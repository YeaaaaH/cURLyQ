import { usePersistedState } from "./usePersistedState";

// Thin boolean-typed wrapper around usePersistedState, kept for callers that
// don't need the generic form.
export function usePersistedBoolean(key: string, defaultValue: boolean) {
  return usePersistedState(key, defaultValue);
}
