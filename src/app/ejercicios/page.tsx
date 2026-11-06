import Link from "next/link";
import { studentAdmin } from "@/lib/students/server";
import { RoutineShell } from "@/components/routines/routine-shell";
import { ExerciseCatalog } from "@/components/routines/exercise-catalog";
export const dynamic = "force-dynamic";
export default async function Exercises() {
  const client = await studentAdmin();
  if (!client) return <main className="shell"><h1>Acceso restringido</h1><Link href="/cuenta">Mi cuenta</Link></main>;
  const { data: { user } } = await client.auth.getUser();
  return <RoutineShell email={user?.email ?? "Cuenta de CUEVA"}><Link href="/rutinas">← Rutinas</Link><div className="dash-heading"><div><p className="dash-overline">CATÁLOGO BÁSICO</p><h1>Ejercicios</h1><p>Creá y organizá los ejercicios de tu gimnasio. Videos y archivos pendientes.</p></div></div><ExerciseCatalog/></RoutineShell>;
}
