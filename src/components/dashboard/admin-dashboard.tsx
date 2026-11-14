import type { ReactNode } from "react";
import { AdminProfileMenu } from "./admin-profile-menu";
import "./admin-home.css";

type IconName = "home" | "users" | "calendar" | "wallet" | "file" | "user" | "arrow" | "dumbbell" | "bell";
const paths: Record<IconName, ReactNode> = {
  home: <><path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-6h6v6"/></>,
  users: <><circle cx="9" cy="8" r="3"/><path d="M3.5 20v-2a5.5 5.5 0 0 1 11 0v2M16 5.5a3 3 0 0 1 0 5.8M17 13a4.5 4.5 0 0 1 3.5 4.4V20"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18M8 14h3m-3 4h3"/></>,
  wallet: <><rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 9h18m-6 6h3"/></>,
  file: <><path d="M6 3h8l4 4v14H6zM14 3v5h5M9 12h6M9 16h6"/></>,
  dumbbell: <><rect x="4" y="7" width="4" height="10" rx="1"/><rect x="16" y="7" width="4" height="10" rx="1"/><path d="M8 12h8M2 10v4m20-4v4"/></>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  arrow: <><path d="M5 12h14m-5-5 5 5-5 5"/></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
};
function Icon({ name }: { name: IconName }) {
  return <svg className="dash-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
type AdminSection = "alumnos" | "pagos" | "alertas" | "vencimientos" | "comprobantes" | "rutinas" | "ejercicios";

const navigationAreas: { id: AdminSection; href: string; name: string; description: string; icon: IconName }[] = [
  { id: "alumnos", href: "/alumnos", name: "Alumnos", description: "Gestioná las fichas.", icon: "users" },
  { id: "vencimientos", href: "/pagos?vista=vencimientos", name: "Vencimientos", description: "Ajustá las fechas de cuota.", icon: "calendar" },
  { id: "pagos", href: "/pagos", name: "Pagos", description: "Registrá pagos y revisá saldos.", icon: "wallet" },
  { id: "comprobantes", href: "/pagos/comprobantes", name: "Comprobantes", description: "Revisá los envíos de alumnos.", icon: "file" },
  { id: "rutinas", href: "/rutinas", name: "Rutinas", description: "Armá y publicá rutinas.", icon: "file" },
  { id: "ejercicios", href: "/ejercicios", name: "Ejercicios", description: "Consultá el catálogo y los videos.", icon: "dumbbell" },
  { id: "alertas", href: "/alertas", name: "Alertas", description: "Consultá avisos operativos.", icon: "bell" },
];

type AdminProps = { displayName: string; email: string; role: string; logo: ReactNode; themePicker: ReactNode; accountActions?: ReactNode };
export function AdminAccountActions({ ownerOnly }: { ownerOnly: boolean }) {
  return ownerOnly ? <p>Las invitaciones y la recuperación de alumnos estarán disponibles cuando terminemos de configurar el correo del gimnasio.</p> : <><form method="post" action="/api/acceso/admin-invitar"><label>Correo del alumno <input name="email" type="email" required/></label><button>Invitar</button></form><form method="post" action="/api/acceso/admin-recuperar"><label>Identificador del alumno <input name="user_id" required/></label><button>Enviar recuperación</button></form></>;
}


export function AdminShell({ displayName, email, role, logo, themePicker, accountActions, active = "inicio", children, }: AdminProps & { active?: "inicio" | AdminSection; children: ReactNode;}) {

  const isHome = active === "inicio";
  const panelLink = isHome ? "#inicio" : "/cuenta";
  const accountLink = isHome ? "#cuenta" : "/cuenta#cuenta";
  return <div className={isHome ? "dashboard dash-home" : "dashboard"} id="inicio">
    <a className="skip-link" href="#panel" tabIndex={0}>Saltar al contenido</a>
    <aside className="dash-sidebar" aria-label="Barra lateral">
      <a href={panelLink} className="dash-brand" aria-label="CUEVA, inicio">{logo}<span>CUEVA <small>GESTIÓN DE GIMNASIO</small></span></a>
      <div className="dash-nav-label">MENÚ PRINCIPAL</div>
      <nav className="dash-side-nav" aria-label="Navegación principal">
        <a href={panelLink} className={active === "inicio" ? "dash-nav-active" : undefined} aria-current={active === "inicio" ? "page" : undefined}><Icon name="home"/>Inicio</a>
        {navigationAreas.map(area => <a href={area.href} key={area.id} className={active === area.id ? "dash-nav-active" : undefined} aria-current={active === area.id ? "page" : undefined}><Icon name={area.icon}/>{area.name}</a>)}
        <a href={accountLink}><Icon name="user"/>Mi cuenta</a>
      </nav>
      <div className="dash-sidebar-bottom"><span className="dash-avatar" aria-hidden="true">{displayName.charAt(0).toUpperCase()}</span><div><strong>{displayName}</strong><small>{role}</small></div></div>
    </aside>
    <div className="dash-content">
      <header className="dash-header dash-admin-header"><div className="dash-mobile-brand">{logo}<span>CUEVA</span></div><div className="dash-breadcrumb">CUEVA <span>/</span> {navigationAreas.find(area => area.id === active)?.name ?? "Panel de administración"}</div><div className="dash-header-actions">{themePicker}<AdminProfileMenu accountLink={accountLink}><Icon name="user"/></AdminProfileMenu></div></header>
      <main className="dash-main" id="panel" tabIndex={-1}>
        {children}
        {isHome && <section className="dash-account dash-home-profile" id="cuenta" aria-labelledby="dash-profile-heading" tabIndex={-1}><div><p className="dash-kicker">TU CUENTA</p><h2 id="dash-profile-heading">Tu perfil</h2><p>Sesión iniciada como <strong>{email}</strong></p><span className="dash-account-role">{role}</span></div><form method="post" action="/api/acceso/salir"><button type="submit" className="dash-signout">Cerrar sesión <Icon name="arrow"/></button></form>{accountActions && <div className="dash-account-actions">{accountActions}</div>}</section>}
        <footer className="dash-footer"><span>CUEVA <i/> UN LUGAR PARA AVANZAR</span><span>Hecho para acompañar tu entrenamiento.</span></footer>
      </main>
    </div>
    <nav className="dash-mobile-nav" aria-label="Navegación móvil">
  <a href={panelLink} aria-current={active === "inicio" ? "page" : undefined}>
    <Icon name="home"/><span>Inicio</span>
  </a>
  <a href="/alumnos" aria-current={active === "alumnos" ? "page" : undefined}>
    <Icon name="users"/><span>Alumnos</span>
  </a>
  <a href="/pagos" aria-current={active === "pagos" ? "page" : undefined}>
    <Icon name="wallet"/><span>Pagos</span>
  </a>
  <a href="/alertas" aria-current={active === "alertas" ? "page" : undefined}>
    <Icon name="bell"/><span>Alertas</span>
  </a>
  <a href="/rutinas" aria-current={active === "rutinas" ? "page" : undefined}>
    <Icon name="file"/><span>Rutinas</span>
  </a>
  <a href="/ejercicios" aria-current={active === "ejercicios" ? "page" : undefined}>
    <Icon name="dumbbell"/><span>Ejercicios</span>
  </a>
  <a href={accountLink}><Icon name="user"/><span>Cuenta</span></a>
</nav>

  </div>;
}
export function AdminDashboard(props: AdminProps) {
  return <AdminShell {...props}>
    <h1 className="dash-home-greeting">Hola, {props.displayName}</h1>
    <nav className="dash-home-access" aria-label="Secciones de administración">
      {navigationAreas.map(area => (
        <a className="dash-home-card" href={area.href} key={area.id} tabIndex={0} aria-labelledby={`home-label-${area.id}`} aria-describedby={`home-description-${area.id}`}>
          <span className={`dash-card-icon icon-${area.id}`}><Icon name={area.icon}/></span>
          <strong id={`home-label-${area.id}`}>{area.name}</strong>
          <span className="dash-home-card-description" id={`home-description-${area.id}`}>{area.description}</span>
        </a>
      ))}
    </nav>
  </AdminShell>;
}
