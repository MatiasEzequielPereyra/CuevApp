import { notFound } from "next/navigation";
import { productConfig, userClient } from "@/lib/product-auth/server";

export const dynamic = "force-dynamic";
export default async function AccountPage() {
  if (!productConfig()) notFound();
  const auth = await userClient(true);
  const { data: { user }, error } = await auth.auth.getUser();
  if (error || !user) return <main><h1>Ingresá para continuar</h1></main>;
  const profile = await auth.from("cueva_profiles").select("role").maybeSingle();
  if (profile.error || !profile.data) return <main><h1>Acceso no disponible</h1></main>;
  return <main><h1>Tu cuenta</h1><p>Perfil: {profile.data.role}</p>{profile.data.role === "admin" && <><form method="post" action="/api/acceso/admin-invitar"><label>Correo del alumno <input name="email" type="email" required/></label><button>Invitar</button></form><form method="post" action="/api/acceso/admin-recuperar"><label>Identificador del alumno <input name="user_id" required/></label><button>Enviar recuperación</button></form></>}<form method="post" action="/api/acceso/salir"><button>Salir</button></form></main>;
}
