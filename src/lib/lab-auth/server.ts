import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Test-only: an explicit opt-in and strict loopback targets prevent use in production.
export function config() {
  if (process.env.NODE_ENV !== "development" || process.env.CUEVA_LOCAL_AUTH !== "1") return null;
  const { CUEVA_AUTH_URL: auth, CUEVA_REST_URL: rest, CUEVA_ANON_KEY: key, CUEVA_LAB_ORIGIN: origin, CUEVA_DB_PORT: port, CUEVA_DB_PASSWORD: password } = process.env;
  if (!auth || !rest || !key || !origin || !port || !password) return null;
  try {
    for (const value of [auth, rest, origin]) {
      const url = new URL(value);
      if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || !url.port || url.username || url.password) return null;
    }
    if (!/^\d{1,5}$/.test(port) || +port < 1 || +port > 65535) return null;
  } catch { return null; }
  return { auth, rest, key, origin, port: +port, password };
}

export async function client() {
  const cfg = config();
  if (!cfg) throw new Error("Laboratorio deshabilitado");
  const jar = await cookies();
  return createServerClient("http://cueva-test.invalid", cfg.key, {
    global: { fetch(input, init) {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      const prefix = url.pathname.startsWith("/auth/v1/") ? "/auth/v1" : url.pathname.startsWith("/rest/v1/") ? "/rest/v1" : null;
      if (!prefix) throw new Error("Ruta inválida");
      return fetch(`${prefix === "/auth/v1" ? cfg.auth : cfg.rest}${url.pathname.slice(prefix.length)}${url.search}`, init);
    } },
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (items) => { for (const { name, value, options } of items) jar.set(name, value, { ...options, httpOnly: true, sameSite: "lax", path: "/" }); },
    },
  });
}
