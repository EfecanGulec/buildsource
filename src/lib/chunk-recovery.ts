// Recovers from stale page code: after the app updates or the preview restarts, an open tab
// can ask for files that no longer exist ("Importing a module script failed"). Reloading
// fetches the current files. A short cooldown stops reload loops if the server is really down.
const KEY = "bs-chunk-reload";
// A preview restart can take a few seconds, so one reload may land mid-restart and fail again.
// Allow a few reloads, each waiting a little longer, then stop so a real outage cannot loop.
const WINDOW_MS = 120_000;
const FAST_RELOADS = 3;
const MAX_RELOADS = 6;
const SLOW_MS = 10_000; // a long preview restart outlasts the fast retries; wait it out
const STEP_MS = 800;

export type ReloadState = { first: number; count: number } | null;

/** Next state and delay if another reload is allowed, else null. */
export function nextReload(state: ReloadState, now: number): { state: { first: number; count: number }; delay: number } | null {
  if (!state || now - state.first > WINDOW_MS) return { state: { first: now, count: 1 }, delay: 0 };
  if (state.count >= MAX_RELOADS) return null;
  return { state: { first: state.first, count: state.count + 1 }, delay: state.count < FAST_RELOADS ? state.count * STEP_MS : SLOW_MS };
}

const PATTERNS = [
  /importing a module script failed/i, // Safari
  /failed to fetch dynamically imported module/i, // Chrome
  /error loading dynamically imported module/i, // Firefox
  /unable to preload css/i,
  /loading (css )?chunk \S+ failed/i,
];

export function isChunkLoadError(err: unknown): boolean {
  const msg =
    typeof err === "string" ? err : err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : "";
  return PATTERNS.some((p) => p.test(msg));
}

let pending = false;
declare global {
  interface Window { __bsReload?: () => boolean }
}

/** Bypass an already-cached document while keeping the current path, search and hash. */
export function recoveryUrl(href: string, now: number): string {
  const url = new URL(href);
  url.searchParams.set("__bs_refresh", String(now));
  return url.href;
}

export function refreshCurrentPage() {
  sessionStorage.removeItem(KEY);
  window.location.replace(recoveryUrl(window.location.href, Date.now()));
}

/** All error listeners share one scheduler and one bounded retry budget. */
export function reloadOnce(): boolean {
  if (typeof window === "undefined") return false;
  if (window.__bsReload) return window.__bsReload();
  if (pending) return true;
  let state: ReloadState = null;
  try {
    const v = sessionStorage.getItem(KEY);
    state = v ? (JSON.parse(v) as ReloadState) : null;
  } catch {}
  const next = nextReload(state, Date.now());
  if (!next) return false;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(next.state));
  } catch {}
  pending = true;
  setTimeout(() => window.location.replace(recoveryUrl(window.location.href, Date.now())), next.delay);
  return true;
}

let installed = false;
export function installChunkRecovery() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("vite:preloadError", (e) => {
    e.preventDefault();
    reloadOnce();
  });
  window.addEventListener("unhandledrejection", (e) => {
    if (isChunkLoadError(e.reason)) {
      e.preventDefault();
      reloadOnce();
    }
  });
  window.addEventListener("error", (e) => {
    if (isChunkLoadError(e.error ?? e.message)) reloadOnce();
  });
}
