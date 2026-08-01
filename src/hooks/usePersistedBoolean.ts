import { useEffect, useState } from "react";

function loadBoolean(key: string, defaultValue: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? defaultValue : JSON.parse(raw);
  } catch {
    return defaultValue;
  }
}

// Small localStorage-backed boolean for UI state that should survive a
// reload (e.g. a section's open/closed state) — same treatment as
// expandedById in useCollectionTreeState.ts, generalized to one value.
export function usePersistedBoolean(key: string, defaultValue: boolean) {
  const [value, setValue] = useState(() => loadBoolean(key, defaultValue));

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
}
