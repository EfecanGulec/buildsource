import { useSyncExternalStore } from "react";
import type { LensResponse } from "./lens.functions";
import type { LensProduct } from "./lens";

type Workspace = { files: File[]; note: string; res: LensResponse | null; products: LensProduct[]; active: number; chosen: string[]; busy: boolean };
const empty = (): Workspace => ({ files: [], note: "", res: null, products: [], active: 0, chosen: [], busy: false });
const serverSnapshot = empty();
const workspaces = new Map<string, Workspace>();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

/** Scoped to the signed-in account and kept for this tab, never shared across accounts. */
export function useLensWorkspace(scope: string) {
  const get = () => {
    let value = workspaces.get(scope);
    if (!value) { value = empty(); workspaces.set(scope, value); }
    return value;
  };
  const state = useSyncExternalStore(subscribe, get, () => serverSnapshot);
  function set<K extends keyof Workspace>(key: K, value: Workspace[K] | ((old: Workspace[K]) => Workspace[K])) {
    const current = get();
    workspaces.set(scope, { ...current, [key]: typeof value === "function" ? (value as (old: Workspace[K]) => Workspace[K])(current[key]) : value });
    listeners.forEach((l) => l());
  }
  return { state, set };
}