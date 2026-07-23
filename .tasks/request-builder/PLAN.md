# Request Builder — Plan

Tracks the remaining work for the request-tabs/request-builder feature (tabs, name,
method/URL/send, Params/Headers/Body). Update this file as steps complete or
requirements change — it's meant to carry context across sessions, not just this one.

Source design reference: Figma file `4gvGyPnh2xqjT2YUS60Aaj` (node `4:2`), built from
the app's own Tailwind/shadcn tokens (Geist font, neutral OKLCH palette, 10px base radius).

## Conventions established so far (read before touching `src/App.tsx`)

- **Data model**: `RequestTab` (one per open tab) holds `id`, `name`, `method`, `url`,
  `activeSubTab`, `params`, `response`, `error`, `isSending`. Each tab is fully
  independent — switching tabs must not lose in-progress state.
- **`KeyValuePair`** (`{ id, key, value, enabled }`) is the shape used for Params, and
  should be reused as-is for Headers.
- **Self-growing row list pattern**: the row array always keeps exactly one trailing
  empty row in *actual state* (not a derived/virtual one). Typing into it fills it in;
  once it stops being empty, a new empty row is appended. **Do not** use a shared
  literal key (like `"__new__"`) for a placeholder row — that caused a real bug where
  React matched the key across renders and yanked focus away mid-typing. Real, stable
  `crypto.randomUUID()` ids only.
- **Enabled checkbox**: unchecking a row excludes it from the request but keeps the row
  (never delete on uncheck). The checkbox and trash icon are both hidden (`invisible`,
  not unmounted, to preserve column alignment) on the trailing empty row via an
  `isTrailingEmpty` check.
- **URL/Params sync (params-specific, doesn't apply to headers)**:
  - `buildRequestUrl(url, params)` — fully percent-encoded via the `URL` API, used only
    at send time for the actual outgoing request.
  - `buildDisplayUrl(url, params)` — human-readable reconstruction (only `&`, `=`, `#`
    are escaped) used to keep the URL bar readable, including non-ASCII text (e.g.
    Cyrillic). Never use `url.toString()` for anything user-facing.
  - Editing a Params row rewrites the URL's query string (`syncUrlWithParams`).
    Typing/pasting a URL with an existing query string populates the rows
    (`handleUrlChange`). Clearing the URL resets params back to a single blank row.
- **Workflow**: one small piece at a time, type-check (`npx tsc --noEmit -p
  tsconfig.json`) after every edit, rely on Vite HMR for live verification instead of
  restarting the dev server, and only commit/push when explicitly asked.

## Step 1: Headers tab — DONE

Replace the `"No headers yet."` placeholder with a row editor identical in structure to
Params (same `KeyValuePair`, same self-growing-row/enabled-checkbox/trash-icon pattern),
but:
- Add a `headers: KeyValuePair[]` field to `RequestTab` (seed with one empty row, same
  as `params`).
- **No URL sync** — headers don't touch the URL bar, so no `buildDisplayUrl`-equivalent
  is needed here.
- At send time, only rows with `enabled === true` and a non-empty trimmed key are sent.

### Rust side (`src-tauri/src/lib.rs`)

- `send_request` needs a new parameter, e.g. `headers: Vec<(String, String)>` (prefer a
  `Vec` of pairs over `HashMap<String, String>` so duplicate header names — e.g. multiple
  `Set-Cookie`-style request headers — aren't silently collapsed).
- Apply via `.header(name, value)` per pair on the `reqwest::RequestBuilder` (chain
  before `.send()`).
- No validation beyond what `reqwest` already enforces (invalid header names/values
  surface as the existing `.map_err(|e| e.to_string())` error path) — keep this
  consistent with how `method`/`url` parsing errors are already surfaced.

## Step 2: Body tab — DONE

- Add `body: string` to `RequestTab` (defaults to `""`).
- Replace the `"No body yet."` placeholder with a `<textarea>`-style input (monospace,
  matching the Figma mockup's JSON panel), bound to `activeRequest.body`.
- Per `project_specs.md`, v1 body support is raw text/JSON — no schema validation
  required, but consider a lightweight "invalid JSON" hint (non-blocking, similar to
  `getUrlError`) since the panel is JSON-flavored.
- **Resolved**: auto-set `Content-Type: application/json` when the body is non-empty
  and no `Content-Type` row already exists in Headers (case-insensitive match) — v1
  only ever sends JSON bodies, so this is a safe default. A content-type dropdown
  (JSON/text/form/etc.) is deferred until non-JSON bodies are actually supported.
- Body should be sendable regardless of HTTP method (don't restrict to POST/PUT/PATCH
  only) — matches how Postman/Insomnia behave and keeps the UI simple.
- Extra UX polish added beyond the original plan: Tab inserts a 2-space indent instead
  of moving focus (`handleBodyKeyDown`), triple-or-more click selects the whole body
  (`onMouseDown` intercept at `e.detail >= 3`, `preventDefault` + `.select()` to avoid
  the native per-click-count selection flicker), and the panel uses a filled
  background (`bg-muted/60`, no border, `resize-none`) instead of a nested bordered
  box to avoid a double-container look.

### Rust side

- `send_request` needs an optional body parameter, e.g. `body: Option<String>`.
- Apply via `.body(body)` on the request builder only when `Some` and non-empty.

## Step 3: Persist open tabs across restarts — DONE

**Scope clarified during implementation**: this is tab-session restore (like a browser
restoring previous tabs), not a Postman-style "saved requests" library. No explicit
Save action — Ctrl+S/a Save button was considered but rejected, since in Postman that
gesture means "save to a collection," which doesn't exist yet (see the CI/CD-adjacent,
still-deferred collections feature). Instead:

- `PersistedTab` (Rust) — the on-disk subset of `RequestTab`: `id`, `name`, `method`,
  `url`, `params`, `headers`, `body`. Excludes `response`, `error`, `isSending`,
  `activeSubTab` — no responses are persisted, matching the user's explicit ask.
- Storage: `tabs.json` in Tauri's `app_data_dir()` (`C:\Users\<user>\AppData\Roaming\
  cURLyQ\tabs.json` on Windows, after the identifier rename from `com.curlyq.app`).
  Whole-list write, no per-tab diffing.
- Rust commands `save_tabs`/`load_tabs`, registered in `generate_handler!`.
- Frontend: debounced autosave (500ms after the last change to `requests`) via a
  `useEffect`, no dirty-flag tracking, no button, no keyboard shortcut. On mount, a
  separate `useEffect` calls `load_tabs` and replaces the initial blank tab if
  anything was persisted.
- A real "saved requests" / collections library (with an explicit save gesture) is a
  separate future feature, not this one.

## Step 4: Environment variables — DONE

- `Environment { id, name, variables: KeyValuePair[] }`, app-level `environments`
  state (shared across tabs). `activeEnvironmentId` lives in localStorage rather
  than Rust — a UI preference, not shared request data. Environments themselves
  persist via `save_environments`/`load_environments`, mirroring `save_tabs`/`load_tabs`.
- `substituteVariables` resolves `{{varName}}` against the active environment at
  send time (URL, params, headers, body) without touching stored state, so the raw
  template stays editable. New environments are auto-named from a world-capitals
  list instead of "Environment N", deduped against names in use.
- **Resolved**: full editor lives in a "Manage environments" `Dialog`; a dropdown
  next to the tab bar switches the active one and opens the Dialog per-row via a
  pencil icon; a drag-to-open left sidebar (Postman-style rail, "Collections"
  placeholder + "Environments" list) gives a roomier view for many environments.
- Along the way: fixed an app-wide focus-ring color, and a flexbox scroll/squish
  bug that affects any `overflow-y-auto` list sized to a fixed height.

## Stretch: Copy as cURL

Frontend-only — no Rust changes needed, since by send time the full request (method,
final percent-encoded URL, enabled headers, body) is already assembled in JS.

- Pure function: `buildCurlCommand(method, url, headers, body) -> string`, formatting
  `curl -X METHOD 'url' -H 'Key: Value' ... --data 'body'`.
- Copy via `navigator.clipboard.writeText`, triggered by a small button near Send.
- Target bash-style single-quote escaping (`'\''` for embedded single quotes) as the
  common case; note as a known limitation that this isn't guaranteed to paste cleanly
  into PowerShell/cmd.
- Do this after Headers + Body land, since a cURL export without them is only
  partially useful.

## Explicitly not doing (per `project_specs.md` v1 scope)

- Collections/folders, built-in auth helpers, request history. Don't build toward
  these unless the user changes scope.
