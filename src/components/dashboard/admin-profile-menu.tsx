"use client";

import type { ReactNode } from "react";
import "./admin-profile-menu.css";

export function AdminProfileMenu({ accountLink, children }: { accountLink: string; children: ReactNode }) {
  return <>
    <button type="button" className="dash-profile-link dash-profile-trigger" aria-label="Opciones de cuenta" popoverTarget="admin-profile-menu">
      {children}
    </button>
    <div id="admin-profile-menu" className="dash-profile-menu" popover="auto">
      <a href={accountLink} tabIndex={0} onClick={event => {
        event.currentTarget.closest<HTMLDivElement>("[popover]")?.hidePopover();
      }}>
        Ir a tu cuenta
      </a>
      <form method="post" action="/api/acceso/salir">
        <button type="submit">Cerrar sesión</button>
      </form>
    </div>
  </>;
}
