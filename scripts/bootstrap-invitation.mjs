import { createClient } from '@supabase/supabase-js';
import { createHash, randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const project = 'vbkzoojkdkcugxhneyzi';
const vercelProject = 'prj_IuCNdIG2xpwWNgizkrF1kbP1wMPa';
const origin = 'https://cueva-gym.vercel.app';
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
class BootstrapStop extends Error {}
const stop = code => { throw new BootstrapStop(code); };

function validate(config, mode) {
  if (!['dry-run', 'check', 'apply'].includes(mode)) stop('MODE_INVALID');
  for (const value of [config.url, config.site]) {
    let parsed;
    try { parsed = new URL(value); } catch { stop('TARGET_INVALID'); }
    if (parsed.origin !== value) stop('TARGET_INVALID');
    if (config.local && (parsed.protocol !== 'http:' || parsed.hostname !== '127.0.0.1' || !parsed.port)) stop('LOCAL_TARGET_INVALID');
  }
  if (!config.local && (config.url !== `https://${project}.supabase.co` || config.site !== origin)) stop('PROJECT_MISMATCH');
  if (mode !== 'dry-run' && !config.key) stop('SERVICE_KEY_MISSING');
  if (mode === 'apply') {
    if (!config.email || config.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.email)) stop('EMAIL_INVALID');
    if (!config.local && (config.deploymentEnvironment !== 'production' || config.deploymentProject !== vercelProject || !/^[0-9a-f]{40}$/i.test(config.expectedCommit || '') || config.deploymentCommit !== config.expectedCommit)) stop('EXACT_PRODUCTION_BUILD_REQUIRED');
  }
}

// Standalone one-off operator tool. It is never imported by the application or
// added to package.json/build hooks. No direct database credential is required.
export async function bootstrap(config, mode = 'dry-run') {
  validate(config, mode);
  if (mode === 'dry-run') return { mode: 'DRY_RUN', project: config.local ? 'LOCAL_SYNTHETIC' : project, origin: config.site, network: 'NOT_USED' };
  const service = createClient(config.url, config.key, {
    ...(config.local && config.fetch ? { global: { fetch: config.fetch } } : {}),
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const users = await service.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (users.error || !Array.isArray(users.data.users)) stop('AUTH_INVENTORY_FAILED');
  const profiles = await service.from('cueva_profiles').select('user_id', { count: 'exact', head: true }).retry(false);
  if (profiles.error || !Number.isSafeInteger(profiles.count) || profiles.count < 0) stop('PROFILE_INVENTORY_FAILED');
  const inventory = { authUsersPresent: users.data.users.length > 0, profilesCount: profiles.count };
  const empty = !inventory.authUsersPresent && inventory.profilesCount === 0;
  if (mode === 'check') return { mode: 'CHECK', ...inventory, empty };
  if (!empty) stop('NOT_EMPTY_NO_INVITATION_SENT');
  // No cross-service atomicity: the trusted operator must exclude other writers
  // and other invocations before applying. Never retry an ambiguous request.
  const nonce = randomBytes(32).toString('hex');
  const redirect = new URL('/aceptar-invitacion', config.site);
  redirect.search = new URLSearchParams({ nonce, generation: '1', type: 'invite' }).toString();
  let invited;
  try { invited = await service.auth.admin.inviteUserByEmail(config.email, { redirectTo: redirect.href }); }
  catch { stop('INVITATION_AMBIGUOUS_RECONCILE_NO_RETRY'); }
  if (invited.error || !uuid(invited.data.user?.id)) stop('INVITATION_AMBIGUOUS_RECONCILE_NO_RETRY');
  let prepared;
  try { prepared = await service.rpc('cueva_prepare_invitation', { p_user: invited.data.user.id, p_nonce_hash: createHash('sha256').update(nonce).digest('hex') }).retry(false); }
  catch { stop('PREPARATION_AMBIGUOUS_RECONCILE_NO_RETRY'); }
  if (prepared.error || prepared.data !== true) stop('PREPARATION_AMBIGUOUS_RECONCILE_NO_RETRY');
  return { mode: 'APPLIED', userId: invited.data.user.id, role: 'alumno', promotion: 'NOT_PERFORMED' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    if (args.length > 1 || (args.length === 1 && !['--check', '--apply'].includes(args[0]))) stop('ARGUMENTS_INVALID');
    const env = process.env;
    const result = await bootstrap({ url: env.CUEVA_SUPABASE_URL, site: env.CUEVA_PRODUCT_ORIGIN, key: env.CUEVA_SERVICE_KEY,
      email: env.CUEVA_FIRST_ADMIN_EMAIL, expectedCommit: env.CUEVA_BOOTSTRAP_COMMIT_SHA,
      deploymentEnvironment: env.VERCEL_ENV, deploymentProject: env.VERCEL_PROJECT_ID, deploymentCommit: env.VERCEL_GIT_COMMIT_SHA, local: false },
    args[0] === '--apply' ? 'apply' : args[0] === '--check' ? 'check' : 'dry-run');
    console.log(JSON.stringify(result));
  } catch (error) {
    // Only our fixed codes are safe to print; SDK/provider errors can embed keys,
    // email addresses or access URLs. Never print their messages or stacks.
    console.error(JSON.stringify({ mode: 'STOPPED', code: error instanceof BootstrapStop ? error.message : 'UNKNOWN_CHECK_STATE_BEFORE_RETRY' }));
    process.exitCode = 1;
  }
}
