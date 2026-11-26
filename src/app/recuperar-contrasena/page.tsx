import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandMark } from "@/components/brand/brand-mark";
import { ThemePicker } from "@/components/theme/theme-picker";
import { RecoveryForm } from "@/components/access/recovery-form";
import { productConfig } from "@/lib/product-auth/server";
import styles from "@/components/access/access.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Recuperar contraseña · CUEVA",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default function RecoveryPage() {
  const cfg = productConfig();
  if (!cfg || cfg.ownerOnly || (process.env.VERCEL_ENV !== "production" && !cfg.local)) notFound();
  return <div className={styles.page}>
    <a className="skip-link" href="#contenido">Saltar al contenido</a>
    <header className={styles.header}>
      <Link href="/ingresar" className={styles.brandLink} aria-label="CUEVA, inicio"><BrandMark size={44} /></Link>
      <ThemePicker />
    </header>
    <main className={styles.main} id="contenido" tabIndex={-1}>
      <div className={styles.intro}><p className={styles.kicker}>CUEVA / TU CUENTA</p><h1>Volvé a<br /><span>tu espacio.</span></h1></div>
      <section className={styles.card} aria-label="Recuperación de contraseña"><RecoveryForm /></section>
    </main>
  </div>;
}
