# Collections — Plan

Phase A, Phase B, and Step B3 (save gesture) are all done — see
`.tasks/done/collections.md`. This file now only tracks what's explicitly deferred or
not yet scheduled.

## Explicitly deferred (unless scope changes)

- Import/export (Postman collection JSON format compatibility).
- Duplicating a request/folder.

## Noted, not scheduled

- The Request Body tab's overall approach (plain `<textarea>`, no syntax
  highlighting/formatting/validation beyond the existing non-blocking "invalid
  JSON" hint) might be worth revisiting once Collections settles — flagged in
  passing by the user, no specific direction yet.
- Auto-expanding a collapsed folder/collection when something is dragged over
  it and held there (hover-to-expand) isn't built — reaching a spot inside a
  collapsed container during a drag currently requires expanding it by hand
  first.
- `SaveRequestDialog`'s tree picker has no create-folder affordance of its own —
  if that turns out to matter in practice, revisit alongside a proper name-prompt
  flow (matching the sidebar's inline-rename convention) rather than the
  auto-named "New Collection" quick-create it has now.
