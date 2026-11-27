// Native browser + local Auth and PostgREST. Never log cookie values or credentials.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { combineChunks, createChunks, isChunkLike } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { chromium, expect } from "@playwright/test";
import pg from "pg";

const { API_URL, DB_URL, CUEVA_PRODUCT_ORIGIN: origin, CUEVA_PUBLISHABLE_KEY, CUEVA_SERVICE_KEY } = process.env;
for (const value of [API_URL, DB_URL, origin]) assert.equal(new URL(value).hostname, "127.0.0.1");
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(API_URL, CUEVA_SERVICE_KEY, options);
const db = new pg.Client({ connectionString: DB_URL });
const preference = "cueva-session-retention";
const authKey = "sb-127-auth-token";
const isAuthCookie = name => isChunkLike(name, authKey) || isChunkLike(name, `${authKey}-code-verifier`);
const users = [];
let phase = "setup";

async function account(role, ready = true) {
  const email = `${role}-${randomUUID()}@example.test`;
  const password = `Cueva!9-${randomUUID()}`;
  const { data, error } = await service.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { full_name: "Prueba Sesión", session_fixture: "x".repeat(1200) },
  });
  assert.ok(!error && data.user, "synthetic account created");
  const id = data.user.id;
  users.push(id);
  await db.query("insert into public.cueva_profiles(user_id,role) values ($1,$2)", [id, role]);
  await db.query("insert into cueva_private.access_state(user_id,ready,session_not_before) values ($1,$2,now()-interval '1 minute')", [id, ready]);
  return { email, password, id };
}

async function openLogin(page, path = "/ingresar") {
  await page.goto(origin + path);
  await expect(page).toHaveURL(origin + "/ingresar");
  await expect(page.getByRole("checkbox", { name: "Mantener sesión iniciada" })).not.toBeChecked();
  await expect(page.getByLabel("Correo electrónico")).toBeVisible();
}

async function login(page, { email, password }, remember) {
  await openLogin(page, "/");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  if (remember) await page.getByRole("checkbox", { name: "Mantener sesión iniciada" }).press("Space");
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(page).toHaveURL(origin + "/cuenta");
}

async function storedSession(context, mode) {
  const all = await context.cookies(origin);
  const fragments = all.filter(cookie => isChunkLike(cookie.name, authKey));
  assert.ok(fragments.length >= 2, "fixture exercises fragmented auth cookies");
  const setting = all.find(cookie => cookie.name === preference);
  assert.equal(setting?.value, mode === "legacy" ? undefined : mode);
  for (const cookie of setting ? [...fragments, setting] : fragments) {
    assert.ok(cookie.httpOnly && cookie.sameSite === "Lax" && cookie.path === "/", "protected cookie attributes");
    if (mode === "session") assert.equal(cookie.expires, -1, "no persistent expiry");
    else assert.ok(cookie.expires > Date.now() / 1000 + 365 * 86400, "long-lived expiry");
  }
  const encoded = await combineChunks(authKey, name => fragments.find(cookie => cookie.name === name)?.value);
  assert.ok(encoded?.startsWith("base64-"));
  const session = JSON.parse(Buffer.from(encoded.slice("base64-".length), "base64url").toString());
  return { session, fragments };
}

async function refresh(context, mode, path, realExpiry = false) {
  const before = await storedSession(context, mode);
  if (realExpiry) {
    // This optional local pass uses real short-lived JWTs issued by isolated Auth.
    const claims = JSON.parse(Buffer.from(before.session.access_token.split(".")[1], "base64url").toString());
    const remaining = claims.exp * 1000 - Date.now();
    assert.ok(remaining <= 150_000, "real-expiry stack must issue short JWTs");
    await delay(Math.max(0, remaining + 1_100));
    const expired = await service.auth.getUser(before.session.access_token);
    assert.ok(expired.error && !expired.data.user, "Auth rejects the original expired JWT");
  } else {
    // Make the SDK request a refresh without changing the CI stack's JWT lifetime.
    // Access and refresh tokens remain genuine and unchanged in this fixture.
    const due = { ...before.session, expires_at: 1 };
    const encoded = `base64-${Buffer.from(JSON.stringify(due)).toString("base64url")}`;
    for (const fragment of before.fragments) await context.clearCookies({ name: fragment.name });
    await context.addCookies(createChunks(authKey, encoded).map(chunk => ({ ...before.fragments[0], ...chunk })));
  }
  const response = await context.request.get(origin + path, { maxRedirects: 0 });
  assert.equal(response.status(), 200);
  assert.match(response.headers()["cache-control"], /no-store/);
  const after = await storedSession(context, mode);
  assert.ok(after.session.refresh_token !== before.session.refresh_token, "real Auth rotated the refresh token");
  assert.ok(after.session.access_token !== before.session.access_token, "real Auth issued a different JWT");
  if (mode !== "legacy") {
    const written = new Set(response.headersArray().filter(({ name }) => name.toLowerCase() === "set-cookie")
      .map(({ value }) => value.split("=")[0]));
    assert.ok(after.fragments.every(({ name }) => written.has(name)) && written.has(preference), "refresh renewed every live fragment and the preference");
  }
  return after.session;
}

async function assertEntry(page, path) {
  await page.goto(origin + path);
  await expect(page).toHaveURL(origin + "/cuenta");
  await expect(page.getByLabel("Correo electrónico")).toHaveCount(0);
}

const tempRoot = await realpath(tmpdir());
const profilePrefix = "cueva-session-";
const profile = await mkdtemp(join(tempRoot, profilePrefix));
let persistent, browser;
try {
  await db.connect();
  const admin = await account("admin");
  const student = await account("alumno");
  const pending = await account("alumno", false);
  phase = "remembered login in persistent profile";
  persistent = await chromium.launchPersistentContext(profile);
  let page = persistent.pages()[0];
  await login(page, admin, true);
  await storedSession(persistent, "remembered");
  assert.ok(!(await page.evaluate(() => document.cookie)).includes(authKey), "tokens are HttpOnly");
  phase = "direct entry after browser restart";
  await persistent.close();
  persistent = await chromium.launchPersistentContext(profile);
  page = persistent.pages()[0];
  await assertEntry(page, "/");
  await assertEntry(page, "/ingresar");
  console.log("PASS remembered login, HttpOnly fragments and two direct entries after browser restart.");

  phase = "remembered refresh";
  const realExpiry = process.env.CUEVA_SESSION_TEST_REAL_EXPIRY === "1";
  await refresh(persistent, "remembered", "/mi-cuenta", realExpiry);
  console.log(`PASS remembered renewal through Auth${realExpiry ? " after JWT expired" : " (SDK expiry metadata due)"}.`);

  phase = "logout, history, restart and existing global scope";
  const other = createClient(API_URL, CUEVA_PUBLISHABLE_KEY, options);
  const otherLogin = await other.auth.signInWithPassword({ email: admin.email, password: admin.password });
  assert.ok(!otherLogin.error && otherLogin.data.session);
  await persistent.addCookies([
    { name: `${authKey}.19`, value: "obsolete-test-fragment", url: origin },
    { name: `${authKey}-code-verifier.0`, value: "obsolete-test-verifier", url: origin },
  ]);
  await page.goto(origin + "/mi-cuenta");
  await expect(page.getByRole("heading", { name: "Mi cuenta", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cerrar sesión", exact: true }).first().click();
  await expect(page).toHaveURL(origin + "/ingresar");
  assert.ok(!(await persistent.cookies(origin)).some(({ name }) => isAuthCookie(name) || name === preference));
  const otherRefresh = await other.auth.refreshSession();
  assert.ok(otherRefresh.error && !otherRefresh.data.session, "logout still revokes other Auth sessions");
  await page.goBack();
  await expect(page.getByLabel("Correo electrónico")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mi cuenta", exact: true })).toHaveCount(0);
  await persistent.close();
  persistent = await chromium.launchPersistentContext(profile);
  await openLogin(persistent.pages()[0], "/cuenta");
  await persistent.close();
  persistent = null;
  console.log("PASS logout clears fragments and preference, preserves global Auth scope, back and restart stay signed out.");

  phase = "unchecked native form, renewal and gate";
  browser = await chromium.launch();
  const native = await browser.newContext({ javaScriptEnabled: false });
  const nativePage = await native.newPage();
  await login(nativePage, student, false);
  await assertEntry(nativePage, "/ingresar");
  const studentSession = await refresh(native, "session", "/mi-perfil");
  await nativePage.goto(origin + "/mi-perfil");
  await expect(nativePage.getByRole("heading", { name: "Mi perfil", exact: true })).toBeVisible();
  await db.query("update cueva_private.access_state set ready=false where user_id=$1", [student.id]);
  await openLogin(nativePage, "/");
  await nativePage.goto(origin + "/mi-perfil");
  await expect(nativePage.getByRole("heading", { name: "Acceso restringido" })).toBeVisible();
  await db.query("update cueva_private.access_state set ready=true where user_id=$1", [student.id]);
  const revoked = await service.auth.admin.signOut(studentSession.access_token, "local");
  assert.ok(!revoked.error, "Auth revoked the isolated session");
  await openLogin(nativePage, "/ingresar");
  await nativePage.goto(origin + "/mi-perfil");
  await expect(nativePage.getByRole("heading", { name: /Acceso restringido|Ingresá para continuar/ })).toBeVisible();
  await native.close();
  console.log("PASS unchecked native form, nondurable refresh, direct student entry, gate denial and Auth revocation.");

  phase = "checked native form and compatibility without preference";
  const legacy = await browser.newContext({ javaScriptEnabled: false });
  const legacyPage = await legacy.newPage();
  await login(legacyPage, admin, true);
  await storedSession(legacy, "remembered");
  await legacy.clearCookies({ name: preference });
  await assertEntry(legacyPage, "/ingresar");
  await refresh(legacy, "legacy", "/mi-cuenta");
  await legacy.close();
  console.log("PASS checked native form and legacy durable refresh without a preference.");

  phase = "pending first access";
  const firstAccess = await browser.newContext({ javaScriptEnabled: false });
  const pendingPage = await firstAccess.newPage();
  await login(pendingPage, pending, false);
  await expect(pendingPage.getByRole("heading", { name: "Acceso no disponible" })).toBeVisible();
  await openLogin(pendingPage, "/");
  await pendingPage.goto(origin + "/crear-contrasena");
  await expect(pendingPage.getByRole("heading", { name: "Elegí tu contraseña" })).toBeVisible();
  console.log("PASS pending account stays gated and can reach the existing first-password page.");
} catch (error) {
  // Diagnostics must not print the password manager's input, browser cookies or tokens.
  console.error(`FAIL session retention at ${phase} (${error.name}); details omitted.`);
  const matcher = /\b(toHaveURL|toBeVisible|toHaveCount|toBeChecked)\b/.exec(error.message)?.[1];
  if (matcher) console.error(`Browser assertion failed in ${matcher}.`);
  if (error.code === "ERR_ASSERTION" && error.generatedMessage === false) console.error(error.message.split("\n")[0]);
  process.exitCode = 1;
} finally {
  await persistent?.close();
  await browser?.close();
  await db.end();
  for (const id of users) await service.auth.admin.deleteUser(id);
  const resolvedProfile = await realpath(profile);
  assert.ok(dirname(resolvedProfile) === tempRoot && basename(resolvedProfile).startsWith(profilePrefix));
  await rm(resolvedProfile, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 });
}
