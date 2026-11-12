// Recovers from stale page code: after the app updates or the preview restarts, an open tab
// can ask for files that no longer exist ("Importing a module script failed"). Reloading
// fetches the current files. A short cooldown stops reload loops if the server is really down.
const KEY = "bs-chunk-reload-at";
const COOLDOWN_MS = 10_000;

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

export function shouldReload(lastAt: number | null, now: number): boolean {
  return lastAt === null || now - lastAt > COOLDOWN_MS;
}

/** Reloads the page unless it already did so moments ago. Returns true if a reload started. */
export function reloadOnce(): boolean {
  if (typeof window === "undefined") return false;
  let last: number | null = null;
  try {
    const v = sessionStorage.getItem(KEY);
    last = v ? Number(v) : null;
  } catch {}
  const now = Date.now();
  if (!shouldReload(last, now)) return false;
  try {
    sessionStorage.setItem(KEY, String(now));
  } catch {}
  window.location.reload();
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
