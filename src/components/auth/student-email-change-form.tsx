"use client";

import { useState, type FormEvent } from "react";
import { canSubmitEmailChange } from "@/lib/student-profile-form-validation";

export function StudentEmailChangeForm({ currentEmail }: { currentEmail: string }) {
  const [ready, setReady] = useState(false);

  function updateAvailability(event: FormEvent<HTMLFormElement>) {
    const input = event.currentTarget.elements.namedItem("email") as HTMLInputElement | null;
    if (!input) return setReady(false);
    setReady(canSubmitEmailChange(input.value, currentEmail, input.validity.valid));
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
