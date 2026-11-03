"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

export default function OwnerInvitation({ nonce, generation, type }: { nonce: string; generation: string; type: string }) {
  const session = useRef<{ accessToken: string; refreshToken: string } | null>(null);
  const busy = useRef(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const fragment = window.location.hash;
    if (!fragment) return;
    // Remove the capability before parsing or interaction. Never persist tokens
    // in storage, DOM inputs, component props, logs or a second URL.
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    if (fragment.length > 8192) return;
    const params = new URLSearchParams(fragment.slice(1));
    const accessToken = params.get("access_token"), refreshToken = params.get("refresh_token");
    if (accessToken && refreshToken) session.current = { accessToken, refreshToken };
  }, []);

  async function accept(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const current = session.current;
    if (!current) { setMessage("No se pudo leer la invitación. Volvé al correo y abrí el enlace."); return; }
    busy.current = true;
    setMessage("Comprobando invitación…");
    try {
      const result = await fetch("/api/acceso/owner-invitacion", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ access_token: current.accessToken, refresh_token: current.refreshToken, nonce, generation, type }) });
      if (!result.ok) { setMessage("No se pudo aceptar la invitación. Probá nuevamente en unos minutos."); return; }
      session.current = null;
      window.location.replace("/crear-contrasena");
    } catch { setMessage("No se pudo completar la solicitud. Probá nuevamente en unos minutos."); }
    finally { busy.current = false; }
  }
  return <form onSubmit={accept}><button>Aceptar y continuar</button><p role="status">{message}</p></form>;
}
