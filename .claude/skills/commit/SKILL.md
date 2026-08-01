---
name: commit
description: Commit the current working tree changes onto a feature/bug/task branch, push it, and open a PR into master, following this repo's established git conventions (imperative subject, prose body explaining why, Co-Authored-By trailer, split into logical commits when changes cover unrelated concerns). Direct pushes to master are not used. Use when the user says "commit", "commit and push", or invokes /commit.
---

# Commit & Push

Delegates the actual git work to the `committer` subagent
(`.claude/agents/committer.md`), which runs on a cheaper model — staging,
committing, branching, pushing, and opening the PR is mostly mechanical, not
reasoning-heavy, so it doesn't need the main conversation's model.

`master` is protected by convention: nothing is pushed there directly. The
`committer` agent creates (or reuses) a `feature/`, `bug/`, or `task/`
branch, pushes that, and opens a PR into `master` — see the agent file for
exactly how it picks the branch name and whether it reuses an existing PR.

## Steps

1. Write a short (1-4 sentence) summary of what changed in this session and
   *why* — the context the `committer` agent needs to write an accurate
   commit message body and PR description, since it starts with no memory of
   this conversation. Describe what was actually done and the reasoning
   behind any non-obvious decisions; don't just say "commit it."
2. Invoke the `committer` subagent via the Agent tool (`subagent_type:
   committer`, `run_in_background: false` — its result is needed before
   reporting back) with that summary as the prompt.
3. Relay its result (pushed commit hash(es) + subject line, and the PR URL)
   to the user.

Do not perform the git steps yourself inline — that defeats the point of
delegating to the cheaper model. The full git conventions (commit message
shape, splitting logic, guardrails) live in `committer.md` itself, not here —
don't duplicate them.
