# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

cURLyQ is a desktop Postman clone (send HTTP requests with headers/params/body, view responses), built as a learning project — see `project_specs.md` for full v1 scope and what's explicitly out of scope.

## Stack

- Frontend: TypeScript + React, in Tauri's webview.
- Backend: Rust, exposed to the frontend as Tauri commands (`#[tauri::command]`), invoked via `invoke(...)` from JS/TS.
- HTTP requests are performed on the Rust side (not from the webview) and returned to the frontend.

Project is not yet scaffolded — no build/lint/test commands exist yet. Once `npm create tauri-app` is run, update this section with the actual dev/build/test commands.

## Workflow

Work step by step, one small piece at a time, with a review checkpoint before moving to the next piece. Do not implement multiple features or large chunks in a single pass unless explicitly asked to.

When introducing a new Rust or JS/TS concept (syntax, pattern, library, tool) for the first time, briefly explain what it is and why it's used here — this project is explicitly for learning, not just shipping.
