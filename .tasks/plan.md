# Plan

All open/planned work for cURLyQ lives here — one flat backlog instead of scattered
per-feature `PLAN.md` files. Shipped work moves to `.tasks/done.md` instead of staying
here. Keep aligned with `project_specs.md`'s v1 scope.

**Process**: one item at a time. Implement, get it reviewed/confirmed working in the
running app, then mark it done here (and move a short summary to `done.md`) before
starting the next.

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

## Workflows (flows)

Mid-term goal. Postman-inspired but deliberately lighter: a visual chain of
requests, closer to what our team's day-to-day API testing actually needs
than Postman's heavier canvas/branching model.

Design decisions made during brainstorming:
- First-class entity alongside collections, not nested inside a single one —
  the whole point is chaining requests that live in *different* collections
  without duplicating them into a throwaway local collection first.
- Each step **live-references** a saved request (from any collection, or
  standalone). Editing the source request updates the flow automatically.
- Steps run **linearly** (top to bottom) for v1 — deliberately not a DAG or
  parallel executor, even though explicit bindings (below) would make one
  derivable later without a data-model change. No branching/conditional/
  loop logic (Postman's `setNextRequest()` makes control flow untraceable
  from the UI — not repeating that). Canvas can still render steps as
  connected nodes visually; execution itself stays sequential.
- Data passes between steps via **explicit typed bindings**, not implicit
  script side effects: each step defines an `extract` block (named outputs
  pulled from its response, e.g. via a JSON path) and a later step binds a
  field to `{{steps.<stepId>.<name>}}` — reusing the existing Variable
  Engine (`src/lib/variables/`) for resolution, cycle detection, and
  resolved/unresolved token coloring rather than building new resolver
  infra. Pre/post-response scripts remain available as an escape hatch for
  logic a declarative extractor can't express (e.g. computing a signature)
  — a script's `ctx.environment.set()` output is exposed as a binding the
  same way a declarative extract is, but extract/bind is the primary,
  inspectable channel, not scripts. Rationale: Postman's chaining lives
  entirely in script side effects on a shared variable bag, so there's no
  static link between a producer and consumer step — a response-shape
  change three steps back surfaces as a runtime error nobody can trace to
  its source. Known cost: the extract-field UI (JSON path editor + response
  validation) is new surface area, not something reused from the existing
  script textarea.
- **Resumable runs**: persist each step's extracted/bound values as a
  snapshot keyed by step id, so a failed run at step 7 can resume from step
  6's snapshot instead of re-executing steps 1–6 (and their side effects —
  e.g. a POST that creates a resource) from scratch. Replaces the scripting
  engine's earlier "last run only" limitation with a concrete per-step
  history a flow run can actually use.
- Step detail view reuses the existing `RequestBuilder` (params/headers/body
  tabs) rather than a cramped node-inspector panel — the thing we found
  ugly/unfriendly about Postman Flows.
- **Export inlines/snapshots** every referenced request into the flow's JSON,
  so a flow file is self-contained and shareable — Postman can't do this
  (Flows have no export option at all, since they reference workspace
  resources by ID and break on import elsewhere). This is a deliberate
  advantage to preserve, not an incidental detail.

## Collection run

Goal: batch-execute every request in a collection or folder, top-to-bottom in
current tree order — Postman's "Collection Runner," scoped down. Distinct
from Workflows (flows) above: no curated step list, no cross-collection
chaining, just "run what's already in this collection/folder."

Design decisions made during brainstorming:
- Trigger from a collection's or folder's context menu ("Run collection" /
  "Run folder") rather than a new top-level entity like Workflows.
- Sequential execution only, recursing into nested folders in tree order. No
  parallelism, no reordering separate from the tree itself.
- On failure, don't stop the run — execute every request regardless and
  report pass/fail per request at the end, like Postman's Runner.
- Runs headlessly against `send_request` rather than opening a tab per
  request — needs a dedicated results view (list of requests with
  status/time, expandable per-request detail) rather than reusing
  `RequestTab`/`ResponseDetails`.
- Reuses the existing scripting engine as-is for data passing between
  requests — pre-request/post-response scripts already read/write the
  active environment via `ctx.environment.get/set`, so a later request in
  the run sees an earlier request's `ctx.environment.set()` calls with no
  new mechanism needed. Runs against the currently active environment, same
  as a normal single send.
- No data-driven iteration for v1 (no CSV/JSON data file, no repeat-N-times)
  — a single top-to-bottom pass only. Worth revisiting as a later polish
  item if it turns out to matter in practice.

Open question, needs deciding before implementation: what counts as
"failure" for the pass/fail report. The scripting engine has no assertion
concept (a `pm.test()` equivalent) today — only pre-request/post-response
side-effect scripts. Simplest v1 definition is "non-2xx status or network
error," with real assertions deferred; worth confirming that's acceptable
before designing the results UI around it.

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
  piecemeal.
- Postman's own `event`/`exec` script arrays aren't mapped on import/export —
  an imported Postman collection's scripts are silently dropped.
- `ctx.variables.*` alias, mutating the URL or HTTP method from a
  pre-request script — deliberately left out of v1's `ctx` API surface.
- Snippet helper buttons / autocomplete for the `ctx` API itself (e.g. a
  quick-insert for `ctx.environment.set(...)`), separate from the JS syntax
  highlighting above.

## Explicitly out of scope for v1 (do not build toward these)

Per `project_specs.md`: built-in auth helpers (Bearer, Basic, OAuth), request history.
