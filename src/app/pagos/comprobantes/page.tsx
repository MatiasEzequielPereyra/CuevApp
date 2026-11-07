import Link from "next/link";
import { AdminShell } from "@/components/dashboard/admin-dashboard";
import { BrandMark } from "@/components/brand/brand-mark";
import { ThemePicker } from "@/components/theme/theme-picker";
import { ReceiptReview } from "@/components/receipts/receipt-review";
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
  if (!user) return <main className="shell"><h1>Ingresá para continuar</h1><Link href="/ingresar">Ingresar</Link></main>;

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
    logo={<BrandMark size={42}/>} themePicker={<ThemePicker/>} active="pagos">
    <Link href="/pagos">Volver a Pagos y cuotas</Link>
    <h1>Comprobantes de pago</h1>
    <nav className="routine-actions" aria-label="Estado de comprobantes">
      <Link href="/pagos/comprobantes" aria-current={!resolved ? "page" : undefined}>Pendientes</Link>
      <Link href="/pagos/comprobantes?estado=resueltos" aria-current={resolved ? "page" : undefined}>Resueltos</Link>
    </nav>
    {error ? <p>No pudimos cargar los comprobantes. <Link href={pageLink(offset)}>Reintentar</Link></p> : <>
      {!rows.length && <p>{resolved ? "Todavía no hay comprobantes resueltos." : "No hay comprobantes pendientes."}</p>}
      <div className="membership-history">
        {rows.slice(0, pageSize).map(row => <section key={row.id} className="membership-card">
          <h2>{row.student.first_name} {row.student.last_name}</h2>
          <p>Período {row.period.month.slice(0, 7)} · {receiptState[row.state]}</p>
          <p>Presentado el <time dateTime={row.submitted_at}>{submittedDate.format(new Date(row.submitted_at))}</time></p>
          {row.resolved_at && <p>Resuelto el <time dateTime={row.resolved_at}>{submittedDate.format(new Date(row.resolved_at))}</time></p>}
          {row.rejection_reason && <p>Motivo del rechazo: {row.rejection_reason}</p>}
          <a href={`/api/comprobantes?id=${row.id}`} target="_blank" rel="noopener noreferrer">Abrir comprobante</a>
          {row.state === "pending" && <details><summary>Revisar comprobante</summary><ReceiptReview id={row.id} today={buenosAiresDate()}/></details>}
        </section>)}
      </div>
      <nav className="routine-actions" aria-label="Páginas de comprobantes">
        {offset > 0 && <Link href={pageLink(Math.max(0, offset - pageSize))}>Página anterior</Link>}
        {rows.length > pageSize && <Link href={pageLink(offset + pageSize)}>Página siguiente</Link>}
      </nav>
    </>}
  </AdminShell>;
}
