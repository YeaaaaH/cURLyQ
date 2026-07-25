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
- **Tabs** — multiple requests open at once, persisted across app restarts (including which tab and sub-tab was active).
- **Environment variables / variable substitution** (e.g. `{{baseUrl}}`) across requests.
- **Collections** — Postman-style nested folders for saving and organizing requests, so they survive app restarts.
- **Import/export** — Postman-compatible JSON. Environments are done (Postman v2.1 environment format); collections import/export is planned next.

Explicitly out of scope for v1 (revisit later):
- Built-in auth helpers (Bearer, Basic, OAuth, etc.) — v1 relies on raw headers only.
- Request history.

## Workflow

Built step by step, one small piece at a time, with review at each step — the goal is learning Claude Code in practice, not shipping fast.
