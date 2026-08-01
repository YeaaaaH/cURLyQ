import type { CollectionNode, RequestNode } from "@/lib/collections";

export type AddTreeNode = (collectionId: string, parentFolderId: string | null) => string;
export type SetExpanded = (id: string, expanded: boolean) => void;
export type RenameNode = (collectionId: string, nodeId: string, name: string) => void;
export type OpenRequest = (collectionId: string, node: RequestNode) => void;

// Bag of callbacks + UI state threaded down through every row in the tree —
// shared by CollectionRow, NodeRow, FolderRow, and RequestRow.
export interface TreeHandlers {
  renamingId: string | null;
  onStartRename: (id: string) => void;
  onCancelRename: () => void;
  onOpenRequest: OpenRequest;
  onAddFolder: AddTreeNode;
  onAddRequest: AddTreeNode;
  onRenameNode: RenameNode;
  requestDeleteNode: (collectionId: string, node: CollectionNode) => void;
  isOpen: (id: string, defaultOpen: boolean) => boolean;
  setOpen: SetExpanded;
  isDragActive: boolean;
}

// Explicit, serializable delete-confirmation state — avoids storing a
// closure (and its captured props/variables) directly in React state.
// idsToForget is every id in the subtree being deleted (itself included),
// computed up front so confirmDelete can sweep expand state without needing
// the original node/collection object back.
export type PendingDelete =
  | { type: "collection"; collectionId: string; title: string; description: string; idsToForget: string[] }
  | { type: "node"; collectionId: string; nodeId: string; title: string; description: string; idsToForget: string[] };
