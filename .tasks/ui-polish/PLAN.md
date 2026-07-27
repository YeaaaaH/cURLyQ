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

### Item 7: Collections (nested folders) — DONE, see `.tasks/done/collections.md`
### Item 8: Pre-request / post-response scripts — not started
### Item 9: Import (Postman v2.1 → cURLyQ) — DONE, see `.tasks/import-export/PLAN.md`
### Item 10: Export (cURLyQ → Postman v2.1) — DONE, see `.tasks/import-export/PLAN.md`

### Item 11: Color `{{var}}` tokens by resolution state — DONE, see `.tasks/variable-engine/PLAN.md`

Grew from "color the tokens" into a full shared variable engine (range-based
tokenizer, recursive resolver with cycle detection, one overlay-based
`VariableAwareInput`/`VariableAwareTextarea` component pair replacing native inputs
across URL/Params/Headers/Body) — tracked and completed in its own plan doc.

### Item 12: Colorize the method dropdown in the URL bar — not started

The method `<Select>` in `RequestEditor.tsx` (`HTTP_METHODS.map(...)` →
`SelectItem`) renders every method as plain text. `METHOD_COLORS`
(`src/lib/http.ts`) already exists and is used for the method badge everywhere
else (tabs, collection tree rows) — just needs applying to each `SelectItem`'s
label here too, for consistency.
