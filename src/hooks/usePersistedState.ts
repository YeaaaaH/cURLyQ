import { useEffect, useState } from "react";

function loadPersisted<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? defaultValue : (JSON.parse(raw) as T);
  } catch {
    return defaultValue;
  }
}

export function usePersistedState<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(() => loadPersisted(key, defaultValue));

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
}
