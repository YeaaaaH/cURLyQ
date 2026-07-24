# Collections — Plan

Two phases: (A) split `App.tsx` into domain-based modules/components first, since it's
grown to 1237 lines with everything — types, utils, and a ~660-line `App()` — in one
file; (B) build Postman-style nested-folder collections on top of the cleaner
structure. Update this file as steps complete or requirements change.

## Decisions made so far

- **Nested folders, Postman-style** — a collection is a tree (folders can contain
  folders and requests), not just a flat list of requests.
- **Save behavior is a live link** — a tab opened from a saved request remembers
  where it came from (`sourceRequestId`/`sourceCollectionId`) and "Save" updates that
  request in place, matching real Postman muscle memory. "Save as" still forks a copy.
- The sidebar already has a "Collections" placeholder Collapsible
  (`No collections yet.`) next to Environments — Phase B replaces its content, not its
  position/structure.
- `project_specs.md` currently lists collections/folders as explicitly out of scope
  for v1 — update it once Phase B starts so the doc doesn't contradict what's built.

## Phase A: Refactor `App.tsx` (no behavior change)

Current state: one 1237-line file — types + pure utility functions, three components
(`KeyValueEditor`, `EnvironmentNameField`, `EnvironmentEditor`), and one ~660-line
`App()` holding all state plus the sidebar, tab bar, request editor, and response
viewer inline.

Verify after every step: `npx tsc --noEmit -p tsconfig.json`, then a quick look at the
running dev server (Vite HMR) — this phase changes no behavior, so it should be a
visual no-op.

### Step A1: Extract pure logic into `src/lib/` — DONE (1237 → 941 lines)

- `keyValue.ts` — `KeyValuePair` type + `updateRows`/`removeRow`/`stripEmptyRows`/
  `ensureTrailingBlankRow`. — DONE
- `environments.ts` — `Environment` type, `createEnvironment`, `nextEnvironmentName`,
  `substituteVariables`, `findVariableNames`, `getUnresolvedVariables`. — DONE
  (`findVariableNames` stays internal to the module — App.tsx never called it
  directly, only through `getUnresolvedVariables`.)
- `requestUrl.ts` — `buildRequestUrl`/`buildDisplayUrl`/`syncUrlWithParams`/
  `escapeForDisplay`/`unescapeFromDisplay`/`parseParamsFromUrl`. — DONE
  (`buildDisplayUrl`/`escapeForDisplay`/`unescapeFromDisplay` stay internal to the
  module — App.tsx only calls `buildRequestUrl`/`syncUrlWithParams`/
  `parseParamsFromUrl` directly.)
- `requestTabs.ts` — `RequestTab`/`PersistedTab`/`PersistedTabsFile` types,
  `createRequestTab`/`toPersistedTab`/`fromPersistedTab`, `formatBody`,
  `statusVariant`, `getUrlError`, `getBodyError`. — DONE (`PersistedTab`/`SubTab`
  types stay internal to the module — App.tsx only used them through the
  functions, never as standalone annotations.)
- `http.ts` — `HttpResponse` type, `HTTP_METHODS`, `METHOD_COLORS`. — DONE

### Step A2: Extract standalone components (move as-is, no logic change) — DONE
(941 → 728 lines)

- `src/components/KeyValueEditor.tsx`
- `src/components/EnvironmentEditor.tsx` (incl. `EnvironmentNameField`)

### Step A3: Extract App-level sections into their own components — DONE
(728 → 414 lines)

These still take state/callbacks as props from `App` (which keeps owning shared
state — `requests`, `environments`, `activeId`, etc.):

- `src/components/Sidebar.tsx` — collapsible rail: Collections tree (placeholder
  until Phase B) + Environments list, drag-to-resize handle.
- `src/components/TabBar.tsx` — tab strip, add/close tab, wheel-scroll handling,
  plus the environment-switcher dropdown and its "Manage environments" Dialog
  (moved in alongside the tab strip since that's where the trigger UI lives).
- **Deviation from the original plan**: instead of one `RequestEditor.tsx`
  covering "method/url/send bar + Params/Headers/Body sub-tabs", it's split into
  two components because the underlying DOM has two different flex containers
  (a `shrink-0` header vs. a `min-h-0 flex-1 overflow-y-auto` scroll region — see
  `ui-polish` Item 1) that must stay siblings for the existing scroll-fix to keep
  working:
  - `src/components/RequestEditor.tsx` — name input, method/url/send form,
    sub-tab buttons (lives in the `shrink-0` header, alongside `TabBar`).
  - `src/components/RequestPanel.tsx` — the Params/Headers/Body box itself
    (lives in the scrollable region, alongside `ResponseViewer`).
- `src/components/ResponseViewer.tsx` — error card + status/headers/body display.

### Step A4: `App.tsx` becomes an orchestrator — DONE

Achieved as part of A3 above — `App.tsx` (414 lines) now only owns state, effects
(load/save tabs, load/save environments, active environment), and handlers, wiring
the five extracted components together via props.

## Phase B: Collections (Postman-style, nested folders)

### Data model

- `CollectionNode` — discriminated union:
  - Folder: `{ type: "folder", id, name, items: CollectionNode[] }`
  - Saved request: `{ type: "request", id, name, method, url, params, headers, body }`
- `Collection` — `{ id, name, items: CollectionNode[] }` (the root container — a
  named tree of folders/requests).
- `RequestTab` gains `sourceRequestId: string | null` and `sourceCollectionId: string
  | null`, so an opened saved request can be saved back in place.

### Step B1: Rust persistence — DONE

- `CollectionNode` enum (`src-tauri/src/lib.rs`) — `#[serde(tag = "type", rename_all
  = "lowercase")]` so it serializes exactly as the frontend's discriminated union:
  `Folder { id, name, items: Vec<CollectionNode> }` → `{"type":"folder",...}`,
  `Request { id, name, method, url, params, headers, body }` →
  `{"type":"request",...}` (params/headers reuse `KeyValuePair`, same as
  `PersistedTab`).
- `Collection { id, name, items: Vec<CollectionNode> }`.
- `collections.json` in `app_data_dir()`, mirroring `environments.json` (whole-tree
  write, no per-node diffing).
- `save_collections`/`load_collections` Tauri commands, registered in
  `generate_handler!`.
- Added `#[cfg(test)] mod collection_node_tests` pinning down the serialized JSON
  shape (`type: "folder"`/`"request"` tags, nested items, round-trip through
  `serde_json`) — a mismatch here wouldn't be caught by the compiler on either side
  of the IPC boundary, so it's worth a real test rather than just trusting
  `cargo check`. `cargo test collection_node_tests` passes; `cargo check` clean.
- **No frontend changes yet** — the TS `CollectionNode`/`Collection` types and
  `invoke("save_collections"/"load_collections", ...)` calls land in Step B2
  alongside the sidebar tree UI that actually uses them.

### Step B2: Sidebar — collection tree UI — DONE

- `src/lib/collections.ts` — `FolderNode`/`RequestNode` (discriminated union via
  `type: "folder" | "request"`, matching the Rust enum's `#[serde(tag = "type")]`
  shape exactly) and `Collection`. Recursive tree helpers (`mapItems`/`removeItem`/
  `insertItem`/`findItem`, kept module-private) power the exported collection-level
  operations: `renameCollection`/`deleteCollection`/`addNodeToCollection`/
  `renameCollectionNode`/`deleteCollectionNode`/`findCollectionNode`. Factories:
  `createCollection`/`createFolderNode`/`createRequestNode` — no name-collision
  handling (unlike `nextEnvironmentName`) since new nodes immediately enter rename
  mode for the user to name them, same as VS Code's "new file" pattern.
- `src/components/CollectionTree.tsx` — recursive `NodeRow` (folder or request),
  each with a `RenameInput` (local draft state, auto-select-on-mount, commits on
  blur/Enter, cancels on Escape — same shape as `EnvironmentNameField` but inline in
  the row instead of a separate confirm button) and a `NodeMenu` ("..." dropdown:
  New folder/New request only on folders and the collection root, Rename/Delete on
  everything). Depth-based indentation via inline `paddingLeft` (Tailwind has no
  arbitrary-depth padding scale). `renamingId` is single, tree-wide state in
  `CollectionTree` — only one row can be mid-rename at a time.
- Wired into `Sidebar.tsx` in place of the "No collections yet." placeholder.
  `App.tsx` owns `collections: Collection[]` state, `load_collections`/
  `save_collections` effects (mirroring `environments`), and the handlers passed
  down: add/rename/delete collection, add/rename/delete node, open request.
- **Delete has no confirmation yet** — deliberately deferred to Step B4 (cascade
  delete needs a real confirm dialog; doing it here would've meant redoing the UX).
- **Opening a saved request**: `RequestTab` gained `sourceRequestId`/
  `sourceCollectionId` (nullable) in `lib/requestTabs.ts`, threaded through
  `toPersistedTab`/`createRequestTab`/the Rust `PersistedTab` struct (`#[serde(default)]`
  on the two new Rust fields so old `tabs.json` files without them still deserialize
  as `None`, no manual migration needed — cleaner than the approach used for the
  `tabs.json` shape change in `ui-polish` Item 2). `handleOpenCollectionRequest`
  in `App.tsx` checks for an already-open tab with a matching `sourceRequestId`
  and focuses it instead of opening a duplicate.
- Verified: `tsc --noEmit` clean, `cargo check` clean, Tauri's dev watcher
  successfully rebuilt Rust on every `lib.rs` change (confirmed via the running
  dev server's log output).

**Follow-up polish after user testing:**
- Top-level collection rows now show a `Folder` icon too, matching nested folder
  rows (previously only nested folders had one).
- Added a `QuickAddRequestButton` ("+", next to the "..." menu) on every
  container row (collections and folders) — a one-click shortcut for "New
  request" that skips the dropdown. The menu's "New request" item still exists
  alongside it.
- Creating a request (via either the quick button or the menu item) now opens it
  in a new tab immediately instead of only entering tree-inline-rename — there's
  nowhere to edit method/URL/params from the tree row alone. Folders still use
  tree-inline-rename on creation since they have nothing to "open". Extracted
  `openCollectionRequestTab` (shared by `handleAddRequestNode` and
  `handleOpenCollectionRequest`) so both paths build the tab identically.
- Auto-expand: `CollectionTree` switched its `Collapsible`s from uncontrolled
  `defaultOpen` to a controlled `openMap: Record<string, boolean>` (`isOpen`/
  `setOpen` in `TreeHandlers`), so creating a folder/request now force-opens the
  container it landed in (`setOpen(id, true)` alongside the create call) —
  otherwise a request added into a collapsed folder would be invisible with no
  indication anything happened.
- Name sync: `RequestEditor`'s name input now commits through a new
  `onCommitName` prop (`App.tsx`'s `handleCommitRequestName`) that, on blur,
  applies the empty-name-becomes-"Untitled request" fallback *and*, if the tab
  has a `sourceRequestId`/`sourceCollectionId`, calls `renameCollectionNode` so
  the tree reflects the new name. **Deliberately blur-only, not per-keystroke**
  — syncing on every keystroke would re-render the whole collection tree per
  character typed, the exact lag bug already fixed once for environment
  renaming (`ui-polish` Item 3). This is one-directional (tab → tree); renaming
  via the tree's own "Rename" doesn't push into any already-open tab, which
  wasn't asked for and adds real complexity (matching against
  `sourceRequestId` across all open tabs) — revisit if it's actually wanted.

### Step B3: Save gesture

- Save button/shortcut (e.g. Ctrl+S) on the active tab:
  - If the tab has a `sourceRequestId`, update that request in place.
  - Otherwise (a fresh "Untitled request" tab), open a "Save to..." picker: choose an
    existing collection/folder or create a new one, prompt for a name.
- "Save as" (secondary action) always opens the picker, even for tabs with a source —
  lets you fork a copy.

### Step B4: Rename/delete/move — DONE

- Rename & delete for folders, collections, and requests. Deleting a non-empty
  folder/collection cascades — confirm before deleting.
- Move a request/folder to a different parent — stretch, can defer to a follow-up.

**Delete confirmation — DONE.** Added the shadcn `alert-dialog` primitive
(`npx shadcn@latest add alert-dialog`, not previously in the project). Only
non-empty folders/collections confirm — deleting a lone request or an
already-empty container stays instant, matching the original "cascades"
framing (the risk is losing *multiple* things at once, not losing one).
- `lib/collections.ts`: `countNodes(items)` — recursively totals folders/
  requests contained in a folder's or collection's `.items` (not counting the
  container itself), reused for wording the confirmation message.
- `CollectionTree.tsx`: `requestDeleteNode`/`requestDeleteCollection` check
  `.items.length > 0` before deleting — if non-empty, they set a single shared
  `pendingDelete` state (title/description/onConfirm) instead of deleting
  immediately, and one `AlertDialog` at the tree root renders whichever is
  pending. `TreeHandlers.onDeleteNode` was replaced with
  `requestDeleteNode` throughout (both the folder and request branches of
  `NodeRow`); `CollectionRow` similarly takes `onRequestDeleteCollection`
  instead of the raw delete handler. The message reads e.g. `Delete "My
  Folder"? This folder contains 2 folders and 5 requests. Deleting it will
  permanently delete everything inside — this can't be undone.`

### Drag-and-drop reordering/move — DONE (pulled forward from "deferred")

Added `@dnd-kit/core` + `@dnd-kit/utilities` (no existing DnD library in the
project; user chose this over hand-rolled native HTML5 drag events for a nested
tree, given accessible/precise reordering is fiddly to get right by hand).

- `lib/collections.ts`: `locateNode` (finds a node's current collectionId/
  parentFolderId/index — needed both to remove it and to know where a drop
  target sits), `moveNodeInto` (append as last child of a folder/collection,
  with a `containsId` cycle guard so a folder can't be dropped into itself or
  its own descendant), `moveNodeBefore` (re-locates the target *after*
  extracting the dragged node, since removing a preceding sibling shifts
  indices), and `moveNodeRelativeToTarget` — the single entry point a drop
  calls, dispatching on what `targetId` resolves to: a `Collection` → append to
  its root; a folder node → append as its last child; a request node → insert
  immediately before it in its current parent.
- `CollectionTree.tsx`: every row (collection/folder/request) is both a drag
  source and a drop target via a combined `useDraggable`/`useDroppable` hook
  (`useTreeDragAndDrop`), merging both refs onto the same DOM node — the
  standard dnd-kit pattern for elements that are simultaneously draggable and
  droppable. `PointerSensor` uses an 8px activation distance so ordinary clicks
  (open a request, expand a folder, hit the "..." menu) aren't swallowed as
  drags. Visual feedback is simple (`opacity-40` while dragging, `bg-accent` on
  the hovered drop target) rather than a full `DragOverlay` ghost/animated
  reflow — reflowing sibling positions during drag would need `@dnd-kit/
  sortable`'s flattened-list machinery, real added complexity for a nested tree
  that didn't seem worth it for a first pass.
- **Known v1 limitation**: reordering two folders relative to each other isn't
  precise — dropping onto a folder always means "nest inside it," so the only
  way to move a folder is into another container, not to a specific position
  among its siblings. Reordering *requests* is precise (drop onto a request to
  land immediately before it). Revisit with a real drop-position indicator
  (before/after/inside based on pointer position within the target's bounds)
  if folder reordering turns out to matter.

**Follow-up: folder-to-folder reordering — DONE.** Added a `BeforeDropZone`
above every folder row (`CollectionTree.tsx`), same border-toggle line
treatment as `EndDropZone` — dropping there inserts the dragged item as a
sibling immediately before that folder, instead of nesting inside it (which
dropping on the folder's own row still does — useful for collapsed/empty
folders with no visible child to target instead). `lib/collections.ts` gained
`BEFORE_ZONE_PREFIX`/`beforeZoneId`, handled in `moveNodeRelativeToTarget` by
unwrapping the id and calling the already-existing (previously
folder-type-excluded) `moveNodeBefore` directly. **Scoped to folders only** —
reordering top-level *collections* relative to each other is a separate,
unbuilt feature (collections aren't part of the `CollectionNode` tree
`locateNode` searches, so this mechanism doesn't reach them; dragging a
collection onto another already silently no-ops today, pre-existing and
unrelated to this fix).

**Bug fix — drop zones made the idle tree look bulky.** `BeforeDropZone`/
`EndDropZone` were always rendered at a fixed `h-2` (8px), on top of the
existing `gap-0.5` between rows — with several folders in view that added up
to real visual bulk even when nobody was dragging anything, which is what
prompted this fix. Both now collapse to a `h-0.5` hairline when idle and only
grow to `h-2` while a drag is actually in progress (`isDragActive`, threaded
through `TreeHandlers` from `activeDragId !== null`) — the tree reads tight
in its normal state and only reveals comfortable drop targets during an
active drag.

**Bug fix — rounded drop-line + unreachable zone between two folders.**
Two issues from the same session:
1. `BeforeDropZone`/`EndDropZone` still had `rounded-full` unconditionally —
   the same "line curves at its ends" bug already fixed once for the
   request-row indicator (via `rounded-t-none` on hover), just never applied
   here. Removed `rounded-full` from both — they're flat insertion-line
   strips, no reason for pill rounding.
2. Dropping a request *between* two adjacent folders didn't work. Root
   cause: `DndContext` had no `collisionDetection` prop, so dnd-kit used its
   default, `rectIntersection` — which picks whichever droppable has the
   *greatest overlap area* with the dragged item. A thin `BeforeDropZone`
   sandwiched between two much taller folder rows always loses that area
   contest to the neighboring row, making it functionally unreachable even
   though it's correctly wired — a known dnd-kit gotcha for small droppables
   next to large ones. Fixed by setting `collisionDetection={closestCenter}`
   (imported from `@dnd-kit/core`) — compares center-to-center distance
   instead of area, the standard recommended strategy for this case.
   **Confirmed by user** — drag-and-drop now behaves smoothly, both the flat
   line and the between-two-folders drop work as expected.

**Follow-up: collections shouldn't be draggable.** `CollectionRow` used the
same combined `useTreeDragAndDrop` as folders/requests, making a collection
itself pickup-able — not intended; only a collection's *contents* should be
reorderable, the collection itself just stays a valid drop target for content
appended to its root. `useTreeDragAndDrop` gained an `isDraggable = true`
param — passing `false` (as `CollectionRow` now does) disables only the
`useDraggable` half via dnd-kit's own `disabled` flag, leaving `useDroppable`
fully active.

**Bug fix — phantom scrollbar while dragging**: the dragged row's visual
feedback originally moved it via `style={{ transform: CSS.Translate.toString(...) }}`
(a common dnd-kit pattern), but the row stays in normal document flow inside
the sidebar's `overflow-y-auto` container — and a CSS `transform` on an in-flow
descendant counts toward its ancestor's *scrollable overflow region* per spec.
Dragging a row down inflated the sidebar's `scrollHeight`, producing a new
scrollbar and letting the row be dragged into space that only existed because
of the transform; it only looked "fixed" after add/delete because that's what
forces a real reflow to recompute the scroll bounds. **Fix**: removed the
transform from the source row entirely (dropped `@dnd-kit/utilities`, now
unused) and switched to `DragOverlay` — a `document.body` portal, outside any
scrollable ancestor — showing a small floating preview (icon/method badge +
name, via a new `resolveDragPreview` helper) that follows the cursor instead
of moving the row itself. The source row now only fades (`opacity-40`) in
place while dragging.

**Follow-up: closing orphaned tabs on delete.** Deleting a request (or a
folder/collection containing requests) now also closes any open tab linked to
it via `sourceRequestId` — previously the tab stayed open pointing at a request
that no longer existed. Added `collectRequestIds` (`lib/collections.ts`, itself
for a request or every request nested in a folder) and `closeTabsForRequestIds`
(`App.tsx`, shared by `handleDeleteCollectionNode` and `handleDeleteCollection`)
which filters those tabs out, falling back to a fresh blank tab if that closes
the last one, or the first remaining tab if the *active* tab specifically was
among those closed. Extended to whole-collection delete too, not just
single-node delete — same bug class (a tab left pointing at something that no
longer exists), so it seemed right to fix both together rather than wait for a
follow-up report.

**Follow-up: tab bar didn't scroll to the active tab.** With enough open tabs
to overflow the strip, clicking a collection request that was already open
(the `sourceRequestId` dedup in `handleOpenCollectionRequest`) switched
`activeId` correctly but left the tab strip's scroll position untouched — the
newly-active tab could be scrolled out of view with no visible sign anything
happened. `TabBar.tsx` now keeps a `Map<string, HTMLDivElement>` of each tab's
row (set via a callback `ref`) and scrolls the active one into view
(`scrollIntoView({ block: "nearest", inline: "nearest" })`) whenever `activeId`
changes — not collections-specific (any programmatic tab switch benefits), but
surfaced by this feature.

**Follow-up: Collections/Environments sidebar sections didn't match.** The
"Environments" `Collapsible` had `defaultOpen` and `min-h-0 flex-1` sizing (so
it starts expanded and shares the sidebar's height); "Collections" had
neither, so it started collapsed and, even if opened, was sized `shrink-0`
(sized to content, not sharing available height). Made both identical —
`defaultOpen`, `min-h-0 flex-1` on the `Collapsible`, `scrollbar-thin` on the
content — so they now split the sidebar's height evenly and both start open,
matching after every reload.

**Follow-up: tree spacing/alignment + request-name box alignment.**
- Request rows' method-badge-to-name gap tightened from `gap-1.5` to `gap-1`,
  matching folder/collection rows.
- Folder and collection rows' leading `ChevronDown` + `Folder` icon pair is now
  wrapped in a fixed `w-8` slot (same width as the request row's method badge)
  instead of sizing to its own content — previously a request and a
  folder/collection at the same depth had their name text start at slightly
  different x positions since one slot was fixed-width and the other wasn't.
  Now any row's name text starts at an identical offset for a given depth.
  Updated the "Empty" placeholder's indentation formula to match
  (`(depth + 1) * 14 + 36`, accounting for one more depth level plus the
  36px slot+gap) so it still lines up under where a real child would sit.
- Removed the request-name input's `-ml-2` (a negative-margin/matching-padding
  trick that kept its *text* flush with the container edge while letting its
  hover-highlight box extend slightly further left for a nicer hit target).
  That box was the only element in the header starting to the left of
  `<main>`'s content edge — the tab bar, the method/URL/Send row, the
  Params/Headers/Body box, and the Response card all start flush with no
  extra margin. Removing it aligns the name input's box with all of them.

**Follow-up: unified sidebar top bar.** Moved "New collection" and "New
environment" out of the bottom of their own sections and into one shared
row above both `Collapsible`s: a search `Input` (`Sidebar.tsx`, `pl-7` for the
`Search` icon absolutely positioned inside it — no filtering logic yet, purely
the shell for a later feature) plus a single "+" `DropdownMenu` with "New
collection"/"New environment" items. `CollectionTree` no longer owns collection
creation at all (dropped its `onAddCollection` prop) — creating one is now
purely `Sidebar`/`App.tsx`'s concern. **Trade-off**: the old "+ New collection"
button auto-entered tree-inline-rename on the freshly created collection
(`setRenamingId(onAddCollection())`); the new top-bar dropdown doesn't, since
`renamingId` is private state inside `CollectionTree` with no clean way to
reach from outside without lifting it up (real added complexity for a nicety).
New collections now get the default name "New Collection" and are renamed via
the existing "..." menu, same as new environments already worked (they get an
auto-generated capital-city name, never needed inline-rename-on-create).

**Follow-up: drop-line indicator.** Hovering a drop target previously just
highlighted the whole row (`bg-accent`), which doesn't distinguish "insert
before this" from "nest inside this." Since the interaction model is fixed per
target type (dropping on a request always means insert-before; dropping on a
folder/collection always means nest-inside — see `moveNodeRelativeToTarget`),
no pointer-position tracking was needed to add a proper indicator: request
rows show a line above the row while something is dragged over them, replacing
their highlight entirely; folder/collection rows keep the `bg-accent` fill,
now reading unambiguously as "drop inside" since it's no longer also used for
the before-insertion case. Colored Harvest Gold (`#DA9100`) at 75% opacity,
per user preference over the default `bg-primary`.

**Bug fix — inconsistent line thickness between rows.** The first
implementation rendered the line as an absolutely-positioned `div`
(`absolute -top-px h-0.5/h-1`) inside each row. Its exact Y-offset depends on
the row's cumulative position in the scrolled list, so on some rows it landed
on a whole device pixel (crisp) and on others a fractional one (the browser
anti-aliased it, reading as visibly thicker/blurrier) — confirmed by the user
seeing 1-of-5 rows render differently even after doubling the nominal height,
which ruled out "just too thin" as the explanation. **Fix**: replaced the
overlay div with a `border-t-2` on the row itself, toggling only the border
*color* (`border-transparent` ↔ `border-[#DA9100]/75`) rather than adding the
border conditionally — border-width is always reserved so toggling never
shifts row height, and border rendering snaps to the device pixel grid
consistently (unlike a translated overlay), which is what actually fixes the
jitter. Trade-off: every request row is now uniformly ~2px taller (the
reserved but usually-transparent border), a bit more than the flex `gap-0.5`
between rows already added.

**Follow-up: renamed RequestPanel/ResponseViewer + fixed the response scroll
boundary.** Per user naming preference: `RequestPanel.tsx` →
`RequestVariablesTabs.tsx` ("the panel with Params/Headers/Body"),
`ResponseViewer.tsx` → `ResponseContainer.tsx` ("everything we receive in the
response"). While renaming, fixed two related layout issues the user flagged:

1. The scrollable region shared by both used to be one `overflow-y-auto`
   wrapper around both elements (`App.tsx`) — so the whole stack scrolled
   together even though only the Response Container was likely to overflow,
   which felt like a redundant middle scrollbar. `App.tsx`'s wrapper is now a
   plain flex column (no scroll of its own); `RequestVariablesTabs` keeps its
   fixed `h-[340px]` box, and `ResponseContainer`'s root is `min-h-0 flex-1`
   so it fills exactly the remaining frame space and never grows past it.
2. Even after that, the visible bordered `Card` was still `shrink-0` (sized to
   its own content) while the *invisible* wrapper around it held the actual
   `overflow-y-auto` — so the scrollbar rendered at the wrapper's edge,
   detached from the card's own border, and the card didn't fill the frame
   like it visually should have. Fixed by moving `min-h-0 flex-1
   overflow-y-auto` onto the `Card` itself (dropping the now-redundant
   per-section `max-h-[480px]` caps on the body `<pre>`, since the card as a
   whole is the scroll boundary now) — mirrors the pattern
   `RequestVariablesTabs`'s own box already used (border + `overflow-y-auto`
   on the same element, not a separate wrapper).

**Follow-up: labeled the Response Container's three parts.** Aligned with the
rename above — the container's three sections (status badge, headers, body)
now read as "Status" (unlabeled, self-evident from the badge alone, matching
Postman/Insomnia), "Response Headers" (renamed from just "Headers" in the
collapsible trigger, for symmetry with the request side's "Headers" tab), and
"Response Body" (previously had no heading at all — added one above the
`<pre>`).

**Follow-up: scroll only the Response Body, not the whole card.** After the
scroll-boundary fix above put `overflow-y-auto` on the whole response `Card`
(status + headers + body all scrolling together as one unit), the user
clarified that wasn't the intent — Status and Response Headers should stay
pinned in place, only the body itself should scroll. Card no longer has
`overflow-y-auto` (just `flex min-h-0 flex-1 flex-col`, bounding it to the
frame without scrolling itself); status row and headers `Collapsible` stay
`shrink-0`; the body's wrapping div is now the sole `min-h-0 flex-1
overflow-y-auto` — the only part that actually scrolls.

**Follow-up: unified the Card concept — RequestVariablesTabs now uses it too.**
User noticed `ResponseContainer` used the shared `Card` component while
`RequestVariablesTabs`'s box was a plain `<div>` manually styled to look the
same (border/rounded-lg matching, via the `ring-0` override pattern from
`ui-polish` Item 1) — same visual "container" concept, two different
implementations. Converted `RequestVariablesTabs.tsx` to render a `Card`
instead, with the same override treatment (`rounded-lg border border-input
ring-0`, `p-3` overriding Card's default `py-(--card-spacing)`). Audited the
rest of the codebase (`grep` for bordered-box patterns) for other instances of
this divergence — none found; everything else matching a border/rounded
pattern is a small interactive control (tab pills, drag-preview chip, shadcn
form primitives), not a "boxed content section," so `Card` doesn't apply
there. **One thing to verify visually**: `Card`'s base classes include
`overflow-hidden`; our override adds `overflow-y-auto` on the same element.
Whether `tailwind-merge` correctly drops the conflicting `overflow-hidden` in
favor of the per-axis override isn't something `tsc` can catch — needs an
eyeball check that Params/Headers/Body still scrolls with enough rows.

**Follow-up: Body textarea fixes.** Found while reviewing
`RequestVariablesTabs.tsx` right after the Card conversion above:
1. The Body `<textarea>` only had `spellCheck={false}`, missing the
   `autoComplete="off"`/`autoCorrect="off"` added to the Params/Headers
   `KeyValueEditor` inputs earlier this session (the fix for stray characters
   from Windows/WebView2 text suggestions) — same category of field (code,
   not prose), same latent vulnerability, just missed at the time. Added both.
2. The textarea had its own `bg-muted/60 rounded-md p-2`, making it look like
   a second nested card inside the outer `Card` (which already has its own
   background/border/padding) — a "box within a box." Removed all three; the
   textarea now sits flush in the outer Card's own `p-3` padding, same as how
   Params/Headers content already does, with no background/border of its own
   (the `focus-visible`/`aria-invalid` rings still render fine without it).
   **Correction**: removing the background/rounding made the `focus-visible`
   ring trace the textarea's *full* bounding box — nearly the same size as
   the outer Card — so it read as a second border fighting the Card's own
   rather than a normal focus cue. Removed `focus-visible:ring-2
   focus-visible:ring-ring/40` entirely per user preference (the outer Card
   already visually bounds the box); kept `aria-invalid:ring-2
   aria-invalid:ring-destructive` since that's the error-state indicator, a
   different concern from a focus cue.

**Follow-up: couldn't drop something as the last item.** Dropping on an
existing row only ever meant "insert before it" — there was no way to make a
dragged item land *after* the last item in a folder/collection short of
dragging all the way up to the folder/collection's own header (which appends
to the end, but is easy to lose reach of in a long list). Added `endZoneId`/
`END_ZONE_PREFIX` (`lib/collections.ts`) — `moveNodeRelativeToTarget` now
recognizes an `__end__:<containerId>` target id and recurses with the bare
container id, resolving to the exact same "append to end" destination the
header already used, no duplicated logic. `CollectionTree.tsx` renders a new
`EndDropZone` (small `useDroppable`, same border-toggle treatment as the
request-row line) right after the last item in every non-empty folder/
collection's list.

**Noted for later, not today**: the Request Body tab's overall approach
(plain `<textarea>`, no syntax highlighting/formatting/validation beyond the
existing non-blocking "invalid JSON" hint) might be worth revisiting once
Collections work settles — user flagged this in passing, no specific direction
yet.

**Follow-up: cross-collection dragging — confirmed working.** The move logic
(`moveNodeInto`/`moveNodeBefore` in `lib/collections.ts`) was never scoped to
a single collection — `extractNode` searches *all* collections, and the
destination is whatever collection the drop target belongs to — and the tree
UI runs one shared `DndContext` over every collection together, not one per
collection. Dragging a request/folder from one collection into a totally
different one works — **confirmed by user** dropping across collection
boundaries. Still open, not yet built:
- Auto-expanding a collapsed collection/folder while something is dragged
  over it and held there for a moment (common "hover-to-expand" tree UX) —
  right now reaching a precise spot *inside* a collapsed container during a
  drag requires expanding it first by hand.

### Explicitly deferred (unless scope changes)

- Import/export (Postman collection JSON format compatibility).
- Duplicating a request/folder.
