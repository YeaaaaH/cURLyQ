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

## Sidebar search

`SidebarSearchAndAdd.tsx`'s search input is an unwired shell — needs actual
filtering wired up. Design agreed, not yet built:

- Lift `query` state (plain `useState<string>`, not persisted — search text
  shouldn't survive a reload) up to `Sidebar.tsx`, controlling the `Input`
  and passed down to both `CollectionsSection`/`CollectionTree` and
  `EnvironmentsSection`.
- Match names only (folder/request/environment names), not method/URL —
  keeps it simple.
- One shared search box filters both Collections and Environments at once,
  not a separate box per section.
- Add `filterCollections(collections, query)` to `lib/collections.ts` —
  recursive, a node matches if its own name matches or any descendant does
  (so ancestor folders stay visible around a match), alongside the tree's
  other structural helpers (`locateNode`, `mapItems`, etc). A simple name
  filter for environments too.
- Auto-expand-to-reveal: compute an *ephemeral* set of ancestor ids that
  must be open to show current matches, fresh per keystroke, and OR it into
  `CollectionTree.tsx`'s `treeState.isOpen` read only — never written to the
  persisted `expandedById` in `useCollectionTreeState`, so clearing the
  query reverts to exactly the expand state from before searching. Same
  ephemeral-override idea for the Collections/Environments section-level
  collapse (now `usePersistedBoolean`-backed) so a match auto-opens a
  collapsed section without touching its persisted state.
- Add a "No matches for '...'" empty state alongside `CollectionTree.tsx`'s
  existing "No collections yet." message.

Medium effort: the query plumbing and basic filtering are small and
mechanical; the auto-expand-reveal layer is the tricky part, since it must
not disturb persisted expand state. Worth two review checkpoints — (1) query
plumbing + basic filtering, (2) auto-expand-reveal on top.

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

## Workflows (flows)

Mid-term goal, after core collections work is done. Postman-inspired but
deliberately lighter: a visual chain of requests, closer to what our team's
day-to-day API testing actually needs than Postman's heavier canvas/branching
model.

Design decisions made during brainstorming:
- First-class entity alongside collections, not nested inside a single one —
  the whole point is chaining requests that live in *different* collections
  without duplicating them into a throwaway local collection first.
- Each step **live-references** a saved request (from any collection, or
  standalone). Editing the source request updates the flow automatically.
- Steps run **linearly** (top to bottom) for v1 — no branching/conditional/
  loop logic. Canvas can still render steps as connected nodes visually;
  execution itself stays sequential.
- Data passes between steps via the pre-request/post-response scripting
  engine (now built — see `.tasks/done.md` and `docs/scripting.md`), e.g.
  extract a field from step A's response, feed it into step B. That engine
  currently only keeps each script's *last* run for its own request tab —
  worth revisiting once a flow can actually chain multiple runs, since
  debugging a multi-step chain probably wants more than "last run only."
- Step detail view reuses the existing `RequestBuilder` (params/headers/body
  tabs) rather than a cramped node-inspector panel — the thing we found
  ugly/unfriendly about Postman Flows.
- **Export inlines/snapshots** every referenced request into the flow's JSON,
  so a flow file is self-contained and shareable — Postman can't do this
  (Flows have no export option at all, since they reference workspace
  resources by ID and break on import elsewhere). This is a deliberate
  advantage to preserve, not an incidental detail.

## Response metadata

- Track and surface response time (ms) and response size (bytes) next to the
  status badge in `ResponseDetails.tsx` — called for by the Modernist redesign
  but not yet backed by real data. `HttpResponse` (`src/lib/http.ts`) and the
  `send_request` command (`src-tauri/src/lib.rs`) currently only return
  status/headers/body. Needs: time the request in `send_request` (wrap the
  `request.send().await` call, e.g. `std::time::Instant`) and compute a size
  (byte length of the response body, plus headers if we want a "wire size"
  rather than just body size), thread both through `HttpResponse` and
  `RequestTab`, then render them in the response header row.

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

## Scripting polish (not in original scope)

- More advanced text editing for the script editor — currently a plain
  `<textarea>` (`ScriptEditor.tsx`) with only `Ctrl+/` comment-toggle; no JS
  syntax highlighting, bracket matching, or autocomplete. Likely needs a
  real editor component (e.g. CodeMirror) rather than extending the plain
  textarea further — worth designing deliberately rather than bolting on
  piecemeal, given the Body tab's own "no syntax highlighting" gap
  (Collections section above) is the same underlying need.
- Postman's own `event`/`exec` script arrays aren't mapped on import/export —
  an imported Postman collection's scripts are silently dropped.
- `ctx.variables.*` alias, mutating the URL or HTTP method from a
  pre-request script — deliberately left out of v1's `ctx` API surface.
- Snippet helper buttons / autocomplete for the `ctx` API itself (e.g. a
  quick-insert for `ctx.environment.set(...)`), separate from the JS syntax
  highlighting above.

## Explicitly out of scope for v1 (do not build toward these)

Per `project_specs.md`: built-in auth helpers (Bearer, Basic, OAuth), request history.
