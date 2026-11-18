import type { ReactNode } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/brand/brand-mark";
import { ThemePicker } from "@/components/theme/theme-picker";
import { StudentIcon, type StudentIconName } from "./student-icon";

type StudentSection = "cuenta" | "rutina" | "membresia" | "notificaciones" | "perfil";

const navigation: { href: string; label: string; name?: string; section: StudentSection; icon: StudentIconName }[] = [
  { href: "/cuenta", label: "Inicio", section: "cuenta", icon: "home" },
  { href: "/mi-rutina", label: "Rutina", name: "Rutina de entrenamiento", section: "rutina", icon: "dumbbell" },
  { href: "/mi-membresia", label: "Cuotas", name: "Cuotas · Mi Membresía", section: "membresia", icon: "wallet" },
  { href: "/notificaciones", label: "Avisos", name: "Avisos y notificaciones", section: "notificaciones", icon: "bell" },
  { href: "/mi-perfil", label: "Perfil", name: "Mi perfil", section: "perfil", icon: "user" },
];

export function StudentPageHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="student-page-heading">
      <h1>{title}</h1>
      {children}
    </header>
  );
}

export function StudentShell({ children, active = "cuenta" }: { children: ReactNode; active?: StudentSection }) {
  return (
    <div className="dashboard student-dashboard">
      <a className="skip-link" href="#contenido">Saltar al contenido</a>
      <header className="student-topbar">
        <div className="student-topbar-inner">
          <Link className="student-brand" href="/cuenta" aria-label="CUEVA, inicio">
            <BrandMark size={46} decorative />
          </Link>
          <nav className="student-routine-nav" aria-label="Navegación del alumno">
            {navigation.map(item => (
              <Link key={item.section} href={item.href} aria-label={item.name}
                aria-current={active === item.section ? "page" : undefined}>
                <span className="student-nav-icon"><StudentIcon name={item.icon} /></span>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
          <ThemePicker />
        </div>
      </header>
      <main className="dash-main student-main" id="contenido" tabIndex={-1}>
        {children}
        {active === "perfil" && (
          <form className="student-signout" method="post" action="/api/acceso/salir">
            <button className="dash-signout" type="submit">Cerrar sesión</button>
          </form>
        )}
      </main>
    </div>
  );
}
