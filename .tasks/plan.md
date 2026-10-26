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
- `tauri.conf.json` sets `"csp": null`, and `read_text_file`/`write_text_file`
  accept an arbitrary path string with no allowlisting. No live exploit
  today (response rendering is plain `<pre>`, no `dangerouslySetInnerHTML`),
  but there's no defense-in-depth backstop if that ever changes. Set a real
  CSP and consider scoping the fs commands to dialog-picked paths only.
- Importing scripts (see Scripting polish) must come with a "this collection
  contains N scripts — review before enabling" prompt, not silently populate
  and run them — that's the point an untrusted script could reach
  `ctx.environment`.

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
- Step detail view reuses the existing `RequestEditor` (params/headers/body
  tabs) rather than a cramped node-inspector panel — the thing we found
  ugly/unfriendly about Postman Flows.
- **Export inlines/snapshots** every referenced request into the flow's JSON,
  so a flow file is self-contained and shareable — Postman can't do this
  (Flows have no export option at all, since they reference workspace
  resources by ID and break on import elsewhere). This is a deliberate
  advantage to preserve, not an incidental detail.

## Variables

- **Collection-level and global variables.** Only the active environment
  exists today. `createVariableContext` already merges scopes first-match-wins
  (`src/lib/variables/context.ts`), so this is mostly a new `VariableScope`
  per level plus UI and persistence. Order to decide: environment > collection
  > global, like Postman.
- `{{`-triggered autocomplete of variable names. The Body editor is
  CodeMirror, so `@codemirror/autocomplete` (already a dependency) covers it;
  URL/params/headers are plain `<input>` + overlay (`VariableAwareInput`), so
  they need a hand-rolled dropdown — or a move to single-line CodeMirror.
- The "Unresolved variables" hint under the URL bar covers the whole request
  (URL, params, headers, body), so a `{{var}}` used only in the body reads as
  a URL problem. Say where each one is used, e.g. `{{port}} (body)`.

## Scripting polish

- **Import Postman scripts.** Export already writes `event`/`exec`; import
  still drops them (`collections.ts` hardcodes both to `""`) and only reports
  how many were dropped. `pm` is already an alias of `ctx`, so importing the
  raw text works for the supported subset. Scope: request-level scripts only
  — Postman also allows folder/collection-level inherited scripts, which needs
  its own decision. Blocked on the review prompt in Security.
- **`pm.test` / `pm.expect`** (Chai-style assertions), then `pm.sendRequest`,
  `pm.variables`, `pm.collectionVariables`. Unlocks real pass/fail in
  Collection run, which today counts any 2xx as passed — a 200 with
  `{"error": ...}` passes. Larger piece: decide how much of Postman's API is
  worth reimplementing before starting.

## HTTP feature coverage

- Body types beyond raw/JSON: `x-www-form-urlencoded` first (key/value rows,
  reuses `KeyValueEditor`), then `multipart/form-data` with file upload
  (needs file picking and a Rust-side multipart builder).
- Request cancellation — a Cancel button for a send and for a collection
  run. Discarding the result on the frontend is easy; actually aborting the
  network call needs a request id passed to `send_request` and an abort
  handle kept in Rust state (e.g. `tokio::select!` against a oneshot).
  Today a hung request ends only via the 30s client timeout, and a
  collection run can't be stopped mid-flight.
- Paste a cURL command into the URL bar → populate method/URL/headers/body.
  Needs a small shell-quoting-aware parser (`-X`, `-H`, `-d`/`--data-raw`,
  `--url`, line continuations).
- Response viewer: syntax highlighting and Ctrl+F search via a read-only
  CodeMirror (needs `@codemirror/search`), instead of a plain `<pre>`.
- Auth tab: Bearer and Basic first (compile to an `Authorization` header at
  send time, like `DEFAULT_HEADERS`), OAuth2 later.
- Request history: last N sends with method/URL/status/time, re-openable as
  a tab.
- Response size: text bodies are fully buffered and sent over IPC with no
  cap, so a multi-MB response freezes the `<pre>` render. Truncate the
  displayed body past a limit (with "show all" / "save to file"). Binary
  bodies are already detected by Content-Type and not transferred
  (`is_binary_content_type` in `lib.rs`); next steps there are an image
  preview and "save response to file".
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
