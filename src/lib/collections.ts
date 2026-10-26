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

function removeItem(items: CollectionNode[], id: string): CollectionNode[] {
  return items
    .filter((node) => node.id !== id)
    .map((node) => (node.type === "folder" ? { ...node, items: removeItem(node.items, id) } : node));
}

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

// Guards against dragging a folder into its own subtree.
function containsId(node: CollectionNode, id: string): boolean {
  if (node.id === id) return true;
  return node.type === "folder" && node.items.some((child) => containsId(child, id));
}

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

// A matching folder keeps only its matching descendants, not all of them.
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

export function collectRequestIds(node: CollectionNode): string[] {
  if (node.type === "request") return [node.id];
  return node.items.flatMap(collectRequestIds);
}

// Depth-first, matching sidebar render order.
export function collectRequestNodes(node: CollectionNode): RequestNode[] {
  if (node.type === "request") return [node];
  return node.items.flatMap(collectRequestNodes);
}

export function collectAllNodeIds(node: CollectionNode): string[] {
  if (node.type === "request") return [node.id];
  return [node.id, ...node.items.flatMap(collectAllNodeIds)];
}

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

export function locateNode(collections: Collection[], id: string): NodeLocation | null {
  for (const collection of collections) {
    const found = locateInItems(collection.items, id, null);
    if (found) return { collectionId: collection.id, ...found };
  }
  return null;
}

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

// No-op if it would nest a folder inside itself.
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

// Drop zone after a container's last item: dropping on a row inserts before it,
// so there's otherwise no way to drop at the end.
const END_ZONE_PREFIX = "__end__:";

export function endZoneId(containerId: string): string {
  return `${END_ZONE_PREFIX}${containerId}`;
}

// Drop zone above a folder row: dropping on the row itself nests inside it,
// so this is the only way to place something beside a folder.
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
  event?: unknown;
}

interface ImportCounter {
  skippedBody: number;
  droppedScripts: number;
}

function countScripts(event: unknown): number {
  if (!Array.isArray(event)) return 0;
  return event.filter((e) => {
    const exec = (e as { script?: { exec?: unknown } } | null)?.script?.exec;
    const text = Array.isArray(exec) ? exec.join("\n") : exec;
    return typeof text === "string" && text.trim() !== "";
  }).length;
}

// Postman's `url` is either a string or an object with `raw`.
function rawUrlOf(url: unknown): string {
  if (typeof url === "string") return url;
  if (typeof url === "object" && url !== null && typeof (url as { raw?: unknown }).raw === "string") {
    return (url as { raw: string }).raw;
  }
  return "";
}

// Unsupported body modes import as an empty body; scripts aren't imported yet.
function mapPostmanItems(items: unknown[], counter: ImportCounter): CollectionNode[] {
  return items.map((raw): CollectionNode => {
    const item = raw as PostmanItem;
    counter.droppedScripts += countScripts(item.event);
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
      preRequestScript: "",
      postResponseScript: "",
    };
  });
}

export function parsePostmanCollection(
  json: unknown,
  existing: Collection[]
): { collection: Collection; skippedBodyCount: number; droppedScriptCount: number } {
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

  const counter: ImportCounter = { skippedBody: 0, droppedScripts: countScripts(data.event) };
  const items = mapPostmanItems(data.item, counter);

  return {
    collection: {
      id: crypto.randomUUID(),
      name: dedupeName(rawName, new Set(existing.map((c) => c.name))),
      items,
    },
    skippedBodyCount: counter.skippedBody,
    droppedScriptCount: counter.droppedScripts,
  };
}

// Textual, not AST-aware: `ctx` inside strings and comments is rewritten too.
function toPostmanScript(script: string): string {
  return script.replace(/\bctx\b/g, "pm");
}

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

// Postman drops the body on these methods unless disableBodyPruning is set:
// https://github.com/postmanlabs/postman-runtime/blob/develop/docs/protocol-profile-behavior.md
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

// `targetId`: a collection or folder id (append inside), a request id (insert
// before it), an endZoneId (append), or a beforeZoneId (insert before that folder).
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
