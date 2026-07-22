# CI/CD — Plan

Tracks setting up a cross-platform build pipeline so cURLyQ can be built and
downloaded for Windows/macOS/Linux without a local dev environment.

## Goal

A GitHub Actions workflow that builds the Tauri app for Windows, macOS, and Linux
and produces downloadable installer artifacts (`.msi`/`.exe`, `.dmg`, `.AppImage`/
`.deb`) attached to a GitHub Release.

## Notes / open decisions to confirm before implementing

- **Trigger**: tag push (e.g. `v*.*.*`) is recommended over building on every commit
  to master — releases should be deliberate, not automatic on every push.
- **Tooling**: use the official `tauri-apps/tauri-action` GitHub Action — it already
  handles the per-OS build matrix and GitHub Release upload, instead of hand-rolling
  that logic.
- **macOS signing**: GitHub-hosted macOS runners produce unsigned builds by default
  (no Apple Developer certificate configured) — installable, but will show Gatekeeper
  warnings. Code-signing needs a paid Apple Developer account; flag as a later
  decision, not needed to get builds working.

## Draft steps (to refine before implementing)

1. Add `.github/workflows/release.yml` using `tauri-apps/tauri-action`, matrixed over
   `windows-latest` / `macos-latest` / `ubuntu-latest`.
2. Trigger on tag push matching `v*.*.*`.
3. Linux runner needs system deps (`webkit2gtk`, `libayatana-appindicator`, etc.) —
   confirm the exact apt package list against `tauri-action`'s docs at
   implementation time.
4. On success, artifacts attach to a GitHub Release automatically.
5. Document the release-cutting process (how to tag a new version) somewhere
   discoverable (README or CLAUDE.md).

Deferred — not blocking request-builder work.
