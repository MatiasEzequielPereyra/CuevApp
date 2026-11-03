import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { operate } from '../../scripts/access-operations.mjs';

export async function run({ base, rest, mail, site, admin, database, id, secret, sql, note, stopApp, stopAuth }) {
  const mappedFetch = (input, init) => { const u = new URL(input); const prefix = u.pathname.startsWith('/auth/v1/') ? '/auth/v1' : '/rest/v1'; return fetch(`${prefix === '/auth/v1' ? base : rest}${u.pathname.slice(prefix.length)}${u.search}`, init); };
  const service = createClient(base, admin, { global: { fetch: mappedFetch }, auth: { persistSession: false, autoRefreshToken: false } });
  const email = `first-admin-${id}@example.com`, password = `Aa9!${secret()}`;
  const config = { local: true, url: base, site, key: admin, database, email, fetch: mappedFetch };
  const messages = async () => (await (await fetch(`${mail}/api/v1/messages`)).json()).messages;
  async function nextMail(before) {
    for (let i = 0; i < 30; i++) { const found = (await messages()).find(m => !before.has(m.ID)); if (found) return (await fetch(`${mail}/api/v1/message/${encodeURIComponent(found.ID)}`)).json(); await new Promise(resolve => setTimeout(resolve, 300)); }
    throw new Error('MAIL_MISSING');
  }
  async function mustReject(fn) { try { await fn(); return false; } catch { return true; } }
  const beforeDry = (await messages()).length;
  const dry = await operate('invite-first-admin', config);
  note('bootstrap_default_dry_run_no_effects', dry.mode === 'DRY_RUN' && sql('select count(*) from auth.users') === '0' && (await messages()).length === beforeDry);
  note('bootstrap_wrong_project_rejected', await mustReject(() => operate('invite-first-admin', { ...config, local: false, url: 'https://other.supabase.co' }, true)));
  const invited = await operate('invite-first-admin', config, true), uid = invited.userId;
  note('bootstrap_invitation_prepared', /^[0-9a-f-]{36}$/i.test(uid || '') && sql(`select role from public.cueva_profiles where user_id='${uid}'`) === 'alumno');
  const firstMail = await nextMail(new Set());
  const count = (await messages()).length;
  note('bootstrap_duplicate_stopped_without_resend', await mustReject(() => operate('invite-first-admin', config, true)) && (await messages()).length === count);
  note('bootstrap_promotion_before_activation_rejected', await mustReject(() => operate('promote-first-admin', { ...config, target: uid }, true)));
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext(), page = await context.newPage(); page.setDefaultTimeout(10000);
    const linkFromMail = async (html, expectedType, marker) => {
      const parser = await browser.newPage();
      await parser.setContent(html);
      const href = await parser.locator('a').getAttribute('href');
      const hasMarker = (await parser.locator('h2').textContent()) === marker;
      await parser.close();
      const link = new URL(href);
      const ok = hasMarker && link.origin === site && link.pathname === '/aceptar-invitacion' && /^[0-9a-f]{64}$/.test(link.searchParams.get('nonce') || '') && /^[1-9]\d*$/.test(link.searchParams.get('generation') || '') && link.searchParams.get('type') === expectedType && !!link.searchParams.get('token_hash') && !link.searchParams.has('amp;token_hash') && !link.hash;
      note(`rendered_${expectedType}_exact_template_and_parameters`, ok);
      if (!ok) throw new Error('TEMPLATE_MISMATCH');
      return href;
    };
    const firstHref = await linkFromMail(firstMail.HTML, 'invite', 'Te invitamos a CUEVA');
    // Open the provider-rendered href verbatim. No token extraction, replacement,
    // or synthesized application URL is used to make this test pass.
    await page.goto(firstHref);
    await page.getByRole('button', { name: 'Aceptar y continuar' }).click();
    await page.getByLabel('Contraseña', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Guardar contraseña' }).click();
    note('bootstrap_invitation_own_password', await page.getByText('Perfil: alumno', { exact: true }).count() === 1);
    note('bootstrap_wrong_email_promotion_rejected', await mustReject(() => operate('promote-first-admin', { ...config, target: uid, email: `wrong-${id}@example.com` }, true)));
    const promoted = await operate('promote-first-admin', { ...config, target: uid }, true);
    await page.reload();
    note('bootstrap_exact_admin_promotion', promoted.affected === 1 && await page.getByText('Perfil: admin', { exact: true }).count() === 1 && sql("select count(*) from public.cueva_profiles where role='admin'") === '1');
    note('bootstrap_repeat_promotion_rejected', await mustReject(() => operate('promote-first-admin', { ...config, target: uid }, true)));
    const beforeInvite = new Set((await messages()).map(m => m.ID));
    await page.getByLabel('Correo del alumno').fill(`student-${id}@example.com`);
    await page.getByRole('button', { name: 'Invitar', exact: true }).click();
    const studentMail = await nextMail(beforeInvite);
    const studentHref = await linkFromMail(studentMail.HTML, 'invite', 'Te invitamos a CUEVA');
    const studentId = sql("select user_id from public.cueva_profiles where role='alumno'");
    if (!/^[0-9a-f-]{36}$/i.test(studentId)) throw new Error('FIXTURE_ID');
    const studentContext = await browser.newContext(), studentPage = await studentContext.newPage(); studentPage.setDefaultTimeout(10000);
    await studentPage.goto(studentHref);
    await studentPage.getByRole('button', { name: 'Aceptar y continuar' }).click();
    await studentPage.getByLabel('Contraseña', { exact: true }).fill(`Bb9!${secret()}`);
    await studentPage.getByRole('button', { name: 'Guardar contraseña' }).click();
    note('rendered_student_invitation_completes', await studentPage.getByText('Perfil: alumno', { exact: true }).count() === 1);
    await new Promise(resolve => setTimeout(resolve, 1500));
    const beforeRecovery = new Set((await messages()).map(m => m.ID));
    await page.getByLabel('Identificador del alumno').fill(studentId);
    await page.getByRole('button', { name: 'Enviar recuperación' }).click();
    const recoveryMail = await nextMail(beforeRecovery);
    const recoveryHref = await linkFromMail(recoveryMail.HTML, 'recovery', 'Recuperá tu acceso a CUEVA');
    const recoveryContext = await browser.newContext(), recoveryPage = await recoveryContext.newPage(); recoveryPage.setDefaultTimeout(10000);
    await recoveryPage.goto(recoveryHref);
    await recoveryPage.getByRole('button', { name: 'Aceptar y continuar' }).click();
    await recoveryPage.getByLabel('Contraseña', { exact: true }).fill(`Cc9!${secret()}`);
    await recoveryPage.getByRole('button', { name: 'Guardar contraseña' }).click();
    note('rendered_recovery_completes', await recoveryPage.getByText('Perfil: alumno', { exact: true }).count() === 1);
    // Disallowed external origin must fall back to SiteURL, losing the capability;
    // such fallback is a failure for the product, never accepted as onboarding.
    const beforeDenied = new Set((await messages()).map(m => m.ID));
    const denied = await service.auth.admin.inviteUserByEmail(`external-${id}@example.com`, { redirectTo: 'https://untrusted.invalid/aceptar-invitacion?nonce=bad' });
    if (denied.error) throw new Error('REDIRECT_FIXTURE');
    const deniedMail = await nextMail(beforeDenied), parser = await browser.newPage();
    await parser.setContent(deniedMail.HTML); const deniedHref = await parser.locator('a').getAttribute('href'); await parser.close();
    let fallback;
    try { fallback = new URL(deniedHref, site); } catch { /* SiteURL has no query; appending &token_hash may be an invalid URL. */ }
    note('untrusted_redirect_not_preserved', !deniedHref.includes('untrusted.invalid') && !deniedHref.includes('nonce=') && (!fallback || (fallback.origin === site && fallback.pathname !== '/aceptar-invitacion')), `fallback_url_valid=${!!fallback}; product_capability_missing=true`);
    const packed = (await recoveryContext.cookies()).filter(c => c.name.startsWith('sb-') && c.name.includes('auth-token')).sort((a,b) => a.name.localeCompare(b.name)).map(c => c.value).join('');
    const accessToken = JSON.parse(Buffer.from(packed.slice(7), 'base64url').toString()).access_token;
    const op = '77777777-7777-4777-8777-777777777777';
    const begun = await service.rpc('cueva_begin_operation', { p_user: studentId, p_operation: op, p_kind: 'reset', p_session: null });
    if (begun.error || typeof begun.data !== 'number') throw new Error('INTERRUPTED_FIXTURE');
    note('interrupted_operation_stays_closed', sql(`select ready=false and operation_id='${op}' from cueva_private.access_state where user_id='${studentId}'`) === 't');
    await browser.close(); browser = null;
    await stopApp(); const providerStopped = stopAuth();
    // Exclusive disposable database: terminate remaining provider postgres
    // connections, then observe none. Rest uses a different login role.
    sql("select pg_terminate_backend(pid) from pg_stat_activity where usename='postgres' and pid<>pg_backend_pid()");
    const noProviderBackends = sql("select count(*) from pg_stat_activity where usename='postgres' and pid<>pg_backend_pid()") === '0';
    note('local_quiescence_provider_stopped_and_backends_zero', providerStopped && noProviderBackends);
    if (!providerStopped || !noProviderBackends) throw new Error('QUIESCENCE_FAILED');
    const reconciled = sql(`begin; select user_id from cueva_private.access_state where user_id='${studentId}' for update;
      delete from auth.sessions where user_id='${studentId}';
      update cueva_private.access_state set ready=false,generation=generation+1,allowed_session=null,nonce_hash=null,session_not_before=clock_timestamp(),operation_id=null,operation_kind=null
      where user_id='${studentId}' and operation_id='${op}' and generation=${begun.data} returning 'RECONCILED'; commit;`);
    note('controlled_reconciliation_closed_new_generation', reconciled.includes('RECONCILED') && sql(`select not ready and operation_id is null and allowed_session is null and nonce_hash is null and generation=${begun.data+1} from cueva_private.access_state where user_id='${studentId}'`) === 't');
    const oldVisible = await fetch(`${rest}/cueva_profiles?select=user_id`, { headers: { authorization: `Bearer ${accessToken}` } });
    note('reconciliation_old_session_denied', oldVisible.ok && (await oldVisible.json()).length === 0);
    note('hosted_quiescence_and_email_delivery', 'NOT_RUN', 'Local processes were stopped. Hosted Auth cannot be stopped by this lab; no real email or accounts used.');
  } finally { if (browser) await browser.close(); }
}
