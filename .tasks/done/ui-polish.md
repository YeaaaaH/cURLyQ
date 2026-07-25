# UI Polish + Persistence Bug Backlog — Done

Items 1–6 of the original bug/analysis batch. Part 2 (the larger new features scoped
alongside them) is still tracked in `.tasks/ui-polish/PLAN.md`.

- **Item 1: Layout — scrolling + fixed-size Params/Headers/Body/Response.** Root cause:
  `<main>` had no bounded height, so the whole document scrolled instead of any panel
  scrolling internally. Fix: `<main>` is `flex h-screen flex-col overflow-hidden`, split
  into a `shrink-0` header (tabs/name/method/URL/subtab buttons) and a
  `min-h-0 flex-1 overflow-y-auto` body region. The Params/Headers/Body box is a fixed
  `h-[340px]` with its own scroll instead of growing with content. Response/error cards
  overridden to `rounded-lg border border-input ring-0` to match.
- **Item 2: Tab + sub-tab active-state persistence.** `activeSubTab`/`activeTabId` now
  round-trip through `tabs.json` (shape changed from a bare array to
  `{ activeTabId, tabs }`). A one-time migration for the old bare-array shape was added
  then removed once confirmed working.
- **Item 3: Environment-name input lag.** Root cause was a full-tree re-render per
  keystroke (renaming wrote directly to shared `environments` state). Fixed via
  `React.memo`/`useCallback`/`useMemo` generally, plus a dedicated
  `EnvironmentNameField` that holds the draft in local state and only commits on
  blur/Enter.
- **Item 4: Params tab not syncing on templated URLs.** `new URL(rawUrl)` throws
  whenever the host is templated (e.g. `{{baseUrl}}/search?q=...`). Added
  `parseParamsFromUrl` (plain string splicing, mirrors `buildDisplayUrl`'s existing
  approach) instead of `new URL()` parsing.
- **Item 5: Dummy empty variable persisted.** The growing-row UI always keeps one
  trailing empty row, which was being persisted verbatim. Added `stripEmptyRows`
  (applied only at the persistence boundary: `toPersistedTab`, `save_environments`) and
  `ensureTrailingBlankRow` (applied on load, to restore the invariant live UI expects).
- **Item 6: Persistence mechanism review — analysis, closed.** Both `environments.json`
  and `tabs.json` are full-list overwrites, not per-id patches. No change recommended —
  fine at this scale; per-id patching would be premature complexity.
