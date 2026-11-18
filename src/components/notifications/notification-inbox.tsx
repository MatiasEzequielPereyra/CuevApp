"use client";

import { useState } from "react";
import styles from "./notification-inbox.module.css";

export type NotificationInboxItem = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

export function NotificationInbox({ items: initialItems }: { items: NotificationInboxItem[] | null }) {
  const [items, setItems] = useState(initialItems ?? []);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function markRead(id: string) {
    setBusyId(id);
    setMessage("");
    try {
      const response = await fetch("/api/notifications/inbox", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null) as { message?: string } | null;
        throw new Error(result?.message ?? "No pudimos marcar el aviso como leído.");
      }
      const result = await response.json() as { readAt?: string };
      setItems(current => current.map(item =>
        item.id === id ? { ...item, read_at: result.readAt ?? new Date().toISOString() } : item,
      ));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No pudimos actualizar el aviso.");
    } finally {
      setBusyId(null);
    }
  }

  const unreadCount = items.filter(item => !item.read_at).length;

  return (
    <section className={styles.panel} aria-labelledby="notification-inbox-title">
      <div className={styles.heading}>
        <div>
          <p className={styles.kicker}>MENSAJES DE CUEVA</p>
          <h2 id="notification-inbox-title">Avisos internos</h2>
          <p>Recordatorios y novedades de tu membresía.</p>
        </div>
        <span className={styles.count}>{unreadCount} sin leer</span>
      </div>

      {initialItems === null ? (
        <p className={styles.empty} role="status">No pudimos cargar tus avisos. Intentá nuevamente más tarde.</p>
      ) : items.length === 0 ? (
        <p className={styles.empty}>Todavía no tenés avisos internos.</p>
      ) : (
        <ul className={styles.list}>
          {items.map(item => (
            <li className={item.read_at ? styles.read : styles.unread} key={item.id}>
              <div className={styles.itemHeading}>
                <h3>{item.title}</h3>
                {!item.read_at && <span className={styles.newLabel}>Nuevo</span>}
              </div>
              <p className={styles.body}>{item.body}</p>
              <div className={styles.footer}>
                <time dateTime={item.created_at}>
                  {new Intl.DateTimeFormat("es-AR", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "America/Argentina/Buenos_Aires",
                  }).format(new Date(item.created_at))}
                </time>
                {!item.read_at && (
                  <button type="button" onClick={() => void markRead(item.id)} disabled={busyId !== null}>
                    {busyId === item.id ? "Actualizando…" : "Marcar como leído"}
                  </button>
                )}
                {item.read_at && <span className={styles.readLabel}>Leído</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {message && <p className={styles.message} role="status">{message}</p>}
    </section>
  );
}
