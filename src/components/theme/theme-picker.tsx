"use client";

import { useSyncExternalStore } from "react";
import { getPreference, setPreference, subscribeToPreference, type Preference } from "@/lib/theme";

const options: { value: Preference; label: string }[] = [
  { value: "light", label: "Claro" },
  { value: "dark", label: "Oscuro" },
  { value: "system", label: "Sistema" },
];
const serverPreference = () => "system" as const;

export function ThemePicker() {
  const preference = useSyncExternalStore(subscribeToPreference, getPreference, serverPreference);

  return (
    <div className="theme-picker" role="group" aria-label="Elegir tema">
      {options.map(({ value, label }) => (
        <button key={value} type="button" aria-pressed={preference === value} onClick={() => setPreference(value)}>
          {label}
        </button>
      ))}
    </div>
  );
}
