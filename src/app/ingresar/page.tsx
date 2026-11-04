import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/brand/brand-mark";
import { ThemePicker } from "@/components/theme/theme-picker";
import { SignInForm } from "@/components/access/sign-in-form";
import { productConfig } from "@/lib/product-auth/server";
import styles from "@/components/access/access.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Ingresar · CUEVA",
  description: "Ingresá a tu cuenta de CUEVA con tu correo y contraseña.",
};

export default function SignInPage() {
  const enabled = process.env.VERCEL_ENV === "production" && !!productConfig();
  return (
    <div className={styles.page}>
      <a className="skip-link" href="#contenido">Saltar al contenido</a>
      <header className={styles.header}>
        <Link href="/ingresar" className={styles.brandLink} aria-label="CUEVA, inicio"><BrandMark size={44} /><span>EL ESPACIO DE TU ENTRENAMIENTO</span></Link>
        <ThemePicker />
      </header>
      <main className={styles.main} id="contenido" tabIndex={-1}>
        <div className={styles.intro}>
          <div className={styles.emblem}><BrandMark size={280} /></div>
          <p className={styles.kicker}>TU GIMNASIO. TU ESPACIO.</p>
          <h1>Un lugar para<br /><span>seguir avanzando.</span></h1>
          <p className={styles.description}>La misma fuerza de siempre.<br />Ahora, también en tu cuenta.</p>
        </div>
        <section className={styles.card} aria-labelledby="access-title">
          <div className={styles.lock} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></svg></div>
          <p className={styles.kicker}>CUEVA / TU CUENTA</p>
          <h2 id="access-title">Ingresá a tu cuenta</h2>
          <p className={styles.subtitle}>Usá tu correo y tu contraseña para continuar.</p>
          <SignInForm enabled={enabled} />
          <div className={styles.help}>
            <h3>¿Olvidaste tu contraseña?</h3>
            <p>Contactá al gimnasio para recibir ayuda con tu acceso. La recuperación por correo para alumnos todavía no está habilitada.</p>
          </div>
          <p className={styles.invitation}>¿Es tu primera vez? El gimnasio te indicará cómo acceder a tu cuenta.</p>
        </section>
      </main>
      <footer className={styles.footer}><span>HECHA PARA EL GIMNASIO.</span><span>CUEVA · Un lugar para avanzar</span></footer>
    </div>
  );
}
