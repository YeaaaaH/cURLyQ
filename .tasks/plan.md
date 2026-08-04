# Plan

All open/planned work for cURLyQ lives here — one flat backlog instead of scattered
per-feature `PLAN.md` files. Shipped work moves to `.tasks/done.md` instead of staying
here. The MVP scoped in `project_specs.md` is done — everything here is continuous
improvement, not walled off by a "v1"/"out of scope" boundary anymore.

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
- Steps run **linearly** (top to bottom) for now — deliberately not a DAG or
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

## Variable engine polish

- `{{`-triggered autocomplete of variable names in the Body/URL/Headers
  editors, via `@codemirror/autocomplete` (already a dependency, currently
  unused for custom completions).

## Scripting polish

- Postman's own `event`/`exec` script arrays aren't mapped on import/export —
  an imported Postman collection's scripts are silently dropped
  (`collections.ts` hardcodes both to `""` on import). Scope narrowly first:
  request-level scripts only, not folder/collection-level inherited scripts
  (Postman allows scripts at any of those levels) — that inheritance question
  needs its own decision before extending further.

## Body editor polish

- "Beautify"/format button for the Body tab — reformat JSON with consistent
  indentation. A naive version (strip `//`/`/* */` comments via
  `stripJsonComments`, substitute `{{vars}}` with placeholders the same way
  `getBodyError` does, `JSON.parse` + `JSON.stringify(..., null, 2)`) is
  small, comparable effort to Sidebar search's basic filtering — but it
  silently destroys any comments in the body, which stings now that
  comment-tolerance is a real, deliberate feature (see the CodeMirror
  editor swap in `done.md`). Preserving comments through a reformat needs a
  real parser that attaches comments to AST nodes and re-emits them in
  place — the hard part of any formatter — likely via a dependency (e.g.
  Prettier's standalone bundle) rather than a hand-rolled reformatter.
  Recommendation: ship the naive strip-comments version first, only invest
  in comment-preservation if it turns out people actually rely on Body
  comments enough to miss them.

## Not yet prioritized

Ideas noted but nobody's picked up yet — not excluded, just behind everything
above: built-in auth helpers (Bearer, Basic, OAuth), request history.
