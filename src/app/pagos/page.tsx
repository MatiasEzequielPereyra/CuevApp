import Link from "next/link";
import { AdminShell } from "@/components/dashboard/admin-dashboard";
import { BrandMark } from "@/components/brand/brand-mark";
import { BillingForm } from "@/components/payments/billing-form";
import { DueDateManager } from "@/components/payments/due-date-manager";
import { ThemePicker } from "@/components/theme/theme-picker";
import { pesos, type Period, type Snapshot } from "@/lib/payments/money";
import { buenosAiresDate } from "@/lib/students/date";
import { studentSearchFilter } from "@/lib/students/search";
import { studentAdmin } from "@/lib/students/server";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "medium",
  timeZone: "UTC",
});

const movementTimeFormatter = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "short",
  timeStyle: "medium",
  timeZone: "America/Argentina/Buenos_Aires",
});

function PeriodCard({ period, studentId, actorId, today, month }: {
  period: Period;
  studentId: string;
  actorId: string;
  today: string;
  month: string;
}) {
  const balance = BigInt(period.cents) - BigInt(period.paid);
  const overdue = balance > 0n && period.due_on < today;
  const headingId = `billing-period-${period.id}`;

  return (
    <article className="billing-panel billing-period-card" aria-labelledby={headingId}>
      <div className="billing-row">
        <h3 id={headingId}>Período {period.month.slice(0, 7)}</h3>
        <span className="billing-status" data-state={balance <= 0n ? "paid" : overdue ? "overdue" : "pending"}>
          {balance <= 0n ? "Pagado" : overdue ? "Vencido" : "Pendiente"}
        </span>
      </div>

      <dl className="billing-period-facts">
        <div className="billing-period-balance">
          <dt>Saldo pendiente</dt>
          <dd>{pesos(balance.toString())}</dd>
        </div>
        <div className="billing-period-due">
          <dt>Vencimiento</dt>
          <dd><time dateTime={period.due_on}>{dateFormatter.format(new Date(`${period.due_on}T00:00:00Z`))}</time></dd>
        </div>
        <div><dt>Total</dt><dd>{pesos(period.cents)}</dd></div>
        <div><dt>Pagado</dt><dd>{pesos(period.paid)}</dd></div>
      </dl>

      {balance > 0n && (
        <details className="billing-payment">
          <summary className="billing-action billing-primary">Registrar pago</summary>
          <BillingForm kind="payment" studentId={studentId} periodId={period.id} month={month} today={today} actorId={actorId} />
        </details>
      )}

      {period.payments.length ? (
        <details className="billing-period-history">
          <summary className="billing-text-action">Historial de movimientos ({period.payments.length})</summary>
          <ul className="billing-movements">
            {period.payments.map(payment => (
              <li key={payment.id}>
                <strong>{pesos(payment.cents)} · {payment.reversal ? "Anulado" : "Confirmado"}</strong>
                <p>{payment.paid_on} · {payment.method}</p>
                <p>Confirmó: {payment.actor}</p>
                <p>Registrado: {movementTimeFormatter.format(new Date(payment.recorded_at))}</p>
                {payment.reversal ? (
                  <>
                    <p>Motivo: {payment.reversal.reason}</p>
                    <p>Anuló: {payment.reversal.actor} · {movementTimeFormatter.format(new Date(payment.reversal.recorded_at))}</p>
                  </>
                ) : (
                  <details>
                    <summary className="billing-text-action">Corregir mediante anulación</summary>
                    <BillingForm kind="reverse" studentId={studentId} paymentId={payment.id} month={month} today={today} actorId={actorId} />
                  </details>
                )}
              </li>
            ))}
          </ul>
        </details>
      ) : <p className="billing-period-history">No hay pagos registrados.</p>}
    </article>
  );
}

export default async function Payments({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const client = await studentAdmin();
  if (!client) return <main className="shell"><h1>Acceso restringido</h1><Link href="/cuenta">Volver a mi cuenta</Link></main>;
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;

  const params = await searchParams;
  const student = typeof params.alumno === "string" && /^[0-9a-f-]{36}$/i.test(params.alumno) ? params.alumno : null;
  const dueDatesView = params.vista === "vencimientos";
  const viewHref = dueDatesView ? "/pagos?vista=vencimientos" : "/pagos";
  const studentHref = (id: string) => dueDatesView ? `${viewHref}&alumno=${id}` : `/pagos?alumno=${id}`;
  const q = typeof params.q === "string" ? params.q.slice(0, 100) : "";

  let query = client.from("cueva_students").select("id,first_name,last_name,active").order("last_name").limit(101);
  if (q) query = query.or(studentSearchFilter(q));
  if (student) query = query.eq("id", student);

  const students = await query;
  const selectedStudent = student ? students.data?.[0] : undefined;
  const snapshot = await client.rpc("cueva_billing_snapshot", { student });
  const data = snapshot.data as Snapshot | null;
  const today = buenosAiresDate();
  const month = today.slice(0, 7);
  const [year, monthNumber] = month.split("-").map(Number);
  const nextMonth = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 7);
  const [currentScheduleResult, nextScheduleResult, auditResult, attemptResult] = student ? await Promise.all([
    client.from("cueva_due_schedules")
      .select("id,due_day,effective_month,recorded_at")
      .eq("student_id", student)
      .lte("effective_month", month + "-01")
      .order("effective_month", { ascending: false })
      .order("recorded_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1),
    client.from("cueva_due_schedules")
      .select("id,due_day,effective_month,recorded_at")
      .eq("student_id", student)
      .lte("effective_month", nextMonth + "-01")
      .order("effective_month", { ascending: false })
      .order("recorded_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1),
    client.from("cueva_due_date_audit")
      .select("id,actor,actor_email,old_due_day,new_due_day,effective_month,scope,reason,result,recorded_at")
      .eq("student_id", student)
      .order("recorded_at", { ascending: false })
      .limit(50),
    client.from("cueva_due_date_attempts")
      .select("id,operation_id,actor_email,requested_due_day,effective_month,scope,requested_reason,error_code,error_message,recorded_at")
      .eq("student_id", student)
      .order("recorded_at", { ascending: false })
      .limit(50)
  ]) : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }, { data: [], error: null }];
  const currentSchedule = currentScheduleResult.data?.[0];
  const nextSchedule = nextScheduleResult.data?.[0];
  const dueHistory = auditResult.data ?? [];

  return (
    <AdminShell
      displayName={user.email ?? "Cuenta CUEVA"}
      email={user.email ?? ""}
      role="Administrador"
      logo={<BrandMark size={42} />}
      themePicker={<ThemePicker />}
      active={dueDatesView ? "vencimientos" : "pagos"}
    >
      <div className="billing-page">
        <header className="billing-row billing-header">
          <div>
            <h1>{dueDatesView ? "Vencimientos" : "Pagos y cuotas"}</h1>
            {dueDatesView && <p>Consultá y ajustá el día de vencimiento por alumno.</p>}
          </div>
          <nav className="billing-actions billing-header-actions" aria-label="Gestión de cuotas">
            {dueDatesView ? <Link className="billing-action" href="/pagos">Volver a Pagos y cuotas</Link> : (
              <>
                <Link className="billing-action" href="/pagos?vista=vencimientos" aria-label="Gestionar vencimientos">Vencimientos</Link>
                <Link className="billing-action" href="/pagos/comprobantes" aria-label="Revisar comprobantes de pago">Comprobantes</Link>
              </>
            )}
          </nav>
        </header>

        {students.error || snapshot.error || !data ? (
          <section className="billing-panel">
            <h2>{dueDatesView ? "Vencimientos no disponibles" : "Pagos no disponibles"}</h2>
            <p>No pudimos consultar las cuotas. Volvé a intentarlo.</p>
            <Link className="billing-action" href={viewHref}>Reintentar</Link>
          </section>
        ) : (
          <>
            {student && selectedStudent ? (
              <>
                <section className="billing-panel billing-row billing-student" aria-labelledby="billing-student-heading">
                  <div>
                    <h2 id="billing-student-heading">{selectedStudent.first_name} {selectedStudent.last_name}</h2>
                    <p>Estado administrativo: {selectedStudent.active ? "Activo" : "Inactivo"}</p>
                  </div>
                  <div className="billing-actions">
                    <Link className="billing-action" href={viewHref}>Cambiar alumno</Link>
                    <Link className="billing-text-action" href={`/alumnos?id=${student}`} aria-label="Ver ficha administrativa">Ver ficha</Link>
                  </div>
                </section>

                {!dueDatesView && (
                  <section className="billing-periods" aria-labelledby="billing-periods-heading">
                    <h2 id="billing-periods-heading">Períodos y pagos</h2>
                    {data.periods.length ? (
                      data.periods.map(period => (
                        <PeriodCard key={period.id} period={period} studentId={student} actorId={user.id} today={today} month={month} />
                      ))
                    ) : <p className="billing-panel">Todavía no hay períodos creados para este alumno.</p>}
                    <div className="billing-panel">
                      <BillingForm key={`period-${student}`} kind="period" studentId={student} month={month} today={today} actorId={user.id} />
                    </div>
                  </section>
                )}

                {currentScheduleResult.error || nextScheduleResult.error || auditResult.error || attemptResult.error || !currentSchedule || !nextSchedule ? (
                  <section className="billing-panel">
                    <h2>Vencimientos no disponibles</h2>
                    <p>No pudimos consultar el calendario individual y su historial.</p>
                  </section>
                ) : (
                  <DueDateManager
                    studentId={student}
                    actorId={user.id}
                    currentMonth={month}
                    currentDay={currentSchedule.due_day}
                    nextDay={nextSchedule.due_day}
                    currentDueOn={data.periods.find(period => period.month === month + "-01")?.due_on ?? null}
                    nextDueOn={data.periods.find(period => period.month === nextMonth + "-01")?.due_on ?? null}
                    history={dueHistory}
                    attempts={attemptResult.data ?? []}
                  />
                )}
              </>
            ) : (
              <section className="billing-panel billing-student-search" aria-labelledby="billing-search-heading">
                <h2 id="billing-search-heading">Seleccioná un alumno</h2>
                <form action="/pagos" className="billing-search">
                  {dueDatesView && <input type="hidden" name="vista" value="vencimientos" />}
                  <label>
                    Buscar alumno
                    <input type="search" name="q" defaultValue={q} maxLength={100} />
                  </label>
                  <button className="billing-action billing-primary">Buscar</button>
                </form>
                {student && <p>No se encontró el alumno. Buscá para volver a elegir.</p>}
                {!student && (students.data?.length ? (
                  <ul className="billing-results">
                    {students.data.slice(0, 100).map(item => (
                      <li key={item.id}>
                        <Link href={studentHref(item.id)}>
                          <strong>{item.last_name}, {item.first_name}</strong>
                          <small>{item.active ? "Activo" : "Inactivo"}</small>
                          <span aria-hidden="true">›</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : <p>{q ? "No encontramos alumnos para esa búsqueda." : "Todavía no hay alumnos registrados."}</p>)}
                {(students.data?.length ?? 0) > 100 && <p>Mostramos los primeros 100 alumnos. Refiná la búsqueda para ver otros resultados.</p>}
              </section>
            )}

            {!dueDatesView && (
              <details className="billing-panel billing-settings">
                <summary className="billing-text-action">Configurar precio mensual general</summary>
                {data.prices.length ? (
                  <ul>
                    {data.prices.map(price => <li key={price.month}>{price.month.slice(0, 7)}: {pesos(price.cents)}</li>)}
                  </ul>
                ) : <p>Sin precio configurado.</p>}
                <BillingForm kind="price" month={month} today={today} actorId={user.id} />
              </details>
            )}
          </>
        )}
      </div>
    </AdminShell>
  );
}
