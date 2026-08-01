---
name: release
description: Cut a cURLyQ release — bump the version across tauri.conf.json/package.json/Cargo.toml, commit, tag vX.Y.Z, and push to trigger the cross-platform release build (.github/workflows/release.yml). Use when the user says "release", "cut a release", "bump the version", or invokes /release.
---

# Release

Automates the manual steps documented in `docs/releasing.md`. Read that file
first if it's not already in context — this skill mechanizes exactly what it
describes and should stay in sync with it. Don't duplicate its "known
limitations" content here.

This is the one flow that still commits and pushes straight to `master` —
every other change goes through the `commit` skill's `feature/`/`bug`/`task`
branch + PR flow (`.claude/agents/committer.md`). A version bump is
mechanical (not code under review) and the release tag has to point at a
commit on `master` anyway, so routing it through a PR would just add a
manual-merge step in the middle of cutting a release. Don't "fix" this to
match the branch+PR convention without checking with the user first.

## Steps

0. **Confirm you're on `master` and up to date** (`git branch --show-current`,
   `git status`). Since most other work now lives on feature branches, it's
   easy to end up invoking `/release` from inside one by mistake — if not on
   `master`, stop and say so rather than tagging a commit that isn't merged.

1. **Determine the target version.**
   - Read the current version from `src-tauri/tauri.conf.json`'s `version`
     field (kept in sync with `package.json` and `src-tauri/Cargo.toml` —
     spot-check they agree; if they've drifted, stop and flag it rather than
     guessing which is right).
   - If invoked with an explicit version (e.g. `/release 0.3.0`), use it.
   - If invoked with `patch`/`minor`/`major`, compute the next semver from
     the current version.
   - Otherwise, ask via AskUserQuestion: offer the next patch/minor/major
     bump (computed and shown explicitly, e.g. "0.2.0 → 0.2.1") plus an
     "other" option for a specific version.

2. **Update the version in three files** — `src-tauri/tauri.conf.json`
   (`version`), `package.json` (`version`), `src-tauri/Cargo.toml`
   (`[package].version`). Use Edit, not Write, so only the version line
   changes in each.

3. **Sync `Cargo.lock`.** Run `cargo check` from `src-tauri/` — this
   regenerates the local `tauri-app` package entry in `Cargo.lock` to match
   the new `Cargo.toml` version (that file is otherwise not hand-edited).

4. **Sanity-check.** Run `npx tsc --noEmit` and `cargo check` (already run
   in step 3). If either fails, stop and report — don't tag a broken build.

5. **Show a summary** of the version change (old → new) and confirm with the
   user before doing anything that touches the remote — committing locally
   is cheap to undo, but the push in step 6 triggers real GitHub Actions
   builds across three platforms and creates a real (draft) GitHub Release,
   so it needs an explicit go-ahead in the moment, not just the fact that
   `/release` was invoked.

6. **Commit, tag, push** (only after confirmation):
   - `git add src-tauri/tauri.conf.json package.json src-tauri/Cargo.toml src-tauri/Cargo.lock`
     (stage by name, never `-A`/`.`).
   - Commit: subject `Bump version to X.Y.Z`, no body needed for a
     mechanical version-only change, `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`
     trailer per repo convention.
   - `git tag vX.Y.Z`
   - `git push && git push origin vX.Y.Z`

7. **Report back**: the Actions run URL
   (`https://github.com/YeaaaaH/cURLyQ/actions`), and remind the user this
   only creates a **draft** release — they still need to check the
   attachments and hit Publish on GitHub themselves once all four platform
   builds finish (that step stays manual, per `docs/releasing.md`).

## Guardrails

- Never force-push, amend an existing commit, or skip hooks.
- If the three version files have already drifted out of sync before this
  skill even runs, stop and surface it instead of silently picking one.
- If there are *other* uncommitted changes in the working tree beyond the
  version bump, stop and ask — don't sweep unrelated work into a release
  commit or push it as a side effect of tagging.
