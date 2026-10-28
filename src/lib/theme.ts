export const THEME_KEY = "cueva:appearance:v1";
export const THEME_EVENT = "cueva:appearance-change";
export type Preference = "light" | "dark" | "system";

function normalize(value: string | null): Preference {
  return value === "light" || value === "dark" ? value : "system";
}

function storedPreference(): Preference {
  try {
    return normalize(localStorage.getItem(THEME_KEY));
  } catch {
    return "system";
  }
}

function applyPreference(preference: Preference) {
  const root = document.documentElement;
  root.dataset.preference = preference;
  root.dataset.theme = preference === "system"
    ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : preference;
}

export function getPreference(): Preference {
  return normalize(document.documentElement.dataset.preference ?? null);
}

export function setPreference(preference: Preference) {
  applyPreference(preference);
  try {
    localStorage.setItem(THEME_KEY, preference);
  } catch {
    // Appearance still works for this page when storage is unavailable.
  }
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function subscribeToPreference(onChange: () => void) {
  const media = matchMedia("(prefers-color-scheme: dark)");
  const onMediaChange = () => {
    if (getPreference() === "system") applyPreference("system");
    onChange();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_KEY || event.key === null) {
      applyPreference(storedPreference());
      onChange();
    }
  };
  window.addEventListener(THEME_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  media.addEventListener("change", onMediaChange);
  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
    media.removeEventListener("change", onMediaChange);
  };
}

// Fixed application-owned script; no user input is interpolated. Runs before paint.
export const THEME_BOOTSTRAP = `(function(){var p='system';try{var s=localStorage.getItem('${THEME_KEY}');if(s==='light'||s==='dark')p=s}catch{}var r=document.documentElement;r.dataset.preference=p;r.dataset.theme=p==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):p})()`;
