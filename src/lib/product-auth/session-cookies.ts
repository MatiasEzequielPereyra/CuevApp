import { isChunkLike, type CookieOptions } from "@supabase/ssr";

const preferenceCookie = "cueva-session-retention";
export type SessionRetention = "remembered" | "session";

type CookieStore = {
  getAll: () => { name: string; value: string }[];
  set: (name: string, value: string, options: CookieOptions) => void;
};
type CookieWrite = { name: string; value: string; options: CookieOptions };
type CookieConfig = { url: string; local: boolean };

function authCookieName(url: string) {
  // Keep the storage key used by Supabase JS so existing sessions still work.
  return `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
}

export function hasSessionCookie(items: ReturnType<CookieStore["getAll"]>, url: string) {
  const base = authCookieName(url);
  return items.some(({ name, value }) => value && isChunkLike(name, base));
}

export function isCookieRemoval({ maxAge, expires }: CookieOptions) {
  return maxAge !== undefined ? maxAge <= 0 : expires !== undefined && expires.getTime() <= Date.now();
}

function protectedOptions(options: CookieOptions, local: boolean): CookieOptions {
  return { ...options, httpOnly: true, sameSite: "lax", secure: !local, path: "/" };
}

function retentiveOptions(options: CookieOptions, retention?: SessionRetention): CookieOptions {
  if (retention !== "session" || isCookieRemoval(options)) return options;
  const sessionOptions = { ...options };
  delete sessionOptions.maxAge;
  delete sessionOptions.expires;
  return sessionOptions;
}

export function writeSessionCookies(
  store: CookieStore, items: CookieWrite[], cfg: CookieConfig, chosen?: SessionRetention,
) {
  const base = authCookieName(cfg.url);
  const existing = store.getAll();
  const preference = existing.find(({ name }) => name === preferenceCookie)?.value;
  const retention = chosen ?? (preference === "remembered" || preference === "session" ? preference : undefined);
  let liveOptions: CookieOptions | undefined;
  for (const { name, value, options } of items) {
    const sessionCookie = isChunkLike(name, base);
    const resolved = protectedOptions(sessionCookie ? retentiveOptions(options, retention) : options, cfg.local);
    if (sessionCookie && value && !isCookieRemoval(options)) liveOptions = resolved;
    store.set(name, value, resolved);
  }
  // The SDK only sends changed chunks. Renew unchanged chunks too so the
  // entire explicit session has the same retention, including its preference.
  // Sessions without a choice keep the installed SDK's previous behavior.
  if (retention && liveOptions) {
    const updated = new Set(items.map(item => item.name));
    for (const { name, value } of existing) {
      if (value && isChunkLike(name, base) && !updated.has(name)) store.set(name, value, liveOptions);
    }
    store.set(preferenceCookie, retention, liveOptions);
  }
}

export function clearSessionCookies(store: CookieStore, cfg: CookieConfig) {
  const base = authCookieName(cfg.url);
  const verifier = `${base}-code-verifier`;
  const names = new Set([base, verifier, preferenceCookie]);
  for (const { name } of store.getAll()) {
    if (isChunkLike(name, base) || isChunkLike(name, verifier)) names.add(name);
  }
  const options = protectedOptions({ maxAge: 0 }, cfg.local);
  for (const name of names) store.set(name, "", options);
}
