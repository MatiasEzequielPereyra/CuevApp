import Link from "next/link";
import { BrandMark } from "@/components/brand/brand-mark";
import { ThemePicker } from "@/components/theme/theme-picker";
import styles from "@/components/access/access.module.css";

export const metadata = { title: "Registro pendiente · CUEVA" };
export default function PendingRegistrationPage() {
  return <div className={styles.page}>
    <header className={styles.header}>
      <Link href="/ingresar" className={styles.brandLink}><BrandMark size={44} /><span>CUEVA</span></Link>
      <ThemePicker />
    </header>
    <main className={styles.main} id="contenido">
      <div className={styles.intro}>
        <p className={styles.kicker}>CUEVA / TU CUENTA</p>
        <h1>Tu correo está confirmado.</h1>
        <p className={styles.description}>Ya no tenés que pedir que te manden una invitación.</p>
      </div>
      <section className={styles.card}>
        <h2>Verificamos tu registro</h2>
        <p className={styles.subtitle}>No pudimos completar la vinculación automática. Puede que ya exista una ficha con tu correo, o que haya un problema temporal. Para proteger tus datos, no asociamos fichas existentes solo por coincidencia del correo.</p>
        <p>Intentá <Link href="/ingresar">ingresar con tu contraseña</Link>. Si el aviso continúa, el gimnasio puede verificar tu ficha sin enviarte otra invitación.</p>
      </section>
    </main>
    <footer className={styles.footer}><span>HECHA PARA EL GIMNASIO.</span><span>CUEVA · Un lugar para avanzar</span></footer>
  </div>;
}
