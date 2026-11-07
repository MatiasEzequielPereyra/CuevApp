import { redirect } from "next/navigation";
import Templates from "./plantillas/page";
export const dynamic = "force-dynamic";
export default async function Routines({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  if (typeof params.alumno === "string") {
    const { StudentRoutine } = await import("@/components/routines/student-routine");
    return <StudentRoutine id={params.alumno}/>;
  }
  if (params.id || params.nueva) redirect(`/rutinas/plantillas?${new URLSearchParams(Object.entries(params).filter((entry): entry is [string,string] => typeof entry[1] === "string"))}`);
  return <Templates searchParams={searchParams}/>;
}
