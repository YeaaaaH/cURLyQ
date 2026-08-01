---
name: investigation
description: Token-efficient investigation methodology — search for symbols/entry points before reading, read only relevant line ranges, follow direct references one hop at a time, and stop once enough evidence exists. Trigger before any "how does X work" / "investigate this" / architecture-understanding task, and as the read-only front half of debugging or feature work in unfamiliar code.
version: 1.0.0
author: YeaaaaH, Claude
tags:
  - investigation
  - exploration
  - efficiency
  - workflow
---

# Investigation Skill

## Overview

A disciplined exploration loop that trades expensive full-file `Read` calls for
cheaper search operations. Built to counter the most common agent failure mode
in this repo: interpreting "understand X" as permission to open dozens of files,
including files already read earlier in the session.

## When to Use

- "How does X work" / "where is Y handled" questions.
- Before implementing a feature or fix that touches code you haven't looked at yet
  this session.
- As the read-only investigation phase before `debugging`'s Phase 1 (root cause),
  whenever the affected area isn't already known.

## When Not to Use

- The relevant file(s) are already known and short — just read them.
- Reviewing changes just made — use `git diff`, not a fresh full read (see below).

## Method

1. **Search first.** Use Grep for the symbol/keyword or Glob for the filename
   pattern before opening anything. Don't open a file just "to see what's in
   there."
2. **Read narrow.** Once a hit is found, read only the relevant line range
   (`Read` supports `offset`/`limit`) instead of the whole file, unless the file
   is genuinely short or the task needs full context.
3. **Follow one hop at a time.** From the located code, follow direct
   callers/callees only as needed. Don't preemptively pull in the whole call
   graph.
4. **Delegate breadth.** If the search is likely to span more than ~3 files, or
   the location is genuinely unclear, use the `Explore` agent instead of reading
   files one by one inline — keeps the broad-search cost out of the main
   context.
5. **Summarize before continuing.** After each round of reads, state what's been
   learned and what's still unknown, rather than silently opening more files.
6. **Stop at sufficiency.** Stop as soon as there's enough evidence to answer the
   question or act. Investigating further "just to be sure" burns tokens without
   changing the answer.

## Reviewing Changes

Use `git diff` to review work already done, not a fresh full read of the changed
files. Open surrounding code only where the diff itself doesn't explain the
behavior.

## Explicitly Forbidden Anti-Patterns

- Reading a whole file "for context" before searching for the symbol.
- Re-reading a file after `Edit`/`Write` to confirm the change landed — the tool
  already errors on failure.
- Recursively opening files across the repo for a narrowly scoped question.
- Investigating solo, file-by-file, in the main thread when the task is a
  multi-file/breadth search better suited to the `Explore` agent.
