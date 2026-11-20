import { NextResponse } from "next/server";
import { productConfig, userClient } from "@/lib/product-auth/server";

export const dynamic = "force-dynamic";

/**
 * Supabase confirmation email template sends a token hash to this callback.
 * The token never appears in the final URL or in a page rendered to the user.
 */
export async function GET(request: Request) {
  const cfg = productConfig();
  if (!cfg || !cfg.selfRegistrationEnabled || cfg.ownerOnly) {
    return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const url = new URL(request.url);
  const hash = url.searchParams.get("token_hash") ?? "";
  const type = url.searchParams.get("type");
  const redirect = (destination: string) => NextResponse.redirect(new URL(destination, cfg.origin), {
    status: 303,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });

  if (type !== "signup" || !/^[a-zA-Z0-9_-]{24,256}$/.test(hash)) {
    return redirect("/registrarse?estado=enlace-invalido");
  }

  try {
    const auth = await userClient();
    const verified = await auth.auth.verifyOtp({ token_hash: hash, type: "signup" });
    if (verified.error || !verified.data.session || !verified.data.user?.email_confirmed_at) {
      return redirect("/registrarse?estado=enlace-invalido");
    }

    const enrollment = await auth.rpc("cueva_complete_self_registration");
    if (enrollment.error) return redirect("/registro-pendiente");
    if (enrollment.data === "created" || enrollment.data === "existing") {
      return redirect("/cuenta");
    }
    return redirect("/registro-pendiente");
  } catch {
    return redirect("/registro-pendiente");
  }
}
