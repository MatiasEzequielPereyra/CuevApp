import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { localFetch, productConfig } from "@/lib/product-auth/server";
import { hasSessionCookie, isCookieRemoval, writeSessionCookies } from "@/lib/product-auth/session-cookies";

export async function proxy(request: NextRequest) {
  const cfg = productConfig();
  if (!cfg) return NextResponse.next();
  const writes = new Map<string, { value: string; options: CookieOptions }>();
  if (hasSessionCookie(request.cookies.getAll(), cfg.url)) {
    const auth = createServerClient(cfg.url, cfg.key, {
      ...(cfg.local ? { global: { fetch: localFetch(cfg) } } : {}),
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: items => writeSessionCookies({
          getAll: () => request.cookies.getAll(),
          set(name, value, options) {
            if (isCookieRemoval(options)) request.cookies.delete(name);
            else request.cookies.set(name, value);
            writes.set(name, { value, options });
          },
        }, items, cfg),
      },
    });
    // Auth verifies and refreshes the session. Pages and handlers still authorize
    // independently with the forwarded cookies and their existing gates.
    await auth.auth.getUser();
  }
  const response = NextResponse.next({ request });
  for (const [name, { value, options }] of writes) response.cookies.set(name, value, options);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = { matcher: [
  "/ingresar", "/cuenta", "/mi-cuenta", "/mi-perfil", "/alumnos", "/pagos", "/pagos/comprobantes",
  "/rutinas/:path*", "/mi-rutina", "/mi-membresia", "/ejercicios", "/notificaciones", "/alertas",
  "/api/alumnos/:path*", "/api/pagos", "/api/comprobantes", "/api/comprobantes/revisar", "/api/rutinas",
  "/api/ejercicios/:path*", "/api/entrenamientos", "/api/notifications/inbox", "/api/notifications/settings",
  "/api/notifications/push", "/api/notifications/student-notices",
] };
