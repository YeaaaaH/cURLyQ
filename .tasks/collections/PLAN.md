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

### Step B1: Rust persistence

- `collections.json` in `app_data_dir()`, mirroring `environments.json` (whole-tree
  write, no per-node diffing).
- `save_collections`/`load_collections` Tauri commands, registered in
  `generate_handler!`.

### Step B2: Sidebar — collection tree UI

- Replace "No collections yet." with a recursive tree component: folders
  expand/collapse via `Collapsible`, requests are clickable leaves.
- "+ New collection" button (mirrors "+ New environment").
- Per-node "..." menu: New folder, New request, Rename, Delete.
- Clicking a saved request opens it in a new tab, seeded from the saved request and
  tagged with `sourceRequestId`/`sourceCollectionId`.

### Step B3: Save gesture

- Save button/shortcut (e.g. Ctrl+S) on the active tab:
  - If the tab has a `sourceRequestId`, update that request in place.
  - Otherwise (a fresh "Untitled request" tab), open a "Save to..." picker: choose an
    existing collection/folder or create a new one, prompt for a name.
- "Save as" (secondary action) always opens the picker, even for tabs with a source —
  lets you fork a copy.

### Step B4: Rename/delete/move

- Rename & delete for folders, collections, and requests. Deleting a non-empty
  folder/collection cascades — confirm before deleting.
- Move a request/folder to a different parent — stretch, can defer to a follow-up.

### Explicitly deferred (unless scope changes)

- Drag-and-drop reordering/move.
- Import/export (Postman collection JSON format compatibility).
- Duplicating a request/folder.
