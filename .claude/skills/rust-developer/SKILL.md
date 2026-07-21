---
name: rust-developer
description: Lead Rust developer guidance for a Tauri desktop application (Rust 2021+, Tauri 2.x commands, serde/thiserror error handling across the IPC boundary, async command patterns, and shared state). Trigger for Rust backend code in the src-tauri crate, command handlers, state management, IPC serialization, or architecture decisions in this Tauri app.
version: 1.1.0
author: Claes Adamsson, Claude
tags:
  - rust
  - tauri
  - desktop
  - ipc
  - error-handling
  - architecture
---

# Rust Developer Skill

## Overview

Use this skill when acting as a Lead Rust Developer on a Tauri desktop application. It targets Rust 2021 edition, Tauri 2.x, serde for serialization, and thiserror/anyhow for error handling. The distinguishing feature of a Tauri app versus a plain CLI or server is the IPC boundary: Rust code is called from JavaScript, and whatever a command returns has to cross that boundary as JSON. Most of the guidance below exists to keep that boundary clean.

## When to Use

- Implementing or reviewing #[tauri::command] handlers in src-tauri.
- Designing error types that need to travel from Rust to the frontend.
- Managing shared state (State<T>, Mutex/RwLock) across commands.
- Writing async commands, background tasks, or event emission (emit/listen).
- Guiding module structure or architecture decisions for the Rust backend of this app.

## When Not to Use

- Frontend/webview code (React, Svelte, Vue, plain JS/TS) — that's a separate concern, this skill covers the Rust side only.
- Non-Tauri Rust work such as standalone CLIs or servers with no IPC boundary; the general Rust idioms below still apply, but the command/error/state guidance is Tauri-specific.
- Infrastructure-as-code, CI, or packaging/signing configuration (tauri.conf.json bundle settings), unless the question is specifically about how Rust code behaves at build time.

## Instructions

### General Guidance

- Use idiomatic Rust: ownership, borrowing, lifetimes, pattern matching, and iterators.
- Default to immutable bindings (`let`) and leverage the type system for safety.
- Avoid `.unwrap()` and `.expect()` in library code; use `?` operator and proper error propagation.
- Prefer `Result<T, E>` over panics; reserve panics for truly unrecoverable states.
- Treat tests as first-class: unit tests in modules, integration tests in `tests/`.

### Preferred Practices

- Keep `#[tauri::command]` handlers thin and delegate to domain/service modules.
- Use the module system effectively: `mod.rs` or inline modules, clear public API boundaries.
- Leverage iterators and combinators (`.map()`, `.filter()`, `.collect()`) over manual loops.
- Keep functions/files concise; split modules when responsibilities grow complex.
- Use `cargo clippy` and `cargo fmt` for linting and formatting.

### Patterns to Follow

A command's return type is serialized to JSON and sent to JS, so the error type must implement serde::Serialize. anyhow::Error does not implement Serialize, so the classic fn main() -> anyhow::Result<()> pattern does not transfer directly to a command handler — using it as a return type is a common but wrong copy-paste from CLI code.

Two workable patterns, in order of preference:

1. A dedicated, serializable error enum (preferred for anything the frontend needs to branch on):
  ```rust
    use serde::Serialize;
    use thiserror::Error;

    #[derive(Debug, Error, Serialize)]
    #[serde(tag = "kind", content = "message")]
    pub enum CommandError {
        #[error("not found: {0}")]
        NotFound(String),
        #[error("io error: {0}")]
        Io(String),
        #[error("internal error: {0}")]
        Internal(String),
    }

    // Convert lower-level errors at the boundary rather than leaking them raw.
    impl From<std::io::Error> for CommandError {
        fn from(e: std::io::Error) -> Self {
            CommandError::Io(e.to_string())
        }
    }

  #[tauri::command]
  fn read_config(path: String) -> Result<Config, CommandError> {
      let contents = std::fs::read_to_string(&path)?; // io::Error -> CommandError via From
      let config: Config = serde_json::from_str(&contents)
          .map_err(|e| CommandError::Internal(e.to_string()))?;
      Ok(config)
  }
  ```

The #[serde(tag = "kind", content = "message")] gives the frontend a discriminated union it can match on ({"kind": "NotFound", "message": "..."}), instead of an opaque string.

2. Result<T, String> (fine for simple commands where the frontend just displays the message and doesn't branch on error type):
  ```rust
    #[tauri::command]
    fn delete_file(path: String) -> Result<(), String> {
        std::fs::remove_file(&path).map_err(|e| e.to_string())
    }
  ```


Keep anyhow for internal service/business logic that never crosses the IPC boundary directly (e.g. a function called by several commands, or logic exercised by integration tests). Convert to CommandError or String only at the #[tauri::command] layer itself:
  ```rust
  // Internal logic, not a command — anyhow is fine here.
  fn load_and_validate(path: &Path) -> anyhow::Result<Config> {
      let raw = std::fs::read_to_string(path).context("reading config file")?;
      let config: Config = serde_json::from_str(&raw).context("parsing config")?;
      validate(&config).context("config failed validation")?;
      Ok(config)
  }

  #[tauri::command]
  fn get_config(path: String) -> Result<Config, String> {
      load_and_validate(Path::new(&path)).map_err(|e| e.to_string())
  }
  ```


Shared State
Register shared state with .manage(...) on the Builder and access it via State<'_, T> in command signatures.
Wrap mutable state in Mutex or RwLock. Tauri's async runtime is Tokio — use tokio::sync::Mutex for state touched inside async fn commands (a lock held across an .await with std::sync::Mutex can deadlock or block the runtime); std::sync::Mutex is fine for state only ever touched in sync commands.
Keep the lock scope as small as possible — acquire, do the minimal work, drop, then do anything slow (I/O, await points) outside the lock.
  ```rust
    use tokio::sync::Mutex;

    struct AppState {
        counter: Mutex<u32>,
    }

    #[tauri::command]
    async fn increment(state: tauri::State<'_, AppState>) -> Result<u32, String> {
        let mut count = state.counter.lock().await;
        *count += 1;
        Ok(*count)
    }
  ```

Async Commands and Blocking Work
Tauri commands can be async fn; they run on Tauri's Tokio runtime.
Never call blocking APIs (blocking file I/O on large files, CPU-bound loops, blocking crates) directly inside an async fn command — it stalls the runtime's worker thread. Wrap it in tokio::task::spawn_blocking:
```rust
  #[tauri::command]
  async fn hash_large_file(path: String) -> Result<String, String> {
      tokio::task::spawn_blocking(move || {
          // CPU-bound / blocking work here
          compute_hash(&path)
      })
      .await
      .map_err(|e| e.to_string())?
      .map_err(|e: std::io::Error| e.to_string())
  }
```

- **Structs & Enums**: Use `#[derive]` liberally for common traits.
  ```rust
  #[derive(Debug, Clone, Serialize, Deserialize, Default)]
  pub struct Config {
      pub name: String,
      #[serde(default)]
      pub enabled: bool,
  }
  ```

- **Option/Result Handling**: Prefer combinators and `?` over explicit matching.
  ```rust
  // Preferred
  let name = config.name.as_ref().map(|s| s.trim()).unwrap_or("default");
  
  // Also good with ?
  let value = some_option.ok_or_else(|| anyhow!("Missing value"))?;
  ```


- **Testing**:
  Business logic that doesn't need a running Tauri app (validation, parsing, transforms) should be plain functions tested with ordinary #[cfg(test)] unit tests — don't make it depend on tauri::State or AppHandle just because it's called from a command. 

  Keep #[tauri::command] functions thin — argument extraction and error conversion only — and delegate to a tested inner function. This also means the command layer rarely needs its own tests beyond a smoke check.

  ```rust
    fn compute_margin(revenue: f64, cost: f64) -> Result<f64, String> {
        if revenue <= 0.0 {
            return Err("revenue must be positive".into());
        }
        Ok((revenue - cost) / revenue)
    }

    #[tauri::command]
    fn get_margin(revenue: f64, cost: f64) -> Result<f64, String> {
        compute_margin(revenue, cost)
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn margin_rejects_nonpositive_revenue() {
            assert!(compute_margin(0.0, 10.0).is_err());
        }
    }
  ```

### Patterns to Avoid

- **Unwrap Abuse**: Avoid `.unwrap()` except in tests or when invariants are proven.
- **Clone Overuse**: Don't `.clone()` to satisfy the borrow checker without understanding why.
- **Stringly Typed**: Use enums and newtypes instead of raw strings for domain concepts.
- **God Modules**: Avoid modules with 500+ lines; split into focused submodules.
- **Ignoring Clippy**: Address warnings; they often catch real issues.
- **Blocking in Async**: If using async, don't call blocking APIs without `spawn_blocking`.
- Returning anyhow::Error (or any non-Serialize type) from a #[tauri::command] — it won't compile, or if wrapped carelessly, produces an unhelpful serialized error for the frontend.
- Business logic embedded directly in the #[tauri::command] function — makes it untestable without spinning up Tauri; extract to a plain function.

### Tooling & Dependency Checks

- Confirm crate versions from Cargo.toml/src-tauri/Cargo.toml and Cargo.lock before adding dependencies.
- Prefer well-maintained crates from the ecosystem (check crates.io downloads, recent updates).
- Use `cargo test` for unit/integration tests; `cargo test --doc` for doc tests.
- Maintain test coverage on critical logic; structure tests with Arrange-Act-Assert.
- Run `cargo clippy -- -W clippy::pedantic` periodically for deeper analysis.
- Use `cargo audit` to check for security vulnerabilities in dependencies.

### Output Expectations

- Document public APIs with doc comments (`///`) focusing on usage and rationale.
- Include examples in doc comments for complex functions.
- Keep guidance inclusive, action-oriented, and practical.
- When suggesting new dependencies, justify the addition and check for existing alternatives.

### Module Organization (Tauri example)

```
src-tauri/
├── src/
│   ├── main.rs          # Entry point: builds and runs the Tauri app
│   ├── lib.rs            # Builder setup, .manage(), invoke_handler registration
│   ├── commands/          # #[tauri::command] handlers, thin, grouped by domain
│   │   ├── mod.rs
│   │   ├── config.rs
│   │   └── files.rs
│   ├── state.rs           # Shared app state structs
│   ├── error.rs           # CommandError and From impls
│   └── services/           # Business logic, plain functions/structs, unit-testable
│       ├── mod.rs
│       └── config_service.rs
├── tauri.conf.json
└── Cargo.toml

```

- Keep `main.rs` thin: build the `Builder`, register state and commands, run the app.
- Command handlers in commands/ do argument extraction + error conversion, then call into services/.
- services/ holds the actual logic and is where most unit tests live.

## Notes

- If unsure about a pattern or crate, design a small experiment first (write a test) before implementing.
- Consult [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/) for naming and design decisions.
- Consult the [Tauri docs](https://tauri.app/) for IPC, state, and plugin specifics.
- Reference [The Rust Book](https://doc.rust-lang.org/book/) for fundamentals.
