"use client";

import { useState, type FormEvent } from "react";

export function StudentEmailChangeForm({ currentEmail }: { currentEmail: string }) {
  const [ready, setReady] = useState(false);
  const existing = currentEmail.trim().toLocaleLowerCase("es-AR");

  function updateAvailability(event: FormEvent<HTMLFormElement>) {
    const input = event.currentTarget.elements.namedItem("email") as HTMLInputElement | null;
    if (!input) return setReady(false);
    const next = input.value.trim();
    setReady(next.length > 0 && input.validity.valid && next.toLocaleLowerCase("es-AR") !== existing);
  }

  return (
    <form className="access-fields student-profile-form" method="post"
      action="/api/acceso/cambiar-correo" onInput={updateAvailability} onChange={updateAvailability}>
      <label htmlFor="student-new-email">Nuevo correo electrónico</label>
      <input id="student-new-email" type="email" name="email" autoComplete="email"
        maxLength={254} placeholder="nombre@ejemplo.com" required />
      <button type="submit" disabled={!ready}>Enviar verificación</button>
    </form>
  );
}
