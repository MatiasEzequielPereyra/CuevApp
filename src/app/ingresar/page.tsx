import Link from "next/link";
import { BrandMark } from "@/components/brand/brand-mark";
import { ThemePicker } from "@/components/theme/theme-picker";

export default function SignInPreview() {
  return (
    <>
      <a className="skip-link" href="#contenido">Saltar al contenido</a>
      <header className="site-header shell">
        <Link className="brand-link" href="/" aria-label="CUEVA, inicio"><BrandMark /></Link>
        <span className="header-caption">EL ESPACIO DE TU ENTRENAMIENTO</span>
        <ThemePicker />
      </header>
      <main className="access-shell shell" id="contenido" tabIndex={-1}>
        <div className="access-intro">
          <p className="eyebrow"><span className="status-dot" aria-hidden="true" /> EN DESARROLLO</p>
          <h1>Tu espacio,<br /><span>más cerca.</span></h1>
          <p>Estamos preparando el acceso a tu cuenta de CUEVA.</p>
          <Link href="/" className="access-back">← Volver al inicio</Link>
        </div>
        <section className="access-card" aria-labelledby="access-title" aria-describedby="access-status">
          <p className="access-kicker">CUEVA / TU CUENTA</p>
          <h2 id="access-title">Ingresar</h2>
          <p id="access-status" className="access-status"><strong>El acceso todavía no está disponible.</strong><br />Esta es una vista previa. Te avisaremos cuando puedas ingresar.</p>
          <fieldset disabled className="access-fields" aria-label="Vista previa del acceso">
            <label htmlFor="preview-email">Correo electrónico</label>
            <input id="preview-email" type="email" autoComplete="email" placeholder="tu@correo.com" />
            <label htmlFor="preview-password">Contraseña</label>
            <input id="preview-password" type="password" autoComplete="current-password" placeholder="Tu contraseña" />
            <button type="button">Ingresar</button>
          </fieldset>
          <p className="access-footnote">Cuando esté habilitado, el gimnasio te indicará cómo acceder.</p>
        </section>
      </main>
      <footer className="site-footer shell"><BrandMark size={52} /><p>Hecha para el gimnasio.<br /><span className="muted">Paso a paso, con la misma fuerza.</span></p><span className="footer-status">VERSIÓN EN DESARROLLO</span></footer>
    </>
  );
}
