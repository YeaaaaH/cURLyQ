import { useState } from "react";

// Wraps a persisted open/closed boolean so an active search can force it
// open without touching the persisted value — the section-level counterpart
// to the ephemeral per-folder override CollectionTree uses. While searching,
// an explicit toggle overrides the forced-open default and resets on the
// next keystroke; clearing the query always reverts to the real persisted
// value, untouched by anything that happened during the search.
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
