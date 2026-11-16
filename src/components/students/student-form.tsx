"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export type Student = { id: string; first_name: string; last_name: string; email: string; dni: string | null; joined_on: string; active: boolean };

export function StudentForm({ student, defaultJoinedOn }: { student?: Student; defaultJoinedOn: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [id] = useState(() => student?.id ?? crypto.randomUUID());

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/alumnos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id, edit: !!student, first_name: form.get("first_name"), last_name: form.get("last_name"),
          email: form.get("email"), dni: form.get("dni"), joined_on: form.get("joined_on"),
          active: form.get("active") === "true", invite: !student && form.get("invite") === "on",
        }),
      });
      const data = await response.json();
      if (response.ok) {
        router.push(`/alumnos?id=${data.id}&guardado=1${data.invitation ? `&invitacion=${encodeURIComponent(data.invitation.state)}` : ""}`);
      } else {
        setMessage(data.message);
      }
    } catch {
      setMessage("No se pudo conectar. Tus datos siguen en el formulario.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="student-form students-panel" onSubmit={save}>
      <div className="students-form-fields">
        <label>Nombre<input name="first_name" required maxLength={80} defaultValue={student?.first_name} /></label>
        <label>Apellido<input name="last_name" required maxLength={80} defaultValue={student?.last_name} /></label>
        <label>Correo electrónico<input name="email" type="email" required maxLength={254} defaultValue={student?.email} /></label>
        <label>DNI (opcional)<input name="dni" inputMode="numeric" pattern="[0-9]{6,10}" maxLength={10} defaultValue={student?.dni ?? ""} /></label>
        <label>Fecha de alta<input name="joined_on" type="date" required min="1900-01-01" max="2100-12-31" defaultValue={student?.joined_on ?? defaultJoinedOn} /></label>
        <div className="students-form-field">
          <label>Estado administrativo
            <select name="active" defaultValue={student?.active === false ? "false" : "true"} aria-describedby="students-active-help">
              <option value="true">Activo</option>
              <option value="false">Inactivo</option>
            </select>
          </label>
          <p id="students-active-help">Este estado es independiente de los pagos.</p>
        </div>
      </div>
      {!student && (
        <div className="students-form-invitation">
          <label className="student-invite-option">
            <input type="checkbox" name="invite" defaultChecked aria-describedby="students-invite-help" />
            Enviar invitación para acceder a CUEVA
          </label>
          <p id="students-invite-help">Si el envío falla o el correo general está cerrado, la ficha se conserva y muestra su estado de invitación.</p>
        </div>
      )}
      {message && <p role="alert">{message}</p>}
      <button className="students-action students-primary" type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar ficha"}</button>
    </form>
  );
}
