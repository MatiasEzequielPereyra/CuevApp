"use client";

import { useEffect, useState } from "react";
import { installedMode, isAppleMobile } from "@/lib/pwa/browser";

type PushSettings = {
  pushEnabled: boolean;
  available: boolean;
  publicKey: string | null;
};

const onboardingKey = "cueva:push-onboarding:seen:v1";
let onboardingSeen = false;
let updating = false;

function alreadyShown() {
  try { return onboardingSeen || sessionStorage.getItem(onboardingKey) === "1"; }
  catch { return onboardingSeen; }
}

function rememberShown() {
  onboardingSeen = true;
  try { sessionStorage.setItem(onboardingKey, "1"); } catch { /* Storage is optional. */ }
}

function browserMessage() {
  if (isAppleMobile() && !installedMode()) {
    return "En tu iPhone o iPad, abrí Compartir, elegí Agregar a pantalla de inicio y después abrí CUEVA desde su ícono.";
  }
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return "Este navegador no admite avisos push. Podés seguir leyendo tus Avisos en CUEVA.";
  }
  if (Notification.permission === "denied") {
    return "Las notificaciones están bloqueadas. Permití los avisos de CUEVA en los ajustes de notificaciones del dispositivo o del navegador y volvé a Avisos.";
  }
  return "";
}

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

export function PushNotificationSettings({ onboarding = false }: { onboarding?: boolean }) {
  const [settings, setSettings] = useState<PushSettings | null>(null);
  const [registered, setRegistered] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (onboarding && (!installedMode() || alreadyShown())) return;
    let active = true;
    const load = async () => {
      const value = await readSettings();
      if (!active) return;
      const issue = browserMessage();
      let confirmed = false;
      try {
        if (value.available && !issue && Notification.permission === "granted") {
          const registration = await navigator.serviceWorker.getRegistration("/");
          const subscription = await registration?.pushManager.getSubscription();
          if (active && subscription) confirmed = await confirmSubscription(subscription, true);
        }
      } catch {
        if (active) {
          setMessage("No pudimos verificar el registro de este dispositivo.");
          setSettings(value);
          setProblem(issue);
        }
        return;
      }
      if (active) {
        setSettings(value);
        setRegistered(confirmed);
        setProblem(issue);
        if (onboarding && !confirmed && !alreadyShown()) {
          rememberShown();
          setShowOnboarding(true);
        }
      }
    };
    const frame = requestAnimationFrame(() => {
      void load().catch(() => {
        if (active) setMessage("No pudimos cargar la configuración de avisos.");
      });
    });
    return () => { active = false; cancelAnimationFrame(frame); };
  }, [onboarding]);

  async function enablePush() {
    if (updating || !settings?.available || !settings.publicKey) return;
    const issue = browserMessage();
    if (issue) { setProblem(issue); return; }
    updating = true;
    setBusy(true);
    setMessage("");
    try {
      let permission = Notification.permission;
      if (permission === "default") permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setProblem(browserMessage());
        if (permission !== "denied") setMessage("Necesitamos tu permiso para mostrar avisos en este dispositivo.");
        return;
      }

      await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription()
        ?? await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey(settings.publicKey),
        });
      if (!await confirmSubscription(subscription)) {
        throw new Error("No pudimos confirmar el registro de este dispositivo.");
      }
      if (Notification.permission !== "granted") {
        setProblem(browserMessage());
        return;
      }
      setSettings(current => current ? { ...current, pushEnabled: true } : current);
      setRegistered(true);
      setMessage("Notificaciones activadas en este dispositivo.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No pudimos activar los avisos.");
    } finally {
      updating = false;
      setBusy(false);
    }
  }

  async function disablePush() {
    if (updating) return;
    updating = true;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/notifications/push", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.pushEnabled !== false) throw new Error("No pudimos actualizar la preferencia.");
      setSettings(current => current ? { ...current, pushEnabled: false } : current);
      setRegistered(false);
      setMessage("Los avisos push quedaron desactivados para tu cuenta. Email y avisos internos siguen activos.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No pudimos actualizar la preferencia.");
    } finally {
      updating = false;
      setBusy(false);
    }
  }

  const active = settings?.pushEnabled && registered && !problem;
  const canActivate = !!settings?.available && !!settings.publicKey && !problem && !active;
  const note = problem || (settings && !settings.available ? "Los avisos del dispositivo todavía no están disponibles." : "");

  if (onboarding) {
    if (!showOnboarding) return null;
    return <aside className="push-settings-panel push-onboarding" aria-labelledby="push-onboarding-title">
      <div>
        <h2 id="push-onboarding-title">{active ? "Notificaciones activadas" : note ? "Avisos en este dispositivo" : "Activá las notificaciones de CUEVA"}</h2>
        {!active && !note && <p className="push-settings-description">Recibí avisos importantes del gimnasio directamente en tu celular.</p>}
        {note && <p className="push-settings-note" role="status">{note}</p>}
      </div>
      <div className="push-settings-actions">
        {canActivate && <button type="button" onClick={enablePush} disabled={busy}>{busy ? "Procesando…" : "Activar notificaciones"}</button>}
        <button className="push-secondary" type="button" onClick={() => setShowOnboarding(false)}>{active ? "Cerrar" : "Ahora no"}</button>
      </div>
      {message && <p className="push-settings-message" role="status">{message}</p>}
    </aside>;
  }

  if (!settings && !message) {
    return <section className="push-settings-panel" aria-labelledby="push-settings-title" aria-busy="true">
      <h2 id="push-settings-title">Avisos en este dispositivo</h2>
      <p>Consultando la configuración…</p>
    </section>;
  }

  return <section className="push-settings-panel" aria-labelledby="push-settings-title">
    <div>
      <h2 id="push-settings-title">Avisos en este dispositivo</h2>
      <p className="push-settings-description">
        Podés recibir un aviso en este dispositivo cuando se acerque el vencimiento de tu cuota.
      </p>
    </div>
    {note && <p className="push-settings-note" role="status">{note}</p>}
    {settings && <div className="push-settings-actions">
      {active && <span className="push-settings-status">Notificaciones activadas</span>}
      {canActivate && <button type="button" onClick={enablePush} disabled={busy}>
        {busy ? "Procesando…" : settings.pushEnabled ? "Activar en este dispositivo" : "Volver a activar push"}
      </button>}
      {settings.pushEnabled && (active || note || canActivate) && <button className="push-secondary" type="button" onClick={disablePush} disabled={busy}>Desactivar push en mi cuenta</button>}
      {!settings.pushEnabled && <p className="push-settings-note">Los avisos push están desactivados para tu cuenta.</p>}
    </div>}
    {message && <p className="push-settings-message" role="status">{message}</p>}
  </section>;
}
