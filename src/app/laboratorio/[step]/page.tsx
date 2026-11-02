import { notFound } from "next/navigation";
import { config } from "@/lib/lab-auth/server";

export const dynamic = "force-dynamic";

export default async function LabPage({ params, searchParams }: { params: Promise<{step: string}>; searchParams: Promise<{token_hash?: string}> }) {
  if (!config()) notFound();
  const { step } = await params;
  const query = await searchParams;
  if (step === "invite") return <main><h1>Aceptar invitación</h1><form method="post" action="/laboratorio/action/invite"><input type="hidden" name="token" value={query.token_hash ?? ""}/><button>Aceptar invitación</button></form></main>;
  if (step === "password") return <main><h1>Elegí tu contraseña</h1><form method="post" action="/laboratorio/action/password"><label>Contraseña <input name="password" type="password" required minLength={8}/></label><button>Guardar contraseña</button></form></main>;
  if (step === "login") return <main><h1>Ingresar</h1><form method="post" action="/laboratorio/action/login"><label>Correo <input name="email" type="email" required /></label><label>Contraseña <input name="password" type="password" required /></label><button>Ingresar</button></form></main>;
  if (step === "error") return <main><h1>No se pudo ingresar</h1><p>Revisá los datos e intentá nuevamente.</p></main>;
  notFound();
}
