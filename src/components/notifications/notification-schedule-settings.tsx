"use client";

import { useState, type FormEvent } from "react";
import styles from "./notification-schedule-settings.module.css";

export function NotificationScheduleSettings({ initialTime }: { initialTime: string | null }) {
  const [sendTime, setSendTime] = useState(initialTime ?? "12:00");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/notifications/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sendTime }),
      });
      const result = await response.json().catch(() => null) as { sendTime?: string; message?: string } | null;
      if (!response.ok || typeof result?.sendTime !== "string") {
        throw new Error(result?.message ?? "No pudimos guardar el horario.");
      }
      setSendTime(result.sendTime);
      setMessage("Horario actualizado. Los avisos pendientes y aún no procesados adoptaron el nuevo horario.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No pudimos guardar el horario.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="notification-schedule-title">
      <div>
        <p className={styles.kicker}>CONFIGURACIÓN GENERAL</p>
        <h2 id="notification-schedule-title">Horario de avisos</h2>
        <p>Los recordatorios se programan según la hora de Buenos Aires. El proceso automático revisa pendientes cada cinco minutos.</p>
      </div>
      {initialTime === null ? (
        <p role="status" className={styles.message}>No pudimos cargar el horario configurado.</p>
      ) : (
        <form className={styles.form} onSubmit={save}>
          <label htmlFor="notification-send-time">Hora de envío</label>
          <div className={styles.controls}>
            <input
              id="notification-send-time"
              type="time"
              step={60}
              required
              value={sendTime}
              onChange={event => setSendTime(event.target.value)}
              disabled={busy}
            />
            <button type="submit" disabled={busy || sendTime === initialTime}>
              {busy ? "Guardando…" : "Guardar horario"}
            </button>
          </div>
          {message && <p className={styles.message} role="status">{message}</p>}
        </form>
      )}
    </section>
  );
}
