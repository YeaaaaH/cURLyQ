# Plan

All open/planned work for cURLyQ lives here — one flat backlog instead of scattered
per-feature `PLAN.md` files. Shipped work moves to `.tasks/done.md` instead of staying
here. Keep aligned with `project_specs.md`'s v1 scope.

**Process**: one item at a time. Implement, get it reviewed/confirmed working in the
running app, then mark it done here (and move a short summary to `done.md`) before
starting the next.

## CI/CD — cross-platform release builds

Goal: a GitHub Actions workflow that builds the Tauri app for Windows/macOS/Linux and
attaches installer artifacts (`.msi`/`.exe`, `.dmg`, `.AppImage`/`.deb`) to a GitHub
Release. Deferred — not blocking other work.

Decisions already made:
- Trigger on tag push (`v*.*.*`), not every commit to master — releases should be
  deliberate.
- Use `tauri-apps/tauri-action` (handles the per-OS build matrix + release upload)
  rather than hand-rolling it.
- GitHub-hosted macOS runners produce unsigned builds (Gatekeeper warnings, no Apple
  Developer cert) — acceptable for now, code-signing is a later decision.

Draft steps: add `.github/workflows/release.yml` matrixed over
`windows-latest`/`macos-latest`/`ubuntu-latest`, triggered on `v*.*.*` tags; confirm the
Linux apt package list (`webkit2gtk`, `libayatana-appindicator`, etc.) against
`tauri-action`'s docs at implementation time; document the release-cutting process
somewhere discoverable once it exists.

## Collections

- Duplicate a request or folder.
- Auto-expand a collapsed folder/collection when something is dragged over it and held
  there (currently requires expanding by hand first).
- `SaveRequestDialog`'s tree picker has no create-folder affordance of its own — revisit
  alongside a proper name-prompt flow (matching the sidebar's inline-rename convention)
  rather than the current auto-named "New Collection" quick-create, if it turns out to
  matter in practice.
- The Body tab's plain `<textarea>` (no syntax highlighting/formatting beyond the
  existing non-blocking "invalid JSON" hint) might be worth revisiting — flagged in
  passing, no specific direction yet. Partially softened by the variable-engine's token
  coloring, but full syntax highlighting is still unbuilt.

## Import/Export (Postman v2.1)

- Secret-type variable masking (Postman's `type: "secret"`).
- Preserve Postman's own `id`/`_postman_*` metadata for round-trip fidelity (currently
  dropped on import, regenerated fresh on export).
- Persist the import/export log across restarts (currently session-only, resets on
  every launch).
- Non-raw request body modes (form-data, urlencoded, GraphQL) — currently import as an
  empty body with a note in the toast/log, since v1 scope is raw/JSON bodies only.
- Export a single folder as its own Postman collection (Postman itself supports this;
  only whole-collection export is built).
- Rebuild `url.protocol`/`host`/`path`/`query` on export (currently only `url.raw` is
  emitted, which is sufficient for re-import but not a full round-trip).

## Pre-request / post-response scripts

Not started. Design decision already made: scripts run as plain JS in the
webview/frontend, no embedded Rust JS engine.

## Small UI polish

- Colorize the method dropdown in the URL bar: `METHOD_COLORS` (`src/lib/http.ts`)
  already exists and is used for the method badge everywhere else (tabs, collection
  tree rows) — just needs applying to each `SelectItem` label in `UrlBar.tsx`'s method
  `<Select>`.

## Variable engine polish (not in original scope)

- Ctrl/Cmd-click a `{{var}}` token to navigate to its definition.
- "Create missing variable" quick-fix from an unresolved token.
- Full diagnostics (squiggly underlines, a problems list) beyond the current
  resolved/unresolved coloring.
- Distinct visual treatment for circular vs. plain-unresolved variables (currently
  both render the same "unresolved" red).
- `{{`-triggered autocomplete of variable names.

## Explicitly out of scope for v1 (do not build toward these)

Per `project_specs.md`: built-in auth helpers (Bearer, Basic, OAuth), request history.
