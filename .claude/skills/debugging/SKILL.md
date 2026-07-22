---
name: debugging
description: Systematic root-cause debugging methodology — reproduce, isolate cause without modifying code, apply a minimal fix, verify. Includes a 3-attempt safety stop that escalates to the user with an investigation report instead of thrashing. Trigger for any bug investigation, failing test, stack trace, or unexpected runtime/UI behavior in this project.
version: 1.0.0
author: Vladiskell, Claude
tags:
  - debugging
  - root-cause-analysis
  - workflow
  - safety
---

# Debugging Skill

## Overview

A disciplined debugging loop for this project: reproduce deterministically, find the
root cause without touching code, apply the smallest fix that addresses it, then
verify. Built to counter the most common agent failure modes — jumping to a
speculative fix before understanding the bug, patching a symptom instead of the
cause, bundling unrelated changes, or weakening a test to make it pass.

## When to Use

- Any reported bug: a failing test, a Rust panic/compile error, a browser console
  error, an unexpected Tauri IPC result, or UI behavior that doesn't match
  expectations.
- Before writing any fix code — this skill governs the investigation phase, not just
  the patch.

## When Not to Use

- Pure feature work with no bug involved (use the normal stepwise workflow instead).
- Cosmetic/UI polish requests that aren't actually broken, just not yet built.

## Phase 0 — Reproduce

Achieve a deterministic reproduction of the bug before doing anything else:

- Document the exact reproduction steps.
- Reduce the issue to the smallest possible case.
- Capture the actual failure: a Rust panic or `cargo check`/`cargo build` error, a
  Tauri IPC error surfaced to the frontend, a browser devtools console error, or a
  failing test.

**Hard rule:** do not modify code until the bug has been reproduced reliably. Do not
attempt to fix an issue that can't be observed consistently.

## Phase 1 — Identify the Root Cause

**Do not modify code during this phase.**

- Read the complete stack trace / error and follow the actual execution path.
- Gather evidence: logs, temporary diagnostic output (`dbg!`, `println!`,
  `console.log`, breakpoints), or direct state inspection.
- Verify real runtime state instead of relying on assumptions.
- Clearly distinguish the symptom from the underlying cause.
- Formulate a concrete hypothesis in the form: "X fails because Y."

**Phase gate:** do not proceed to implementation until the reason the issue occurs
can be clearly explained. This is the primary safeguard against blind or speculative
changes.

## Phase 2 — Form a Hypothesis and Apply the Minimal Fix

- Explicitly record the root-cause hypothesis.
- Predict what behavior should change after the fix.
- If a test framework exists for the affected area, consider writing a failing
  regression test first (TDD-style) that demonstrates both the bug and the fix.
  (Note: cURLyQ has no test framework set up yet, per `CLAUDE.md` — this step will
  often be skipped here until one exists; don't block on it.)
- Make the smallest possible change that addresses the root cause, not a workaround
  for the symptom.
- One logical change at a time — otherwise it's impossible to tell which change
  actually resolved the issue.

## Phase 3 — Verify

Confirm all of the following before calling it fixed:

- The Phase 0 reproduction scenario no longer fails.
- Any new regression test passes.
- Relevant neighboring/regression tests also pass.
- The fix addresses the underlying cause, not just the symptom.
- No unrelated behavior changed.

## Safety Stop

After three unsuccessful fix attempts, stop making further changes. Do not continue
applying speculative patches.

Instead:

- Reconsider the original assumptions.
- Review the relevant architecture and execution flow.
- Consider whether the bug is located elsewhere.
- Consider whether the current mental model of the system is wrong.
- Escalate to the user with an investigation report containing:
  - what was reproduced;
  - what evidence was collected;
  - which changes were attempted;
  - the result of each attempt;
  - which hypotheses were disproven;
  - the current leading hypothesis;
  - where the investigation is currently blocked.

This prevents a debugging death spiral caused by repeated random changes.

## Explicitly Forbidden Anti-Patterns

- Modifying code before reproducing the bug.
- Fixing a symptom instead of the root cause.
- Making several unrelated changes at the same time.
- Weakening, deleting, skipping, or rewriting a valid test merely to make it pass.
- Claiming an issue is fixed without rerunning the original reproduction scenario.
- Adding broad exception handling, null checks, retries, or fallback behavior without
  proving it addresses the root cause.
- Refactoring unrelated code while investigating a bug.
- Silently changing expected behavior to match the current (buggy) implementation.
