import { useSyncExternalStore } from "react";

/**
 * Light / dark / system theme (design system §2.1, D1).
 * Persisted in localStorage ("bs-theme"); the inline script in __root.tsx applies
 * the class before first paint so there is no flash.
 */

export type Theme = "light" | "dark" | "system";

const KEY = "bs-theme";
const listeners = new Set<() => void>();

export function getTheme(): Theme {
  if (typeof window === "undefined") return "system";
  const v = window.localStorage.getItem(KEY);
  return v === "light" || v === "dark" ? v : "system";
}

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const dark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function setTheme(theme: Theme) {
  if (theme === "system") window.localStorage.removeItem(KEY);
  else window.localStorage.setItem(KEY, theme);
  applyTheme(theme);
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  // Follow OS changes while theme is "system"
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onMq = () => {
    if (getTheme() === "system") applyTheme("system");
  };
  mq.addEventListener("change", onMq);
  return () => {
    listeners.delete(cb);
    mq.removeEventListener("change", onMq);
  };
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const theme = useSyncExternalStore(subscribe, getTheme, () => "system" as Theme);
  return [theme, setTheme];
}
