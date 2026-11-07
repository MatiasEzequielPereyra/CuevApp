import type { ReactNode } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/brand/brand-mark";
import { ThemePicker } from "@/components/theme/theme-picker";

export function StudentShell({ children, active = "cuenta" }: { children: ReactNode; active?: "cuenta" | "rutina" | "membresia" }) {
  return <div className="dashboard student-dashboard"><a className="skip-link" href="#contenido">Saltar al contenido</a><header className="dash-header"><Link href="/cuenta" aria-label="CUEVA, mi cuenta"><BrandMark size={42}/></Link><ThemePicker/></header><main className="dash-main" id="contenido" tabIndex={-1}>{children}<section className="dash-account"><Link href="/cuenta">Mi cuenta</Link><form method="post" action="/api/acceso/salir"><button className="dash-signout">Cerrar sesión</button></form></section></main><nav className="student-routine-nav" aria-label="Navegación del alumno"><Link href="/cuenta" aria-current={active === "cuenta" ? "page" : undefined}>Mi cuenta</Link><Link href="/mi-rutina" aria-current={active === "rutina" ? "page" : undefined}>Mi rutina</Link><Link href="/mi-membresia" aria-current={active === "membresia" ? "page" : undefined}>Mi Membresía</Link></nav></div>;
}
