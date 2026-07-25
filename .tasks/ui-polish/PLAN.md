# UI Polish + Persistence Bug Backlog — Plan

Tracks a batch of bugs/analysis items found during a hands-on pass over the app, plus
four larger new features scoped alongside them. This file is the living,
session-to-session tracker — update it as items complete.

Items 1–6 (the bug/analysis batch) are done — see `.tasks/done/ui-polish.md`. This file
now only tracks Part 2.

**Process**: one item at a time. Implement, get it reviewed/confirmed working in the
running app, then mark it DONE here before moving to the next. Don't batch multiple
items into one pass.

## Part 2 — New features (each gets its own dedicated session + PLAN.md)

Design decisions already made with the user:
- **Scripts** run as plain JS in the webview/frontend (no embedded Rust JS engine).
- **Collections** support nested folders, not just a flat list.
- **Import/export** targets Postman v2.1 collection/environment JSON format.

### Item 7: Collections (nested folders) — mostly done, see `.tasks/collections/PLAN.md`

Only Step B3 (save gesture) remains there.

### Item 8: Pre-request / post-response scripts — not started
### Item 9: Import (Postman v2.1 → cURLyQ) — DONE, see `.tasks/import-export/PLAN.md`
### Item 10: Export (cURLyQ → Postman v2.1) — DONE, see `.tasks/import-export/PLAN.md`

### Item 11: Color `{{var}}` tokens by resolution state — not started

Raised while debugging a stray-quote-character bug in the Params/Headers key field
(turned out to be Windows/WebView2 text suggestions on a field missing
`autoComplete="off"`, fixed separately). While investigating, the user asked for a
real feature: any `{{varName}}` token typed into Params/Headers/URL/Body should be
visually colored — red if it doesn't resolve against the active environment, light
blue if it does. `getUnresolvedVariables`/`findVariableNames` (in
`src/lib/environments.ts` after the Phase A refactor) already contain the resolution
logic needed; this would need a syntax-highlighting-style overlay or rich-text input
since plain `<input>`/`<textarea>` can't color substrings of their own value.

**Extended scope (added 2026-07-25)**: on top of the coloring, hovering a `{{name}}`
token should open a small popup showing its resolved value (or an "unresolved" state
if nothing matches). Detection reuses the same `{{name}}` pattern — now
`VARIABLE_PATTERN` in `src/lib/environments.ts` (exported when the hyphen/dot fix
landed) rather than \w-only. Since this needs to know each token's on-screen
position to anchor a popup, it likely needs the same rich-text/overlay approach as
the coloring itself, not a separate mechanism — worth building both together rather
than the coloring first and retrofitting hover after.

### Item 12: Colorize the method dropdown in the URL bar — not started

The method `<Select>` in `RequestEditor.tsx` (`HTTP_METHODS.map(...)` →
`SelectItem`) renders every method as plain text. `METHOD_COLORS`
(`src/lib/http.ts`) already exists and is used for the method badge everywhere
else (tabs, collection tree rows) — just needs applying to each `SelectItem`'s
label here too, for consistency.
