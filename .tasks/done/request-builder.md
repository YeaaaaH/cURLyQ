# Request Builder — Done

Steps 1–4 of the request-tabs/request-builder feature. Remaining work (Stretch: Copy as
cURL) is still tracked in `.tasks/request-builder/PLAN.md`.

- **Step 1: Headers tab** — row editor identical in structure to Params (same
  `KeyValuePair`, self-growing-row/enabled-checkbox/trash-icon pattern). `send_request`
  (Rust) takes `headers: Vec<(String, String)>` (a `Vec` of pairs, not a `HashMap`, so
  duplicate header names aren't silently collapsed), applied via `.header()` per pair.
- **Step 2: Body tab** — `body: string` on `RequestTab`, monospace textarea. Auto-sets
  `Content-Type: application/json` when the body is non-empty and no Content-Type
  header already exists (case-insensitive match). Body is sendable on any HTTP method.
  `send_request` takes an optional `body: Option<String>`. UX extras: Tab inserts a
  2-space indent instead of moving focus, triple-click selects the whole body, filled
  background instead of a nested bordered box.
- **Step 3: Persist open tabs across restarts** — tab-session restore (not a
  Postman-style saved-requests library — no Save button/shortcut). `PersistedTab`
  (Rust) excludes `response`/`error`/`isSending`/`activeSubTab`. Stored as `tabs.json`
  in `app_data_dir()` via `save_tabs`/`load_tabs`. Debounced 500ms autosave, restored
  on mount.
- **Step 4: Environment variables** — `Environment { id, name, variables }`, app-level
  `environments` state shared across tabs; `activeEnvironmentId` lives in localStorage
  (a UI preference, not shared data). `substituteVariables` resolves `{{var}}` against
  the active environment at send time without mutating the stored template. New
  environments auto-named from a world-capitals list, deduped against names in use.
  Full editor lives in a "Manage environments" Dialog; a sidebar rail (drag-to-open)
  gives a roomier view for many environments.

## Conventions that came out of this work (still apply to remaining/future work)

- `RequestTab`: id, name, method, url, activeSubTab, params, response, error,
  isSending — each tab fully independent, switching tabs must not lose in-progress
  state.
- `KeyValuePair` (`{ id, key, value, enabled }`) shared by Params/Headers/env
  variables.
- Self-growing row list: the row array always keeps exactly one trailing empty row in
  real state. Never use a shared literal key (like `"__new__"`) for a placeholder row —
  caused a real bug where React matched the key across renders and yanked focus away
  mid-typing. Always real `crypto.randomUUID()` ids.
- Enabled checkbox: unchecking a row excludes it from the request but never deletes the
  row. Checkbox/trash icon are `invisible` (not unmounted) on the trailing empty row to
  preserve column alignment.
- URL/Params sync (params-specific): `buildRequestUrl` (fully percent-encoded, send-time
  only) vs `buildDisplayUrl` (human-readable, keeps the URL bar readable including
  non-ASCII text) — never use `url.toString()` for anything user-facing.
