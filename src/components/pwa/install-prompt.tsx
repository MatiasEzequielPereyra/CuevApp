"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./install-prompt.module.css";

type Platform = "android" | "ios-chrome" | "ios-safari";
type PromptEvent = Event & { prompt: () => Promise<{ outcome?: string }> };
const INSTALLED = "cueva:pwa:installed:v1";
const DISMISSED_UNTIL = "cueva:pwa:dismissed-until:v1";
const REMIND_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

function getStored(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return null; }
}

function setStored(key: string, value: string) {
  try { window.localStorage.setItem(key, value); } catch { /* Modo privado / storage deshabilitado. */ }
}

function installedMode() {
  return window.matchMedia("(display-mode: standalone)").matches
    || window.matchMedia("(display-mode: fullscreen)").matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function phonePlatform(): Platform | null {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (ios) return /CriOS/i.test(ua) ? "ios-chrome" : "ios-safari";
  return /Android/i.test(ua) ? "android" : null;
}

export function PwaInstallPrompt() {
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [canPrompt, setCanPrompt] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const deferred = useRef<PromptEvent | null>(null);

  useEffect(() => {
    let active = true;
    const update = () => {
      if (!active) return;
      const suppressed = installedMode() || getStored(INSTALLED) === "true"
        || Number(getStored(DISMISSED_UNTIL) ?? "0") > Date.now();
      setPlatform(suppressed ? null : phonePlatform());
    };
    const frame = window.requestAnimationFrame(update);
    const beforeInstall = (event: Event) => {
      if (!("prompt" in event) || typeof (event as PromptEvent).prompt !== "function") return;
      event.preventDefault();
      deferred.current = event as PromptEvent;
      if (active) setCanPrompt(true);
    };
    const installed = () => {
      setStored(INSTALLED, "true");
      deferred.current = null;
      if (active) { setCanPrompt(false); setPlatform(null); }
    };
    const display = window.matchMedia("(display-mode: standalone)");
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", installed);
    display.addEventListener?.("change", update);
    return () => {
      active = false;
      window.cancelAnimationFrame(frame);
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", installed);
      display.removeEventListener?.("change", update);
    };
  }, []);

  function dismiss() {
    setStored(DISMISSED_UNTIL, String(Date.now() + REMIND_AFTER_MS));
    setPlatform(null);
  }

  function alreadyInstalled() {
    setStored(INSTALLED, "true");
    setPlatform(null);
  }

  async function promptInstallation() {
    const pending = deferred.current;
    if (!pending || busy) { setExpanded(true); return; }
    deferred.current = null;
    setCanPrompt(false);
    setBusy(true);
    try {
      const result = await pending.prompt();
      if (result?.outcome === "accepted") dismiss();
      else setExpanded(true);
    } catch {
      setExpanded(true);
    } finally {
      setBusy(false);
    }
  }

  if (!platform) return null;
  const onIphone = platform !== "android";
  const instruction = platform === "ios-chrome"
    ? "En Chrome, tocá Compartir junto a la barra de direcciones, elegí Agregar a pantalla de inicio y confirmá Agregar."
    : platform === "ios-safari"
      ? "En Safari, tocá Compartir, elegí Agregar a pantalla de inicio y confirmá Agregar."
      : "En Chrome para Android, tocá el menú de tres puntos (⋮) y elegí Instalar aplicación o Agregar a pantalla principal.";

  return <aside className={styles.banner} aria-labelledby="cueva-install-title" data-testid="pwa-install-prompt">
    <div className={styles.heading}>
      <span aria-hidden="true" className={styles.logo}/>
      <div>
        <p className={styles.label}>CUEVA EN TU CELULAR</p>
        <h2 id="cueva-install-title">Instalá CUEVA</h2>
      </div>
      <button type="button" className={styles.close} aria-label="Cerrar aviso de instalación" onClick={dismiss}>×</button>
    </div>
    <p className={styles.description}>Tené tu gimnasio a un toque, directo desde la pantalla de inicio.</p>
    {(onIphone || expanded) && <p className={styles.steps} id="cueva-install-instructions">{instruction}</p>}
    <div className={styles.actions}>
      {platform === "android" && canPrompt
        ? <button className={styles.primary} type="button" disabled={busy} onClick={() => { void promptInstallation(); }}>
          {busy ? "Abriendo…" : "Instalar ahora"}
        </button>
        : !onIphone && !expanded
          ? <button className={styles.primary} type="button" onClick={() => setExpanded(true)} aria-expanded={expanded} aria-controls="cueva-install-instructions">Cómo instalar</button>
          : null}
      <button className={styles.secondary} type="button" onClick={dismiss}>Ahora no</button>
      <button className={styles.textButton} type="button" onClick={alreadyInstalled}>Ya la instalé</button>
    </div>
  </aside>;
}
