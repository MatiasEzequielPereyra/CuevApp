"use client";

import { useEffect, useState } from "react";

type PushSettings = {
  pushEnabled: boolean;
  available: boolean;
  publicKey: string | null;
};

function applicationServerKey(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const decoded = window.atob(value.replace(/-/g, "+").replace(/_/g, "/") + padding);
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) bytes[index] = decoded.charCodeAt(index);
  return bytes;
}

async function readSettings(): Promise<PushSettings> {
  const response = await fetch("/api/notifications/push", { cache: "no-store" });
  if (!response.ok) throw new Error("No pudimos consultar las preferencias de notificaciones.");
  return response.json() as Promise<PushSettings>;
}

async function confirmSubscription(subscription: PushSubscription, checkOnly = false): Promise<boolean> {
  const response = await fetch(`/api/notifications/push${checkOnly ? "?check=1" : ""}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });
  const result = await response.json().catch(() => null) as { registered?: boolean; message?: string } | null;
  if (!response.ok || typeof result?.registered !== "boolean") {
    throw new Error(result?.message ?? "No pudimos confirmar el registro de este dispositivo.");
  }
  return result.registered;
}

export function PushNotificationSettings() {
  const [settings, setSettings] = useState<PushSettings | null>(null);
  const [registered, setRegistered] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void readSettings().then(async value => {
      let confirmed = false;
      try {
        if (value.available && value.pushEnabled && "serviceWorker" in navigator
          && "PushManager" in window && "Notification" in window && Notification.permission === "granted") {
          const registration = await navigator.serviceWorker.getRegistration("/");
          const subscription = await registration?.pushManager.getSubscription();
          if (subscription) confirmed = await confirmSubscription(subscription, true);
        }
      } catch {
        if (active) setMessage("No pudimos verificar el registro de este dispositivo.");
      }
      if (active) {
        setSettings(value);
        setRegistered(confirmed);
      }
    }).catch(() => {
      if (active) setMessage("No pudimos cargar la configuración de avisos.");
    });
    return () => { active = false; };
  }, []);

  async function enablePush() {
    if (!settings?.available || !settings.publicKey) return;
    setBusy(true);
    setMessage("");
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setMessage("Este navegador no admite notificaciones push.");
        return;
      }
      let permission = Notification.permission;
      if (permission !== "granted") permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMessage(permission === "denied"
          ? "El navegador bloqueó los avisos. Habilitá las notificaciones de CUEVA desde la configuración del navegador."
          : "Necesitamos tu permiso para mostrar avisos de vencimiento.");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription()
        ?? await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey(settings.publicKey),
        });
      if (!await confirmSubscription(subscription)) {
        throw new Error("No pudimos confirmar el registro de este dispositivo.");
      }
      setSettings(current => current ? { ...current, pushEnabled: true } : current);
      setRegistered(true);
      setMessage("Este dispositivo quedó habilitado para recibir avisos.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No pudimos activar los avisos.");
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/notifications/push", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      });
      if (!response.ok) throw new Error("No pudimos actualizar la preferencia.");
      setSettings(current => current ? { ...current, pushEnabled: false } : current);
      setRegistered(false);
      setMessage("Los avisos push quedaron desactivados para tu cuenta. Email y avisos internos siguen activos.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No pudimos actualizar la preferencia.");
    } finally {
      setBusy(false);
    }
  }

  if (!settings && !message) {
    return <section className="push-settings-panel" aria-labelledby="push-settings-title" aria-busy="true">
      <h2 id="push-settings-title">Avisos en este dispositivo</h2>
      <p>Consultando la configuración…</p>
    </section>;
  }

  return <section className="push-settings-panel" aria-labelledby="push-settings-title">
    <div>
      <p className="push-settings-kicker">NOTIFICACIONES</p>
      <h2 id="push-settings-title">Avisos en este dispositivo</h2>
      <p className="push-settings-description">
        Recibí avisos push sobre vencimientos. Los correos y avisos internos de CUEVA siguen activos.
      </p>
    </div>
    {!settings?.available ? <p className="push-settings-note">La recepción push todavía no está configurada en el servidor. Podés seguir usando los avisos por correo y dentro de CUEVA.</p>
      : settings.pushEnabled && registered ? <div className="push-settings-actions">
        <span className="push-settings-status">Push habilitado</span>
        <button type="button" onClick={disablePush} disabled={busy}>Desactivar push</button>
      </div>
      : <div className="push-settings-actions">
        <button type="button" onClick={enablePush} disabled={busy}>
          {busy ? "Procesando…" : settings.pushEnabled ? "Activar en este dispositivo" : "Volver a activar push"}
        </button>
        {!settings.pushEnabled && <span className="push-settings-note">La preferencia push está desactivada para tu cuenta.</span>}
      </div>}
    {message && <p className="push-settings-message" role="status">{message}</p>}
  </section>;
}
