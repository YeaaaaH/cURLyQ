# UI Polish + Persistence Bug Backlog — Plan

Tracks a batch of bugs/analysis items found during a hands-on pass over the app, plus
four larger new features scoped alongside them. Full context and root-cause analysis
for every item lives in the plan-mode session that produced this list; this file is the
living, session-to-session tracker — update it as items complete.

**Process**: one item at a time. Implement, get it reviewed/confirmed working in the
running app, then mark it DONE here before moving to the next. Don't batch multiple
items into one pass.

## Item 1: Layout — scrolling + fixed-size Params/Headers/Body/Response — DONE

**Root cause**: the left sidebar was the only region wrapped in a real viewport-bound
container (`fixed inset-y-0` + an unbroken `flex flex-col` + `min-h-0`/`flex-1` chain
down to `overflow-y-auto`). `<main>` had no height at all, so the whole *document*
scrolled instead of any panel scrolling internally, and the Params/Headers wrapper
(`min-h-[220px]`, no `max-h`) plus the Body `<textarea>` (`min-h-[180px]`, no `max-h`)
just grew with content instead of scrolling in place.

**Fix implemented** (`src/App.tsx`):
- `<main>` is now `flex h-screen flex-col overflow-hidden` — bounded to the viewport
  regardless of ancestor height (uses `vh`, not a parent height chain).
- Split the previous single wrapping div into two: a `shrink-0` header section (tab bar,
  name input, method/URL form, sub-tab buttons — never scrolls) and a
  `min-h-0 flex-1 overflow-y-auto` region below it holding the Params/Headers/Body box,
  the error card, and the response card — this is the region that scrolls as a whole if
  everything together is taller than the window, mirroring the sidebar's proven pattern.
- The Params/Headers/Body box itself is now a **fixed height** (`h-[340px]`, tuned up
  from an initial `h-[220px]` after visual review) with its own `overflow-y-auto` —
  it no longer grows with row/content count. The Body `<textarea>` fills that box via
  `flex-1 min-h-0` instead of its own `min-h-[180px]`.
- Added the shared `scrollbar-thin` utility (already used by the sidebar) to every
  newly-scrollable region for a consistent scrollbar look.
- Adaptivity (bug "check adaptivity for different screen sizes"): no dedicated
  breakpoint work needed — replacing the fixed-pixel `min-h`/`max-h` values with a
  `flex-1`/`min-h-0` chain means the request/response panels now resize with the window
  the same way the sidebar already did. Confirmed visually rather than adding
  `sm:`/`md:`/`lg:` breakpoints, since nothing suggested a distinct narrow/wide layout
  was actually needed.
- Follow-up polish during review: the response/error `Card` components (shadcn default:
  `rounded-xl` + a faint `ring-1 ring-foreground/10`) visually clashed with the
  Params/Headers/Body box's `rounded-lg border border-input`. Overrode both cards to
  `rounded-lg border border-input`/`border-destructive` with `ring-0` to cancel the
  default ring, so all the stacked panels read as one consistent set.

## Item 2: Tab + sub-tab active-state persistence — DONE

**Root cause**: `activeId` and each tab's `activeSubTab` were pure React state, never
written to `tabs.json`. On restart, `fromPersistedTab` hardcoded `activeSubTab: "params"`
and the restore effect hardcoded `setActiveId(restored[0].id)` — always the first tab,
always Params.

**Fix implemented**:
- `PersistedTab` (TS `App.tsx` + mirrored Rust struct `lib.rs`) now includes
  `activeSubTab`/`active_sub_tab` (Rust struct uses `#[serde(rename_all = "camelCase")]`
  so the on-disk JSON key stays `activeSubTab`). `toPersistedTab`/`fromPersistedTab`
  carry it through instead of hardcoding `"params"`.
- `tabs.json`'s top-level shape changed from a bare array to
  `{ activeTabId: string | null, tabs: PersistedTab[] }` (new `PersistedTabsFile` struct
  in Rust, matching TS interface). `save_tabs`/`load_tabs` signatures updated
  accordingly; the frontend's debounced save effect now depends on `[requests, activeId]`
  and sends both. On restore, `activeTabId` is used if it still matches a restored tab,
  otherwise falls back to `restored[0].id`.
- **Migration handled and then removed**: since the user's existing `tabs.json` was in
  the old bare-array shape, `load_tabs` briefly had a fallback that tried the new shape
  first and fell back to parsing the old bare array (defaulting `activeTabId` to `null`
  and `activeSubTab` to `"params"` via `#[serde(default = ...)]`) — a one-time, invisible
  conversion, confirmed working by inspecting the on-disk file before/after. Once
  confirmed, that fallback code and the `default_sub_tab()` helper were deleted; the
  final code only parses the new shape, no lingering backwards-compat path.
- Verified end-to-end in the running app: switched sub-tab on an open tab, relaunched,
  confirmed the same tab and sub-tab were restored.

## Item 3: Environment-name input lag — DONE

**Root cause**: not a persistence problem (`save_environments` was already debounced
500ms) — it was a full-tree re-render on every keystroke, since renaming updated the
top-level `environments` state directly on every `onChange`, cascading into the sidebar
env list, the environment dropdown, and every `KeyValueEditor` row in the editor.

**Fix implemented**:
- First pass (general memoization): wrapped `KeyValueEditor` in `React.memo`; converted
  `updateParam`/`removeParam`/`updateHeader`/`removeHeader` and
  `updateEnvironmentVariable`/`removeEnvironmentVariable` to `useCallback` with stable
  functional `setRequests`/`setEnvironments` updates (keyed on `activeId` /
  `editingEnvironmentId` respectively, not on the request/environment data itself) so
  their identities don't change on unrelated edits; wrapped `urlError`/`bodyError`/
  `unresolvedVariables` in `useMemo`.
- Still felt laggy after that, because renaming itself updates the shared `environments`
  array on every keystroke — the sidebar and dropdown legitimately re-render every
  character since they display the live name. **Root fix**: replaced the environment
  name `Input` with a new `EnvironmentNameField` component that holds the typed value in
  **local** component state (`useState`) and only calls `onRename` (touching shared
  state) when the user clicks a confirm (✓) button or presses Enter. `key={editing.id}`
  on the field resets the draft when switching which environment is being edited. Typing
  no longer touches app-wide state at all, so it can't cascade into any other component.
- Verified in the running app: typing a long name now feels smooth.

## Item 4: Params tab doesn't sync when deleting a templated URL param — DONE

**Root cause**: `handleUrlChange` used `new URL(rawUrl)`, which throws whenever the
base/host is templated (e.g. `{{baseUrl}}/search?q={{someEnvVar}}`) — confirmed via
direct test. The `catch` branch then updated only `url`, leaving `params` stale from
then on. `buildDisplayUrl` (the reverse direction) already worked around this with plain
string splicing and had a comment explaining why; `handleUrlChange` needed the same
treatment.

**Fix implemented**: added `parseParamsFromUrl` (plain string splicing — split on `#`,
then `?`, then `&`/`=`, mirroring `buildDisplayUrl`/`escapeForDisplay`'s approach exactly
via a new `unescapeFromDisplay` helper) and swapped it in for the `new URL()` parsing in
`handleUrlChange`. Works for template URLs in both directions now.

## Item 5: environments.json persists an empty dummy variable — DONE

**Root cause**: not a save-path bug — the growing-row UI (`createEnvironment`,
`updateRows`) always keeps one trailing empty row to type into, and that row was part of
the same array persisted verbatim (no filtering anywhere before the `invoke` calls).

**Fix implemented**:
- New `stripEmptyRows` helper (filters rows where both `key` and `value` are blank),
  applied at the persistence boundary only: inside `toPersistedTab` (for `tabs.json`'s
  `params`/`headers` — same latent issue existed there too) and in the `save_environments`
  debounced effect (for each environment's `variables`).
- New `ensureTrailingBlankRow` helper (inverse — adds a blank row back if the last row is
  filled in or the list is empty), applied on load (`fromPersistedTab`, and the
  `load_environments` effect) to restore the self-growing-row invariant live UI state
  expects, since a stripped/loaded row list may have zero rows or end in a filled one.
- Verified against the real `environments.json`: new environments now save as
  `"variables": []` instead of a dummy `{ id, key: "", value: "" }` entry. Also used this
  pass to clear ~95 leftover test environments that had accumulated in the file from
  earlier manual testing, down to the two real ones (`dev-ac`, `test-env`).

## Item 6: environments.json / tabs.json persistence mechanism — analysis, closed

Both files are full-list overwrites (`std::fs::write` of the entire array), not per-id
patches, on both the Rust and JS sides. **No change recommended** — for a local,
single-user JSON file at this scale, full-overwrite is simpler with no real downside;
per-id patching would be premature complexity.

## Part 2 — New features (each gets its own dedicated session + PLAN.md)

Design decisions already made with the user:
- **Scripts** run as plain JS in the webview/frontend (no embedded Rust JS engine).
- **Collections** support nested folders, not just a flat list.
- **Import/export** targets Postman v2.1 collection/environment JSON format.

### Item 7: Collections (nested folders) — not started
### Item 8: Pre-request / post-response scripts — not started
### Item 9: Import (Postman v2.1 → cURLyQ) — not started, depends on Item 7
### Item 10: Export (cURLyQ → Postman v2.1) — not started, depends on Item 7
