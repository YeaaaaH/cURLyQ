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

## Step 1: Headers tab

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

## Step 2: Body tab

- Add `body: string` to `RequestTab` (defaults to `""`).
- Replace the `"No body yet."` placeholder with a `<textarea>`-style input (monospace,
  matching the Figma mockup's JSON panel), bound to `activeRequest.body`.
- Per `project_specs.md`, v1 body support is raw text/JSON — no schema validation
  required, but consider a lightweight "invalid JSON" hint (non-blocking, similar to
  `getUrlError`) since the panel is JSON-flavored.
- **Open decision — confirm with the user before implementing**: should a
  `Content-Type: application/json` header be auto-set when the body is non-empty and
  the user hasn't already added their own `Content-Type` row in Headers? v1 scope says
  "raw headers only" (no auth helpers), but this is a body-encoding default, not an auth
  helper — worth a quick check-in either way rather than assuming.
- Body should be sendable regardless of HTTP method (don't restrict to POST/PUT/PATCH
  only) — matches how Postman/Insomnia behave and keeps the UI simple.

### Rust side

- `send_request` needs an optional body parameter, e.g. `body: Option<String>`.
- Apply via `.body(body)` on the request builder only when `Some` and non-empty.

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

## Now in v1 scope, but not part of this plan

`project_specs.md` was updated to move **saving/loading requests to disk** and
**environment variables / variable substitution** into v1 scope. Both are real
features, not small additions to the current Headers/Body work, so they deserve their
own `.tasks/<name>/PLAN.md` when picked up rather than being folded in here. Worth
noting now since they'll likely interact with this feature (e.g. env var substitution
needs to run on whatever `url`/`headers`/`body` look like by the time Headers/Body
land, and "save request" needs a settled `RequestTab` shape to serialize).
