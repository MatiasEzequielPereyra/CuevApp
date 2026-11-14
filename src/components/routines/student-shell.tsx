import type { ReactNode } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/brand/brand-mark";
import { ThemePicker } from "@/components/theme/theme-picker";

type StudentSection = "cuenta" | "rutina" | "membresia" | "notificaciones" | "perfil";

const navigation: { href: string; label: string; section: StudentSection }[] = [
  { href: "/cuenta", label: "Inicio", section: "cuenta" },
  { href: "/mi-membresia", label: "Mi Membresía", section: "membresia" },
  { href: "/mi-rutina", label: "Entrenamiento", section: "rutina" },
  { href: "/notificaciones", label: "Notificaciones", section: "notificaciones" },
  { href: "/mi-perfil", label: "Mi perfil", section: "perfil" },
];

export function StudentShell({ children, active = "cuenta" }: { children: ReactNode; active?: StudentSection }) {
  return <div className="dashboard student-dashboard">
    <a className="skip-link" href="#contenido">Saltar al contenido</a>
    <header className="dash-header">
      <Link href="/cuenta" aria-label="CUEVA, inicio"><BrandMark size={42}/></Link>
      <ThemePicker/>
    </header>
    <main className="dash-main" id="contenido" tabIndex={-1}>
      {children}
      <section className="dash-account">
        <Link href="/mi-perfil">Mi perfil</Link>
        <form method="post" action="/api/acceso/salir"><button className="dash-signout">Cerrar sesión</button></form>
      </section>
    </main>
    <nav className="student-routine-nav" aria-label="Navegación del alumno">
      {navigation.map(item => <Link key={item.section} href={item.href} aria-current={active === item.section ? "page" : undefined}>{item.label}</Link>)}
    </nav>
  </div>;
}
