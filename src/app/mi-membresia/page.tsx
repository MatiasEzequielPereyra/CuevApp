import Link from "next/link";
import { StudentShell } from "@/components/routines/student-shell";
import { pesos } from "@/lib/payments/money";
import { productConfig, userClient } from "@/lib/product-auth/server";
import { ReceiptUpload } from "@/components/receipts/receipt-upload";
import { PushNotificationSettings } from "@/components/notifications/push-notification-settings";
import { NotificationInbox, type NotificationInboxItem } from "@/components/notifications/notification-inbox";
import { receiptState, type Receipt } from "@/lib/receipts/contracts";

export const dynamic = "force-dynamic";

type MembershipPeriod = {
  month: string;
  due_on: string;
  cents: string;
  paid: string;
  balance: string;
  status: "paid" | "overdue" | "pending";
  payments: { paid_on: string; cents: string }[];
};

type Membership = {
  active: boolean;
  last_paid_on: string | null;
  current: MembershipPeriod | null;
  history: MembershipPeriod[];
};

const statuses = { paid: "Al día", overdue: "Vencida", pending: "Pendiente" };
const dateFormat = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeZone: "UTC" });
const monthFormat = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "UTC" });

function PaymentDate({ value }: { value: string }) {
  return <time dateTime={value}>{dateFormat.format(new Date(value))}</time>;
}

type ReceiptPeriod = { id: string; receipts: Receipt[] };

function PeriodDetails({ period, files }: { period: MembershipPeriod; files?: ReceiptPeriod | undefined }) {
  return <>
    <dl>
      <div><dt>Estado de la cuota</dt><dd>{statuses[period.status]}</dd></div>
      <div><dt>Vencimiento</dt><dd><PaymentDate value={period.due_on}/></dd></div>
      <div><dt>Importe de la cuota</dt><dd>{pesos(period.cents)}</dd></div>
      <div><dt>Total pagado</dt><dd>{pesos(period.paid)}</dd></div>
      <div><dt>Saldo pendiente</dt><dd>{pesos(period.balance)}</dd></div>
    </dl>
    {period.payments.length > 0 && <ul className="membership-payment-list" aria-label="Pagos confirmados">
      {period.payments.map((payment, index) => <li key={index}><PaymentDate value={payment.paid_on}/> · {pesos(payment.cents)}</li>)}
    </ul>}
    {files && <section aria-label="Comprobantes del período">
      <h3>Comprobantes</h3>
      {!files.receipts.length && <p>Todavía no presentaste comprobantes para esta cuota.</p>}
      {!!files.receipts.length && <ul className="membership-payment-list">
        {files.receipts.map(receipt => <li key={receipt.id}>
          <strong>{receiptState[receipt.state]}</strong>
          <p>Presentado el <PaymentDate value={receipt.submitted_at}/></p>
          {receipt.resolved_at && <p>Resuelto el <PaymentDate value={receipt.resolved_at}/></p>}
          {receipt.rejection_reason && <p>Motivo del rechazo: {receipt.rejection_reason}</p>}
          <a href={`/api/comprobantes?id=${receipt.id}`} target="_blank" rel="noopener noreferrer">Abrir comprobante</a>
        </li>)}
      </ul>}
      {BigInt(period.balance) > 0n && !files.receipts.some(receipt => receipt.state === "pending") &&
        <ReceiptUpload key={files.id} period={files.id}/>}
    </section>}
  </>;
}

export default async function MembershipPage() {
  if (!productConfig()) return <main className="shell"><h1>Acceso no disponible</h1></main>;
  const client = await userClient(true);
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return <main className="shell"><h1>Ingresá para continuar</h1><Link href="/ingresar">Ingresar</Link></main>;
  const profile = await client.from("cueva_profiles").select("role").maybeSingle();
  if (profile.error || profile.data?.role !== "alumno") {
    return <main className="shell"><h1>Acceso restringido</h1><Link href="/cuenta">Mi cuenta</Link></main>;
  }

  const [{ data: snapshot, error: readError }, receiptPeriods, inboxResult] = await Promise.all([
    client.rpc("cueva_membership_snapshot"),
    client.rpc("cueva_receipt_periods"),
    client.from("cueva_notification_inbox")
      .select("id,title,body,created_at,read_at")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  const data = snapshot as Membership | null;
  const files = receiptPeriods.error ? null : receiptPeriods.data as Record<string, ReceiptPeriod> | null;
  const inboxItems = inboxResult.error ? null : (inboxResult.data ?? []) as NotificationInboxItem[];
  return <StudentShell active="membresia">
    <div className="dash-heading"><div><h1>Mi Membresía</h1><p>Consultá tu cuota y los pagos registrados por el gimnasio.</p></div></div>
    <PushNotificationSettings />
    <NotificationInbox items={inboxItems} />
    {readError || !data ? <section className="dash-account">
      <div><h2>No pudimos cargar tu membresía</h2><p>Si el problema continúa, consultá con el gimnasio.</p></div>
      <Link href="/mi-membresia">Reintentar</Link>
    </section> : <>
      {!files && <p>Los comprobantes no están disponibles por el momento.</p>}
      <div className="membership-summary">
        <section className="membership-card"><h2>Estado de membresía</h2>
          <dl>
            <div><dt>Membresía</dt><dd>{data.active ? "Activa" : "Inactiva"}</dd></div>
            <div><dt>Último pago confirmado</dt><dd>{data.last_paid_on ? <PaymentDate value={data.last_paid_on}/> : "Todavía no hay pagos"}</dd></div>
          </dl>
        </section>
        <section className="membership-card"><h2>Cuota de este mes</h2>
          {data.current ? <PeriodDetails period={data.current} files={files?.[data.current.month]}/> : <p>El gimnasio todavía no registró la cuota de este mes.</p>}
        </section>
      </div>
      <section className="membership-history"><h2>Historial de cuotas</h2>
        {data.history.length === 0 && <p>Todavía no hay cuotas de meses anteriores.</p>}
        {data.history.map(period => <details className="membership-card" key={period.month}>
          <summary>{monthFormat.format(new Date(period.month))}</summary>
          <PeriodDetails period={period} files={files?.[period.month]}/>
        </details>)}
      </section>
    </>}
  </StudentShell>;
}
