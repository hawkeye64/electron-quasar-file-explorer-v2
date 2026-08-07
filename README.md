# File Explorer (electron-quasar-file-explorer-v2)

![File Explorer](images/file-explorer.png)

<span class="badge-github-sponsors"><a href="https://github.com/sponsors/hawkeye64" title="Sponsor this project on GitHub"><img src="https://img.shields.io/badge/github-sponsors-ea4aaa.svg?logo=githubsponsors&logoColor=white" alt="GitHub Sponsors button" /></a></span>
<span class="badge-paypal"><a href="https://paypal.me/hawkeye64" title="Donate to this project using Paypal"><img src="https://img.shields.io/badge/paypal-donate-yellow.svg" alt="PayPal donate button" /></a></span>

[![Discord](https://img.shields.io/badge/discord-join%20server-738ADB?style=for-the-badge&logo=discord&logoColor=738ADB)](https://chat.quasar.dev)
[![X](https://img.shields.io/badge/follow-@jgalbraith64-1DA1F2?style=for-the-badge&logo=x&logoColor=1DA1F2)](https://twitter.com/jgalbraith64)

This is a follow-up to an article I wrote and published on [Medium](https://medium.com/quasar-framework/building-an-electron-file-explorer-with-quasar-and-vue-7bf94f1bbf6).

This File Explorer now uses Quasar v2, Vue 3, and the current Quasar app-vite Electron workflow.

This is a rudimentary File Explorer that works for Windows, Mac and Linux systems. It provides a good example of how to use Quasar in `electron` mode.

## Current Stack

- App version `3.1.0`
- Quasar `2.24.0`
- `@quasar/app-vite` `3.5.0`
- Vue `3.5.41`
- vue-router `5.2.0`
- Electron `43.3.0`
- electron-builder `26.15.7`
- Node `24.14.1+`
- pnpm `11.20.0`

Electron runtime dependencies live in `src-electron/package.json`, while renderer dependencies live in the root `package.json`. This mirrors the current Quasar app-vite Electron setup and keeps packaged Electron dependencies separate from the browser app.

## What This Demonstrates

- Quasar app-vite Electron mode with a separate `src-electron` runtime package.
- Electron main and preload scripts using the current Quasar `#q-app/electron/*` runtime helpers.
- A narrow, validated preload bridge with an explicitly sandboxed and
  context-isolated renderer.
- A shared, structured-clone-safe contract between Electron main and the
  renderer.
- Bounded asynchronous filesystem scans that keep blocking Node filesystem
  calls out of Electron's main process.
- Purpose-built, size-limited thumbnail IPC instead of exposing arbitrary file
  reads to the renderer.
- Electron Builder packaging with app icons under `src-electron/electron-assets/icons`.
- Custom app, favicon, and file-type icons generated from source SVG assets.
- Node's built-in test runner plus a Node 24 / pnpm 11 verification workflow
  and a cross-platform Electron build-and-runtime-smoke matrix.

## How The Electron Boundary Works

The Vue renderer never imports Node filesystem APIs. A component calls a helper
in `src/backend/utils.js`, which uses the narrow `window.myShell` API exposed by
`electron-preload.ts`. The preload sends a named IPC request, and `handler.ts`
validates both the sending window and the request arguments before main-process
code accesses the filesystem.

Directory results use the shared types in `src/types/fileExplorer.ts`. They
contain only structured-clone-safe primitives rather than Node `fs.Stats`
objects. This is why values such as `mtimeMs` are copied explicitly before the
result crosses IPC.

## Install

```bash
pnpm install
pnpm electron:install
```

## Development

```bash
pnpm dev
```

The dev command removes an inherited `ELECTRON_RUN_AS_NODE` environment variable before launching Quasar. If that variable leaks in from a parent shell, Electron starts like plain Node and its main-process APIs are unavailable.

## Verify

```bash
pnpm verify
```

`pnpm verify` runs formatting, lint, type checking, behavioral tests, and a
production Electron build. The focused tests can be run with `pnpm test`.
After a production build, `pnpm smoke:packaged` launches the native packaged
application, verifies the preload/IPC/filesystem path, and exits automatically.

## Build

```bash
pnpm build
```

The build creates the packaged Electron output in `dist/electron`.

Items that have been added since the last tutorial:

- Double-click to open a file based on its type
- Grid and virtualized list views
- File size and modification-time metadata
- Startup in the current user's home directory on every supported OS
- Location-aware shortcut highlighting, tree expansion, and scrolling
- A compact application menu with new-window, view, icon-size, refresh, path,
  hidden-dotfile, parent-folder, and About actions
- Platform-aware keyboard shortcuts that use Ctrl on Windows/Linux and Command
  on macOS, including modified mouse-wheel icon sizing
- Bounded image thumbnails
- Explicit loading, empty-folder, partial-read, and error states

Removed since last tutorial:

- File/folder watching (I just never got around to updating this)

There is still plenty of work to be done to make it better.

For example:

- copy, paste, cut, delete
- file info/properties
- plug and play drives (ie: USBs)
- automatic filesystem change notifications
- and others

Feel free to PR if you would like to make it better for others.

## Support

If Electron Quasar File Explorer is useful in your workflow and you want to support ongoing maintenance:

- GitHub Sponsors: https://github.com/sponsors/hawkeye64
- PayPal: https://paypal.me/hawkeye64

## License

MIT (c) 2021 Jeff Galbraith <galbraith64@gmail.com>
