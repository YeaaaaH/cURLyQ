# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

cURLyQ is a desktop HTTP client (send HTTP requests with headers/params/body, view responses) — a Postman alternative, inspired by it — built as a learning project. See `project_specs.md` for the shipped MVP scope; `.tasks/plan.md` is the live backlog for everything since (continuous improvement, no fixed scope boundary).

## Stack

- Frontend: TypeScript + React, in Tauri's webview. Styled with Tailwind CSS v4 + shadcn/ui (see `.claude/skills/curlyq-ui/SKILL.md` for conventions).
- Backend: Rust, exposed to the frontend as Tauri commands (`#[tauri::command]`), invoked via `invoke(...)` from JS/TS.
- HTTP requests are performed on the Rust side (not from the webview) and returned to the frontend.

Read `docs/architecture.md` before changing the send flow, persisted data shapes, the Rust↔TS contract, or the script sandbox — it covers the request pipeline, where state lives, and the invariants that are easy to break. If a change makes it (or `docs/scripting.md`) inaccurate, update it in the same change.

Scaffolded via `npm create tauri-app` (react-ts template, npm package manager).

- Dev (frontend + Tauri window): `npm run tauri dev`
- Build release binary: `npm run tauri build`
- Frontend-only dev server: `npm run dev`
- Rust check: `cargo check` (run from `src-tauri/`)
- Rust unit tests: `cargo test` (run from `src-tauri/`). No frontend test framework yet.

## Workflow

Work step by step, one small piece at a time, with a review checkpoint before moving to the next piece. Do not implement multiple features or large chunks in a single pass unless explicitly asked to.

When introducing a new Rust or JS/TS concept (syntax, pattern, library, tool) for the first time, briefly explain what it is and why it's used here — this project is explicitly for learning, not just shipping. That explanation goes in the chat reply, not in a code comment.

## Code comments

Code should explain itself through naming and structure. Comment only a non-obvious *why* — a workaround, a library quirk, a constraint the code can't express — in 1–2 lines.

- No history ("previously", "an earlier version", "used to") — git and `.tasks/done.md` have it.
- No restating what the code or a function name already says.
- No flow/architecture descriptions — those live in `docs/architecture.md`.
- Existing long comments are not a style to match.

## Git workflow

`master` is protected by convention — nothing is pushed there directly except release version bumps. Use the `commit` skill (`/commit`) for everything else: it delegates to the `committer` subagent (`.claude/agents/committer.md`), which commits onto a `feature/`/`bug`/`task` branch, pushes it, and opens a PR into `master`. `.github/workflows/ci.yml` runs frontend build, `cargo fmt`/`clippy`/`test`, and a per-OS `cargo check` on every PR and push to `master`.

Cutting a release uses the `release` skill (`/release`) instead — see `docs/releasing.md`. That's the one flow that still commits and pushes straight to `master`, since a version bump isn't code under review and the release tag needs to point at a commit on `master` anyway.
