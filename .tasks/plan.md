# Plan

All open/planned work for cURLyQ lives here — one flat backlog instead of scattered
per-feature `PLAN.md` files. Shipped work moves to `.tasks/done.md` instead of staying
here. The MVP scoped in `project_specs.md` is done — everything here is continuous
improvement, not walled off by a "v1"/"out of scope" boundary anymore.

**Process**: one item at a time. Implement, get it reviewed/confirmed working in the
running app, then mark it done here (and move a short summary to `done.md`) before
starting the next.

## Security

The sharpest gap in the current backlog — the failure mode here is "your API
key leaves your machine," not "a feature is missing."

- Environment variables have no "secret" type — stored as plain
  `{key, value}` in unencrypted `environments.json`, and the full flattened
  environment is handed to every pre/post-request script via
  `ctx.environment`. Add a `KeyValuePair`-shaped `isSecret` flag, mask secret
  values at rest and in the UI (Postman-style eye-toggle), and reconsider
  what a script's `ctx.environment` should expose once scripts can come from
  an untrusted import (see Scripting polish below).
- The script sandbox (`sandbox.worker.ts`) is a crash/hang boundary (timeout
  + terminate), not a security boundary — it's a Web Worker with
  `new Function`, still has `fetch`/`XMLHttpRequest`. Document this
  explicitly (README or in-app copy near the Scripts tab) so it's a known
  tradeoff, not a silent assumption.
- `tauri.conf.json` sets `"csp": null`, and `read_text_file`/`write_text_file`
  accept an arbitrary path string with no allowlisting. No live exploit
  today (response rendering is plain `<pre>`, no `dangerouslySetInnerHTML`),
  but there's no defense-in-depth backstop if that ever changes. Set a real
  CSP and consider scoping the fs commands to dialog-picked paths only.

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

- **Export is done** (see `done.md`) — Postman's `event`/`exec` script
  array, a Postman-shaped headers/body/response API on `ctx`, and a
  `disableBodyPruning` flag for GET-with-body requests are all wired up and
  verified against real Postman. Only **import** remains: Postman's
  `event`/`exec` scripts are still silently dropped on import
  (`collections.ts` hardcodes both to `""`). Scope narrowly first:
  request-level scripts only, not folder/collection-level inherited scripts
  (Postman allows scripts at any of those levels) — that inheritance question
  needs its own decision before extending further.
- Postman scripts use the `pm.*` API (`pm.environment`, `pm.test()`,
  `pm.expect()`, `pm.sendRequest()`, `pm.variables`, `pm.collectionVariables`);
  cURLyQ's `ctx.*` now covers headers/body/response in Postman's own shape
  (see `done.md`) but still has no assertion framework or async
  sub-requests. A naive plumbing fix would still import scripts that throw
  on anything beyond environment/headers/body/response (e.g.
  `pm.test is not a function`). Two viable increments, in order: (1) import
  raw script text as-is with a visible "uses Postman's `pm` API, may still
  need rewriting" notice — safe, honest, unblocks the plumbing gap now; (2)
  build out `pm.test`/`pm.expect` (Chai-style assertions)/`pm.sendRequest`/
  `pm.variables`/`pm.collectionVariables` as a separate, larger later piece
  once it's clear how much of Postman's scripting API is worth
  reimplementing.
- Import should show a "this collection contains N scripts — review before
  enabling" prompt rather than silently populating and running them — this
  is the actual point an untrusted script could reach `ctx.environment`,
  ties directly into the Security section above.

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

## HTTP feature coverage

- HEAD/OPTIONS methods (currently GET/POST/PUT/PATCH/DELETE only).
- `multipart/form-data` / file-upload body type — only raw/JSON text today.
- Request cancellation — no `AbortController` in `requestSend.ts`, no cancel
  button; a hung request only ends via the hardcoded 30s server timeout, and
  a collection run can't be stopped mid-flight.
- Response body is read fully via `.text()` — errors outright on
  binary/non-UTF8 responses, no size cap, fully buffered in memory. Needs a
  content-type/size check before deciding text vs. binary handling.
- Cookie jar, proxy config, client-cert/TLS options — all absent from the
  shared `reqwest::Client`.
- Per-request timeout override (currently hardcoded 30s for every request
  via the shared client).

## Testing & CI

- Zero frontend test coverage — no vitest/jest, nothing in `package.json`
  devDependencies — despite the variable tokenizer/resolver (cycle
  detection), Postman import/export mapping, drag-and-drop collection-tree
  reordering, and collection-run sequencing all living in `src/lib` with
  real logic worth pinning down. Add vitest, start with the variable
  resolver (highest-risk, most self-contained).
- No ESLint config at all; CI's "frontend" job is just `tsc && vite build`.
- Rust side: only 2 tests, both on `Collection` serde tagging. `send_request`
  and the save/load JSON paths have no coverage.

## Not yet prioritized

Ideas noted but nobody's picked up yet — not excluded, just behind everything
above: built-in auth helpers (Bearer, Basic, OAuth), request history.
