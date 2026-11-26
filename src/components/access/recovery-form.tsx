"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import styles from "./access.module.css";

export function RecoveryForm() {
  const inFlight = useRef(false);
  const feedback = useRef<HTMLParagraphElement>(null);
  const [token, setToken] = useState("");
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const readLink = () => {
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      // Fragments never reach HTTP logs. Remove the capability from browser
      // history; it lives only in memory until submission or navigation.
      window.history.replaceState(null, "", window.location.pathname);
      setToken(""); setSent(false); setSuccess(false); setError("");
      if (fragment.size) {
        const hash = fragment.get("token_hash") ?? "";
        if (fragment.get("type") === "recovery" && /^[a-zA-Z0-9_-]{24,256}$/.test(hash)) setToken(hash);
        else setError("El enlace no es válido. Solicitá uno nuevo.");
      }
      setReady(true);
    };
    const frame = requestAnimationFrame(readLink);
    window.addEventListener("hashchange", readLink);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("hashchange", readLink); };
  }, []);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => window.location.replace("/ingresar"), 2500);
    return () => clearTimeout(timer);
  }, [success]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || !ready || sent || success) return;
    const form = event.currentTarget;
    const body = new FormData(form);
    if (token && body.get("password") !== body.get("confirm_password")) {
      setError("Las contraseñas no coinciden.");
      requestAnimationFrame(() => feedback.current?.focus());
      return;
    }
    if (token) body.set("token_hash", token);
    inFlight.current = true;
    setPending(true);
    setError("");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch(`/api/acceso/${token ? "restablecer" : "recuperar"}`, {
        method: "POST", body, credentials: "same-origin", cache: "no-store", signal: controller.signal,
      });
      const result = await response.json().catch(() => null);
      if (response.ok && result?.ok === true) {
        if (token) { setToken(""); setSuccess(true); }
        else setSent(true);
      } else if (token) {
        setToken("");
        setError("No pudimos restablecer la contraseña. El enlace puede haber vencido o ya haberse usado. Solicitá uno nuevo; si tu cuenta está pendiente, completá primero su habilitación.");
      } else setError("No pudimos procesar la solicitud. Esperá unos minutos y volvé a intentar.");
    } catch {
      if (token) setToken("");
      setError("No pudimos confirmar el resultado. Revisá tu conexión. Si estabas cambiando la contraseña, intentá ingresar o solicitá un nuevo enlace.");
    } finally {
      clearTimeout(timeout);
      body.delete("password"); body.delete("confirm_password"); body.delete("token_hash");
      form.reset();
      inFlight.current = false;
      setPending(false);
      requestAnimationFrame(() => feedback.current?.focus());
    }
  }

  return <>
    <h2>{success ? "Contraseña actualizada" : token ? "Elegí tu nueva contraseña" : "Recuperá tu contraseña"}</h2>
    <p className={styles.subtitle}>{success ? "Ya podés ingresar con tu nueva contraseña. Te llevamos al ingreso." : token ? "Usá al menos 8 caracteres." : "Te enviaremos un enlace al correo de tu cuenta, si está registrada."}</p>
    <p ref={feedback} role={error ? "alert" : "status"} tabIndex={-1} className={error || sent ? styles.notice : styles.emptyError}>
      {error || (success ? "Tu contraseña se actualizó. Volvé a ingresar con la nueva." : sent ? "Si existe una cuenta con ese correo, puede recibir un enlace. Revisá también spam. Si no llega, esperá unos minutos antes de volver a solicitarlo." : "")}
    </p>
    {!success && <form className={styles.form} onSubmit={submit} aria-busy={pending}>
      <fieldset disabled={!ready || pending || sent}>
        {token ? <>
          <label htmlFor="recovery-password">Contraseña nueva</label>
          <input id="recovery-password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={1024} required />
          <label htmlFor="recovery-confirm">Confirmar contraseña</label>
          <input id="recovery-confirm" name="confirm_password" type="password" autoComplete="new-password" minLength={8} maxLength={1024} required />
        </> : <>
          <label htmlFor="recovery-email">Correo electrónico</label>
          <input id="recovery-email" name="email" type="email" autoComplete="email" maxLength={254} required autoCapitalize="none" spellCheck={false} />
        </>}
        <button type="submit">{pending ? "Procesando…" : token ? "Guardar contraseña" : sent ? "Solicitud procesada" : "Enviar enlace"}</button>
      </fieldset>
    </form>}
    <p className={styles.invitation}><Link href="/ingresar">Volver a ingresar</Link></p>
  </>;
}
