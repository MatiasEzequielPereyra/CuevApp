import Link from "next/link";
import { pesos } from "@/lib/payments/money";
import { StudentIcon, type StudentIconName } from "./student-icon";
import { StudentPageHeading } from "./student-shell";

type MembershipSummary = {
  active: boolean;
  current: { due_on: string; balance: string; status: "paid" | "overdue" | "pending" } | null;
};

const dateFormat = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", timeZone: "UTC" });
const statusLabel = { paid: "Al día", overdue: "Vencida", pending: "Pendiente" };

function Shortcut({ href, icon, title, description }: {
  href: string; icon: StudentIconName; title: string; description: string;
}) {
  return (
    <Link className="student-shortcut" href={href}>
      <span className="student-icon-tile"><StudentIcon name={icon} /></span>
      <span className="student-shortcut-copy"><strong>{title}</strong><span>{description}</span></span>
      <StudentIcon name="arrow" />
    </Link>
  );
}

export function StudentHome({ name, membership, unread }: {
  name: string | undefined; membership: MembershipSummary | null; unread: number | null;
}) {
  const period = membership?.current;
  const notice = unread === null ? "No pudimos cargar tus avisos."
    : unread === 0 ? "Estás al día con tus avisos."
    : unread === 1 ? "1 aviso sin leer" : `${unread} avisos sin leer`;

  return (
    <>
      <StudentPageHeading title={name ? `Hola, ${name}` : "Inicio"} />
      <div className="student-home-grid">
        <Link className="student-card student-quota student-quota-link" href="/mi-membresia" aria-labelledby="student-quota-title">
          <div className="student-card-heading">
            <span className="student-icon-tile"><StudentIcon name="wallet" /></span>
            <h2 id="student-quota-title">Tu cuota</h2>
            {period && <span className="student-status" data-status={period.status}>{statusLabel[period.status]}</span>}
          </div>
          {period ? <dl className="student-quota-details">
            <div><dt>Saldo pendiente</dt><dd>{pesos(period.balance)}</dd></div>
            <div><dt>Vencimiento</dt><dd><time dateTime={period.due_on}>{dateFormat.format(new Date(`${period.due_on}T00:00:00Z`))}</time></dd></div>
          </dl> : <p>{membership ? "Todavía no hay una cuota registrada para este período." : "No pudimos consultar el estado de tu cuota."}</p>}
          {membership && !membership.active && <p>Membresía inactiva</p>}
          <span className="student-text-link">Ver mi membresía <StudentIcon name="arrow" /></span>
        </Link>
        <Link className="student-card student-training" href="/mi-rutina">
          <span className="student-icon-tile"><StudentIcon name="dumbbell" /></span>
          <h2>Mi rutina</h2>
          <p>Ejercicios, series y pesos de tu plan.</p>
          <span className="student-training-action">Ver entrenamiento <StudentIcon name="arrow" /></span>
        </Link>
      </div>
      <div className="student-shortcuts">
        <Shortcut href="/notificaciones" icon="bell" title="Notificaciones" description={notice} />
        <Shortcut href="/mi-perfil" icon="user" title="Mi perfil" description="Tus datos de acceso" />
      </div>
    </>
  );
}
