import { chromium } from 'playwright';
import { bootstrap } from '../../scripts/bootstrap-invitation.mjs';

export async function run({ base, rest, mail, site, admin, id, secret, sql, note }) {
  let networkCalls = 0;
  const localFetch = (input, init) => { networkCalls++; const u = new URL(input); const prefix = u.pathname.startsWith('/auth/v1/') ? '/auth/v1' : '/rest/v1'; return fetch(`${prefix === '/auth/v1' ? base : rest}${u.pathname.slice(prefix.length)}${u.search}`, init); };
  const config = { local: true, url: base, site, key: admin, email: `first-${id}@example.com`, fetch: localFetch };
  const messages = async () => (await (await fetch(`${mail}/api/v1/messages`)).json()).messages;
  async function rejected(fn) { try { await fn(); return false; } catch { return true; } }
  const dry = await bootstrap(config);
  note('default_dry_run_no_network', dry.mode === 'DRY_RUN' && networkCalls === 0);
  const initial = await bootstrap(config, 'check');
  note('service_inventory_check_empty_no_mail', initial.empty && initial.profilesCount === 0 && !initial.authUsersPresent && (await messages()).length === 0 && sql('select count(*) from auth.users') === '0');
  const beforeGuard = networkCalls;
  note('wrong_production_build_rejected_before_network', await rejected(() => bootstrap({ ...config, local: false, url: 'https://vbkzoojkdkcugxhneyzi.supabase.co', site: 'https://cueva-gym.vercel.app', deploymentEnvironment: 'preview' }, 'apply')) && networkCalls === beforeGuard);
  note('wrong_project_rejected_before_network', await rejected(() => bootstrap({ ...config, local: false, url: 'https://other.supabase.co' }, 'check')) && networkCalls === beforeGuard);
  const invited = await bootstrap(config, 'apply');
  note('invitation_and_rpc_preparation', invited.mode === 'APPLIED' && invited.role === 'alumno' && sql(`select not ready and nonce_hash is not null and generation=1 from cueva_private.access_state where user_id='${invited.userId}'`) === 't');
  let message;
  for (let i = 0; i < 30; i++) { const list = await messages(); if (list.length) { message = await (await fetch(`${mail}/api/v1/message/${encodeURIComponent(list[0].ID)}`)).json(); break; } await new Promise(resolve => setTimeout(resolve, 300)); }
  if (!message) throw new Error('MAIL_MISSING');
  const beforeDuplicate = (await messages()).length;
  note('duplicate_apply_rejected_no_resend', await rejected(() => bootstrap(config, 'apply')) && (await messages()).length === beforeDuplicate && sql('select count(*) from auth.users') === '1');
  const after = await bootstrap(config, 'check');
  note('inventory_check_after_invite_no_mutation', !after.empty && after.authUsersPresent && after.profilesCount === 1 && (await messages()).length === beforeDuplicate);
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const parser = await browser.newPage(); await parser.setContent(message.HTML);
    const href = await parser.locator('a').getAttribute('href'); await parser.close();
    const link = new URL(href);
    note('literal_rendered_link_has_capability', link.origin === site && link.pathname === '/aceptar-invitacion' && link.searchParams.get('type') === 'invite' && link.searchParams.get('generation') === '1' && /^[0-9a-f]{64}$/.test(link.searchParams.get('nonce') || '') && !!link.searchParams.get('token_hash'));
    const context = await browser.newContext(), page = await context.newPage(); page.setDefaultTimeout(10000);
    await page.goto(href);
    await page.getByRole('button', { name: 'Aceptar y continuar' }).click();
    await page.getByLabel('Contraseña', { exact: true }).fill(`Aa9!${secret()}`);
    await page.getByRole('button', { name: 'Guardar contraseña' }).click();
    note('invited_account_chooses_password_and_activates_as_student', await page.getByText('Perfil: alumno', { exact: true }).count() === 1 && sql(`select ready and operation_id is null from cueva_private.access_state where user_id='${invited.userId}'`) === 't');
    note('no_admin_promoted_by_build_script', sql("select count(*) from public.cueva_profiles where role='admin'") === '0');
    note('hosted_build_secret_email_and_auth', 'NOT_RUN', 'Synthetic loopback services only. No Vercel build, real email or hosted account created.');
  } finally { if (browser) await browser.close(); }
}
