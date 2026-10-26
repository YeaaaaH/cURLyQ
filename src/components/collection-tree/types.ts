import type { CollectionNode, RequestNode } from "@/lib/collections";

export type AddTreeNode = (collectionId: string, parentFolderId: string | null) => string;
export type SetExpanded = (id: string, expanded: boolean) => void;
export type RenameNode = (collectionId: string, nodeId: string, name: string) => void;
export type OpenRequest = (collectionId: string, node: RequestNode) => void;

export interface TreeHandlers {
  query: string;
  renamingId: string | null;
  onStartRename: (id: string) => void;
  onCancelRename: () => void;
  onOpenRequest: OpenRequest;
  onAddFolder: AddTreeNode;
  onAddRequest: AddTreeNode;
  onRunNode: (collectionId: string, node: CollectionNode) => void;
  onRenameNode: RenameNode;
  requestDeleteNode: (collectionId: string, node: CollectionNode) => void;
  isOpen: (id: string, defaultOpen: boolean) => boolean;
  setOpen: SetExpanded;
  isDragActive: boolean;
  runningId: string | null;
}

// Plain data rather than a stored closure, so confirming can't act on stale props.
export type PendingDelete =
  | { type: "collection"; collectionId: string; title: string; description: string; idsToForget: string[] }
  | { type: "node"; collectionId: string; nodeId: string; title: string; description: string; idsToForget: string[] };
