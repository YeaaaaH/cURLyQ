import { usePersistedState } from "./usePersistedState";

export function usePersistedBoolean(key: string, defaultValue: boolean) {
  return usePersistedState(key, defaultValue);
}
