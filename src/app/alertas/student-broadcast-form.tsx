"use client";

import { useRef, useState, type FormEvent } from "react";
import styles from "./admin-alerts.module.css";

export function StudentBroadcastForm() {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const active = useRef(false);
  const previous = useRef<{ id: string; title: string; body: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (active.current) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const title = String(fields.get("title") ?? "").trim();
    const body = String(fields.get("message") ?? "").trim();
    if (!title || !body) { setFeedback("Completá el título y el mensaje."); return; }
    if (!confirming) { setFeedback(""); setConfirming(true); return; }

    if (!previous.current || previous.current.title !== title || previous.current.body !== body) {
      previous.current = { id: crypto.randomUUID(), title, body };
    }
    active.current = true;
    setBusy(true);
    setFeedback("");
    try {
      const response = await fetch("/api/notifications/student-notices", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(previous.current),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !Number.isSafeInteger(result?.recipients) || !Number.isSafeInteger(result?.devices)) {
        setFeedback(result?.message ?? "No pudimos confirmar el envío. Podés reintentar con el mismo mensaje.");
        return;
      }
      form.reset();
      previous.current = null;
      setConfirming(false);
      setFeedback(result.recipients === 0 ? "No hay alumnos habilitados para recibir el comunicado." :
        `Publicado en Avisos para ${result.recipients} ${result.recipients === 1 ? "alumno" : "alumnos"}. Push en cola para ${result.devices} ${result.devices === 1 ? "dispositivo" : "dispositivos"}.`);
    } catch {
      setFeedback("No pudimos confirmar el envío. Podés reintentar con el mismo mensaje.");
    } finally {
      active.current = false;
      setBusy(false);
    }
  }

  return <section className={`${styles.card} ${styles.broadcast}`} aria-labelledby="broadcast-title">
    <h2 id="broadcast-title">Comunicado para todos los alumnos</h2>
    <p>Queda en Avisos y también se envía a los dispositivos con notificaciones activadas.</p>
    <form onSubmit={submit} aria-busy={busy}>
      <label htmlFor="broadcast-subject">Título</label>
      <input id="broadcast-subject" name="title" required maxLength={120} readOnly={confirming} />
      <label htmlFor="broadcast-text">Mensaje</label>
      <textarea id="broadcast-text" name="message" required maxLength={500} rows={4} readOnly={confirming} />
      {confirming && <p>¿Publicar este comunicado para todos los alumnos habilitados?</p>}
      <div className={styles.broadcastActions}>
        <button type="submit" disabled={busy}>{busy ? "Publicando…" : confirming ? "Enviar a todos" : "Revisar comunicado"}</button>
        {confirming && <button type="button" disabled={busy} onClick={() => setConfirming(false)}>Editar</button>}
      </div>
      <p role="status">{feedback}</p>
    </form>
  </section>;
}
