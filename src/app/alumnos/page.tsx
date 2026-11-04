import {InvitationAction} from "@/components/students/invitation-action";
import {DeleteStudentAction} from "@/components/students/delete-student-action";
import Link from "next/link";
import { studentAdmin } from "@/lib/students/server";
import { studentSearchFilter } from "@/lib/students/search";
import { buenosAiresDate } from "@/lib/students/date";
import { productConfig } from "@/lib/product-auth/server";
import { StudentForm, type Student } from "@/components/students/student-form";
import { AdminAccountActions, AdminShell } from "@/components/dashboard/admin-dashboard";
import { BrandMark } from "@/components/brand/brand-mark";
import { ThemePicker } from "@/components/theme/theme-picker";

export const dynamic = "force-dynamic";
export default async function Students({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const client = await studentAdmin();
  if (!client) return <main className="shell"><h1>Acceso restringido</h1><p>Esta sección requiere una cuenta de administrador habilitada.</p><Link href="/cuenta">Volver a mi cuenta</Link></main>;
  const { data: { user } } = await client.auth.getUser();
  if (!user) return <main className="shell"><h1>Acceso restringido</h1><Link href="/cuenta">Volver a mi cuenta</Link></main>;
  const email = user.email ?? "Cuenta de CUEVA";
  const fullName = user.user_metadata?.full_name;
  const displayName = typeof fullName === "string" && fullName.trim() ? fullName.trim() : email;
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const id = typeof params.id === "string" && /^[0-9a-f-]{36}$/i.test(params.id) ? params.id : null;
  let query = client.from("cueva_students").select("id,first_name,last_name,email,dni,joined_on,active").order("last_name").order("id").limit(101);
  if (id) query = query.eq("id", id);
  if (q) query = query.or(studentSearchFilter(q));
  const { data, error } = await query;
  const rows = (data ?? []) as Student[];
  const student = rows[0];
  const defaultJoinedOn = buenosAiresDate();
  const inviteStatus=id?await client.from("cueva_student_invitations").select("state").eq("student_id",id).maybeSingle():null;
  const deletion=id&&student&&!params.editar?await client.rpc("cueva_delete_empty_student",{p_student:id,p_expected_email:student.email,p_confirm:false}):null;
  return <AdminShell displayName={displayName} email={email} role="Administrador" logo={<BrandMark size={42} />} themePicker={<ThemePicker />} active="alumnos" accountActions={<AdminAccountActions ownerOnly={productConfig()!.ownerOnly} />}>
    <Link href="/alumnos">← Alumnos</Link>
    {params.eliminado==="1"&&!id&&<p role="status">La ficha fue eliminada correctamente.</p>}
    <div className="dash-heading"><h1>{params.nuevo ? "Nuevo alumno" : id ? "Ficha del alumno" : "Alumnos"}</h1>{!id && !params.nuevo && <Link className="dash-role" href="/alumnos?nuevo=1">+ Nuevo alumno</Link>}</div>
    {error ? <section className="dash-account"><h2>Gestión no disponible</h2><p>No pudimos cargar los alumnos. Intentá nuevamente.</p><Link href="/alumnos">Reintentar</Link></section>
      : params.nuevo ? <StudentForm defaultJoinedOn={defaultJoinedOn} />
      : id ? !student ? <p>No se encontró la ficha.</p>
        : params.editar ? <StudentForm student={student} defaultJoinedOn={defaultJoinedOn} />
          : <section className="dash-account"><div><h2>{student.first_name} {student.last_name}</h2>{params.guardado && <p role="status">Ficha guardada correctamente.</p>}<p>{student.email}</p><p>DNI: {student.dni ?? "No informado"}</p><p>Fecha de alta: {student.joined_on}</p><p>Estado administrativo: {student.active ? "Activo" : "Inactivo"}</p><p>Invitación: {inviteStatus?.error?"estado no disponible":inviteStatus?.data?.state==="blocked"?"Pendiente de habilitar correo general":inviteStatus?.data?.state==="sent"?"Enviada":inviteStatus?.data?.state==="processing"?"En proceso; revisar si no finaliza":inviteStatus?.data?.state==="review"?"Requiere revisión antes de reenviar":inviteStatus?.data?.state==="failed"?"No enviada; se puede reintentar":"No solicitada"}</p>{params.invitacion==="blocked"&&<p role="status">Ficha guardada. El correo general todavía no está habilitado; invitación pendiente.</p>}{params.invitacion==="existing"&&<p role="status">Ya existe una cuenta con ese correo. No se vinculó automáticamente; requiere revisión.</p>}{["unavailable","failed","review"].includes(String(params.invitacion))&&<p role="status">Ficha guardada; la invitación no se confirmó. Consultá el estado antes de reintentar.</p>}<InvitationAction id={id} state={inviteStatus?.data?.state}/><Link href={`/alumnos?id=${id}&editar=1`}>Editar ficha</Link><p><Link href={`/pagos?alumno=${id}`}>Consultar cuotas y pagos</Link></p><p>Rutina y comprobantes: próximamente.</p><DeleteStudentAction id={id} email={student.email} name={`${student.first_name} ${student.last_name}`} eligibility={deletion?.error?"unavailable":String(deletion?.data??"unavailable")}/></div></section>
      : <>
        <form className="student-search"><label>Buscar alumnos<input name="q" defaultValue={q} placeholder="Nombre, apellido, correo o DNI" /></label><button>Buscar</button></form>
        <p>{q ? "Resultados de búsqueda" : "Fichas administrativas"} · Estado independiente de los pagos.</p>
        {!rows.length ? <section className="dash-account"><h2>{q ? "No encontramos coincidencias" : "Todavía no hay alumnos"}</h2><p>{q ? "Probá con otro nombre, correo o DNI." : "Registrá la primera ficha desde Nuevo alumno."}</p></section>
          : <ul className="student-list">{rows.slice(0, 100).map(row => <li key={row.id}><Link href={`/alumnos?id=${row.id}`}><strong>{row.last_name}, {row.first_name}</strong><span>{row.email}</span><small>{row.active ? "Activo" : "Inactivo"}</small></Link></li>)}</ul>}
        {rows.length > 100 && <p>Mostramos los primeros 100 resultados. Refiná la búsqueda para encontrar una ficha.</p>}
      </>}
  </AdminShell>;
}
