import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/brand/brand-mark";
import { ThemePicker } from "@/components/theme/theme-picker";
import { productConfig } from "@/lib/product-auth/server";
import styles from "@/components/access/access.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Registrarse · CUEVA",
  description: "Creá tu cuenta personal de CUEVA y confirmá tu correo.",
};

type Query = { estado?: string | string[] };
export default async function RegistrationPage({ searchParams }: { searchParams?: Promise<Query> } = {}) {
  const cfg = productConfig();
  const enabled = !!cfg?.selfRegistrationEnabled && (cfg.local || process.env.VERCEL_ENV === "production");
  const query = await searchParams;
  const state = typeof query?.estado === "string" ? query.estado : "";

  return <div className={styles.page}>
    <a className="skip-link" href="#contenido">Saltar al contenido</a>
    <header className={styles.header}>
      <Link href="/ingresar" className={styles.brandLink} aria-label="CUEVA, volver al ingreso">
        <BrandMark size={44} /><span>EL ESPACIO DE TU ENTRENAMIENTO</span>
      </Link>
      <ThemePicker />
    </header>
    <main className={styles.main} id="contenido" tabIndex={-1}>
      <div className={styles.intro}>
        <div className={styles.emblem}><BrandMark size={280} /></div>
        <p className={styles.kicker}>TU CUENTA, TU ACCESO</p>
        <h1>Empezá en CUEVA.<br /><span>A tu manera.</span></h1>
        <p className={styles.description}>Creá tu cuenta y confirmá tu correo. El gimnasio ya no necesita enviarte una invitación.</p>
      </div>
      <section className={styles.card} aria-labelledby="register-title">
        <p className={styles.kicker}>CUEVA / REGISTRO</p>
        <h2 id="register-title">Crear mi cuenta</h2>
        <p className={styles.subtitle}>Completá tus datos y elegí una contraseña. Te llegará un enlace de confirmación por correo.</p>
        {state === "enviado" && <p className={styles.notice} role="status">Si el correo puede registrarse, recibirás un enlace para confirmar tu cuenta. Revisá también correo no deseado. No necesitás pedir una invitación a Nico.</p>}
        {state === "enlace-invalido" && <p className={styles.error} role="alert">No pudimos verificar ese enlace. Es posible que haya vencido o ya se haya utilizado. Probá ingresar con tu contraseña o volvé a registrarte.</p>}
        {!enabled && <p className={styles.notice} role="status">El registro personal todavía no está habilitado. Podés seguir ingresando con tu cuenta actual.</p>}
        {enabled && state !== "enviado" && <form className={styles.form} method="post" action="/api/acceso/registrarse">
          <fieldset>
            <label htmlFor="register-first-name">Nombre</label>
            <input id="register-first-name" name="first_name" type="text" autoComplete="given-name" maxLength={80} required />
            <label htmlFor="register-last-name">Apellido</label>
            <input id="register-last-name" name="last_name" type="text" autoComplete="family-name" maxLength={80} required />
            <label htmlFor="register-email">Tu correo electrónico</label>
            <input id="register-email" name="email" type="email" inputMode="email" autoComplete="email"
              autoCapitalize="none" spellCheck={false} maxLength={254} required />
            <label htmlFor="register-password">Elegí una contraseña (mínimo 8 caracteres)</label>
            <input id="register-password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={1024} required />
            <label htmlFor="register-confirm">Confirmar contraseña</label>
            <input id="register-confirm" name="confirm_password" type="password" autoComplete="new-password" minLength={8} maxLength={1024} required />
            <button type="submit">Registrarme y recibir el correo <span aria-hidden="true">→</span></button>
          </fieldset>
        </form>}
        <p className={styles.invitation}>¿Ya tenés cuenta? <Link href="/ingresar">Ingresar</Link></p>
      </section>
    </main>
    <footer className={styles.footer}><span>HECHA PARA EL GIMNASIO.</span><span>CUEVA · Un lugar para avanzar</span></footer>
  </div>;
}
