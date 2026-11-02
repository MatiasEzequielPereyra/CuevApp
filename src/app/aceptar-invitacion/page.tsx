import { notFound } from "next/navigation";
import { productConfig } from "@/lib/product-auth/server";

export const dynamic = "force-dynamic";
export default async function AcceptInvitation({ searchParams }: { searchParams: Promise<{token_hash?: string; nonce?: string; generation?: string; type?: string}> }) {
  if (!productConfig()) notFound();
  const q = await searchParams;
  return <main><h1>Aceptar invitación</h1><form action="/api/acceso/invitacion" method="post">
    <input type="hidden" name="token" value={q.token_hash ?? ""}/><input type="hidden" name="nonce" value={q.nonce ?? ""}/>
    <input type="hidden" name="generation" value={q.generation ?? ""}/><input type="hidden" name="type" value={q.type ?? ""}/>
    <button>Aceptar y continuar</button></form></main>;
}
