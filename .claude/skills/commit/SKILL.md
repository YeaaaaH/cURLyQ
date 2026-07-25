---
name: commit
description: Commit and push the current working tree changes, following this repo's established git conventions (imperative subject, prose body explaining why, Co-Authored-By trailer, split into logical commits when changes cover unrelated concerns). Use when the user says "commit", "commit and push", or invokes /commit.
---

# Commit & Push

Stages, commits, and pushes the current changes in one pass, matching how this
repo's history is already written. Don't deviate from the conventions below
without being explicitly asked to.

## Steps

1. Run in parallel: `git status`, `git diff` (unstaged), `git diff --staged`
   (already staged), and `git log --oneline -10`.
2. Decide whether the pending changes are one cohesive change or several
   unrelated ones. Prefer fewer commits when changes genuinely belong
   together; split when they don't — e.g. a docs/plan reorganization is its
   own commit, separate from the feature work it accompanies (see this repo's
   history for precedent: the `.tasks` archive split was committed separately
   from the import/export feature it was done alongside).
3. For each logical group: stage the specific files by name (`git add
   <files>`), then check `git status` / `git diff --staged` for anything that
   shouldn't be committed — secrets, credentials, stray debug files, unrelated
   edits mixed in.
4. Write the commit message in this repo's established shape (spot-check
   `git log -3 --format=full` if unsure it's still accurate):
   - Subject line: imperative mood, under ~70 characters, no trailing period.
   - Blank line, then 1-3 short paragraphs of prose explaining *why* and any
     non-obvious decisions — not a bullet list restating *what* changed, since
     the diff already shows that.
   - Blank line, then `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
   - Always pass the message via a heredoc (`git commit -m "$(cat <<'EOF' ... EOF)"`),
     never a raw `-m "..."` string.
5. Commit each group, then `git push` once every commit is made.
6. Report back the pushed commit(s) — short hash and subject line — to the user.

## Guardrails

- Never `git add -A` or `git add .` — always stage files by name.
- Never amend, force-push, or skip hooks (`--no-verify`/`--no-gpg-sign`) unless
  the user explicitly asks for it in that specific invocation.
- If there's nothing changed, say so rather than creating an empty commit.
- If a pre-commit hook fails, fix the underlying issue and create a *new*
  commit — never amend the one that failed.
