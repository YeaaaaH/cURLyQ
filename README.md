# cURLyQ

A desktop Postman clone — send HTTP requests, inspect responses. Built as a learning project for practicing Claude Code, step by step. See [`project_specs.md`](./project_specs.md) for full v1 scope.

## Stack

- **Frontend**: TypeScript + React, in Tauri's native webview.
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
