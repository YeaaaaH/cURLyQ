# Import/Export (Postman v2.1) — Plan

Tracks import/export of Postman-format JSON, plus a session-only log of recent
import/export executions. First pass scoped to **environments only** — collections
import/export (Postman Collection v2.1) is a deferred follow-up once this lands.

**Status: environment import, export, and the log panel are all done.** Only
collections import/export (explicitly deferred from the start) remains.

## Decisions made so far

- **Scope**: environments first, not collections. Collections import/export (nested
  folders, request method/url/headers/body mapping) is more involved and gets its own
  follow-up once the environment path is proven out.
- **UI location — trigger**: "Import environment..." added to the sidebar's existing
  "+" `DropdownMenu` (`Sidebar.tsx`, currently "Collection"/"Environment"). Export is
  per-environment — **deviation from the original draft**: it landed in the existing
  "..." `DropdownMenu` on each row inside `EnvironmentEditor.tsx` (which already had
  "Delete"), not a new icon next to the pencil in `Sidebar.tsx` — that dropdown was
  already the natural home for a per-row action once actually looking at the editor.
- **UI location — log panel**: a `shrink-0` footer row at the bottom of the sidebar's
  flex column (below the Collections/Environments `Collapsible`s, inside the same
  `p-3` container) — full-width ghost button, `History` icon (lucide-react) + "Import/
  Export Log" label. Opens a shadcn `Popover` anchored to the button, `side="top"`
  (it's pinned at the screen bottom) + `align="start"`. **`Popover` isn't in the
  project yet** — add via `npx shadcn@latest add popover`, same pattern as
  `alert-dialog` was added for delete confirmations. Popover content isn't width-bound
  to the narrow sidebar (portaled overlay), so it can use a comfortable `w-72`/`w-80`.
- **Log persistence**: session-only (`useState`, no Rust/disk persistence) — resets on
  every launch. Simpler for a first pass; can upgrade to a persisted
  `import_export_log.json` (mirroring `tabs.json`/`environments.json`) later if it
  turns out to matter.
- **Log capacity**: last 10 entries, newest first.
- **Name-collision handling on import**: auto-rename via the same dedupe approach
  `nextEnvironmentName` already uses, rather than overwrite or prompting — matches how
  new environments already avoid name clashes.
- **Notifications (added mid-build, not in the original draft)**: `npx shadcn@latest
  add sonner` (pulls in `sonner` + `next-themes` as new deps) gives a `<Toaster
  richColors />` mounted once in `App.tsx` — green `toast.success`/red `toast.error`
  fire alongside every log entry, so success/failure is visible immediately without
  opening the log popover. The log panel stays the "look back at history" surface;
  the toast is the "notice it just happened" one. Note: `sonner.tsx`'s generated
  wrapper uses `next-themes`'s `useTheme()`, but this app has no `ThemeProvider` set
  up — harmless (falls back to `"system"`, matching how the rest of the app's CSS
  already follows the OS preference), just something to revisit if a real theme
  toggle is ever added.
- **Log entry detail view**: clicking a row in the log popover opens a `Dialog`
  (reusing the existing primitive, no new dependency) with the full untruncated,
  selectable error message, exact timestamp, and variable count — the popover row
  itself stays truncated to one line for scanning.

## New dependency: `@tauri-apps/plugin-dialog`

Native file open/save dialogs — not installed yet. Needs:
- `npm install @tauri-apps/plugin-dialog` (frontend) + `cargo add tauri-plugin-dialog`
  (`src-tauri/`).
- Register `.plugin(tauri_plugin_dialog::init())` in `src-tauri/src/lib.rs`.
- A capabilities-file permission entry (`src-tauri/capabilities/*.json`) — Tauri 2
  requires explicit per-plugin permissions, unlike Tauri 1's global allowlist. Worth
  explaining when we get there since this is a new concept for the project.

## Postman Environment v2.1 format (what we're parsing/emitting)

```json
{
  "id": "...",
  "name": "Dev",
  "values": [
    { "key": "baseUrl", "value": "https://api.example.com", "type": "default", "enabled": true }
  ],
  "_postman_variable_scope": "environment"
}
```

## Mapping to our model

- `values[].{key,value,enabled}` → `KeyValuePair` (`src/lib/keyValue.ts`), dropping
  Postman's `type` field — secret-variable masking is out of v1 scope, treat
  `"secret"` and `"default"` the same.
- Postman's `id`/`_postman_*` metadata fields are dropped on import, not preserved for
  round-trip fidelity. Our `Environment.id` is always a fresh `crypto.randomUUID()`,
  never reused from the imported file.

## Import flow — DONE

1. "Import environment..." in the sidebar "+" dropdown opens a native file-open
   dialog (JSON filter) via `plugin-dialog`'s `open()`.
2. New Rust command `read_text_file(path) -> String` (`src-tauri/src/lib.rs`) reads
   the picked path — arbitrary, OS-dialog-chosen, unlike the app-data-dir helpers
   used for `tabs.json`/`environments.json`/`collections.json`. Frontend
   `JSON.parse`s the result.
3. `parsePostmanEnvironment(json, existing)` (`src/lib/environments.ts`) validates
   the shape (rejects an `item` array as "looks like a collection", requires a
   `values` array), maps `values[]` → `KeyValuePair[]` through the existing
   `stripEmptyRows`/`ensureTrailingBlankRow` helpers, and dedupes the name against
   `existing` environments (`"Dev"` → `"Dev (2)"` on a clash — a name-preserving
   dedupe, deliberately not `nextEnvironmentName`'s capital-city scheme, since an
   imported file already has a name the user chose).
4. `handleImportEnvironment` (`App.tsx`) appends the result to `environments` state
   (the existing debounced `save_environments` effect persists it, no new
   persistence code needed) and opens it in "Manage environments" so the import is
   immediately visible.
5. Pushes an `ImportExportLogEntry` + fires a toast either way — success labels with
   the (deduped) environment name and variable count, failure labels with the picked
   file's name and the caught error's message (`PostmanImportError` for
   validation failures, the raw error otherwise).

## Export flow — DONE

1. "Export..." in the per-row "..." `DropdownMenu` inside `EnvironmentEditor.tsx`
   (alongside "Delete").
2. `buildPostmanEnvironment(environment)` (`src/lib/environments.ts`) — reverse of
   `parsePostmanEnvironment`, strips the trailing blank row via `stripEmptyRows`,
   emits `values[].{key,value,type:"default",enabled}` + `_postman_variable_scope`/
   `_postman_exported_at`. Doesn't try to round-trip an original Postman `id` or any
   `_postman_*` metadata we never kept on import.
3. Native save-file dialog via `plugin-dialog`'s `save()`, default filename
   `<name>.postman_environment.json` (Postman's own export naming convention).
4. New Rust command `write_text_file(path, contents) -> ()` writes the JSON to the
   chosen path.
5. Same log-entry-plus-toast pattern as import, on both the success and error path.

## Log panel — DONE

- `ImportExportLogEntry` (`src/lib/importExportLog.ts`) — `id`, `timestamp`,
  `direction` (`"import" | "export"`), `label` (environment name on success, file
  name on failure — a failed parse may never produce a name), `variableCount?`,
  `status`, `message?`. `pushLogEntry` caps the list at 10, newest first. Lives as
  `App.tsx` state, passed down to `Sidebar`.
- Trigger: `History`-icon ghost button, full-width, at the bottom of the sidebar's
  flex column. Opens a `Popover` (`side="top"`, `align="start"`) listing entries —
  status icon, single-line-truncated summary, relative time (`formatRelativeTime`).
  Empty state: "No imports or exports yet."
- **Detail view (added after initial build)**: clicking a row opens a `Dialog`
  (reusing the existing primitive) with the full untruncated, selectable message,
  exact timestamp (`toLocaleString()`), and variable count — added because the
  popover's necessarily-truncated single-line message was cutting off real error
  text (e.g. a JSON `SyntaxError`) with no way to read the rest.

## Explicitly deferred (this pass)

- Collections import/export (Postman Collection v2.1 — `item[]` tree, `request`
  method/url/headers/body mapping) — separate follow-up.
- Secret-type variable masking (Postman's `type: "secret"`).
- Preserving Postman's own `id`/`_postman_*` metadata for round-trip fidelity.
- Persisting the log across restarts.
