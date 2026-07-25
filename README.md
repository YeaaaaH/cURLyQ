# cURLyQ

A desktop Postman clone — send HTTP requests, inspect responses. Built as a learning project for practicing Claude Code, step by step. See [`project_specs.md`](./project_specs.md) for full v1 scope.

## Features

- **Request builder** — method, URL with live query-param sync, headers, and a raw/JSON body (auto-sets `Content-Type: application/json`), sent via a Rust-side `reqwest` client.
- **Tabs** — multiple requests open at once, persisted across restarts (including which tab and which Params/Headers/Body sub-tab was active).
- **Environments** — `{{variable}}` substitution across URL/params/headers/body, managed from a dedicated dialog and switched from the sidebar/tab bar.
- **Collections** — Postman-style nested folders, drag-and-drop reordering and moving (including across collections), rename/delete with a cascade-delete confirmation for non-empty folders.
- **Import/Export** — environments import/export as Postman v2.1 environment JSON, with a recent-activity log (click an entry for full error details) and toast notifications for success/failure. Collections import/export is planned next.
- **Response viewer** — status, headers, and a pretty-printed body.

## Stack

- **Frontend**: TypeScript + React, in Tauri's native webview. Styled with Tailwind CSS v4 + shadcn/ui; drag-and-drop via `@dnd-kit`, toasts via `sonner`.
- **Backend**: Rust, exposed as Tauri commands (`#[tauri::command]`); performs the actual HTTP requests via `reqwest`.
- **Packaging**: Tauri (native binary, not Electron).

## Development

```sh
npm install
npm run tauri dev    # run the app with hot reload
npm run tauri build  # build a release binary
```

Other useful commands:

```sh
npm run dev      # frontend-only Vite dev server
cargo check       # type-check the Rust backend (run from src-tauri/)
```

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
