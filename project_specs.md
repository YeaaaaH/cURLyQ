# cURLyQ — Project Spec

A desktop HTTP client for sending requests and inspecting responses — a Postman alternative, inspired by it. Built as a learning project to practice using Claude Code in practice, step by step.

## Stack

- **Frontend**: TypeScript + React, running in Tauri's native webview.
- **Backend**: Rust, via Tauri commands. Handles the actual HTTP requests (e.g. `reqwest`), invoked from the frontend through Tauri's `invoke` bridge.
- **Packaging**: Tauri (native binary, not Electron).

## MVP (shipped)

The original scoped MVP is done: request builder (method/URL/headers/params/body), send + response viewer, persisted tabs, environment variables, collections, Postman-compatible import/export. See `.tasks/done.md` for the full build history.

Development past this point is continuous improvement, not a walled-off "v2" — there's no fixed scope boundary anymore. `.tasks/plan.md` is the live backlog; nothing there is "out of scope," just not yet prioritized (e.g. built-in auth helpers, request history).

## Workflow

Built step by step, one small piece at a time, with review at each step — the goal is learning Claude Code in practice, not shipping fast.
