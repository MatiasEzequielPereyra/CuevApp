import Link from "next/link";
import "./comprobantes.css";
import { AdminShell } from "@/components/dashboard/admin-dashboard";
import { BrandMark } from "@/components/brand/brand-mark";
import { ThemePicker } from "@/components/theme/theme-picker";
import { ReceiptReview } from "@/components/receipts/receipt-review";
import { ReceiptPreview } from "@/components/receipts/receipt-preview";
import { studentAdmin } from "@/lib/students/server";
import { buenosAiresDate } from "@/lib/students/date";
import { receiptState, type Receipt } from "@/lib/receipts/contracts";

export const dynamic = "force-dynamic";
type QueueEntry = Receipt & {
  student: { first_name: string; last_name: string };
  period: { month: string };
};
const submittedDate = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "short", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires",
});

export default async function ReceiptQueue({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const client = await studentAdmin();
  if (!client) return <main className="shell"><h1>Acceso restringido</h1><Link href="/cuenta">Mi cuenta</Link></main>;
  const { data: { user } } = await client.auth.getUser();
  if (!user) return <main className="shell"><h1>Ingres� para continuar</h1><Link href="/ingresar">Ingresar</Link></main>;

  const params = await searchParams;
  const resolved = params.estado === "resueltos";
  const offset = typeof params.desde === "string" && /^\d{1,6}$/.test(params.desde) ? Number(params.desde) : 0;
  const pageSize = 50;
  const query = client.from("cueva_payment_receipts")
    .select("id,state,submitted_at,resolved_at,rejection_reason,student:cueva_students(first_name,last_name),period:cueva_periods(month)")
    .order("submitted_at", { ascending: !resolved }).order("id").range(offset, offset + pageSize);
  const { data, error } = await (resolved ? query.neq("state", "pending") : query.eq("state", "pending"));
  const rows = (data ?? []) as unknown as QueueEntry[];
  const pageLink = (index: number) => `/pagos/comprobantes?estado=${resolved ? "resueltos" : "pendientes"}&desde=${index}`;
  return <AdminShell displayName={user.email ?? "Cuenta CUEVA"} email={user.email ?? ""} role="Administrador"
    logo={<BrandMark size={42} />} themePicker={<ThemePicker />} active="comprobantes">
    <div className="receipts-page">
      <header className="receipts-header">
        <Link href="/pagos" className="receipts-back receipts-control">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6"/></svg>
          Volver a Pagos y cuotas
        </Link>
        <div className="receipts-heading">
          <span className="receipts-kicker">ADMINISTRACI�N DE PAGOS</span>
          <h1>Comprobantes de pago</h1>
          <p>Consult� los comprobantes enviados por los alumnos y revis� cada presentaci�n.</p>
        </div>
        <nav className="receipts-tabs" aria-label="Estado de comprobantes">
          <Link className="receipts-tab" href="/pagos/comprobantes" aria-current={!resolved ? "page" : undefined}>Pendientes</Link>
          <Link className="receipts-tab" href="/pagos/comprobantes?estado=resueltos" aria-current={resolved ? "page" : undefined}>Resueltos</Link>
        </nav>
      </header>

      {error ? <section className="receipts-message" role="alert">
        <p>No pudimos cargar los comprobantes.</p>
        <Link className="receipts-control" href={pageLink(offset)}>Reintentar</Link>
      </section> : <>
        {!rows.length && <section className="receipts-message"><p>{resolved ? "Todav�a no hay comprobantes resueltos." : "No hay comprobantes pendientes."}</p></section>}
        {rows.length > 0 && <div className="receipts-list">
          {rows.slice(0, pageSize).map(row => <article key={row.id} className="receipts-card">
            <div className="receipts-card-header">
              <div className="receipts-card-identity">
                <h2>{row.student.first_name} {row.student.last_name}</h2>
                <p>Per�odo {row.period.month.slice(0, 7)}</p>
              </div>
              <span className="receipts-status" data-state={row.state}>{receiptState[row.state]}</span>
            </div>
            <div className="receipts-card-meta">
              <p>Presentado el <time dateTime={row.submitted_at}>{submittedDate.format(new Date(row.submitted_at))}</time></p>
              {row.resolved_at && <p>Resuelto el <time dateTime={row.resolved_at}>{submittedDate.format(new Date(row.resolved_at))}</time></p>}
              {row.rejection_reason && <p>Motivo del rechazo: {row.rejection_reason}</p>}
            </div>
            <div className="receipts-card-actions">
              <ReceiptPreview id={row.id} />
              {row.state === "pending" && <details className="receipts-review">
                <summary className="receipts-action receipts-action-primary">
                  Revisar comprobante
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
                </summary>
                <div className="receipts-review-panel"><ReceiptReview id={row.id} today={buenosAiresDate()}/></div>
              </details>}
            </div>
          </article>)}
        </div>}
        {(offset > 0 || rows.length > pageSize) && <nav className="receipts-pagination" aria-label="P�ginas de comprobantes">
          {offset > 0 && <Link className="receipts-control" href={pageLink(Math.max(0, offset - pageSize))}>P�gina anterior</Link>}
          {rows.length > pageSize && <Link className="receipts-control" href={pageLink(offset + pageSize)}>P�gina siguiente</Link>}
        </nav>}
      </>}
    </div>
  </AdminShell>;
}

