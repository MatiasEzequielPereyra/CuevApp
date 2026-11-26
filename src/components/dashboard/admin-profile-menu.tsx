"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { StudentIcon, type StudentIconName } from "@/components/routines/student-icon";
import { getPreference, setPreference, subscribeToPreference, type Preference } from "@/lib/theme";
import "./admin-profile-menu.css";

const themes: { value: Preference; icon: StudentIconName; label: string }[] = [
  { value: "light", icon: "sun", label: "Tema claro" },
  { value: "dark", icon: "moon", label: "Tema oscuro" },
  { value: "system", icon: "monitor", label: "Tema del sistema" },
];

const serverPreference = (): Preference => "system";

export function AdminProfileMenu({
  accountLink, profileActive = false, children,
}: {
  accountLink: string; profileActive?: boolean; children: ReactNode;
}) {
  const preference = useSyncExternalStore(subscribeToPreference, getPreference, serverPreference);

  return <>
    <button type="button" className="dash-profile-link dash-profile-trigger"
      aria-label="Opciones de cuenta" title="Opciones de cuenta" popoverTarget="admin-profile-menu">
      {children}
    </button>
    <div id="admin-profile-menu" className="dash-profile-menu" popover="auto"
      aria-label="Opciones de cuenta del administrador">
      <nav className="dash-profile-menu-actions" aria-label="Cuenta y sesión">
        <a href={accountLink} aria-label="Mi cuenta" title="Mi cuenta"
          aria-current={profileActive ? "page" : undefined}
          onClick={event => event.currentTarget.closest<HTMLElement>("[popover]")?.hidePopover()}>
          <StudentIcon name="user" />
        </a>
        <form method="post" action="/api/acceso/salir">
          <button className="dash-profile-signout" type="submit" aria-label="Cerrar sesión" title="Cerrar sesión">
            <StudentIcon name="log-out" />
          </button>
        </form>
      </nav>
      <div className="dash-profile-menu-themes" role="group" aria-label="Apariencia">
        {themes.map(({ value, icon, label }) => (
          <button key={value} type="button" aria-label={label} title={label}
            aria-pressed={preference === value} onClick={() => setPreference(value)}>
            <StudentIcon name={icon} />
          </button>
        ))}
      </div>
    </div>
  </>;
}
