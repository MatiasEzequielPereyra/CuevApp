import { notFound } from "next/navigation";
import { productConfig } from "@/lib/product-auth/server";

export const dynamic = "force-dynamic";
export default function PasswordPage() {
  if (!productConfig()) notFound();
  return <main><h1>Elegí tu contraseña</h1><form action="/api/acceso/contrasena" method="post"><label>Contraseña <input type="password" name="password" minLength={8} required autoComplete="new-password"/></label><button>Guardar contraseña</button></form></main>;
}
