"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "./access.module.css";

export function SignInForm({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const inFlight = useRef(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enabled || inFlight.current) return;
    const form = event.currentTarget;
    const body = new FormData(form);
    inFlight.current = true;
    setPending(true);
    setError("");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    let continuing = false;
    try {
      const response = await fetch("/api/acceso/ingresar", {
        method: "POST", body, credentials: "same-origin", cache: "no-store",
        signal: controller.signal,
      });
      const destination = new URL(response.url);
      // Only the existing server redirect signals a completed sign-in.
      if (response.redirected && destination.origin === window.location.origin && destination.pathname === "/cuenta") {
        continuing = true;
        router.replace("/cuenta");
        router.refresh();
      } else {
        setError(response.status === 401
          ? "No pudimos ingresar con esos datos. Revisá tu correo y contraseña e intentá de nuevo."
          : "El acceso no está disponible en este momento. Intentá de nuevo más tarde o contactá al gimnasio.");
      }
    } catch {
      setError("No pudimos confirmar el ingreso. Revisá tu conexión e intentá de nuevo.");
    } finally {
      clearTimeout(timeout);
      body.delete("password");
      const password = form.elements.namedItem("password");
      if (password instanceof HTMLInputElement) password.value = "";
      if (!continuing) {
        inFlight.current = false;
        setPending(false);
        requestAnimationFrame(() => errorRef.current?.focus());
      }
    }
  }

  return (
    <form method="post" action="/api/acceso/ingresar" onSubmit={submit} className={styles.form} aria-busy={pending}>
      {!enabled && <p className={styles.notice} id="access-status"><strong>El acceso no está disponible en este entorno.</strong><br />Cuando esté habilitado, el gimnasio te indicará cómo ingresar.</p>}
      <fieldset disabled={!enabled} aria-describedby={!enabled ? "access-status" : undefined}>
        <label htmlFor="access-email">Correo electrónico</label>
        <input id="access-email" name="email" type="email" required autoComplete="username" inputMode="email" autoCapitalize="none" spellCheck={false} placeholder="tu@correo.com" readOnly={pending} />
        <label htmlFor="access-password">Contraseña</label>
        <input id="access-password" name="password" type="password" required autoComplete="current-password" readOnly={pending} />
        <p ref={errorRef} role="alert" tabIndex={-1} className={error ? styles.error : styles.emptyError}>{error}</p>
        <button type="submit" disabled={pending}>{pending ? "Ingresando…" : "Ingresar"}<span aria-hidden="true">→</span></button>
      </fieldset>
      <span className={styles.srOnly} role="status">{pending ? "Estamos procesando tu ingreso." : ""}</span>
    </form>
  );
}
