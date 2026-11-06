import type { ReactNode } from "react";
import { AdminShell } from "@/components/dashboard/admin-dashboard";
import { BrandMark } from "@/components/brand/brand-mark";
import { ThemePicker } from "@/components/theme/theme-picker";

export function RoutineShell({ email, children }: { email: string; children: ReactNode }) {
  return <AdminShell displayName={email} email={email} role="Administrador" active="rutinas" logo={<BrandMark size={42}/>} themePicker={<ThemePicker/>}>{children}</AdminShell>;
}
