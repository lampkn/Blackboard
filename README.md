# Blackboard

Blackboard is a lightweight desktop writing workspace built with [Tauri 2](https://tauri.app/), [Svelte 5](https://svelte.dev/), [SvelteKit](https://kit.svelte.dev/), and TypeScript. It provides a simple project-and-document interface for creating projects, browsing text files, and editing their contents.

## Current functionality

- Create a project from the landing page.
- Browse projects and files from the app's data directory.
- Open a text file in a paper-style editor.
- Save document changes back to the selected file.
- Package the application as a native desktop app through Tauri.

Project data is stored in the platform-specific Tauri application data directory, under `filetree/<project-name>/`.

## Prerequisites

- Node.js and npm
- Rust and Cargo
- Tauri's platform prerequisites for your operating system

See the [Tauri prerequisites guide](https://tauri.app/start/prerequisites/) for OS-specific dependencies.

## Getting started

1. Install JavaScript dependencies:

   ```bash
   npm install
   ```

2. Start the frontend development server:

   ```bash
   npm run dev
   ```

3. Run the desktop application with Tauri:

   ```bash
   npm run tauri dev
   ```

The Tauri development window uses the frontend at `http://localhost:1420`.

## Available scripts

| Command               | Description                                       |
| --------------------- | ------------------------------------------------- |
| `npm run dev`         | Start the Vite development server.                |
| `npm run build`       | Build the SvelteKit frontend into `build/`.       |
| `npm run preview`     | Preview the production frontend build.            |
| `npm run check`       | Run SvelteKit synchronization and type checks.    |
| `npm run check:watch` | Run type checks in watch mode.                    |
| `npm run tauri dev`   | Launch the Tauri desktop app in development mode. |
| `npm run tauri build` | Build installable desktop bundles.                |

Before a release build, run:

```bash
npm run check
npm run build
npm run tauri build
```

## Project structure

```text
src/
├── components/
│   ├── document.svelte       # Text document editor
│   ├── explorermodal.svelte  # Project and file browser
│   ├── landingPage.svelte    # Start screen
│   └── nameModal.svelte      # Project creation dialog
├── routes/
│   ├── +layout.ts            # SPA configuration
│   └── +page.svelte          # Page navigation and app shell
└── app.html

src-tauri/
├── src/                      # Rust/Tauri entry points
├── capabilities/             # Filesystem permissions
├── icons/                    # Application icons
└── tauri.conf.json           # Desktop and build configuration
```

## Storage and permissions

The frontend uses Tauri's filesystem plugin to read and write text files. The default capability allows directory access and text-file operations within the application data directory (`$APPDATA`). Files outside that location are not part of the current storage workflow.

## Development notes

- The SvelteKit app runs in SPA mode because Tauri does not use a Node.js server for SSR.
- The default desktop window is 800×600 and is titled `blackboard`.
- The Rust layer currently includes a sample `greet` command; most application behavior is implemented in the Svelte components.
- The file browser currently expects the `filetree` directory to exist in the app data directory. If project discovery fails on a fresh install, create a project first or initialize that directory as part of future storage work.

## Recommended editor setup

For VS Code, install:

- [Svelte for VS Code](https://marketplace.visualstudio.com/items?itemName=svelte.svelte-vscode)
- [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
