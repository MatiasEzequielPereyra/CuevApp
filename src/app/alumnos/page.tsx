import Link from "next/link";
import { AdminShell } from "@/components/dashboard/admin-dashboard";
import { BrandMark } from "@/components/brand/brand-mark";
import { DeleteStudentAction } from "@/components/students/delete-student-action";
import { InvitationAction } from "@/components/students/invitation-action";
import { StudentForm, type Student } from "@/components/students/student-form";
import { ThemePicker } from "@/components/theme/theme-picker";
import { buenosAiresDate } from "@/lib/students/date";
import { studentSearchFilter } from "@/lib/students/search";
import { studentAdmin } from "@/lib/students/server";
import { productConfig } from "@/lib/product-auth/server";
import "./alumnos.css";

export const dynamic = "force-dynamic";

const invitationLabels: Partial<Record<string, string>> = {
  blocked: "Pendiente de habilitar correo general",
  sent: "Enviada",
  self_registered: "Registro personal confirmado",
  processing: "En proceso; revisar si no finaliza",
  review: "Requiere revisión antes de reenviar",
  failed: "No enviada; se puede reintentar",
};

function StudentStatus({ active, id }: { active: boolean; id?: string }) {
  return <span className="students-status" id={id} data-active={active}>{active ? "Activo" : "Inactivo"}</span>;
}

function StudentList({ rows, q }: { rows: Student[]; q: string }) {
  if (!rows.length) return (
    <section className="students-panel students-result">
      <h2>{q ? "No encontramos coincidencias" : "Todavía no hay alumnos"}</h2>
      <p>{q ? "Probá con otro nombre, apellido, correo o DNI." : "Registrá la primera ficha desde Nuevo alumno."}</p>
      {q && <Link className="students-action" href="/alumnos" tabIndex={0}>Limpiar búsqueda</Link>}
    </section>
  );

  return (
    <>
      <div className="students-list-heading">
        <h2 id="students-results">{q ? "Resultados de búsqueda" : "Fichas administrativas"}</h2>
        {q && <Link className="students-action" href="/alumnos" tabIndex={0}>Limpiar búsqueda</Link>}
      </div>
      <ul className="student-list students-list" aria-labelledby="students-results">
        {rows.slice(0, 100).map(row => (
          <li key={row.id}>
            <Link href={`/alumnos?id=${row.id}`} tabIndex={0}
              aria-labelledby={`student-name-${row.id}`}
              aria-describedby={`student-email-${row.id} student-status-${row.id}`}>
              <span className="students-row-identity">
                <strong id={`student-name-${row.id}`}>{row.last_name}, {row.first_name}</strong>
                <span className="students-row-email" id={`student-email-${row.id}`}>{row.email}</span>
              </span>
              <span className="students-row-end">
                <StudentStatus active={row.active} id={`student-status-${row.id}`} />
                <span className="students-muted" aria-hidden="true">→</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {rows.length > 100 && <p>Mostramos los primeros 100 resultados. Refiná la búsqueda para encontrar una ficha.</p>}
    </>
  );
}

function StudentProfile({ student, saved, invitationResult, invitationState, invitationError, invitationHasAccount, recoveryAllowed, recoveryResult, eligibility }: {
  student: Student;
  saved: boolean;
  invitationResult: string;
  invitationState: string | undefined;
  invitationError: boolean;
  invitationHasAccount: boolean;
  recoveryAllowed: boolean;
  recoveryResult: string;
  eligibility: string;
}) {
  const { id, first_name, last_name, email, dni, joined_on, active } = student;
  return (
    <>
      {saved && <p className="students-feedback" role="status">Ficha guardada correctamente.</p>}
      <nav className="students-profile-actions" aria-label="Acciones de la ficha">
        <Link className="students-action students-primary" href={`/alumnos?id=${id}&editar=1`} tabIndex={0}>Editar ficha</Link>
        <Link className="students-action" href={`/rutinas?alumno=${id}`} tabIndex={0}>Rutina</Link>
        <Link className="students-action" href={`/pagos?alumno=${id}`} tabIndex={0}>Pagos y cuotas</Link>
      </nav>
      <section className="students-panel" aria-labelledby="students-details">
        <h2 id="students-details">Datos de la ficha</h2>
        <dl className="students-details">
          <div><dt>Correo electrónico</dt><dd>{email}</dd></div>
          <div><dt>DNI</dt><dd>{dni ?? "No informado"}</dd></div>
          <div><dt>Fecha de alta</dt><dd><time dateTime={joined_on}>{joined_on}</time></dd></div>
          <div><dt>Estado administrativo</dt><dd><StudentStatus active={active} /></dd></div>
        </dl>
      </section>
      <section className="students-panel students-invitation" aria-labelledby="students-invitation">
        <h2 id="students-invitation">Acceso a CUEVA</h2>
        <p>Invitación: {invitationError ? "estado no disponible" : invitationLabels[invitationState ?? ""] ?? "No solicitada"}</p>
        {invitationResult === "blocked" && <p role="status">Ficha guardada. El correo general todavía no está habilitado; invitación pendiente.</p>}
        {invitationResult === "existing" && <p role="status">Ya existe una cuenta con ese correo. No se vinculó automáticamente; requiere revisión.</p>}
        {["unavailable", "failed", "review"].includes(invitationResult) && <p role="status">Ficha guardada; la invitación no se confirmó. Consultá el estado antes de reintentar.</p>}
        <InvitationAction id={id} {...(invitationState ? { state: invitationState } : {})} />
        {recoveryResult === "enviada" && <p className="students-feedback" role="status">Se envió un enlace de recuperación al correo de esta ficha.</p>}
        {!invitationError && (invitationState === "sent" || invitationState === "self_registered") && invitationHasAccount && recoveryAllowed && (
          <details className="students-recovery">
            <summary>Recuperar acceso del alumno</summary>
            <p>Si el alumno olvidó su contraseña o no puede ingresar, podés enviarle un enlace de recuperación. Su sesión anterior dejará de tener acceso hasta que complete el proceso. Evitá repetir el envío si hay una solicitud pendiente.</p>
            <form method="post" action="/api/acceso/admin-recuperar">
              <input type="hidden" name="email" value={email} />
              <button className="students-action" type="submit">Enviar enlace de recuperación</button>
            </form>
          </details>
        )}
      </section>
      <section className="students-panel students-danger" aria-labelledby="students-delete">
        <h2 id="students-delete">Eliminar ficha</h2>
        <DeleteStudentAction id={id} email={email} name={`${first_name} ${last_name}`} eligibility={eligibility} />
      </section>
    </>
  );
}

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
  const isNew = !!params.nuevo;
  const isEdit = !!id && !!params.editar && !isNew;
  const isList = !id && !isNew;
  const studentHref = id ? `/alumnos?id=${id}` : "/alumnos";
  let query = client.from("cueva_students").select("id,first_name,last_name,email,dni,joined_on,active").order("last_name").order("id").limit(101);
  if (id) query = query.eq("id", id);
  if (q) query = query.or(studentSearchFilter(q));
  const { data, error } = await query;
  const rows = (data ?? []) as Student[];
  const student = id ? rows[0] : undefined;
  const isProfile = !error && student && !isNew && !isEdit;
  const title = isNew ? "Nuevo alumno" : isEdit ? "Editar ficha" : isProfile ? `${student.first_name} ${student.last_name}` : "Alumnos";

  let content;
  if (error) {
    const retry = new URLSearchParams();
    if (id) retry.set("id", id);
    if (q) retry.set("q", q);
    if (isNew) retry.set("nuevo", "1");
    if (isEdit) retry.set("editar", "1");
    content = (
      <section className="students-panel students-result">
        <h2>Gestión no disponible</h2>
        <p role="alert">No pudimos cargar los alumnos. Intentá nuevamente.</p>
        <a className="students-action" href={retry.size ? `/alumnos?${retry}` : "/alumnos"} tabIndex={0}>Reintentar</a>
      </section>
    );
  } else if (isNew) {
    content = <StudentForm key="nuevo" defaultJoinedOn={buenosAiresDate()} />;
  } else if (isEdit && student) {
    content = <StudentForm key={student.id} student={student} defaultJoinedOn={buenosAiresDate()} />;
  } else if (isProfile) {
    const [invitation, deletion] = await Promise.all([
      client.from("cueva_student_invitations").select("state,user_id").eq("student_id", student.id).maybeSingle(),
      client.rpc("cueva_delete_empty_student", { p_student: student.id, p_expected_email: student.email, p_confirm: false }),
    ]);
    content = <StudentProfile student={student} saved={!!params.guardado} invitationResult={String(params.invitacion)}
      invitationState={invitation.data?.state} invitationError={!!invitation.error}
      invitationHasAccount={!!invitation.data?.user_id} recoveryAllowed={!productConfig()?.ownerOnly}
      recoveryResult={typeof params.recuperacion === "string" ? params.recuperacion : ""}
      eligibility={deletion.error ? "unavailable" : String(deletion.data ?? "unavailable")} />;
  } else if (id) {
    content = <section className="students-panel students-result"><h2>No se encontró la ficha</h2></section>;
  } else {
    content = <StudentList rows={rows} q={q} />;
  }

  return (
    <AdminShell displayName={displayName} email={email} role="Administrador"
      logo={<BrandMark size={42} />} themePicker={<ThemePicker />} active="alumnos">
      <div className="students-page">
        {!isList && (
          <Link className="students-back" href={isEdit && student && !error ? studentHref : "/alumnos"} tabIndex={0}>
            <span aria-hidden="true">←</span> {isEdit && student && !error ? "Volver a la ficha" : "Volver a Alumnos"}
          </Link>
        )}
        <header className="students-heading">
          <h1>{title}</h1>
          {isList && <Link className="students-action students-primary" href="/alumnos?nuevo=1" tabIndex={0}>Nuevo alumno</Link>}
        </header>
        {params.eliminado === "1" && !id && <p className="students-feedback" role="status">La ficha fue eliminada correctamente.</p>}
        {isList && (
          <form className="student-search students-search" action="/alumnos" method="get">
            <label htmlFor="students-query">Buscar alumnos</label>
            <div className="students-search-controls">
              <input id="students-query" name="q" key={q} defaultValue={q} placeholder="Nombre, apellido, correo o DNI" />
              <button className="students-action students-primary" type="submit">Buscar</button>
            </div>
          </form>
        )}
        {content}
      </div>
    </AdminShell>
  );
}
