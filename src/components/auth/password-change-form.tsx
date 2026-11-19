"use client";

import { useState, type FormEvent } from "react";
import { canSubmitPasswordChange } from "@/lib/student-profile-form-validation";

/** Only the readiness flag enters React state; passwords stay in their input elements. */
export function PasswordChangeForm({ gateUntilValid = false }: { gateUntilValid?: boolean } = {}) {
  const [ready, setReady] = useState(false);

  function updateAvailability(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const current = form.elements.namedItem("current_password") as HTMLInputElement | null;
    const next = form.elements.namedItem("new_password") as HTMLInputElement | null;
    const confirmation = form.elements.namedItem("confirm_password") as HTMLInputElement | null;
    setReady(Boolean(current && next && confirmation
      && canSubmitPasswordChange(current.value, next.value, confirmation.value, form.checkValidity())));
  }

  return <form className={gateUntilValid ? "access-fields student-profile-form" : "access-fields"}
    method="post" action="/api/acceso/cambiar-contrasena"
    onInput={gateUntilValid ? updateAvailability : undefined}
    onChange={gateUntilValid ? updateAvailability : undefined}>
    <label htmlFor="current-password">Contraseña actual</label>
    <input id="current-password" type="password" name="current_password" autoComplete="current-password" maxLength={1024} required />
    <label htmlFor="new-password">Nueva contraseña</label>
    <input id="new-password" type="password" name="new_password" autoComplete="new-password" minLength={8} maxLength={1024} required />
    <label htmlFor="confirm-password">Confirmar nueva contraseña</label>
    <input id="confirm-password" type="password" name="confirm_password" autoComplete="new-password" minLength={8} maxLength={1024} required />
    <p>Usá al menos 8 caracteres. Tu contraseña no se muestra ni se guarda en texto plano.</p>
    <button type="submit" disabled={gateUntilValid && !ready}>Actualizar contraseña</button>
  </form>;
}
