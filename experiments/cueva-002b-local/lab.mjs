import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { writeFile } from 'node:fs/promises';
import * as oidc from 'openid-client';
import { chromium } from 'playwright';

// All identifiers, credentials, and tokens exist only in this process/container.
const image = 'quay.io/keycloak/keycloak@sha256:3e1ac632e743660017b1e6bb4c3ffc800fd02c82cdd0db858cd03456a98a8dfc';
const id = randomUUID().replaceAll('-', '').slice(0, 12);
const container = `cueva-002b-${id}`;
const network = `cueva-002b-net-${id}`;
const secret = () => `T!${randomBytes(24).toString('base64url')}a9`;
const adminPassword = secret();
const temporary = secret();
const replacement = secret();
const replacement2 = secret();
const user = `student-${id}`;
const admin = `admin-${id}`;
const results = [];
let browser, server, diagnosticPage, stage = 'startup', networkCreated = false, containerCreated = false;
const note = (name, status, detail = '') => results.push({ name, status, detail });
const docker = (args, env = {}) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env } }).trim();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function port() { return new Promise((resolve, reject) => { const s = createNetServer(); s.on('error', reject); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); }); }
async function response(url, opts = {}) { return fetch(url, { ...opts, signal: AbortSignal.timeout(10000) }); }

try {
  const kcPort = await port();
  const callbackPort = await port();
  const base = `http://127.0.0.1:${kcPort}`;
  const callback = `http://127.0.0.1:${callbackPort}/callback`;
  let callbackUrl = null;
  server = createServer((req, res) => { callbackUrl = new URL(req.url, callback); res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }); res.end('Laboratorio local'); });
  await new Promise((resolve, reject) => { server.on('error', reject); server.listen(callbackPort, '127.0.0.1', resolve); });
  docker(['network', 'create', '--driver', 'bridge', network]); networkCreated = true;
  docker(['run', '-d', '--rm', '--name', container, '--network', network, '--memory', '1g', '--cpus', '2', '--log-driver', 'none', '-p', `127.0.0.1:${kcPort}:8080`, '-e', 'KC_BOOTSTRAP_ADMIN_USERNAME', '-e', 'KC_BOOTSTRAP_ADMIN_PASSWORD', '-e', 'KC_HOSTNAME', image, 'start-dev'], { KC_BOOTSTRAP_ADMIN_USERNAME: admin, KC_BOOTSTRAP_ADMIN_PASSWORD: adminPassword, KC_HOSTNAME: base });
  containerCreated = true;
  let ready = false;
  for (let i = 0; i < 90; i++) { try { if ((await response(`${base}/realms/master/.well-known/openid-configuration`)).ok) { ready = true; break; } } catch {} await sleep(1000); }
  if (!ready) throw new Error('KEYCLOAK_NOT_READY');
  const tokenResponse = await response(`${base}/realms/master/protocol/openid-connect/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'password', client_id: 'admin-cli', username: admin, password: adminPassword }) });
  if (!tokenResponse.ok) throw new Error(`ADMIN_TOKEN_HTTP_${tokenResponse.status}`);
  const adminToken = (await tokenResponse.json()).access_token;
  async function api(path, method = 'GET', body) {
    const r = await response(`${base}${path}`, { method, headers: { authorization: `Bearer ${adminToken}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    if (!r.ok) throw new Error(`ADMIN_API_${method}_${r.status}`);
    return r.status === 204 || r.status === 201 ? null : r.json();
  }
  const adminUsers = await api(`/admin/realms/master/users?username=${encodeURIComponent(admin)}&exact=true`);
  if (adminUsers.length !== 1 || !adminUsers[0].id) throw new Error('ADMIN_LOOKUP_FAILED');
  const expectedAdminId = adminUsers[0].id;
  await api('/admin/realms', 'POST', { realm: 'cueva-lab', enabled: true, registrationAllowed: false, resetPasswordAllowed: false, loginWithEmailAllowed: true, duplicateEmailsAllowed: false, eventsEnabled: true, eventsListeners: ['jboss-logging'], adminEventsEnabled: true, adminEventsDetailsEnabled: false, passwordPolicy: 'passwordHistory(3)', clients: [{ clientId: 'cueva-client', enabled: true, publicClient: true, standardFlowEnabled: true, directAccessGrantsEnabled: false, implicitFlowEnabled: false, redirectUris: [callback], webOrigins: [base], attributes: { 'pkce.code.challenge.method': 'S256' } }] });
  // The default profile requests email/name after password change. Remove those requirements for this synthetic no-email realm.
  const profile = await api('/admin/realms/cueva-lab/users/profile');
  for (const attribute of profile.attributes) if (['email', 'firstName', 'lastName'].includes(attribute.name)) delete attribute.required;
  await api('/admin/realms/cueva-lab/users/profile', 'PUT', profile);
  await api('/admin/realms/cueva-lab/users', 'POST', { username: user, enabled: true, emailVerified: false, credentials: [{ type: 'password', value: temporary, temporary: true }] });
  const users = await api(`/admin/realms/cueva-lab/users?username=${encodeURIComponent(user)}&exact=true`);
  if (users.length !== 1) throw new Error('USER_LOOKUP_FAILED');
  const uid = users[0].id;
  note('fixture_without_email_phone', !users[0].email && !users[0].phone ? 'PASS' : 'FAIL');
  const issuer = new URL(`${base}/realms/cueva-lab`);
  const config = await oidc.discovery(issuer, 'cueva-client', undefined, oidc.None(), { execute: [oidc.allowInsecureRequests] });
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage(); diagnosticPage = page;
  async function begin() {
    callbackUrl = null;
    const verifier = oidc.randomPKCECodeVerifier(); const state = oidc.randomState(); const nonce = oidc.randomNonce();
    const challenge = await oidc.calculatePKCECodeChallenge(verifier);
    const url = oidc.buildAuthorizationUrl(config, { redirect_uri: callback, scope: 'openid', response_type: 'code', code_challenge: challenge, code_challenge_method: 'S256', state, nonce });
    await page.goto(url.href, { waitUntil: 'domcontentloaded' });
    return { verifier, state, nonce };
  }
  async function login(password) { await page.locator('#username').fill(user); await page.locator('#password').fill(password); await page.locator('#kc-login').click(); await page.waitForLoadState('domcontentloaded'); }
  async function grant(checks) { if (!callbackUrl) throw new Error('CALLBACK_NOT_RECEIVED'); return oidc.authorizationCodeGrant(config, callbackUrl, { pkceCodeVerifier: checks.verifier, expectedState: checks.state, expectedNonce: checks.nonce }); }
  let flow = await begin(); await login(temporary);
  const needsChange = await page.locator('#password-new').count() === 1;
  note('initial_temporary_blocks_code', needsChange && callbackUrl === null ? 'PASS' : 'FAIL');
  await page.locator('#password-new').fill(temporary); await page.locator('#password-confirm').fill(temporary); await page.locator('input[type=submit],button[type=submit]').first().click(); await page.waitForLoadState('domcontentloaded');
  note('temporary_reuse_rejected', await page.locator('#password-new').count() === 1 && callbackUrl === null ? 'PASS' : 'FAIL');
  stage = 'submit_replacement'; await page.locator('#password-new').fill(replacement); await page.locator('#password-confirm').fill(replacement); await page.locator('input[type=submit],button[type=submit]').first().click(); await page.waitForURL(`${callback}*`);
  stage = 'grant_first'; const tokens = await grant(flow); const claims = tokens.claims();
  note('new_password_session', claims?.sub === uid && !!tokens.access_token && !!tokens.refresh_token ? 'PASS' : 'FAIL', 'OIDC library validated state, nonce and PKCE; subject matched fixture.');
  stage = 'events'; const events = await api(`/admin/realms/cueva-lab/events?user=${encodeURIComponent(uid)}&max=100`);
  const changes = events.filter(e => e.type === 'UPDATE_CREDENTIAL');
  note('event_observation', changes.length ? 'OBSERVED' : 'NOT_OBSERVED', `UPDATE_CREDENTIAL count=${changes.length}; same subject=${changes.some(e => e.userId === uid)}; client=${changes.some(e => e.clientId === 'cueva-client')}; event session present=${changes.some(e => !!e.sessionId)}; token sid present=${!!claims?.sid}; session matches token=${changes.some(e => e.sessionId && e.sessionId === claims?.sid)}. Does not alone prove reset correlation or replay resistance.`);
  let ctx2, p2;
  // Reuse the same flow helpers with a fresh page by using a second authorization flow directly.
  async function freshLogin(password, loginUser = user) {
    if (ctx2) await ctx2.close(); ctx2 = await browser.newContext(); p2 = await ctx2.newPage();
    callbackUrl = null; const verifier = oidc.randomPKCECodeVerifier(); const state = oidc.randomState(); const nonce = oidc.randomNonce();
    const url = oidc.buildAuthorizationUrl(config, { redirect_uri: callback, scope: 'openid', response_type: 'code', code_challenge: await oidc.calculatePKCECodeChallenge(verifier), code_challenge_method: 'S256', state, nonce, prompt: 'login' });
    await p2.goto(url.href); await p2.locator('#username').fill(loginUser); await p2.locator('#password').fill(password); await p2.locator('#kc-login').click(); await p2.waitForLoadState('domcontentloaded');
    return { verifier, state, nonce };
  }
  // Independent fixture: establish a session, then perform a specific administrative reset
  // and complete the required action as the user. Event IDs are compared in memory only.
  stage = 'post_reset_fixture';
  const postUser = `post-reset-${id}`;
  const postInitial = secret(), postTemporary = secret(), postReplacement = secret();
  await api('/admin/realms/cueva-lab/users', 'POST', { username: postUser, enabled: true, credentials: [{ type: 'password', value: postInitial, temporary: false }] });
  const postUsers = await api(`/admin/realms/cueva-lab/users?username=${encodeURIComponent(postUser)}&exact=true`);
  if (postUsers.length !== 1) throw new Error('USER_LOOKUP_FAILED');
  const postUid = postUsers[0].id;
  note('post_reset_fixture_without_email_phone', !postUsers[0].email && !postUsers[0].phone ? 'PASS' : 'FAIL');
  let postFlow = await freshLogin(postInitial, postUser);
  await p2.waitForURL(`${callback}*`);
  const initialPostSession = await grant(postFlow);
  note('post_reset_initial_session', initialPostSession.claims()?.sub === postUid && !!initialPostSession.access_token ? 'PASS' : 'FAIL');
  const previousUserEvents = await api(`/admin/realms/cueva-lab/events?user=${encodeURIComponent(postUid)}&max=100`);
  const previousAdminEvents = await api('/admin/realms/cueva-lab/admin-events?max=100');
  const oldUserEventIds = new Set(previousUserEvents.map(e => e.id).filter(Boolean));
  const oldAdminEventIds = new Set(previousAdminEvents.map(e => e.id).filter(Boolean));
  stage = 'post_reset_admin_reset';
  await api(`/admin/realms/cueva-lab/users/${postUid}/reset-password`, 'PUT', { type: 'password', value: postTemporary, temporary: true });
  const postResetAdminEvents = await api('/admin/realms/cueva-lab/admin-events?max=100');
  const newResetEvents = postResetAdminEvents.filter(e => !oldAdminEventIds.has(e.id) && e.resourcePath === `users/${postUid}/reset-password`);
  const resetEvent = newResetEvents[0];
  const resetEventPass = newResetEvents.length === 1 && !!resetEvent.id && resetEvent.authDetails?.userId === expectedAdminId && resetEvent.resourcePath === `users/${postUid}/reset-password`;
  note('post_reset_admin_event', resetEventPass ? 'PASS' : 'FAIL', `new matching reset events=${newResetEvents.length}; ID present=${!!resetEvent?.id}; actor matches expected admin=${resetEvent?.authDetails?.userId === expectedAdminId}; path matches synthetic user=${resetEvent?.resourcePath === `users/${postUid}/reset-password`}.`);
  stage = 'post_reset_user_change';
  postFlow = await freshLogin(postTemporary, postUser);
  const postRequired = await p2.locator('#password-new').count() === 1 && callbackUrl === null;
  note('post_reset_required_before_session', postRequired ? 'PASS' : 'FAIL');
  await p2.locator('#password-new').fill(postReplacement);
  await p2.locator('#password-confirm').fill(postReplacement);
  await p2.locator('input[type=submit],button[type=submit]').first().click();
  await p2.waitForURL(`${callback}*`);
  const postSession = await grant(postFlow);
  const postClaims = postSession.claims();
  note('post_reset_new_session', postClaims?.sub === postUid && !!postSession.access_token && !!postClaims?.sid ? 'PASS' : 'FAIL', `subject matches fixture=${postClaims?.sub === postUid}; client validated by OIDC library=true; sid present=${!!postClaims?.sid}; initial and new sid differ=${!!initialPostSession.claims()?.sid && !!postClaims?.sid && initialPostSession.claims().sid !== postClaims.sid}.`);
  const postUserEvents = await api(`/admin/realms/cueva-lab/events?user=${encodeURIComponent(postUid)}&max=100`);
  const postChanges = postUserEvents.filter(e => e.type === 'UPDATE_CREDENTIAL' && !oldUserEventIds.has(e.id));
  const postLogins = postUserEvents.filter(e => e.type === 'LOGIN' && e.id && !oldUserEventIds.has(e.id));
  const changeEvent = postChanges[0];
  const changeEventPass = postChanges.length === 1 && !!changeEvent.id && changeEvent.userId === postUid && changeEvent.clientId === 'cueva-client';
  note('post_reset_change_event', changeEventPass ? 'PASS' : 'FAIL', `new credential events=${postChanges.length}; subject matches=${postChanges.some(e => e.userId === postUid)}; client matches=${postChanges.some(e => e.clientId === 'cueva-client')}; event session present=${postChanges.some(e => !!e.sessionId)}; event session matches new token sid=${postChanges.some(e => !!e.sessionId && e.sessionId === postClaims?.sid)}; event detail keys=${[...new Set(postChanges.flatMap(e => Object.keys(e.details || {})))].sort().join(',') || 'none'}.`);
  note('post_reset_login_event', 'OBSERVED', `new login events=${postLogins.length}; subject and client match=${postLogins.some(e => e.userId === postUid && e.clientId === 'cueva-client')}; event session present=${postLogins.some(e => !!e.sessionId)}; event session matches new token sid=${postLogins.some(e => !!e.sessionId && e.sessionId === postClaims?.sid)}.`);
  note('post_reset_code_id_comparison', 'OBSERVED', `change code_id present=${postChanges.some(e => !!e.details?.code_id)}; login code_id present=${postLogins.some(e => !!e.details?.code_id)}; same nonempty code_id=${postChanges.some(c => !!c.details?.code_id && postLogins.some(l => l.details?.code_id === c.details.code_id))}; equality is an observation, not a documented guarantee of reset-generation binding.`);
  note('post_reset_correlation', 'BLOCKED', 'The controlled sequence and new event IDs distinguish observations; no provider-supplied reset-generation link to the change and resulting session has been established.');

  stage = 'old_password'; await freshLogin(temporary);
  note('old_password_rejected', await p2.locator('#password').count() === 1 && callbackUrl === null ? 'PASS' : 'FAIL');
  stage = 'repeat_login'; flow = await freshLogin(replacement); await p2.waitForURL(`${callback}*`); const second = await grant(flow);
  note('second_login_without_change', second.claims()?.sub === uid ? 'PASS' : 'FAIL');
  stage = 'direct_grant'; const direct = await response(`${base}/realms/cueva-lab/protocol/openid-connect/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'password', client_id: 'cueva-client', username: user, password: replacement }) });
  note('direct_grant_disabled', direct.status >= 400 ? 'PASS' : 'FAIL', `HTTP ${direct.status}`);
  stage = 'reset'; const resetTime = Date.now();
  await api(`/admin/realms/cueva-lab/users/${uid}/reset-password`, 'PUT', { type: 'password', value: replacement2, temporary: true });
  const adminEvents = await api('/admin/realms/cueva-lab/admin-events?max=100');
  const resetEvents = adminEvents.filter(e => e.resourcePath?.includes(`users/${uid}/reset-password`));
  note('admin_reset_event', 'OBSERVED', `matching resource path count=${resetEvents.length}; event id present=${resetEvents.some(e => !!e.id)}; actor metadata present=${resetEvents.some(e => !!e.authDetails?.userId)}; no reset generation identifier linked to subsequent user event is established.`);
  const eventsAgain = await api(`/admin/realms/cueva-lab/events?user=${encodeURIComponent(uid)}&max=100`);
  note('old_duplicate_event_observation', 'OBSERVED', `prior credential event still returned after reset=${changes.some(e => e.time <= resetTime && eventsAgain.some(x => x.id && x.id === e.id))}; repeated read is not delivery or replay protection.`);
  let refreshAccepted = false, refreshedTokens; try { refreshedTokens = await oidc.refreshTokenGrant(config, second.refresh_token); refreshAccepted = true; } catch {}
  note('refresh_after_admin_reset', 'OBSERVED', `previous refresh ${refreshAccepted ? 'accepted' : 'rejected'}; Keycloak only, not Supabase.`);
  stage = 'sso_after_reset'; callbackUrl = null; await begin();
  const ssoReceived = callbackUrl !== null || page.url().startsWith(callback);
  note('sso_after_reset', 'OBSERVED', `prior browser SSO emitted callback=${ssoReceived}; pending action page=${await page.locator('#password-new').count() === 1}.`);
  stage = 'abandon'; await freshLogin(replacement2);
  note('abandon_change', callbackUrl === null && await p2.locator('#password-new').count() === 1 ? 'PASS' : 'FAIL', 'Fresh browser left required action without callback.');
  stage = 'remove_action'; const current = await api(`/admin/realms/cueva-lab/users/${uid}`);
  const filtered = (current.requiredActions || []).filter(action => action !== 'UPDATE_PASSWORD');
  await api(`/admin/realms/cueva-lab/users/${uid}`, 'PUT', { ...current, requiredActions: filtered });
  const refreshed = await api(`/admin/realms/cueva-lab/users/${uid}`);
  note('admin_action_removal', !(refreshed.requiredActions || []).includes('UPDATE_PASSWORD') ? 'OBSERVED' : 'NOT_OBSERVED', 'Privileged IdP operator removed action; no claim about unprivileged users.');
  stage = 'admin_removal_login'; flow = await freshLogin(replacement2);
  let adminBypass = false;
  if (callbackUrl) { const bypassTokens = await grant(flow); adminBypass = bypassTokens.claims()?.sub === uid; }
  note('admin_removal_login', 'OBSERVED', `after privileged operator removes action, temporary credential yields consumer session=${adminBypass}; required action displayed=${await p2.locator('#password-new').count() === 1}.`);
  stage = 'admin_logout'; await api(`/admin/realms/cueva-lab/users/${uid}/logout`, 'POST');
  let afterLogoutAccepted = false; if (refreshedTokens?.refresh_token) { try { await oidc.refreshTokenGrant(config, refreshedTokens.refresh_token); afterLogoutAccepted = true; } catch {} }
  note('refresh_after_admin_logout', refreshedTokens?.refresh_token ? 'OBSERVED' : 'NOT_RUN', `refresh obtained after reset accepted after explicit user logout=${afterLogoutAccepted}; access-token expiry and cross-provider revocation not tested.`);
  stage = 'concurrent_reset'; const raceUser = `race-${id}`; const raceInitial = secret(); const raceA = secret(); const raceB = secret();
  await api('/admin/realms/cueva-lab/users', 'POST', { username: raceUser, enabled: true, credentials: [{ type: 'password', value: raceInitial, temporary: true }] });
  const raceUsers = await api(`/admin/realms/cueva-lab/users?username=${encodeURIComponent(raceUser)}&exact=true`);
  const raceId = raceUsers[0].id;
  const raceOutcomes = await Promise.allSettled([raceA, raceB].map(value => api(`/admin/realms/cueva-lab/users/${raceId}/reset-password`, 'PUT', { type: 'password', value, temporary: true })));
  const accepted = [];
  for (const value of [raceA, raceB]) { await freshLogin(value, raceUser); accepted.push(await p2.locator('#password-new').count() === 1 && callbackUrl === null); }
  note('reset_concurrent', 'OBSERVED', `fulfilled admin requests=${raceOutcomes.filter(x => x.status === 'fulfilled').length}; rejected=${raceOutcomes.filter(x => x.status === 'rejected').map(x => String(x.reason?.message).match(/^ADMIN_API_PUT_\d+$/)?.[0] || 'OTHER').join(',') || 'none'}; credentials reaching mandatory change=${accepted.filter(Boolean).length} of 2; no ordering or transaction guarantee inferred.`);
  note('duplicate_event_delivery', 'NOT_RUN', 'Repeated event query was observed; delivery, deduplication and a trusted correlation consumer do not exist in this lab.');
  note('E3_end_to_end', 'BLOCKED', 'The event observation does not establish trusted correlation of reset generation, actor and authorized consumer session.');
  await ctx2.close();
  await context.close();
} catch (error) {
  // Only structural diagnostics; never output page contents, URLs, credentials or tokens.
  if (diagnosticPage) { try { note('diagnostic', 'OBSERVED', `stage=${stage}; password-new=${await diagnosticPage.locator('#password-new').count()}; username=${await diagnosticPage.locator('#username').count()}; email=${await diagnosticPage.locator('#email').count()}; firstName=${await diagnosticPage.locator('#firstName').count()}; alert=${await diagnosticPage.locator('.alert-error,.alert-danger').count()}; errorType=${error.name}`); } catch {} }
  note('execution', 'BLOCKED', String(error.message).match(/^(?:KEYCLOAK_NOT_READY|USER_LOOKUP_FAILED|ADMIN_LOOKUP_FAILED|CALLBACK_NOT_RECEIVED|ADMIN_(?:TOKEN_HTTP|API_[A-Z]+)_\d+)$/)?.[0] || 'Unexpected error; diagnostic details deliberately withheld.');
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server) await new Promise(resolve => server.close(resolve));
  if (containerCreated) { try { docker(['stop', container]); note('container_cleanup', 'PASS'); } catch { note('container_cleanup', 'FAIL'); } }
  if (networkCreated) { try { docker(['network', 'rm', network]); note('network_cleanup', 'PASS'); } catch { note('network_cleanup', 'FAIL'); } }
  const report = { date: new Date().toISOString(), image, results };
  await writeFile('results.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  if (results.some(r => ['FAIL', 'BLOCKED'].includes(r.status) && !['E3_end_to_end', 'post_reset_correlation'].includes(r.name))) process.exitCode = 1;
}
