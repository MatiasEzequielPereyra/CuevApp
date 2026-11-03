import { createClient } from '@supabase/supabase-js';
import { createHash, randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import pg from 'pg';

const project = 'vbkzoojkdkcugxhneyzi';
const origin = 'https://cueva-gym.vercel.app';
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const stop = code => { throw new Error(code); };

// Standalone trusted-operator tool; never imported by the application.
export function validate(config) {
  const { local, url, site, database, email, target } = config;
  for (const value of [url, site]) {
    const parsed = new URL(value);
    if (parsed.origin !== value) stop('ORIGIN_INVALID');
    if (local && (parsed.protocol !== 'http:' || parsed.hostname !== '127.0.0.1' || !parsed.port)) stop('LOCAL_TARGET_INVALID');
  }
  if (!local && (url !== `https://${project}.supabase.co` || site !== origin)) stop('PROJECT_MISMATCH');
  const db = new URL(database);
  if (db.protocol !== 'postgres:' && db.protocol !== 'postgresql:') stop('DATABASE_INVALID');
  if (local ? db.hostname !== '127.0.0.1' : db.hostname !== `db.${project}.supabase.co`) stop('DATABASE_PROJECT_MISMATCH');
  if (!local && db.port && db.port !== '5432') stop('DATABASE_PORT_INVALID');
  if (db.search || db.hash || db.pathname !== '/postgres') stop('DATABASE_OPTIONS_INVALID');
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) stop('EMAIL_INVALID');
  if (target && !uuid(target)) stop('TARGET_INVALID');
  return config;
}

function dbClient(config) {
  return new pg.Client({ connectionString: config.database, ssl: config.local ? false : { rejectUnauthorized: true }, connectionTimeoutMillis: 10000 });
}

export async function operate(action, config, apply = false) {
  validate(config);
  if (!['invite-first-admin', 'promote-first-admin'].includes(action)) stop('ACTION_INVALID');
  if (action === 'promote-first-admin' && !uuid(config.target)) stop('TARGET_REQUIRED');
  // Dry-run performs no network requests and cannot send mail or update data.
  if (!apply) return { action, mode: 'DRY_RUN', project: config.local ? 'LOCAL_SYNTHETIC' : project, origin: config.site };
  if (!config.key) stop('SERVICE_KEY_REQUIRED');
  const db = dbClient(config);
  const service = createClient(config.url, config.key, {
    ...(config.local && config.fetch ? { global: { fetch: config.fetch } } : {}),
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let transaction = false;
  try {
    await db.connect();
    // All invocations of this tool serialize on one session lock. Other provider
    // operators must be excluded by the maintenance procedure, not this lock.
    const locked = await db.query('select pg_try_advisory_lock(20261103, 1) as acquired');
    if (!locked.rows[0]?.acquired) stop('OPERATOR_BUSY');
    if (action === 'invite-first-admin') {
      const inventory = await db.query('select (select count(*) from auth.users)::int as users, (select count(*) from public.cueva_profiles)::int as profiles');
      if (inventory.rows[0].users !== 0 || inventory.rows[0].profiles !== 0) stop('BOOTSTRAP_NOT_EMPTY_RECONCILE');
      const nonce = randomBytes(32).toString('hex');
      const redirect = new URL('/aceptar-invitacion', config.site);
      redirect.search = new URLSearchParams({ nonce, generation: '1', type: 'invite' }).toString();
      // No retry. Even an exception/timeout may mean mail was sent or user created.
      const invited = await service.auth.admin.inviteUserByEmail(config.email, { redirectTo: redirect.href });
      if (invited.error || !uuid(invited.data.user?.id)) stop('INVITATION_RESULT_REQUIRES_RECONCILIATION');
      const prepared = await service.rpc('cueva_prepare_invitation', { p_user: invited.data.user.id, p_nonce_hash: createHash('sha256').update(nonce).digest('hex') });
      if (prepared.error || prepared.data !== true) stop('INVITATION_PREPARATION_REQUIRES_RECONCILIATION');
      return { action, mode: 'APPLIED', userId: invited.data.user.id };
    }
    await db.query('begin'); transaction = true;
    await db.query('lock table public.cueva_profiles in share row exclusive mode');
    const state = await db.query(`select p.user_id, p.role, u.email, s.ready, s.operation_id,
      (select count(*)::int from public.cueva_profiles) as profiles,
      (select count(*)::int from auth.users) as users,
      exists(select 1 from auth.sessions a where a.user_id=p.user_id and a.created_at>=s.session_not_before) as has_session
      from public.cueva_profiles p join auth.users u on u.id=p.user_id
      join cueva_private.access_state s on s.user_id=p.user_id where p.user_id=$1 for update of p,s,u`, [config.target]);
    const current = state.rows[0];
    if (state.rowCount !== 1 || current.email !== config.email || current.role !== 'alumno' || current.users !== 1 || current.profiles !== 1 || !current.ready || current.operation_id !== null || !current.has_session) stop('PROMOTION_PRECONDITIONS_FAILED');
    const changed = await db.query("update public.cueva_profiles set role='admin' where user_id=$1 and role='alumno' returning user_id", [config.target]);
    if (changed.rowCount !== 1) stop('PROMOTION_ROW_COUNT_FAILED');
    await db.query('commit'); transaction = false;
    return { action, mode: 'APPLIED', affected: 1 };
  } finally {
    if (transaction) await db.query('rollback').catch(() => {});
    await db.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const env = process.env;
    const config = { url: env.CUEVA_SUPABASE_URL, site: env.CUEVA_PRODUCT_ORIGIN, key: env.CUEVA_SERVICE_KEY,
      database: env.CUEVA_OPERATIONS_DATABASE_URL, email: env.CUEVA_FIRST_ADMIN_EMAIL, target: env.CUEVA_FIRST_ADMIN_UUID, local: false };
    const result = await operate(process.argv[2], config, process.argv.includes('--apply'));
    console.log(JSON.stringify(result));
  } catch {
    // Driver/provider errors may embed credentials or access URLs. Never print them.
    console.error('Operación detenida. Revisar el estado antes de repetir; no asumir que no hubo efectos.');
    process.exitCode = 1;
  }
}
