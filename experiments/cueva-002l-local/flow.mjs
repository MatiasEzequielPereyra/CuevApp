import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { bootstrap } from '../../scripts/bootstrap-invitation.mjs';

export async function run({ base, rest, mail, site, anon, admin, id, secret, sql, note, restart, setBindFault }) {
  const mapped = (input, init) => { const u = new URL(input); const prefix = u.pathname.startsWith('/auth/v1/') ? '/auth/v1' : '/rest/v1'; return fetch(`${prefix === '/auth/v1' ? base : rest}${u.pathname.slice(prefix.length)}${u.search}`, init); };
  const options = { global: { fetch: mapped }, auth: { persistSession: false, autoRefreshToken: false } };
  const service = createClient(base, admin, options), client = createClient(base, anon, options);
  const ownerEmail = `owner-${id}@example.com`, password = `Aa9!${secret()}`;
  const messages = async () => (await (await fetch(`${mail}/api/v1/messages`)).json()).messages;
  async function nextMail(before) {
    for (let i = 0; i < 30; i++) { const found = (await messages()).find(m => !before.has(m.ID)); if (found) return (await fetch(`${mail}/api/v1/message/${encodeURIComponent(found.ID)}`)).json(); await new Promise(resolve => setTimeout(resolve, 300)); }
    throw new Error('MAIL_MISSING');
  }
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const negativeContext = await browser.newContext();
    const post = (body, origin = site) => negativeContext.request.post(`${site}/api/acceso/owner-invitacion`, { form: body, headers: { origin }, maxRedirects: 0 });
    const noCookies = async () => (await negativeContext.cookies()).filter(c => c.name.startsWith('sb-')).length === 0;
    // Independent attack fixture: password-authenticated owner with a pending
    // nonce. No ready bypass. Remove only this synthetic fixture before bootstrap.
    const fixture = await service.auth.admin.createUser({ email: ownerEmail, password, email_confirm: true });
    if (fixture.error || !fixture.data.user) throw new Error('FIXTURE_ID');
    const passwordNonce = secret();
    const prepareFixture = await service.rpc('cueva_prepare_invitation', { p_user: fixture.data.user.id, p_nonce_hash: createHash('sha256').update(passwordNonce).digest('hex') });
    if (prepareFixture.error || prepareFixture.data !== true) throw new Error('FIXTURE_ID');
    const logged = await client.auth.signInWithPassword({ email: ownerEmail, password });
    if (logged.error || !logged.data.session) throw new Error('FIXTURE_ID');
    const passwordSession = logged.data.session;
    const passwordClaims = JSON.parse(Buffer.from(passwordSession.access_token.split('.')[1], 'base64url').toString());
    const passwordBody = { access_token: passwordSession.access_token, refresh_token: passwordSession.refresh_token, nonce: passwordNonce, generation: '1', type: 'invite' };
    const passwordResult = await post(passwordBody);
    note('password_amr_with_valid_owner_nonce_rejected', passwordClaims.amr?.length === 1 && passwordClaims.amr[0].method === 'password' && passwordResult.status() === 401 && await noCookies() && sql(`select allowed_session is null and not ready from cueva_private.access_state where user_id='${fixture.data.user.id}'`) === 't');
    const forged = passwordSession.access_token.split('.');
    forged[1] = Buffer.from(JSON.stringify({ ...passwordClaims, amr: [{ method: 'otp', timestamp: Math.floor(Date.now()/1000) }] })).toString('base64url');
    const forgedResult = await post({ ...passwordBody, access_token: forged.join('.') });
    note('forged_otp_claim_rejected_by_real_auth_no_cookie', forgedResult.status() === 401 && await noCookies());
    const removed = await service.auth.admin.deleteUser(fixture.data.user.id);
    if (removed.error || sql('select count(*) from auth.users') !== '0' || sql('select count(*) from public.cueva_profiles') !== '0') throw new Error('FIXTURE_ID');
    const beforeOwnerMail = new Set((await messages()).map(m => m.ID));
    const invited = await bootstrap({ local: true, url: base, site, key: admin, email: ownerEmail, fetch: mapped }, 'apply');
    const message = await nextMail(beforeOwnerMail);
    async function literalHref(html) { const parser = await browser.newPage(); await parser.setContent(html); const href = await parser.locator('a').getAttribute('href'); await parser.close(); return href; }
    const href = await literalHref(message.HTML);
    const defaultLink = new URL(href);
    note('real_default_template_links_to_real_auth_loopback', defaultLink.origin === base && defaultLink.pathname === '/verify' && defaultLink.searchParams.get('type') === 'invite');
    const context = await browser.newContext(), page = await context.newPage(); page.setDefaultTimeout(10000);
    let callback;
    page.on('response', response => { if (new URL(response.url()).origin === base && new URL(response.url()).pathname === '/verify') { const location = response.headers()['location']; if (location) callback = new URL(location); } });
    // Provider URL and its Location are used literally; no translated email link.
    await page.goto(href);
    await page.waitForFunction(() => window.location.hash === '');
    if (!callback) throw new Error('DEFAULT_LINK_INVALID');
    const fragment = new URLSearchParams(callback.hash.slice(1));
    const session = { access_token: fragment.get('access_token'), refresh_token: fragment.get('refresh_token') };
    if (!session.access_token || !session.refresh_token) throw new Error('DEFAULT_LINK_INVALID');
    const claims = JSON.parse(Buffer.from(session.access_token.split('.')[1], 'base64url').toString());
    const nonce = callback.searchParams.get('nonce');
    const body = { ...session, nonce, generation: '1', type: 'invite' };
    const verified = await service.auth.getUser(session.access_token);
    note('provider_default_invite_amr_otp_observed', claims.amr?.length === 1 && claims.amr[0].method === 'otp' && verified.data.user?.id === invited.userId && !verified.error, 'Pinned GoTrue emits otp for default invite; not the invite string listed among possible documented methods.');
    note('fragment_removed_and_tokens_not_persisted_in_browser', new URL(page.url()).hash === '' && await page.evaluate(() => !Object.keys(localStorage).some(k => /auth|supabase/i.test(k)) && sessionStorage.length === 0) && !(await page.content()).includes(session.access_token) && !(await page.content()).includes(admin));
    const wrongNonce = await post({ ...body, nonce: '0'.repeat(64) });
    const wrongGeneration = await post({ ...body, generation: '2' });
    const wrongOrigin = await post(body, 'http://untrusted.invalid');
    note('nonce_generation_origin_rejected_before_cookie', wrongNonce.status() === 409 && wrongGeneration.status() === 400 && wrongOrigin.status() === 403 && await noCookies());
    const beforeOther = new Set((await messages()).map(m => m.ID));
    const other = await service.auth.admin.inviteUserByEmail(`other-${id}@example.com`, { redirectTo: callback.origin + callback.pathname + callback.search });
    if (other.error) throw new Error('FIXTURE_ID');
    const otherHref = await literalHref((await nextMail(beforeOther)).HTML);
    const otherResponse = await fetch(otherHref, { redirect: 'manual' });
    const otherFragment = new URLSearchParams(new URL(otherResponse.headers.get('location')).hash.slice(1));
    const wrongOwner = await post({ ...body, access_token: otherFragment.get('access_token'), refresh_token: otherFragment.get('refresh_token') });
    note('other_real_otp_owner_rejected_no_cookie', wrongOwner.status() === 401 && await noCookies());
    for (const fault of ['http503', 'drop']) {
      setBindFault(fault);
      const failed = await post(body);
      note(`bind_${fault}_discards_pending_cookies`, failed.status() === 503 && await noCookies() && sql(`select allowed_session is null and nonce_hash is not null and not ready from cueva_private.access_state where user_id='${invited.userId}'`) === 't');
    }
    const [accepted] = await Promise.all([page.waitForResponse(r => new URL(r.url()).pathname === '/api/acceso/owner-invitacion' && r.request().method() === 'POST'), page.getByRole('button', { name: 'Aceptar y continuar' }).click()]);
    await page.waitForURL(`${site}/crear-contrasena`);
    note('default_owner_fragment_explicit_post_binds_session', accepted.status() === 204 && sql(`select not ready and allowed_session='${claims.session_id}' and nonce_hash is null from cueva_private.access_state where user_id='${invited.userId}'`) === 't');
    const replay = await post(body);
    note('owner_fragment_replay_rejected_no_cookie', replay.status() === 409 && await noCookies());
    await page.goto(`${site}/cuenta`);
    note('data_denied_before_owner_chooses_password', await page.getByRole('heading', { name: 'Acceso no disponible' }).count() === 1);
    await page.goto(`${site}/crear-contrasena`);
    await page.getByLabel('Contraseña', { exact: true }).fill(`Bb9!${secret()}`);
    await page.getByRole('button', { name: 'Guardar contraseña' }).click();
    note('owner_chooses_own_password_then_student_profile', await page.getByText('Perfil: alumno', { exact: true }).count() === 1);
    const cookies = await context.cookies();
    note('owner_session_cookie_http_only', cookies.some(c => c.name.startsWith('sb-') && c.httpOnly && c.sameSite === 'Lax'));
    // Only a synthetic UI-restriction fixture, not a promotion feature of L.
    sql(`update public.cueva_profiles set role='admin' where user_id='${invited.userId}'`);
    await page.reload();
    const mailCount = (await messages()).length;
    const blockedInvite = await context.request.post(`${site}/api/acceso/admin-invitar`, { form: { email: `blocked-${id}@example.com` }, headers: { origin: site } });
    const blockedReset = await context.request.post(`${site}/api/acceso/admin-recuperar`, { form: { user_id: invited.userId }, headers: { origin: site } });
    note('owner_only_admin_actions_hidden_and_server_blocked', await page.getByRole('button', { name: 'Invitar', exact: true }).count() === 0 && await page.getByText('Las invitaciones y la recuperación de alumnos estarán disponibles cuando terminemos de configurar el correo del gimnasio.').count() === 1 && blockedInvite.status() === 503 && blockedReset.status() === 503 && (await messages()).length === mailCount);
    await browser.close(); browser = null;
    await restart(false);
    const closed = await fetch(`${site}/api/acceso/owner-invitacion`, { method: 'POST', headers: { origin: site, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body) });
    note('temporary_owner_flag_off_rejects_callback', closed.status === 404);
    note('hosted_default_mail_owner_flow', 'NOT_RUN', 'Synthetic local Auth/Mailpit only. No hosted SMTP settings, real account or email changed by executor.');
  } finally { if (browser) await browser.close(); }
}
