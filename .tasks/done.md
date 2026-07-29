# Done

Compact history of what's shipped, by feature. Newest first. For open/planned work, see
`.tasks/plan.md`.

## Code Health (2026-07-29)

Full readability/leakage/performance pass. `App.tsx` split 992 → 218 lines into
`src/hooks/` (`useEnvironments`, `useRequestTabs`, `useCollections`,
`useEdgeDragPanel`) — a hooks-based split rather than a component folder, since there
was no more JSX left to extract, only state/handler logic. Fixed a double-send race
(ref-based per-tab guard, since React state alone can't close a stale-closure window),
two drag-listener leaks (missing `pointercancel` cleanup), reused a single
`reqwest::Client` with a timeout instead of one per request, deduped three
near-identical Rust persistence triples into one generic `save_json`/`load_json`,
memoized `Sidebar` with a `React.memo` + full `useCallback` chain (including a
`requestsRef` pattern for the one handler that needs live tab state without
depending on it), and changed response headers from `HashMap` to `Vec<(String,String)>`
so repeated header names (e.g. `Set-Cookie`) survive.

## Variable Engine (2026-07-28)

Replaced ad hoc, non-recursive `{{var}}` handling with a proper engine
(`src/lib/variables/`: tokenizer, context, resolver, requestResolver, diagnostics) —
recursive resolution with cycle detection — and a zero-dependency overlay component
(`VariableAwareInput`/`VariableAwareTextarea`) that colors tokens by resolution state
(resolved/unresolved) across URL, Params, Headers, and Body. Selection highlighting is
drawn manually in the overlay (native `::selection` can't be made to contrast reliably
against arbitrary token colors underneath it) — the one non-obvious piece worth
remembering if this component is touched again.

## Import/Export — Postman v2.1 (2026-07-26)

Environment and collection import/export to/from Postman v2.1 JSON, via
`@tauri-apps/plugin-dialog` native file dialogs + new `read_text_file`/`write_text_file`
Rust commands. Session-only log (last 10 entries) in a sidebar popover, plus
`sonner` toasts on every import/export. Name collisions auto-dedupe rather than
overwrite or prompt. Non-raw request bodies (form-data, urlencoded, GraphQL) import as
empty with a note in the toast/log, since v1 only represents raw/JSON bodies.

## Collections (2026-07-26)

Postman-style nested folders: `CollectionNode` discriminated union (folder/request),
persisted via Rust (`collections.json`). Sidebar tree UI with inline rename, drag-and-drop
reorder/move (`@dnd-kit/core`, cycle-guarded, cross-collection dragging), delete
confirmation for non-empty containers only. Save/Save-As gesture (Ctrl+S or buttons) —
Save writes in place if the tab is linked to a saved request, Save As always forks a new
one. `App.tsx` refactored 1237 → 414 lines as prep (later split further, see Code
Health). Fixed a bug along the way: `httpbingo.org` rejected UA-less requests with a
bare 402 — added a default `User-Agent` header, shown as a locked/disabled row in the
Headers editor when not overridden.

## Request Builder (2026-07-22)

Core request-tabs feature: method/URL/Send, Params/Headers/Body sub-tabs, environment
variables (`{{var}}` substitution against an active environment), tab persistence across
restarts (`tabs.json`), and Copy as cURL (`buildCurlCommand`, in the Variables panel's
cURL tab). Established conventions still in effect: `KeyValuePair` shared shape for
Params/Headers/env vars; self-growing-row lists always keep one real trailing empty row
(never a shared literal placeholder key — caused a real focus-yanking bug); URL↔Params
sync via `buildRequestUrl` (percent-encoded, send-time) vs. `buildDisplayUrl`
(human-readable, never `url.toString()`).

## UI Polish bug/analysis batch (2026-07-22)

Six fixes from a hands-on pass: bounded-height layout so only individual panels scroll
(not the whole document); tab/sub-tab active-state persistence; environment-rename
input lag (root cause: full-tree re-render per keystroke); Params not syncing on
templated URLs (`new URL()` throws on `{{...}}` — added `parseParamsFromUrl`); a dummy
empty variable row was being persisted verbatim (added `stripEmptyRows`/
`ensureTrailingBlankRow`); reviewed the persistence mechanism (full-list overwrite) and
confirmed it's fine at this scale.
