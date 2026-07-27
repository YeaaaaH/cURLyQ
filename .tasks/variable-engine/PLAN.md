# Shared Variable Engine + Colored Variable Editor — Plan

**Status: DONE, confirmed working in the running app (2026-07-28).**

Supersedes/extends `.tasks/ui-polish/PLAN.md` Item 11. Full design doc and rationale
lives in the approved plan; this file tracks stage-by-stage progress.

## Context

Variable (`{{name}}`) handling was inconsistent across fields (URL had hover-only
support via canvas pixel measurement, headers/params/body had none), resolution was
non-recursive, and detection/resolution logic was a grab-bag inside
`src/lib/environments.ts`. This work splits it into a proper pure engine
(`src/lib/variables/`: tokenizer, context, resolver, requestResolver, diagnostics) and
replaces the native `<input>`/`<textarea>` fields with a shared overlay-based
component so `{{tokens}}` can be visually colored (blue = resolved,
red = unresolved/circular), not just hover-detected. (Originally planned around
CodeMirror; superseded by a zero-dependency overlay approach — see the "Revision"
note below.)

## Stage 1: Pure engine, zero visible UI change — DONE (2026-07-28)

Added `src/lib/variables/{tokenizer,context,resolver,requestResolver,diagnostics,index}.ts`.
Trimmed `src/lib/environments.ts` to `Environment` CRUD + Postman import/export only.
`requestTabs.ts`'s `getUrlError`/`getBodyError` now take a `VariableLookup` context;
`buildOutgoingRequest` moved to `requestResolver.ts` as `resolveRequest`. `App.tsx` builds
one `variableContext` (`createVariableContext([environmentScope(activeEnvironment)])`)
and threads it through. Resolution is now recursive with cycle detection
(`MAX_RESOLUTION_DEPTH = 10`); the hover popup (`VariableAwareInput`) and the Variables
panel only allow inline-editing a variable's value when it's a direct literal (no
nested `{{...}}`), to avoid silently flattening a reference. `npm run build` verified
clean.

**Needs manual verification in `npm run tauri dev`** before Stage 2 starts:
- URL hover popup behaves identically to before (resolved value editable, unresolved
  shows red "X is unresolved", links present).
- Params/Headers/Body: still plain, unchanged.
- "Variables in request" panel + cURL tab: identical output to before.
- New: `host={{env}}.example.com` + `env=prod` → hover/panel shows fully-resolved
  `prod.example.com` (previously would've shown the raw one-level value).
- A genuine cycle (`a={{b}}`, `b={{a}}`) behaves as "unresolved" everywhere (hover,
  panel, actual Send, cURL copy) — no crash/hang.

## Revision (2026-07-28): overlay instead of CodeMirror

CodeMirror 6 would add ~85 KB gzipped + 5-6 transitive deps for what's actually needed
(coloring + hover) — the real editor-primitive benefit (autocomplete/diagnostics) only
pays off for already-deferred roadmap items. Switched to a zero-dependency overlay
instead: a transparent real `<input>`/`<textarea>` (native cursor/selection/undo/IME)
stacked under a `pointer-events-none` sibling `<div>` rendering the same text as
colored `<span>`s per token, scroll-synced to the real field. `VariableAwareInput.tsx`
evolved in place rather than being replaced by a new `VariableEditor` component.

## Stage 2: URL field swap — DONE (2026-07-28)

`VariableAwareInput.tsx` rebuilt: removed the old canvas-text-measurement hover hack,
added the colored overlay `<div>` (per-token `<span>` colored via inline `style` —
`var(--color-ring)` resolved / `var(--color-destructive)` unresolved+circular), made
the real `<input>` text `text-transparent caret-foreground`, added scroll-sync
(`onScroll` + a layout-effect fallback). Hover positioning now reads real
`span.getBoundingClientRect()` instead of canvas-measuring. `npm run build` verified
clean; bundle size unchanged (confirms zero new dependencies).

## Stage 3: Header/param values — DONE (2026-07-28)

Bundled the 5 variable-aware props into one `VariableAwareProps`/`variableAware?`
object on `KeyValueEditor` (rather than 5 separate optional props) since they only
ever travel together — kept optional because `EnvironmentEditor.tsx` reuses
`KeyValueEditor` for a variable's own raw value, where `{{var}}` coloring against the
variable being defined isn't in scope; falls back to a plain `Input` there. Threaded
`RequestVariablesTabs` → `KeyValueEditor`; Value column is `VariableAwareInput` for
Params/Headers (Key column stays a plain `Input`, now explicitly `flex-1` to match the
50/50 split that used to fall out of two plain `w-full` inputs mutually shrinking —
needed once Value became a `flex-1`-wrapped component instead of a same-mechanism
plain input). `App.tsx` gained two shared handlers (`handleOpenEnvironment`,
`handleOpenVariablesPanel`) reused by both `RequestEditor` and `RequestVariablesTabs`
instead of duplicating inline closures. `npm run build` verified clean.

**Needs manual verification in `npm run tauri dev`** before Stage 4:
- Params/Headers Value fields show token coloring + hover identically to the URL
  field; Key fields are unchanged plain inputs, columns still align evenly.
- Row add/remove, trailing-blank-row behavior, and locked default-header rows all
  still work.
- Editing a variable from any field's hover popup updates it live in every other
  field showing that token (shared `variableContext`).

## Stage 4: Body field — DONE (2026-07-28)

Extracted the duplication anticipated in Stage 3's note into
`src/components/variable-aware/`: `useVariableTokenHover.ts` (hover-state + token
hit-testing via real span `getBoundingClientRect()`, generic over input vs textarea)
and `VariableHoverPopup.tsx` (the shared popup JSX). `VariableAwareInput.tsx` now
just wires the input-specific overlay (`whitespace-pre`, horizontal-only scroll
sync) on top of those; new `VariableAwareTextarea.tsx` does the same for a
`<textarea>` (`whitespace-pre-wrap break-words`, both-axes scroll sync, a trailing
zero-width-space guard so a body ending in `\n` doesn't collapse the overlay's final
blank line and drift out of alignment with the real text). The triple-click-select-
all behavior moved from `RequestVariablesTabs.tsx` into `VariableAwareTextarea`
itself since it's generic `<textarea>` behavior, not request-specific.
`RequestVariablesTabs.tsx`'s body `<textarea>` swapped to
`VariableAwareTextarea`; `onBodyKeyDown`/`handleBodyKeyDown` (Tab → 2 spaces)
unchanged, still wired straight to the real `<textarea>` underneath. `npm run build`
verified clean; bundle size effectively unchanged (+~2 KB, all own code).

**Needs manual verification in `npm run tauri dev`** — this is the last stage, so a
full pass over everything:
- Body field: token coloring + hover work, including tokens inside JSON string
  values; overlay text stays aligned with the real (invisible) text while typing,
  scrolling, and on a body that ends with a blank line.
- Tab in the body still inserts 2 spaces (not a real tab char, not a focus move).
- Triple-click in the body still selects all text.
- `getBodyError`'s red ring / error text still triggers on invalid JSON.
- One more end-to-end pass over URL / Params / Headers / Body together — coloring,
  hover, editing a variable from any field's popup reflecting live everywhere else,
  Send and the cURL/Variables panel still producing correct output.

## Bugfix: selection contrast — fixed properly (2026-07-28)

Found during manual verification: selecting text where a resolved (blue) `{{token}}`
falls inside the selection looks washed out — the browser's native `::selection`
paints only on the real (invisible) input/textarea underneath the overlay's
static-colored token spans, so no `::selection` color choice can ever reliably
contrast against an arbitrary token color rendered on top of it (tried a neutral
gray, then a darker blue — both still just guessing at a color that might clash).
The actual fix: draw selection highlighting manually in the overlay itself, the way
real code editors do, instead of relying on native browser selection rendering at
all. Added `src/components/variable-aware/useTextSelection.ts`:
- `useTextSelection()` tracks the real element's `selectionStart`/`selectionEnd`
  (via `onSelect`/`onMouseUp`/`onKeyUp`/`onChange`) as a `{start,end} | null` range.
- `splitBySelection(text, absStart, selection)` splits a run of text into
  selected/unselected pieces by absolute offset.
- `SELECTED_TEXT_STYLE` — solid `var(--color-ring)` background + forced
  `var(--color-background)` foreground, so selected text is legible regardless of
  its own color (plain or token).
- `clampSelection` guards against a stale range after `value` changes externally
  (e.g. a Param edit rewriting the URL).

Both `VariableAwareInput` and `VariableAwareTextarea` now split every rendered run
(plain and token alike) against the current selection and render the selected
portion with `SELECTED_TEXT_STYLE`; each token still gets one wrapping `<span
ref>` (for hover hit-testing against its full range) around its own
selection-split inner spans. The real input/textarea's native `::selection` is set
to `selection:bg-transparent` (hidden, not disabled — copy/cut/keyboard-extend
still work) so it doesn't paint a second, uncoordinated band underneath the
overlay's own decoration. `npm run build` verified clean.

**Follow-up bug, actual cause**: reported as "can select across multiple inputs at
once" — this was never real cross-element browser selection. Each field's
`selection` state (in `useTextSelection`) was never cleared on blur, so selecting
text in field A, then clicking into field B and selecting there too, left field A's
highlight rendering forever (nothing had ever told it to stop). Fixed by adding
`clearOnBlur` (wired to `onBlur` on both the real input and textarea) so only the
currently-focused field ever shows its highlight — matching native input behavior,
where a blurred field's selection stops being painted even though the browser still
remembers it internally. (A separate, since-superseded first attempt added
`select-none` to the overlay `<div>`s, suspecting the overlay's own real DOM text
was being picked up by native cross-element selection — kept, since it's correct
defensive hygiene for a `pointer-events-none` decorative layer, but it was not the
actual cause of the reported symptom.) Also hardened the textarea's triple-click
`.select()` call to explicitly update state afterward rather than assume it fires a
native `select` event in every browser. `npm run build` verified clean.

**Follow-up bug found immediately after**: since the overlay's rendered text is
real, normal (visible) DOM content, the browser's own document-wide text selection
could pick it up independent of the real input/textarea's own
`selectionStart`/`selectionEnd` — dragging across multiple fields' overlays created
a native cross-field selection with no relation to our per-field decoration or to
what's actually selected in any one real input. Fixed by adding `select-none` to
both overlay `<div>`s — purely decorative, `pointer-events-none` content should
never have been selectable in the first place; this doesn't affect the real
input/textarea's own selection or our custom decoration, both of which are driven
entirely by JS state (`selectionStart`/`selectionEnd`), not the DOM Selection API.

## Bugfix: selection rendering seam + stale selection after a click (2026-07-28)

Repro: `{{someVar}}asdfasdf` — double-click selected just "asdfasdf" with a visible
gap/seam at the token boundary; triple-click (selecting everything) showed the same
seam; a plain single click afterward didn't clear the highlight. Two separate
causes:
- `SELECTED_TEXT_STYLE` had a `border-radius` — the selection renders as several
  adjacent `<span>`s (one per token/plain run), and rounding each individually
  leaves a visible gap where two of them meet instead of one continuous bar.
  Removed the radius; a flat rectangle merges seamlessly across any number of
  adjacent spans.
- The click-to-clear race: reading `selectionStart`/`selectionEnd` synchronously
  inside `mouseup`/`select`/`keyup` could observe the browser's not-yet-finalized
  selection (still the old, pre-click range) and re-affirm it instead of detecting
  the new collapsed caret. Fixed by deferring that read one frame
  (`requestAnimationFrame`) and reading from the element ref rather than the event
  target.

## Bugfix: drag-select lag vs. live highlight (2026-07-28)

Reported: drag-selecting felt ~0.5s slower than Postman's native selection.
`handleMouseMove` (hover hit-testing) ran unconditionally on every `mousemove`,
calling `getBoundingClientRect()` per token — a layout-forcing call — on every tick
throughout an active drag, when hover detection is meaningless mid-drag anyway.
Fixed by short-circuiting on `e.buttons !== 0` (a button is held → dragging, not
hovering). That surfaced a second issue: the highlight then only appeared on
mouseup, since this webview doesn't fire a live `select` event *during* the drag —
fixed by reading `selectionStart`/`selectionEnd` (cheap property reads, unlike
`getBoundingClientRect()`) directly on `mousemove` whenever a button is held, giving
live highlight growth without the earlier cost. Also made `updateFromElement` bail
out (keep the same object) when the range hasn't actually changed since the last
tick, to avoid a full re-render on every sub-character mouse jitter — mainly
insurance for a large body being drag-selected, not a confirmed problem.

## Regression: Key/Value 50/50 split broke in the Environment editor (2026-07-28)

Stage 3 made `KeyValueEditor`'s Key `<Input>` explicitly `flex-1` (needed once Value
became a `flex-1`-wrapped `VariableAwareInput`), but the *fallback* plain `<Input>`
Value column (used by the Environment editor, which doesn't pass `variableAware`)
was left on the old sizing — mixing `flex-1` (Key) with the old `w-full`-only
mechanism (Value) meant Value claimed all the space and Key collapsed. Fixed by
giving that fallback Value input `min-w-0 flex-1` too, matching Key.

## Deferred (not in this feature's scope)

Ctrl/Cmd-click-to-navigate; "create missing variable" quick-fix; full diagnostics
(squiggly underlines, problems list); distinct visual treatment for circular vs.
unresolved; `{{`-triggered autocomplete of variable names.
