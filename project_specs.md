# cURLyQ — Project Spec (v1)

A desktop Postman clone. Built as a learning project to practice using Claude Code in practice, step by step.

## Stack

- **Frontend**: TypeScript + React, running in Tauri's native webview.
- **Backend**: Rust, via Tauri commands. Handles the actual HTTP requests (e.g. `reqwest`), invoked from the frontend through Tauri's `invoke` bridge.
- **Packaging**: Tauri (native binary, not Electron).

## v1 Scope

In scope:
- **Request builder** — method (GET/POST/PUT/PATCH/DELETE/etc.), URL, headers, query params, body (raw JSON/text at minimum).
- **Send request** — frontend calls a Rust command that performs the HTTP request and returns status/headers/body.
- **Response viewer** — status code, response headers, response body (pretty-printed for JSON). Not persisted.
- **Tabs** — multiple requests open at once in-session (like browser/Postman tabs). No persistence across app restarts in v1.

Explicitly out of scope for v1 (revisit later):
- Saving/loading individual requests to disk.
- Collections/folders.
- Built-in auth helpers (Bearer, Basic, OAuth, etc.) — v1 relies on raw headers only.
- Environment variables / variable substitution.
- Request history.

## Workflow

Built step by step, one small piece at a time, with review at each step — the goal is learning Claude Code in practice, not shipping fast.
