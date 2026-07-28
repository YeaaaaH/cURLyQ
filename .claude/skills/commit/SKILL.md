---
name: commit
description: Commit and push the current working tree changes, following this repo's established git conventions (imperative subject, prose body explaining why, Co-Authored-By trailer, split into logical commits when changes cover unrelated concerns). Use when the user says "commit", "commit and push", or invokes /commit.
---

# Commit & Push

Delegates the actual git work to the `committer` subagent
(`.claude/agents/committer.md`), which runs on a cheaper model — staging,
committing, and pushing is mostly mechanical, not reasoning-heavy, so it
doesn't need the main conversation's model.

## Steps

1. Write a short (1-4 sentence) summary of what changed in this session and
   *why* — the context the `committer` agent needs to write an accurate
   commit message body, since it starts with no memory of this conversation.
   Describe what was actually done and the reasoning behind any non-obvious
   decisions; don't just say "commit it."
2. Invoke the `committer` subagent via the Agent tool (`subagent_type:
   committer`, `run_in_background: false` — its result is needed before
   reporting back) with that summary as the prompt.
3. Relay its result (pushed commit hash(es) + subject line, or whatever it
   reports) to the user.

Do not perform the git steps yourself inline — that defeats the point of
delegating to the cheaper model. The full git conventions (commit message
shape, splitting logic, guardrails) live in `committer.md` itself, not here —
don't duplicate them.
