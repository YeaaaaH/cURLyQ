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

export function useCollectionTreeState() {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [expandedById, setExpandedById] = useState<Record<string, boolean>>(loadExpanded);

  useEffect(() => {
    localStorage.setItem(EXPANDED_STORAGE_KEY, JSON.stringify(expandedById));
  }, [expandedById]);

  const isOpen = useCallback((id: string, defaultOpen: boolean) => expandedById[id] ?? defaultOpen, [expandedById]);

  const setOpen = useCallback((id: string, open: boolean) => {
    setExpandedById((current) => (current[id] === open ? current : { ...current, [id]: open }));
  }, []);

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
