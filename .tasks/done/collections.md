# Collections — Done

Phase A (App.tsx refactor) and most of Phase B (Rust persistence, sidebar tree UI,
rename/delete/move, drag-and-drop). Remaining work (Step B3: save gesture) is still
tracked in `.tasks/collections/PLAN.md`.

## Phase A: Refactor `App.tsx` (no behavior change) — DONE, 1237 → 414 lines

- Extracted pure logic into `src/lib/`: `keyValue.ts`, `environments.ts`,
  `requestUrl.ts`, `requestTabs.ts`, `http.ts`.
- Extracted standalone components: `src/components/KeyValueEditor.tsx`,
  `EnvironmentEditor.tsx`.
- Extracted app-level sections: `Sidebar.tsx`, `TabBar.tsx`, `RequestEditor.tsx`
  (name/method/URL/send bar + sub-tab buttons, lives in the `shrink-0` header) +
  `RequestVariablesTabs.tsx` (originally `RequestPanel.tsx` — the Params/Headers/Body
  box, lives in the scrollable region), `ResponseContainer.tsx` (originally
  `ResponseViewer.tsx`).
- `App.tsx` is now a pure orchestrator: state, effects (load/save tabs, environments),
  and handlers wiring the extracted components via props.

## Data model

- `CollectionNode` — discriminated union: Folder `{ type: "folder", id, name, items }`
  or Request `{ type: "request", id, name, method, url, params, headers, body }`. Rust
  enum uses `#[serde(tag = "type", rename_all = "lowercase")]` to match the TS shape
  exactly.
- `Collection` — `{ id, name, items }`, the root container. Persisted whole-tree to
  `collections.json` via `save_collections`/`load_collections` (mirrors
  `environments.json`).
- `RequestTab` gained `sourceRequestId`/`sourceCollectionId` (nullable) — a tab opened
  from a saved request links back to it; `#[serde(default)]` on the Rust side so old
  `tabs.json` files without these fields still deserialize fine, no manual migration.

## Phase B1: Rust persistence — DONE

Includes a `#[cfg(test)] collection_node_tests` module pinning down the serialized JSON
shape (a mismatch here wouldn't be caught by the compiler on either side of the IPC
boundary).

## Phase B2: Sidebar — collection tree UI — DONE

- `src/lib/collections.ts` — recursive tree helpers (`mapItems`/`removeItem`/
  `insertItem`/`findItem`, module-private) powering `renameCollection`/
  `deleteCollection`/`addNodeToCollection`/`renameCollectionNode`/
  `deleteCollectionNode`/`findCollectionNode`, plus factories
  (`createCollection`/`createFolderNode`/`createRequestNode`).
- `src/components/CollectionTree.tsx` — recursive `NodeRow`, inline `RenameInput`
  (auto-select-on-mount, commits on blur/Enter, cancels on Escape), "..." `NodeMenu`,
  depth-based indentation via inline `paddingLeft`.
- Opening a saved request focuses an already-open tab (matched by `sourceRequestId`)
  instead of duplicating it.
- Name sync is one-directional: editing a tab's name field (blur-only, not
  per-keystroke — per-keystroke would re-render the whole tree) pushes into the tree
  via `onCommitName`; renaming via the tree does not push into any already-open tab.

## Phase B4: Rename/delete/move — DONE

Delete confirmation via shadcn `alert-dialog` (added for this), only for non-empty
folders/collections (`countNodes` helper) — deleting a lone request or an
already-empty container stays instant.

## Drag-and-drop reordering/move — DONE

Added `@dnd-kit/core` + `@dnd-kit/utilities` (no prior DnD lib in the project).

- `lib/collections.ts`: `locateNode`, `moveNodeInto` (cycle-guarded via `containsId`),
  `moveNodeBefore`, `moveNodeRelativeToTarget` (single entry point a drop calls).
- `CollectionTree.tsx`: every row is both drag source and drop target
  (`useTreeDragAndDrop`, combined `useDraggable`/`useDroppable`), 8px activation
  distance so ordinary clicks aren't swallowed as drags. `collisionDetection` is
  `closestCenter`, not dnd-kit's default `rectIntersection` — a thin drop-zone
  sandwiched between two tall rows loses the area contest under the default, a known
  dnd-kit gotcha.
- Dragging visual feedback uses `DragOverlay` (a `document.body` portal) rather than
  transforming the source row in place — a `transform` on an in-flow row inside an
  `overflow-y-auto` container inflates the ancestor's scrollable region, a real bug
  that was hit and fixed here.
- Collections themselves are not draggable (`isDraggable` param on
  `useTreeDragAndDrop`), only droppable — only a collection's contents should reorder.
- `BeforeDropZone` (insert before, folders) + `EndDropZone` (append as last item) added
  as follow-ups so precise reordering doesn't require dragging all the way to a
  container's own header.
- Delete cascades close any open tab pointing at a deleted request
  (`closeTabsForRequestIds`, keyed on `sourceRequestId`), for both single-node and
  whole-collection delete.
- Cross-collection dragging confirmed working — move logic was never scoped to a
  single collection.
- **Known v1 limitation**: folder-to-folder reordering only supports insert-before/
  insert-at-end, not a full pointer-position-based before/after/inside indicator.
- **Not yet built**: auto-expanding a collapsed folder/collection when something is
  dragged over it and held there.

## Notable bug fixes along the way

- Drop-line indicator uses a `border-t-2` toggle (color only, transparent ↔
  `#DA9100`/75%) rather than an absolutely-positioned overlay div — the overlay
  version had inconsistent thickness across rows because its Y-offset landed on
  fractional device pixels depending on scroll position; borders always snap to the
  pixel grid.
- `RequestVariablesTabs`/`ResponseContainer` each got their own scroll boundary
  (previously one shared wrapper scrolled everything together): only the Response Body
  scrolls, Status/Response Headers stay pinned. Both now use the shared `Card`
  component instead of a hand-styled `<div>`.

## Explicitly deferred (unless scope changes)

- Import/export (Postman collection JSON format compatibility).
- Duplicating a request/folder.
