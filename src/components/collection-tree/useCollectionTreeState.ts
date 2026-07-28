import { useCallback, useState } from "react";

// Owns the tree's rename and expand/collapse UI state — controlled (rather
// than each Collapsible's own defaultOpen) so creating something inside a
// container can force it open to reveal what was just added.
export function useCollectionTreeState() {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [expandedById, setExpandedById] = useState<Record<string, boolean>>({});

  const isOpen = useCallback((id: string, defaultOpen: boolean) => expandedById[id] ?? defaultOpen, [expandedById]);

  const setOpen = useCallback((id: string, open: boolean) => {
    setExpandedById((current) => (current[id] === open ? current : { ...current, [id]: open }));
  }, []);

  const startRenaming = useCallback((id: string) => {
    setRenamingId(id);
  }, []);

  const cancelRenaming = useCallback(() => {
    setRenamingId(null);
  }, []);

  return { renamingId, startRenaming, cancelRenaming, isOpen, setOpen };
}
