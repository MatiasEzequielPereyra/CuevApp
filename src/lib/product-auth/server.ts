import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// Explicit opt-ins are required; no environment is enabled by default.
export function productConfig() {
  const local = process.env.NODE_ENV === "development" && process.env.CUEVA_PRODUCT_AUTH_LOCAL === "1";
  const expectedOwner = process.env.CUEVA_FIRST_ADMIN_EMAIL?.trim().toLowerCase();
  const ownerTest = process.env.CUEVA_DEFAULT_MAIL_OWNER_TEST === "1" && !!expectedOwner && expectedOwner.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(expectedOwner);
  const customMailReady = process.env.CUEVA_EMAIL_TEMPLATE_READY === "1";
  if (!local && (process.env.CUEVA_PRODUCT_AUTH_ENABLED !== "1" || (!customMailReady && !ownerTest))) return null;
  const { CUEVA_SUPABASE_URL: url, CUEVA_PUBLISHABLE_KEY: key, CUEVA_SERVICE_KEY: serviceKey, CUEVA_PRODUCT_ORIGIN: origin, CUEVA_AUTH_URL: auth, CUEVA_REST_URL: rest } = process.env;
  if (!url || !key || !serviceKey || !origin || (local && (!auth || !rest))) return null;
  try {
    for (const value of [url, origin]) {
      const parsed = new URL(value);
      if (parsed.origin !== value || parsed.username || parsed.password) return null;
      if (local ? (parsed.protocol !== "http:" || parsed.hostname !== "127.0.0.1" || !parsed.port) : parsed.protocol !== "https:") return null;
    }
    if (local && auth && rest) {
      const api = new URL(url);
      const authBase = new URL(auth);
      const restBase = new URL(rest);
      for (const [parsed, path] of [[authBase, "/auth/v1"], [restBase, "/rest/v1"]] as const) {
        if (parsed.origin !== api.origin || parsed.pathname !== path || parsed.search || parsed.hash || parsed.username || parsed.password
          || parsed.protocol !== "http:" || parsed.hostname !== "127.0.0.1" || !parsed.port) return null;
      }
    }
  } catch { return null; }
  return { url, key, serviceKey, origin, auth, rest, local, ownerTest, expectedOwner, ownerOnly: ownerTest && !customMailReady };
}

export function localFetch(cfg: NonNullable<ReturnType<typeof productConfig>>) {
  return (input: RequestInfo | URL, init?: RequestInit) => {
    const target = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const prefix = target.pathname.startsWith("/auth/v1/") ? "/auth/v1" : target.pathname.startsWith("/rest/v1/") ? "/rest/v1" : null;
    if (!prefix || target.origin !== cfg.url) throw new Error("Ruta inválida");
    return fetch(`${prefix === "/auth/v1" ? cfg.auth : cfg.rest}${target.pathname.slice(prefix.length)}${target.search}`, init);
  };
}

export async function userClient(readOnly = false) {
  const cfg = productConfig();
  if (!cfg) throw new Error("Acceso deshabilitado");
  const jar = await cookies();
  return createServerClient(cfg.url, cfg.key, { ...(cfg.local ? { global: { fetch: localFetch(cfg) } } : {}), cookies: {
    getAll: () => jar.getAll(),
    setAll: (items) => { if (!readOnly) for (const { name, value, options } of items) jar.set(name, value, { ...options, httpOnly: true, sameSite: "lax", secure: !cfg.local, path: "/" }); },
  } });
}

export function serviceClient() {
  const cfg = productConfig();
  if (!cfg) throw new Error("Acceso deshabilitado");
  return createClient(cfg.url, cfg.serviceKey, { ...(cfg.local ? { global: { fetch: localFetch(cfg) } } : {}), auth: { persistSession: false, autoRefreshToken: false } });
}

// One request owns this buffer. Validation failures and exceptions never publish
// its proposed SSR cookie writes; the caller commits only after the private bind.
export async function pendingUserClient() {
  const cfg = productConfig();
  if (!cfg) throw new Error("Acceso deshabilitado");
  const jar = await cookies();
  const pending = new Map<string, { value: string; options: CookieOptions }>();
  const auth = createServerClient(cfg.url, cfg.key, { ...(cfg.local ? { global: { fetch: localFetch(cfg) } } : {}), cookies: {
    getAll: () => {
      const values = new Map(jar.getAll().map(item => [item.name, item.value]));
      for (const [name, item] of pending) values.set(name, item.value);
      return Array.from(values, ([name, value]) => ({ name, value }));
    },
    setAll: items => { for (const { name, value, options } of items) pending.set(name, { value, options }); },
  } });
  return { auth, commit: () => {
    for (const [name, { value, options }] of pending) jar.set(name, value, { ...options, httpOnly: true, sameSite: "lax", secure: !cfg.local, path: "/" });
    pending.clear();
  } };
}
