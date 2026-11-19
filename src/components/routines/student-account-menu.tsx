"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { getPreference, setPreference, subscribeToPreference, type Preference } from "@/lib/theme";
import { StudentIcon, type StudentIconName } from "./student-icon";
import "./student-account-menu.css";

const themes: { value: Preference; icon: StudentIconName; label: string }[] = [
  { value: "light", icon: "sun", label: "Tema claro" },
  { value: "dark", icon: "moon", label: "Tema oscuro" },
  { value: "system", icon: "monitor", label: "Tema del sistema" },
];

const serverPreference = (): Preference => "system";

export function StudentAccountMenu({ profileActive = false }: { profileActive?: boolean }) {
  const preference = useSyncExternalStore(subscribeToPreference, getPreference, serverPreference);

  return (
    <div className="student-account">
      <button type="button" className="student-account-trigger" popoverTarget="student-account-popover"
        aria-label="Opciones de cuenta" title="Opciones de cuenta">
        <StudentIcon name="user" />
      </button>
      <div id="student-account-popover" className="student-account-popover" popover="auto"
        aria-label="Opciones de cuenta del alumno">
        <nav className="student-account-actions" aria-label="Cuenta y sesión">
          <Link href="/mi-perfil" aria-label="Mi cuenta" title="Mi cuenta"
            aria-current={profileActive ? "page" : undefined}
            onClick={event => event.currentTarget.closest<HTMLElement>("[popover]")?.hidePopover()}>
            <StudentIcon name="user" />
          </Link>
          <form method="post" action="/api/acceso/salir">
            <button className="student-account-signout" type="submit" aria-label="Cerrar sesión" title="Cerrar sesión">
              <StudentIcon name="log-out" />
            </button>
          </form>
        </nav>
        <div className="student-account-themes" role="group" aria-label="Apariencia">
          {themes.map(({ value, icon, label }) => (
            <button key={value} type="button" aria-label={label} title={label}
              aria-pressed={preference === value} onClick={() => setPreference(value)}>
              <StudentIcon name={icon} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
