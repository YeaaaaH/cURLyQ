import { useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import {
  type Collection,
  type RequestNode,
  addNodeToCollection,
  buildPostmanCollection,
  collectRequestIds,
  countNodes,
  createCollection,
  createFolderNode,
  createRequestNode,
  deleteCollection,
  deleteCollectionNode,
  findCollectionNode,
  moveNodeRelativeToTarget,
  parsePostmanCollection,
  renameCollection,
  renameCollectionNode,
} from "@/lib/collections";
import { type ImportExportLogEntry, pluralize } from "@/lib/importExportLog";
import { runImportExportWithFeedback } from "@/lib/importExportFeedback";

interface UseCollectionsParams {
  collections: Collection[];
  setCollections: React.Dispatch<React.SetStateAction<Collection[]>>;
  closeTabsForRequestIds: (deletedIds: Set<string>) => void;
  openCollectionRequestTab: (collectionId: string, node: RequestNode) => void;
  onLogEntry: (entry: Omit<ImportExportLogEntry, "id" | "timestamp">) => void;
}

function describeCollectionCounts(items: Collection["items"]): string {
  const counts = countNodes(items);
  const parts: string[] = [];
  if (counts.folders > 0) parts.push(pluralize(counts.folders, "folder"));
  if (counts.requests > 0) parts.push(pluralize(counts.requests, "request"));
  return parts.length > 0 ? parts.join(", ") : "empty";
}

export function useCollections({
  collections,
  setCollections,
  closeTabsForRequestIds,
  openCollectionRequestTab,
  onLogEntry,
}: UseCollectionsParams) {
  // Restore saved collections, if any, on mount.
  useEffect(() => {
    invoke<Collection[]>("load_collections").then((saved) => {
      if (saved.length > 0) setCollections(saved);
    });
  }, [setCollections]);

  // Debounced autosave, same pattern as environments/tabs.
  useEffect(() => {
    const timeout = setTimeout(() => {
      invoke("save_collections", { collections });
    }, 500);
    return () => clearTimeout(timeout);
  }, [collections]);

  // Every handler below is wrapped in useCallback so it stays referentially
  // stable across unrelated App re-renders (e.g. typing in the active
  // request's URL/body) — Sidebar is wrapped in React.memo, and any one
  // prop with a new identity on every render would defeat that regardless
  // of the rest being stable.
  const handleAddCollection = useCallback((): string => {
    const collection = createCollection("New Collection");
    setCollections((prev) => [...prev, collection]);
    return collection.id;
  }, [setCollections]);

  const handleRenameCollection = useCallback(
    (id: string, name: string) => {
      setCollections((prev) => renameCollection(prev, id, name));
    },
    [setCollections]
  );

  const handleDeleteCollection = useCallback(
    (id: string) => {
      const collection = collections.find((c) => c.id === id);
      setCollections((prev) => deleteCollection(prev, id));
      if (collection) {
        closeTabsForRequestIds(new Set(collection.items.flatMap(collectRequestIds)));
      }
    },
    [collections, setCollections, closeTabsForRequestIds]
  );

  const handleAddFolder = useCallback(
    (collectionId: string, parentFolderId: string | null): string => {
      const folder = createFolderNode("New Folder");
      setCollections((prev) => addNodeToCollection(prev, collectionId, parentFolderId, folder));
      return folder.id;
    },
    [setCollections]
  );

  // Creating a request always opens it in a new tab immediately, since the
  // tree row alone has nowhere to edit method/URL/params — same reasoning as
  // why folders (which have nothing to "open") stay in tree-inline-rename
  // instead.
  const handleAddRequestNode = useCallback(
    (collectionId: string, parentFolderId: string | null): string => {
      const node = createRequestNode("New Request");
      setCollections((prev) => addNodeToCollection(prev, collectionId, parentFolderId, node));
      openCollectionRequestTab(collectionId, node);
      return node.id;
    },
    [setCollections, openCollectionRequestTab]
  );

  const handleRenameCollectionNode = useCallback(
    (collectionId: string, nodeId: string, name: string) => {
      setCollections((prev) => renameCollectionNode(prev, collectionId, nodeId, name));
    },
    [setCollections]
  );

  const handleDeleteCollectionNode = useCallback(
    (collectionId: string, nodeId: string) => {
      const node = findCollectionNode(collections, collectionId, nodeId);
      setCollections((prev) => deleteCollectionNode(prev, collectionId, nodeId));
      if (node) {
        closeTabsForRequestIds(new Set(collectRequestIds(node)));
      }
    },
    [collections, setCollections, closeTabsForRequestIds]
  );

  const handleMoveCollectionNode = useCallback(
    (draggedId: string, targetId: string) => {
      setCollections((prev) => moveNodeRelativeToTarget(prev, draggedId, targetId));
    },
    [setCollections]
  );

  const handleImportCollection = useCallback(async () => {
    const path = await open({
      multiple: false,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!path) return;
    const fileName = path.split(/[\\/]/).pop() ?? path;

    await runImportExportWithFeedback({
      onLogEntry,
      direction: "import",
      kind: "collection",
      fallbackLabel: fileName,
      operation: async () => {
        const raw = await invoke<string>("read_text_file", { path });
        const { collection, skippedBodyCount } = parsePostmanCollection(JSON.parse(raw), collections);
        setCollections((prev) => [...prev, collection]);
        const detail = describeCollectionCounts(collection.items);
        const toastDescription =
          skippedBodyCount > 0
            ? `${detail} — ${pluralize(skippedBodyCount, "request")} had an unsupported body, imported empty`
            : undefined;
        return { label: collection.name, detail, toastDescription };
      },
    });
  }, [collections, setCollections, onLogEntry]);

  const handleExportCollection = useCallback(
    async (id: string) => {
      const collection = collections.find((c) => c.id === id);
      if (!collection) return;

      const path = await save({
        defaultPath: `${collection.name}.postman_collection.json`,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!path) return;

      await runImportExportWithFeedback({
        onLogEntry,
        direction: "export",
        kind: "collection",
        fallbackLabel: collection.name,
        operation: async () => {
          const json = JSON.stringify(buildPostmanCollection(collection), null, 2);
          await invoke("write_text_file", { path, contents: json });
          const detail = describeCollectionCounts(collection.items);
          return { label: collection.name, detail };
        },
      });
    },
    [collections, onLogEntry]
  );

  return {
    handleAddCollection,
    handleRenameCollection,
    handleDeleteCollection,
    handleAddFolder,
    handleAddRequestNode,
    handleRenameCollectionNode,
    handleDeleteCollectionNode,
    handleMoveCollectionNode,
    handleImportCollection,
    handleExportCollection,
  };
}
