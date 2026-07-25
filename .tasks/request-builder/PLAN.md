# Request Builder — Plan

Tracks the remaining work for the request-tabs/request-builder feature (tabs, name,
method/URL/send, Params/Headers/Body). Update this file as steps complete or
requirements change — it's meant to carry context across sessions, not just this one.

Steps 1–4 (Headers tab, Body tab, tab persistence, environment variables) are done —
see `.tasks/done/request-builder.md`.

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

- Built-in auth helpers, request history. Don't build toward these unless the user
  changes scope. (Collections/folders were also out of v1 scope originally but are
  now in progress — see `.tasks/collections/PLAN.md`.)
