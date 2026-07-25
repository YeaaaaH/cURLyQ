# Collections — Plan

Two phases: (A) split `App.tsx` into domain-based modules/components first, since it's
grown to 1237 lines with everything — types, utils, and a ~660-line `App()` — in one
file; (B) build Postman-style nested-folder collections on top of the cleaner
structure. Update this file as steps complete or requirements change.

Phase A and most of Phase B (Rust persistence, sidebar tree UI, rename/delete/move,
drag-and-drop) are done — see `.tasks/done/collections.md`. Remaining work: Step B3
(save gesture), below.

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

## Phase B: Collections (Postman-style, nested folders)

### Data model

- `CollectionNode` — discriminated union:
  - Folder: `{ type: "folder", id, name, items: CollectionNode[] }`
  - Saved request: `{ type: "request", id, name, method, url, params, headers, body }`
- `Collection` — `{ id, name, items: CollectionNode[] }` (the root container — a
  named tree of folders/requests).
- `RequestTab` gains `sourceRequestId: string | null` and `sourceCollectionId: string
  | null`, so an opened saved request can be saved back in place.

### Step B3: Save gesture

- Save button/shortcut (e.g. Ctrl+S) on the active tab:
  - If the tab has a `sourceRequestId`, update that request in place.
  - Otherwise (a fresh "Untitled request" tab), open a "Save to..." picker: choose an
    existing collection/folder or create a new one, prompt for a name.
- "Save as" (secondary action) always opens the picker, even for tabs with a source —
  lets you fork a copy.

### Explicitly deferred (unless scope changes)

- Import/export (Postman collection JSON format compatibility).
- Duplicating a request/folder.

### Noted, not scheduled

- The Request Body tab's overall approach (plain `<textarea>`, no syntax
  highlighting/formatting/validation beyond the existing non-blocking "invalid
  JSON" hint) might be worth revisiting once Collections settles — flagged in
  passing by the user, no specific direction yet.
- Auto-expanding a collapsed folder/collection when something is dragged over
  it and held there (hover-to-expand) isn't built — reaching a spot inside a
  collapsed container during a drag currently requires expanding it by hand
  first.
