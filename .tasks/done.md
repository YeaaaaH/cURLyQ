# Done

Compact history of what's shipped, by feature. Newest first. For open/planned work, see
`.tasks/plan.md`.

## Collection run (2026-08-02)

Postman-"Collection Runner"-style batch execution: "Run" on a folder or collection's
context menu sequentially sends every request nested under it, in tree order, continuing
past failures rather than stopping (`runCollectionRequests`, `src/lib/collectionRun.ts`).
"Failure" is deliberately simple for v1 — non-2xx status or a network error — since the
scripting engine has no assertion API yet. Chaining between steps reuses the scripting
engine as-is: an accumulated patch of every `ctx.environment.set()` call so far in the
run is layered onto the active environment for each later step, both for variable
substitution and for what a step's own scripts see via `ctx.environment.get()` — the
live environment state alone wouldn't reflect an earlier step's patch mid-run, since
committing it to React state is an async update the run loop doesn't wait on.

Results open as their own tab in the same strip as request tabs (`RunResultTab`, a
`Tab = RequestTab | RunResultTab` union in `src/lib/tabs.ts`) rather than a separate
view — ephemeral, never persisted, since a run result is a snapshot of a past action.
Each row is expandable into the exact same `ResponseContainer`/`ScriptLogsPanel`
components a single request tab already uses, reused as-is rather than reimplemented;
the script-logs sub-section only auto-opens when a script actually ran for that request,
since most don't have one.

The send pipeline itself (`sendRequestWithScripts`, `src/lib/requestSend.ts`) was
extracted out of `useRequestTabs`'s `handleSend` as a reusable, tab-independent function
first, so both a live tab's Send button and the headless run engine share one
implementation instead of two.

Also added along the way: an unsaved-changes indicator (a dot on a tab's name) for any
request tab whose url/params/headers/body/scripts differ from what's actually
persisted — discovered as a real gap during testing, since Collection Run reads the
persisted collection tree, not open tabs, so an unsaved edit would silently run stale.
Deliberately excludes name/method from the comparison, since those already sync to the
collection live on every change unlike the rest, which only write back on an explicit
Save.

Fixed a real pre-existing bug found along the way: `CollectionNode::Request`'s
`pre_request_script`/`post_response_script` fields (`src-tauri/src/lib.rs`) had
`#[serde(default)]` but no camelCase rename, unlike `PersistedTab`, which correctly has
one — a `rename_all` on a `#[serde(tag = "type")]` enum only affects variant tag names,
not field names within a variant. Every `save_collections` call had been silently
resetting saved scripts to `""` (the JSON keys never matched), and every `load_collections`
left `preRequestScript`/`postResponseScript` `undefined` in JS. No data was actually lost
by the fix, since nothing had ever round-tripped correctly in the first place.

## CI/CD — cross-platform release builds (2026-08-01)

Two workflows: `.github/workflows/ci.yml` (PRs + pushes to `master` — frontend
build, `cargo fmt`/`clippy -D warnings`/`cargo test`, then a lightweight
per-OS `cargo check` matrix to catch OS-specific breakage without redoing
full installer packaging) and `.github/workflows/release.yml` (tag-triggered
on `v*.*.*`, builds via `tauri-apps/tauri-action` across
windows-latest/ubuntu-22.04/macos-latest, uploading to a **draft** GitHub
Release you publish by hand). Non-obvious: macOS Intel + Apple Silicon are
both built by cross-compiling `--target x86_64-apple-darwin`/
`aarch64-apple-darwin` on the same `macos-latest` (ARM) runner — no literal
Intel runner needed, since Rust cross-target linking doesn't execute target
code at build time. Ubuntu 22.04 is a hard floor, not an arbitrary choice —
Tauri v2 requires WebKitGTK 4.1, which Ubuntu 20.04's repos don't ship at
all, and GitHub also retired the `ubuntu-20.04` hosted runner in April 2025.
Renamed `productName` in `tauri.conf.json` from the npm-scaffold default
`"tauri-app"` to `"cURLyQ"` so installer filenames are correct. Process
documented in `docs/releasing.md`; automated via the `/release` skill
(version bump across `tauri.conf.json`/`package.json`/`Cargo.toml`, sync
`Cargo.lock`, confirm, tag, push — the one flow that still pushes straight
to `master`, since it's mechanical and the tag has to point at a `master`
commit anyway).

Landed alongside a git workflow change: `master` is now protected by
convention (not yet server-side) — the `/commit` skill's `committer`
subagent creates/reuses a `feature/`/`bug`/`task` branch, pushes it, and
opens a PR via `gh pr create` instead of pushing directly. Verified
end-to-end: two PRs went through the new flow with `ci.yml` running for
real on the first one, and `v0.1.0` was tagged and built successfully across
all four platform legs (`.msi`/NSIS `.exe`, two `.dmg`s, `.deb`/`.AppImage`/
`.rpm`) as the first real release.

## Pre-request / post-response scripts (2026-07-31)

Scripts run in an isolated Web Worker (`src/lib/scripting/`) via
`new Function("ctx", "console", script)` — `ctx` is a narrower, Postman-`pm`-inspired
object (`environment.get/set/toObject`; `request.headers.get/set` + `request.body.get/set`,
pre-request only; `response.status/headers/body/json()`, post-response only) plus a
captured `console.log/warn/error`. A 5s wall-clock timeout kills a runaway script via
`worker.terminate()`. Non-obvious: the worker streams one `ScriptWorkerMessage` per side
effect (each `ctx.*.set()`/console call), not one final result — so a script that hangs
after a few successful calls doesn't lose them when the timeout kills it; `runScript.ts`
accumulates the stream into the final `ScriptRunResult`. Neither half blocks the request
on error — a throwing pre-request script still applies whatever it managed before
throwing, and the request still sends either way. UI: a 3-way switcher in the Scripts tab
(Pre-request/Post-response/Logs) — Logs shows both halves side-by-side, quiet ("No
output.") when a script did nothing observable, Success/Failed badges only when there's
something to report. `Ctrl+/` line-comment toggle (`src/lib/textEditing.ts`) added to
Scripts + Body editors along the way. Full reference: `docs/scripting.md`.

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
