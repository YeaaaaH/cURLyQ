import { useCallback, useEffect, useState } from "react";

const EXPANDED_STORAGE_KEY = "curlyq-collection-tree-expanded";

function loadExpanded(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(EXPANDED_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// Owns the tree's rename and expand/collapse UI state — controlled (rather
// than each Collapsible's own defaultOpen) so creating something inside a
// container can force it open to reveal what was just added.
export function useCollectionTreeState() {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [expandedById, setExpandedById] = useState<Record<string, boolean>>(loadExpanded);

  // Expand state is a UI preference, not shared request data, so it's
  // persisted to localStorage directly rather than round-tripping through
  // Rust like collections themselves — same treatment as
  // activeEnvironmentId in useEnvironments.ts.
  useEffect(() => {
    localStorage.setItem(EXPANDED_STORAGE_KEY, JSON.stringify(expandedById));
  }, [expandedById]);

  const isOpen = useCallback((id: string, defaultOpen: boolean) => expandedById[id] ?? defaultOpen, [expandedById]);

  const setOpen = useCallback((id: string, open: boolean) => {
    setExpandedById((current) => (current[id] === open ? current : { ...current, [id]: open }));
  }, []);

  // Sweeps a deleted node (and, for a deleted folder, everything that was
  // inside it) out of expand state — otherwise stale ids accumulate forever
  // since nothing else ever removes them.
  const forgetIds = useCallback((ids: readonly string[]) => {
    if (ids.length === 0) return;
    setExpandedById((current) => {
      const next = { ...current };
      let changed = false;
      for (const id of ids) {
        if (id in next) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, []);

  const startRenaming = useCallback((id: string) => {
    setRenamingId(id);
  }, []);

  const cancelRenaming = useCallback(() => {
    setRenamingId(null);
  }, []);

  return { renamingId, startRenaming, cancelRenaming, isOpen, setOpen, forgetIds };
}
