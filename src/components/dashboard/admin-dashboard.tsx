import type { ReactNode } from "react";

type IconName = "home" | "users" | "calendar" | "wallet" | "file" | "user" | "arrow" | "spark";
const paths: Record<IconName, ReactNode> = {
  home: <><path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-6h6v6"/></>,
  users: <><circle cx="9" cy="8" r="3"/><path d="M3.5 20v-2a5.5 5.5 0 0 1 11 0v2M16 5.5a3 3 0 0 1 0 5.8M17 13a4.5 4.5 0 0 1 3.5 4.4V20"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18M8 14h3m-3 4h3"/></>,
  wallet: <><rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 9h18m-6 6h3"/></>,
  file: <><path d="M6 3h8l4 4v14H6zM14 3v5h5M9 12h6M9 16h6"/></>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  arrow: <><path d="M5 12h14m-5-5 5 5-5 5"/></>,
  spark: <><path d="m12 3 1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6zM19 16v5m-2.5-2.5h5"/></>,
};
function Icon({ name }: { name: IconName }) {
  return <svg className="dash-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
const areas: { id: string; name: string; label: string; description: string; icon: IconName }[] = [
  { id: "alumnos", name: "Alumnos", label: "Alumnos activos", description: "La gestión de alumnos estará disponible próximamente.", icon: "users" },
  { id: "vencimientos", name: "Vencimientos", label: "Próximos vencimientos", description: "Acá vas a poder consultar los próximos vencimientos.", icon: "calendar" },
  { id: "pagos", name: "Pagos", label: "Pagos y cuotas", description: "El registro y seguimiento de pagos estará disponible próximamente.", icon: "wallet" },
  { id: "comprobantes", name: "Comprobantes", label: "Comprobantes pendientes", description: "Los comprobantes para revisar aparecerán acá.", icon: "file" },
];
export function AdminDashboard({ displayName, email, role, logo, themePicker, accountActions }: { displayName: string; email: string; role: string; logo: ReactNode; themePicker: ReactNode; accountActions?: ReactNode }) {
  return <div className="dashboard" id="inicio">
    <a className="skip-link" href="#panel">Saltar al contenido</a>
    <aside className="dash-sidebar" aria-label="Barra lateral">
      <a href="#inicio" className="dash-brand" aria-label="CUEVA, inicio">{logo}<span>CUEVA <small>GESTIÓN DE GIMNASIO</small></span></a>
      <div className="dash-nav-label">MENÚ PRINCIPAL</div>
      <nav className="dash-side-nav" aria-label="Navegación principal">
        <a href="#inicio" className="dash-nav-active" aria-current="page"><Icon name="home"/>Inicio</a>
        {areas.map(area => <a href={`#${area.id}`} key={area.id}><Icon name={area.icon}/>{area.name}<span>Próximamente</span></a>)}
        <a href="#cuenta"><Icon name="user"/>Mi cuenta</a>
      </nav>
      <div className="dash-sidebar-bottom"><span className="dash-avatar" aria-hidden="true">{displayName.charAt(0).toUpperCase()}</span><div><strong>{displayName}</strong><small>{role}</small></div></div>
    </aside>
    <div className="dash-content">
      <header className="dash-header"><div className="dash-mobile-brand">{logo}<span>CUEVA</span></div><div className="dash-breadcrumb">CUEVA <span>/</span> Panel de administración</div><div className="dash-header-actions">{themePicker}<a href="#cuenta" className="dash-profile-link" aria-label="Ir a mi cuenta"><Icon name="user"/></a></div></header>
      <main className="dash-main" id="panel" tabIndex={-1}>
        <div className="dash-heading"><div><p className="dash-overline"><span/> TU ESPACIO DE GESTIÓN</p><h1>Hola, {displayName} <span aria-hidden="true">✳</span></h1><p>Todo lo importante de tu gimnasio, en un solo lugar.</p></div><span className="dash-role"><Icon name="spark"/>{role}</span></div>
        <div className="dash-section-heading"><div><p className="dash-kicker">TU GIMNASIO</p><h2>Resumen general</h2></div><span className="dash-live-label"><span/> PANEL DE ADMINISTRACIÓN</span></div>
        <div className="dash-cards">{areas.map(area => <a href={`#${area.id}`} className="dash-card" key={area.id}><span className="dash-card-top"><span className={`dash-card-icon icon-${area.id}`}><Icon name={area.icon}/></span><Icon name="arrow"/></span><span className="dash-card-label">{area.label}</span><strong>Sin datos aún</strong><span className="dash-card-note">Disponible próximamente</span></a>)}</div>
        <div className="dash-section-heading dash-areas-heading"><div><p className="dash-kicker">ORGANIZÁ TU DÍA</p><h2>Tu espacio de trabajo</h2><p>Estamos preparando las herramientas para acompañarte.</p></div></div>
        <div className="dash-workspace">{areas.map(area => <section className="dash-area" id={area.id} key={area.id}><div className="dash-area-icon"><Icon name={area.icon}/></div><div><div className="dash-area-title"><h3>{area.name}</h3><span>PRÓXIMAMENTE</span></div><p>{area.description}</p></div></section>)}</div>
        <section className="dash-account" id="cuenta"><div><p className="dash-kicker">TU CUENTA</p><h2>Tu perfil</h2><p>Sesión iniciada como <strong>{email}</strong></p><span className="dash-account-role">{role}</span></div><form method="post" action="/api/acceso/salir"><button type="submit" className="dash-signout">Cerrar sesión <Icon name="arrow"/></button></form>{accountActions && <div className="dash-account-actions">{accountActions}</div>}</section>
        <footer className="dash-footer"><span>CUEVA <i/> UN LUGAR PARA AVANZAR</span><span>Hecho para acompañar tu entrenamiento.</span></footer>
      </main>
    </div>
    <nav className="dash-mobile-nav" aria-label="Navegación móvil"><a href="#inicio" aria-current="page"><Icon name="home"/><span>Inicio</span></a><a href="#alumnos"><Icon name="users"/><span>Alumnos</span></a><a href="#pagos"><Icon name="wallet"/><span>Pagos</span></a><a href="#comprobantes"><Icon name="file"/><span>Comprobantes</span></a><a href="#cuenta"><Icon name="user"/><span>Cuenta</span></a></nav>
  </div>;
}
