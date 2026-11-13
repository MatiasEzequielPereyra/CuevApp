import Link from "next/link";
import { studentAdmin } from "@/lib/students/server";
import { RoutineShell } from "@/components/routines/routine-shell";
import { ExerciseCatalog } from "@/components/routines/exercise-catalog";
export const dynamic = "force-dynamic";
export default async function Exercises({ searchParams }: { searchParams: Promise<{ vista?: string | string[] }> }) {
  const client = await studentAdmin();
  if (!client) return <main className="shell"><h1>Acceso restringido</h1><Link href="/cuenta">Mi cuenta</Link></main>;
  const { data: { user } } = await client.auth.getUser();
  const videosOnly = (await searchParams).vista === "videos";

  return <RoutineShell email={user?.email ?? "Cuenta de CUEVA"} active="ejercicios">
    <div className="exercises-page">
      <header className="exercises-heading">
        <h1>Ejercicios</h1>
        <nav className="exercise-view-nav" aria-label="Vistas de Ejercicios">
          <Link href="/ejercicios" aria-current={videosOnly ? undefined : "page"}>Catálogo</Link>
          <Link href="/ejercicios?vista=videos" aria-current={videosOnly ? "page" : undefined}>Biblioteca de videos</Link>
        </nav>
      </header>
      <ExerciseCatalog key={videosOnly ? "videos" : "catalogo"} videosOnly={videosOnly}/>
    </div>
  </RoutineShell>;
}
