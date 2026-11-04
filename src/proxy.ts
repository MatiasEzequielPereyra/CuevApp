import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { localFetch, productConfig } from "@/lib/product-auth/server";

export async function proxy(request: NextRequest) {
  const cfg = productConfig();
  if (!cfg) return NextResponse.next();
  let response = NextResponse.next({ request });
  const auth = createServerClient(cfg.url, cfg.key, {
    ...(cfg.local ? { global: { fetch: localFetch(cfg) } } : {}),
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items) => {
        for (const { name, value } of items) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of items) response.cookies.set(name, value, { ...options, httpOnly: true, sameSite: "lax", secure: !cfg.local, path: "/" });
      },
    },
  });
  // Auth verifies the session and refreshes it when appropriate; never use
  // unverified cookies as an authorization decision.
  await auth.auth.getUser();
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export const config = { matcher: ["/cuenta", "/alumnos", "/api/alumnos", "/api/alumnos/invitacion", "/api/alumnos/eliminar", "/pagos", "/api/pagos"] };
