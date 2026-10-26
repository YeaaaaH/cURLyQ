# Pre-request / post-response scripts

Each request has a **Scripts** tab (alongside Params/Headers/Body), with its
own three-way switcher: **Pre-request** and **Post-response** each show that
half's editor (plain JavaScript), and **Logs** shows both halves' last run
side by side, entirely separate from the editors. A half that ran clean,
logged nothing, and changed nothing shows quietly as "No output." — no
badge, nothing to imply you need to look at it. Setting an environment
variable or overriding a header/body counts as doing something even without
a single `console.log` call, so that shows up too (as a green "Set
environment variable: ..." line, not just silence) — only a truly
no-op-in-every-sense run stays quiet. Whenever there *is* real output (logs
and/or changes), a green "Success" badge sits next to the label too — the
mere absence of a red "Failed" badge isn't a strong enough signal on its own
that a run actually succeeded, especially once there's a wall of
`console.log(undefined)` lines to second-guess. An error gets a "Failed"
badge and the message instead. The Logs tab itself picks up a small red dot
the moment either half fails, so a failure doesn't require remembering to
go check.

Both script editors (and the Body tab's raw JSON editor) support **Ctrl+/**
(Cmd+/ on Mac) to toggle a `//` line comment on the current line or every
line touched by the selection — same shortcut as VS Code and most other
code editors (CodeMirror's built-in `toggleComment`, wired up in
`src/components/codemirror/theme.ts`).

## Why a sandbox, and what `ctx` is

Scripts don't run in the main app — they run inside a dedicated [Web
Worker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)
(`src/lib/scripting/sandbox.worker.ts`), a separate JS thread with no access
to the app's DOM, React state, or Tauri APIs. Two reasons:

- **Isolation from the app.** A script can't reach anything in the app
  except what's explicitly handed to it (see below). It can't read other
  tabs, can't touch the file system, can't call Tauri commands.
- **Hang safety.** An infinite loop in a script would freeze the whole
  window if it ran on the main thread. Running it in a Worker means a 5s
  timeout can `worker.terminate()` it instead — see `SCRIPT_TIMEOUT_MS` in
  `src/lib/scripting/runScript.ts`.

> **Not a security boundary.** The Worker still has network access
> (`fetch`, `XMLHttpRequest`), and every script sees the whole active
> environment through `ctx.environment` — tokens and passwords included. A
> script can send those anywhere. Only run scripts you wrote or have read,
> and be careful with collections from someone else.

Each script is called as a plain function body with three parameters:

```ts
const run = new Function("ctx", "pm", "console", script);
run(ctx, ctx, sandboxConsole);
```

`pm` is a literal alias for `ctx` — the same object under a second name, so
`pm.environment.set(...)` and `ctx.environment.set(...)` behave identically.
It exists so Postman-style scripts run as-is; it only covers what `ctx`
implements (see the table below), not Postman-only surface like `pm.test`.

`ctx` is a plain object built fresh for that one run, containing only the
pieces of app data listed below (serialized and sent into the Worker via
`postMessage` — nothing else crosses that boundary). `console` is a fake
console whose `log`/`warn`/`error` calls are captured and shown in the
**Logs** tab (not your browser devtools). Only the last run of each half is
kept; there's no history across sends yet.

## `ctx` API reference

| Call | Available in | What it does |
|---|---|---|
| `ctx.environment.get(key)` | pre-request, post-response | Reads a variable from the active environment. `undefined` if unset. |
| `ctx.environment.set(key, value)` | pre-request, post-response | Writes a variable back into the active environment — persists after the request finishes, and (for pre-request) is visible to variable substitution on the very same send. |
| `ctx.environment.toObject()` | pre-request, post-response | Snapshot of every variable as a plain `{key: value}` object — useful for `console.log`-ing or iterating all variables, since `.get`/`.set` alone can't answer "what's in there" (and being functions, they don't show up in a logged `ctx` either — see note below). |
| `ctx.request.headers.get(key)` | pre-request only | Reads a header on the request about to be sent. |
| `ctx.request.headers.set(key, value)` | pre-request only | Overrides/adds a header for **this send only** — doesn't edit the saved Headers tab. |
| `ctx.request.headers.add(...)` / `.upsert(...)` | pre-request only | Postman's method names, same effect as `.set`. Accept either `({key, value})` (the real Postman form) or `(key, value)`. |
| `ctx.request.body.get()` | pre-request only | Reads the current request body. |
| `ctx.request.body.set(value)` | pre-request only | Overrides the body for **this send only** — doesn't edit the saved Body tab. |
| `ctx.request.body.raw` | pre-request only | Getter/setter alias of `.get()`/`.set()` — `pm.request.body.raw = "..."` works like in Postman. |
| `ctx.request.body.update({ raw })` | pre-request only | Postman-style alias of `.set(raw)`; also accepts a plain string. |
| `ctx.response.status` | post-response only | HTTP status code (number), read-only. |
| `ctx.response.code` | post-response only | Same number as `.status` — Postman's name for it (in real Postman, `.status` is the reason phrase like `"OK"`, which cURLyQ doesn't have). |
| `ctx.response.headers` | post-response only | Response headers as a plain object, read-only. |
| `ctx.response.body` | post-response only | Raw response body text, read-only. Empty for a binary response (image, PDF, archive…). |
| `ctx.response.json()` | post-response only | Parses `ctx.response.body` as JSON — throws if it isn't valid JSON. |
| `console.log/warn/error(...)` | both | Captured — visible in the Logs tab. |

`ctx.request` doesn't exist in a post-response script; `ctx.response` doesn't
exist in a pre-request one.

**Note on `console.log(ctx)`:** `get`/`set` are functions, and functions
vanish when the console's logger serializes an object — so
`console.log(ctx)` always prints `environment` (and `request`, if present)
as `{}`, even when the environment has variables. That's not evidence
they're broken — call `ctx.environment.toObject()` (or log a specific value,
e.g. `ctx.environment.get("token")`) to actually see something.

## Examples

Pre-request — compute something and inject it as a header:

```js
ctx.request.headers.set("X-Timestamp", Date.now().toString());
```

Pre-request — set an environment variable used later in the same request's
URL/headers/body (via `{{token}}`):

```js
ctx.environment.set("token", "abc123");
```

Post-response — pull a field out of the response into an environment
variable, so a later request (or, eventually, the next step of a Workflow)
can use it:

```js
ctx.environment.set("authToken", ctx.response.json().token);
```

## Error handling

Neither half blocks anything — a throwing script never stops the request
from being sent, and never hides a response that already came back. Either
way, the Logs tab picks up a red dot and that half's section marks itself
"Failed" with the message. A pre-request script still applies whatever it
managed to set up (environment/header/body changes) before it threw; it
only stops running the rest of that script, not the send itself.

A script that runs past 5 seconds (an infinite loop, most likely) is killed
and reported as a timeout error, the same way. Its effects up to that point
aren't lost either: each `ctx.*.set()` call and `console.log` is reported to
the app the moment it happens, not saved up and sent only once the whole
script finishes — so `ctx.environment.set("token", "abc"); while (true) {}`
still leaves `token` set, even though the script never actually completes.

## Gotchas

- **Reading past the end of an array doesn't throw.** `data.items[99]` on a
  3-element array is just `undefined` in plain JS — there's no exception to
  catch, so a script that does this "succeeds" with a green checkmark. If a
  value looks wrong, `console.log()` it and check for `undefined` rather
  than assuming an error would've been raised.
- **`console.log(undefined)` prints the literal text `undefined`**, not a
  blank line — if the Logs tab looks empty, the call either didn't run, or
  logged an empty string, not `undefined`.
- **Calling `.set(key, undefined)` is a no-op**, on `ctx.environment`,
  `ctx.request.headers`, and `ctx.request.body` alike — nothing is written
  (an existing value, if any, is left untouched), and a `[warn]` line
  explaining why shows up in the Logs tab. Any other non-string value (a
  number, boolean, etc.) *is* stored, coerced to a string.

## Not supported (yet)

Deliberately out of scope for now — see `.tasks/plan.md`:

- `ctx.variables.*` alias, mutating the URL or HTTP method from a script
- `ctx.sendRequest` (issuing an HTTP call from inside a script)
- Postman-only APIs: `pm.test`, `pm.expect`, `pm.sendRequest`,
  `pm.variables` — calling them throws
- `async`/`await` inside scripts — the script body runs synchronously
- **Import** of Postman's `event`/`exec` script arrays — an imported Postman
  collection's scripts are dropped, and the import log says how many. **Export** does write them: script text
  goes through a best-effort `ctx` → `pm` word-boundary rewrite, and the
  export toast says how many scripts were rewritten so you can double-check
  them.

## Where the code lives

- `src/lib/scripting/sandbox.worker.ts` — the Worker entry point; builds
  `ctx` and runs the script.
- `src/lib/scripting/runScript.ts` — spins up the Worker, applies the
  timeout, exposes `runPreRequestScript`/`runPostResponseScript`.
- `src/lib/scripting/types.ts` — the `ScriptRunResult` shape shared between
  the Worker and the UI.
- `src/lib/requestSend.ts`'s `sendRequestWithScripts` — wires both scripts
  into the send flow (environment patch application, request patching);
  `src/hooks/useRequestTabs.ts`'s `handleSend` calls it and pushes each
  stage's result into the tab's state.
- `src/components/request-variables-tabs/scripts/` — the Scripts tab UI
  (`ScriptsTab`, `ScriptEditor`, `ScriptLogsPanel`, `ScriptOutputSection`).
