import { useState } from "react";

// Forces a persisted open/closed value open during search without overwriting it.
export function useSearchForcedOpen(
  query: string,
  persistedOpen: boolean,
  setPersistedOpen: (open: boolean) => void
): [boolean, (open: boolean) => void] {
  const isSearching = query.trim() !== "";
  const [override, setOverride] = useState<boolean | null>(null);

  const [queryAtLastReset, setQueryAtLastReset] = useState(query);
  if (query !== queryAtLastReset) {
    setQueryAtLastReset(query);
    setOverride(null);
  }

  const isOpen = isSearching ? (override ?? true) : persistedOpen;

  function setOpen(open: boolean) {
    if (isSearching) setOverride(open);
    else setPersistedOpen(open);
  }

  return [isOpen, setOpen];
}
