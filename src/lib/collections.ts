import type { KeyValuePair } from "@/lib/keyValue";

export interface FolderNode {
  type: "folder";
  id: string;
  name: string;
  items: CollectionNode[];
}

export interface RequestNode {
  type: "request";
  id: string;
  name: string;
  method: string;
  url: string;
  params: KeyValuePair[];
  headers: KeyValuePair[];
  body: string;
}

export type CollectionNode = FolderNode | RequestNode;

export interface Collection {
  id: string;
  name: string;
  items: CollectionNode[];
}

export function createCollection(name: string): Collection {
  return { id: crypto.randomUUID(), name, items: [] };
}

export function createFolderNode(name: string): FolderNode {
  return { type: "folder", id: crypto.randomUUID(), name, items: [] };
}

export function createRequestNode(name: string): RequestNode {
  return {
    type: "request",
    id: crypto.randomUUID(),
    name,
    method: "GET",
    url: "",
    params: [],
    headers: [],
    body: "",
  };
}

// Recursively transforms the node matching `id`, leaving everything else
// untouched. Used for renaming a folder/request anywhere in the tree.
function mapItems(
  items: CollectionNode[],
  id: string,
  fn: (node: CollectionNode) => CollectionNode
): CollectionNode[] {
  return items.map((node) => {
    if (node.id === id) return fn(node);
    if (node.type === "folder") return { ...node, items: mapItems(node.items, id, fn) };
    return node;
  });
}

// Recursively removes the node matching `id` from wherever it lives in the
// tree (a folder or the collection root).
function removeItem(items: CollectionNode[], id: string): CollectionNode[] {
  return items
    .filter((node) => node.id !== id)
    .map((node) => (node.type === "folder" ? { ...node, items: removeItem(node.items, id) } : node));
}

// Inserts `node` as a child of the folder matching `parentFolderId` (or at
// the collection root when `parentFolderId` is null), at `index` if given,
// otherwise appended at the end.
function insertItem(
  items: CollectionNode[],
  parentFolderId: string | null,
  node: CollectionNode,
  index?: number
): CollectionNode[] {
  if (parentFolderId === null) {
    if (index === undefined) return [...items, node];
    const next = [...items];
    next.splice(index, 0, node);
    return next;
  }
  return items.map((n) => {
    if (n.type !== "folder") return n;
    if (n.id === parentFolderId) {
      if (index === undefined) return { ...n, items: [...n.items, node] };
      const nextItems = [...n.items];
      nextItems.splice(index, 0, node);
      return { ...n, items: nextItems };
    }
    return { ...n, items: insertItem(n.items, parentFolderId, node, index) };
  });
}

function findItem(items: CollectionNode[], id: string): CollectionNode | null {
  for (const node of items) {
    if (node.id === id) return node;
    if (node.type === "folder") {
      const found = findItem(node.items, id);
      if (found) return found;
    }
  }
  return null;
}

// True if `id` is `node` itself or lives anywhere inside its subtree — used
// to stop a folder from being dragged into its own descendant.
function containsId(node: CollectionNode, id: string): boolean {
  if (node.id === id) return true;
  return node.type === "folder" && node.items.some((child) => containsId(child, id));
}

export function renameCollection(collections: Collection[], id: string, name: string): Collection[] {
  return collections.map((c) => (c.id === id ? { ...c, name } : c));
}

export function deleteCollection(collections: Collection[], id: string): Collection[] {
  return collections.filter((c) => c.id !== id);
}

export function addNodeToCollection(
  collections: Collection[],
  collectionId: string,
  parentFolderId: string | null,
  node: CollectionNode,
  index?: number
): Collection[] {
  return collections.map((c) =>
    c.id === collectionId ? { ...c, items: insertItem(c.items, parentFolderId, node, index) } : c
  );
}

// All request ids contained in `node` — just itself for a request, or every
// request nested anywhere inside a folder. Used so deleting a folder can
// close every tab linked to a request that was inside it.
export function collectRequestIds(node: CollectionNode): string[] {
  if (node.type === "request") return [node.id];
  return node.items.flatMap(collectRequestIds);
}

// Total folders/requests nested inside `items` (a folder's or collection's
// own `.items`, not counting the container itself). Used to word a delete
// confirmation like "contains 2 folders and 5 requests" before a cascading
// delete.
export function countNodes(items: CollectionNode[]): { folders: number; requests: number } {
  return items.reduce(
    (acc, item) => {
      if (item.type === "request") return { folders: acc.folders, requests: acc.requests + 1 };
      const nested = countNodes(item.items);
      return { folders: acc.folders + 1 + nested.folders, requests: acc.requests + nested.requests };
    },
    { folders: 0, requests: 0 }
  );
}

export function renameCollectionNode(
  collections: Collection[],
  collectionId: string,
  nodeId: string,
  name: string
): Collection[] {
  return collections.map((c) =>
    c.id === collectionId ? { ...c, items: mapItems(c.items, nodeId, (n) => ({ ...n, name })) } : c
  );
}

export function deleteCollectionNode(
  collections: Collection[],
  collectionId: string,
  nodeId: string
): Collection[] {
  return collections.map((c) =>
    c.id === collectionId ? { ...c, items: removeItem(c.items, nodeId) } : c
  );
}

export function findCollectionNode(
  collections: Collection[],
  collectionId: string,
  nodeId: string
): CollectionNode | null {
  const collection = collections.find((c) => c.id === collectionId);
  return collection ? findItem(collection.items, nodeId) : null;
}

interface NodeLocation {
  collectionId: string;
  parentFolderId: string | null;
  index: number;
  node: CollectionNode;
}

function locateInItems(
  items: CollectionNode[],
  id: string,
  parentFolderId: string | null
): Omit<NodeLocation, "collectionId"> | null {
  for (let i = 0; i < items.length; i++) {
    const node = items[i];
    if (node.id === id) return { parentFolderId, index: i, node };
    if (node.type === "folder") {
      const found = locateInItems(node.items, id, node.id);
      if (found) return found;
    }
  }
  return null;
}

// Finds where a node currently lives — which collection, which parent folder
// (null for the collection root), and its index within that parent's items.
// Used by drag-and-drop to know both what to remove and where a drop target
// sits before inserting next to it.
export function locateNode(collections: Collection[], id: string): NodeLocation | null {
  for (const collection of collections) {
    const found = locateInItems(collection.items, id, null);
    if (found) return { collectionId: collection.id, ...found };
  }
  return null;
}

// Removes the node matching `id` from wherever it lives and returns it
// alongside the updated tree, so callers can re-insert it elsewhere.
function extractNode(
  collections: Collection[],
  id: string
): { collections: Collection[]; node: CollectionNode | null } {
  const location = locateNode(collections, id);
  if (!location) return { collections, node: null };
  const updated = collections.map((c) =>
    c.id === location.collectionId ? { ...c, items: removeItem(c.items, id) } : c
  );
  return { collections: updated, node: location.node };
}

// Moves `nodeId` to become the last child of the folder matching
// `destParentFolderId` (or the root of `destCollectionId` when null). No-op
// if the move would nest a folder inside itself or one of its own children.
export function moveNodeInto(
  collections: Collection[],
  nodeId: string,
  destCollectionId: string,
  destParentFolderId: string | null
): Collection[] {
  const { collections: withoutNode, node } = extractNode(collections, nodeId);
  if (!node) return collections;
  if (destParentFolderId !== null && containsId(node, destParentFolderId)) return collections;
  return addNodeToCollection(withoutNode, destCollectionId, destParentFolderId, node);
}

// Moves `nodeId` to sit immediately before `beforeNodeId`, in whatever
// container `beforeNodeId` currently lives in.
function moveNodeBefore(collections: Collection[], nodeId: string, beforeNodeId: string): Collection[] {
  if (nodeId === beforeNodeId) return collections;
  const { collections: withoutNode, node } = extractNode(collections, nodeId);
  if (!node) return collections;
  // Re-locate the target after extraction — if `node` was a preceding
  // sibling, removing it shifts every index after it, including the target's.
  const target = locateNode(withoutNode, beforeNodeId);
  if (!target) return collections;
  if (target.parentFolderId !== null && containsId(node, target.parentFolderId)) return collections;
  return addNodeToCollection(withoutNode, target.collectionId, target.parentFolderId, node, target.index);
}

// Prefix for the synthetic "end of list" drop zone id rendered after the
// last item in a folder/collection — dropping on an existing row only ever
// means "insert before it," so without this there'd be no way to place
// something as the very last item without dragging all the way up to the
// folder/collection header instead.
const END_ZONE_PREFIX = "__end__:";

export function endZoneId(containerId: string): string {
  return `${END_ZONE_PREFIX}${containerId}`;
}

// Prefix for the synthetic "insert before this folder" drop zone id rendered
// just above every folder row. Dropping on a folder's own row always means
// "nest inside it" (useful especially for collapsed/empty folders, which have
// no visible child row to target instead) — without this, there'd be no way
// to reposition a folder as a *sibling* of another folder, only ever nest it.
const BEFORE_ZONE_PREFIX = "__before__:";

export function beforeZoneId(nodeId: string): string {
  return `${BEFORE_ZONE_PREFIX}${nodeId}`;
}

// Single entry point for a drag-and-drop drop: `targetId` may be a
// Collection's own id (drop onto a collection header → append to its root),
// a folder node's id (drop onto a folder → append as its last child), a
// request node's id (drop onto a request → insert immediately before it, in
// whatever container it's currently in), an `endZoneId(...)` (drop after the
// last item in that collection/folder → append there too, same as dropping
// on its header, just reachable from the bottom of a long list), or a
// `beforeZoneId(...)` (drop just above a folder → insert as its sibling
// instead of nesting inside it).
export function moveNodeRelativeToTarget(
  collections: Collection[],
  draggedId: string,
  targetId: string
): Collection[] {
  if (draggedId === targetId) return collections;

  if (targetId.startsWith(END_ZONE_PREFIX)) {
    const containerId = targetId.slice(END_ZONE_PREFIX.length);
    return moveNodeRelativeToTarget(collections, draggedId, containerId);
  }

  if (targetId.startsWith(BEFORE_ZONE_PREFIX)) {
    const beforeNodeId = targetId.slice(BEFORE_ZONE_PREFIX.length);
    return moveNodeBefore(collections, draggedId, beforeNodeId);
  }

  const targetCollection = collections.find((c) => c.id === targetId);
  if (targetCollection) {
    return moveNodeInto(collections, draggedId, targetCollection.id, null);
  }

  const target = locateNode(collections, targetId);
  if (!target) return collections;

  if (target.node.type === "folder") {
    return moveNodeInto(collections, draggedId, target.collectionId, target.node.id);
  }
  return moveNodeBefore(collections, draggedId, targetId);
}
