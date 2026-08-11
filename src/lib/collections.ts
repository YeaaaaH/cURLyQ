import type { KeyValuePair } from "@/lib/keyValue";
import { buildPostmanUrlObject, parseParamsFromUrl } from "@/lib/requestUrl";
import { PostmanImportError, dedupeName } from "@/lib/postman";

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
  preRequestScript: string;
  postResponseScript: string;
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
    preRequestScript: "",
    postResponseScript: "",
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

// Every folder/collection id in `collections` — used against an
// already-filtered tree (see filterCollections) to force open exactly the
// containers that either matched the search query or lead to a descendant
// that did, without touching the tree's persisted expand state.
export function collectContainerIds(collections: readonly Collection[]): Set<string> {
  const ids = new Set<string>();
  function walkItems(items: CollectionNode[]) {
    for (const node of items) {
      if (node.type !== "folder") continue;
      ids.add(node.id);
      walkItems(node.items);
    }
  }
  for (const collection of collections) {
    ids.add(collection.id);
    walkItems(collection.items);
  }
  return ids;
}

// Strict, recursive name filter: a request is kept only if its own name
// matches `query`; a folder is kept only if its own name matches OR
// filtering its children down leaves something — either way its `items` are
// always the filtered set, never the original unfiltered children, so a
// matching folder shows only its matching requests/subfolders, not
// everything nested inside it.
function filterItems(items: CollectionNode[], query: string): CollectionNode[] {
  return items.reduce<CollectionNode[]>((matched, node) => {
    if (node.type === "request") {
      if (node.name.toLowerCase().includes(query)) matched.push(node);
      return matched;
    }
    const filteredChildren = filterItems(node.items, query);
    if (node.name.toLowerCase().includes(query) || filteredChildren.length > 0) {
      matched.push({ ...node, items: filteredChildren });
    }
    return matched;
  }, []);
}

// Filters every collection down to folders/requests matching `query` by
// name (see filterItems) — a collection is kept only if its own name
// matches or it has a matching descendant, and its items are always the
// filtered set. A blank query returns `collections` unchanged.
export function filterCollections(collections: readonly Collection[], query: string): Collection[] {
  const trimmed = query.trim().toLowerCase();
  if (trimmed === "") return collections as Collection[];

  return collections.reduce<Collection[]>((matched, collection) => {
    const filteredItems = filterItems(collection.items, trimmed);
    if (collection.name.toLowerCase().includes(trimmed) || filteredItems.length > 0) {
      matched.push({ ...collection, items: filteredItems });
    }
    return matched;
  }, []);
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

// Every request node contained in `node`, in tree order — just itself for a
// request, or every request nested anywhere inside a folder (depth-first,
// matching the order rows render in the sidebar). Used by a Collection run to
// gather what it should send.
export function collectRequestNodes(node: CollectionNode): RequestNode[] {
  if (node.type === "request") return [node];
  return node.items.flatMap(collectRequestNodes);
}

// Every id contained in `node`, including itself — folders and requests
// alike. Used to sweep a deleted subtree's ids out of the tree's expand
// state (see useCollectionTreeState.forgetIds) so they don't linger as dead
// entries.
export function collectAllNodeIds(node: CollectionNode): string[] {
  if (node.type === "request") return [node.id];
  return [node.id, ...node.items.flatMap(collectAllNodeIds)];
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

// Live-syncs a source-linked tab's method back into the collection, the same
// way renameCollectionNode already does for the name — no explicit Save
// gesture yet (that's Step B3), so this is the same narrow "sync this one
// field immediately" shortcut, just for method instead of name. Guarded to
// request nodes only (a no-op on a folder, which has no method) since
// mapItems' callback signature can't express that statically.
export function updateCollectionRequestMethod(
  collections: Collection[],
  collectionId: string,
  nodeId: string,
  method: string
): Collection[] {
  return collections.map((c) =>
    c.id === collectionId
      ? { ...c, items: mapItems(c.items, nodeId, (n) => (n.type === "request" ? { ...n, method } : n)) }
      : c
  );
}

// Writes the full editable field set of a request node back into the tree in
// one shot — used by the explicit Save gesture (Ctrl+S / Save button), which
// needs to sync url/params/headers/body together, unlike the narrow
// single-field live-sync helpers above (name on blur, method on change).
// Guarded to request nodes only, same as updateCollectionRequestMethod.
export function updateCollectionRequestFields(
  collections: Collection[],
  collectionId: string,
  nodeId: string,
  fields: Pick<
    RequestNode,
    "name" | "method" | "url" | "params" | "headers" | "body" | "preRequestScript" | "postResponseScript"
  >
): Collection[] {
  return collections.map((c) =>
    c.id === collectionId
      ? { ...c, items: mapItems(c.items, nodeId, (n) => (n.type === "request" ? { ...n, ...fields } : n)) }
      : c
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

interface PostmanHeader {
  key?: unknown;
  value?: unknown;
  disabled?: unknown;
}

interface PostmanRequestBody {
  mode?: unknown;
  raw?: unknown;
}

interface PostmanRequest {
  method?: unknown;
  url?: unknown;
  header?: unknown;
  body?: unknown;
}

interface PostmanItem {
  name?: unknown;
  item?: unknown;
  request?: unknown;
}

// Postman's `url` is either a plain string or an object with a `raw` field
// (plus a parsed-out protocol/host/path/query breakdown we don't need — we
// derive params from `raw` the same way the rest of the app already does).
function rawUrlOf(url: unknown): string {
  if (typeof url === "string") return url;
  if (typeof url === "object" && url !== null && typeof (url as { raw?: unknown }).raw === "string") {
    return (url as { raw: string }).raw;
  }
  return "";
}

// Recursively maps a Postman `item` array into our CollectionNode tree.
// `counter.skippedBody` is incremented for every request whose body uses a
// mode we can't represent (v1 only supports a raw/JSON body) — that request
// still imports with everything else intact, just an empty body, rather than
// failing the whole import over one unsupported field.
function mapPostmanItems(items: unknown[], counter: { skippedBody: number }): CollectionNode[] {
  return items.map((raw): CollectionNode => {
    const item = raw as PostmanItem;
    const name = typeof item.name === "string" && item.name.trim() !== "" ? item.name : "Untitled";

    if (Array.isArray(item.item)) {
      return {
        type: "folder",
        id: crypto.randomUUID(),
        name,
        items: mapPostmanItems(item.item, counter),
      };
    }

    const request = (item.request ?? {}) as PostmanRequest;
    const url = rawUrlOf(request.url);
    const method = typeof request.method === "string" ? request.method.toUpperCase() : "GET";

    const headers: KeyValuePair[] = Array.isArray(request.header)
      ? (request.header as PostmanHeader[])
          .filter((h): h is PostmanHeader => typeof h?.key === "string")
          .map((h) => ({
            id: crypto.randomUUID(),
            key: h.key as string,
            value: typeof h.value === "string" ? h.value : "",
            enabled: h.disabled !== true,
          }))
      : [];

    let body = "";
    if (request.body && typeof request.body === "object") {
      const b = request.body as PostmanRequestBody;
      if (b.mode === undefined || b.mode === "raw") {
        body = typeof b.raw === "string" ? b.raw : "";
      } else {
        counter.skippedBody++;
      }
    }

    return {
      type: "request",
      id: crypto.randomUUID(),
      name,
      method,
      url,
      params: parseParamsFromUrl(url),
      headers,
      body,
      // Postman's own pre-request/test event scripts aren't mapped yet —
      // imported requests just start with empty scripts.
      preRequestScript: "",
      postResponseScript: "",
    };
  });
}

// Maps a parsed Postman v2.1 collection export into our Collection shape.
// Throws PostmanImportError if `json` doesn't look like a Postman collection
// at all. Returns how many requests had a body mode we can't represent
// alongside the mapped collection, for the caller to note in the log.
export function parsePostmanCollection(
  json: unknown,
  existing: Collection[]
): { collection: Collection; skippedBodyCount: number } {
  if (typeof json !== "object" || json === null) {
    throw new PostmanImportError("Not a valid JSON file.");
  }
  const data = json as Record<string, unknown>;

  if (Array.isArray(data.values)) {
    throw new PostmanImportError(
      "This looks like a Postman environment, not a collection — use \"Import environment...\" instead."
    );
  }
  if (!Array.isArray(data.item)) {
    throw new PostmanImportError('Missing an "item" array — not a Postman collection file.');
  }

  const info = (data.info ?? {}) as Record<string, unknown>;
  const rawName =
    typeof info.name === "string" && info.name.trim() !== "" ? info.name.trim() : "Imported collection";

  const counter = { skippedBody: 0 };
  const items = mapPostmanItems(data.item, counter);

  return {
    collection: {
      id: crypto.randomUUID(),
      name: dedupeName(rawName, new Set(existing.map((c) => c.name))),
      items,
    },
    skippedBodyCount: counter.skippedBody,
  };
}

// `ctx` and `pm` are runtime aliases inside cURLyQ's own sandbox (see
// sandbox.worker.ts) — but real Postman only recognizes `pm`. This swap is
// textual, not AST-aware: a word-boundary match rewrites the `ctx` identifier
// wherever it's used as a call target (`ctx.environment.get(...)`) or
// destructured (`const { environment } = ctx`), but it can't tell a literal
// "ctx" inside a string or comment from a real reference, so those get
// rewritten too. Best-effort, not guaranteed — same spirit as the
// unsupported-body-mode warning below.
function toPostmanScript(script: string): string {
  return script.replace(/\bctx\b/g, "pm");
}

// Builds a request node's `event` array (Postman's pre-request/test script
// slot). Only requests that actually have a script get an `event` entry —
// mirrors the `body` field being omitted below when empty. Increments
// `counter.rewrittenScripts` whenever a script's ctx→pm swap actually changed
// something, so the caller can surface how many scripts to double-check.
function buildScriptEvents(node: RequestNode, counter: { rewrittenScripts: number }): unknown[] {
  const events: unknown[] = [];
  const addEvent = (listen: "prerequest" | "test", script: string) => {
    if (script.trim() === "") return;
    const rewritten = toPostmanScript(script);
    if (rewritten !== script) counter.rewrittenScripts++;
    events.push({ listen, script: { type: "text/javascript", exec: rewritten.split("\n") } });
  };
  addEvent("prerequest", node.preRequestScript);
  addEvent("test", node.postResponseScript);
  return events;
}

// Postman strips the request body from these methods by default (both when
// sending and, per real-world exports, in how the client itself treats a
// saved request) unless `protocolProfileBehavior.disableBodyPruning` is set —
// https://github.com/postmanlabs/postman-runtime/blob/develop/docs/protocol-profile-behavior.md.
// Only GET is reachable today (cURLyQ doesn't support the others yet), but
// checking the full set means this doesn't need revisiting if that changes.
const BODY_PRUNED_METHODS = new Set(["GET", "HEAD", "COPY", "PURGE", "UNLOCK"]);

function buildPostmanItems(items: CollectionNode[], counter: { rewrittenScripts: number }): unknown[] {
  return items.map((node) => {
    if (node.type === "folder") {
      return { name: node.name, item: buildPostmanItems(node.items, counter) };
    }
    const events = buildScriptEvents(node, counter);
    const hasBody = node.body.trim() !== "";
    return {
      name: node.name,
      ...(hasBody && BODY_PRUNED_METHODS.has(node.method)
        ? { protocolProfileBehavior: { disableBodyPruning: true } }
        : {}),
      request: {
        method: node.method,
        header: node.headers
          .filter((h) => h.key.trim() !== "")
          .map((h) => ({ key: h.key, value: h.value, type: "text", disabled: !h.enabled })),
        ...(hasBody ? { body: { mode: "raw", raw: node.body, options: { raw: { language: "json" } } } } : {}),
        url: buildPostmanUrlObject(node.url, node.params),
      },
      ...(events.length > 0 ? { event: events } : {}),
    };
  });
}

// Reverse of parsePostmanCollection above — doesn't try to round-trip an
// original Postman id/schema-quirk, just needs to be re-importable (by us or
// real Postman). Returns how many scripts had a ctx→pm rewrite applied
// alongside the built JSON, for the caller to note in the export log.
export function buildPostmanCollection(collection: Collection): { json: unknown; rewrittenScriptCount: number } {
  const counter = { rewrittenScripts: 0 };
  const item = buildPostmanItems(collection.items, counter);
  return {
    json: {
      info: {
        _postman_id: collection.id,
        name: collection.name,
        schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
      },
      item,
    },
    rewrittenScriptCount: counter.rewrittenScripts,
  };
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
