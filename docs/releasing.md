# Cutting a release

There are two workflows: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)
runs on every PR and push to `master` — frontend build, `cargo fmt`/`clippy`/
`cargo test`, and a `cargo check` per platform to catch OS-specific breakage
early — and [`.github/workflows/release.yml`](../.github/workflows/release.yml)
does the actual release build. This doc is about the latter.

Release builds are produced by [`.github/workflows/release.yml`](../.github/workflows/release.yml),
which runs on GitHub Actions whenever a `v*.*.*` tag is pushed. It builds
the app for Windows (`.msi`), macOS (`.dmg`, both Apple Silicon and Intel),
and Linux (`.AppImage`/`.deb`) via [`tauri-action`](https://github.com/tauri-apps/tauri-action),
and attaches all of them to a **draft** GitHub Release — nothing goes live
until you publish it by hand.

There's no auto-versioning: the workflow just builds whatever version is
checked out at the tag. To cut a release:

1. Bump `version` in three places, kept in sync manually:
   - `src-tauri/tauri.conf.json` (`version`)
   - `package.json` (`version`)
   - `src-tauri/Cargo.toml` (`[package].version`)
2. Commit the bump (e.g. `git commit -am "Bump version to 0.2.0"`).
3. Tag it and push both: `git tag v0.2.0 && git push && git push --tags`.
4. Watch the **Actions** tab on GitHub — the `Release` workflow runs four
   platform builds in parallel, each uploading its installer to the same
   draft release as it finishes.
5. Once all four are done, open the draft release under **Releases**,
   confirm all the expected installers are attached, write/edit the release
   notes, and hit **Publish release**.

## Known limitations (acceptable for now)

- **Unsigned builds.** No Apple Developer certificate or Windows Authenticode
  cert is configured, so macOS shows a Gatekeeper warning and Windows may
  show a SmartScreen warning on first launch. Revisit if/when this matters.
- **OS floor is set by Tauri, not by us.** Windows builds work back to
  Windows 10 1803+ (WebView2 ships built-in or is bootstrapped by the
  installer). macOS Intel builds work back to 10.13 (Tauri's own
  `minimumSystemVersion` default). macOS Apple Silicon builds require macOS
  11+ — inherent to the architecture, since arm64 Macs didn't exist before
  Big Sur. Linux builds require Ubuntu 22.04/Debian 12 or newer (or an
  equivalent glibc/webkit2gtk-4.1 baseline) — Tauri v2 needs WebKitGTK 4.1,
  which Ubuntu 20.04's repos don't provide at all, and GitHub also retired
  the `ubuntu-20.04` hosted runner in April 2025. There's no config here
  that would extend support further back on any platform.
