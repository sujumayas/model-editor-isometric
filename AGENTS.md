# Repository Guidelines

## Project Structure & Module Organization
This is a Vite + TypeScript isometric level editor. The entry point is `src/index.ts`, and the DOM shell lives in `index.html`. Core code lives under `src/` with feature-focused folders: `src/core/`, `src/engine/`, `src/editor/` (tools/history), `src/ui/`, `src/level/`, and `src/assets/` (asset loading/registry). Static artwork lives in the top-level `assets/` directory (e.g., sprite sheets), while build output goes to `dist/`. Use the TypeScript path aliases from `tsconfig.json` for cross-module imports (e.g., `@engine/*`, `@editor/*`, `@ui/*`).

## Build, Test, and Development Commands
- `npm run dev`: Starts the Vite dev server for local development.
- `npm run build`: Runs `tsc` then `vite build` to produce `dist/`.
- `npm run preview`: Serves the built app from `dist/` for production-like checks.
Install dependencies with `npm install` before running any scripts.

## Coding Style & Naming Conventions
The codebase is TypeScript with ES modules and strict compiler options enabled. Follow existing formatting: 2-space indentation, trailing commas where already used, and clear block comments only when logic is non-obvious. File names are typically `PascalCase` for class-centric modules (e.g., `TileRegistry.ts`), while variables and functions use `camelCase`. Prefer path aliases (e.g., `@core/*`) over deep relative imports. There is no formatter/linter configured, so keep diffs minimal and consistent with nearby code.

## Testing Guidelines
There is no test runner or `npm test` script configured in this repository. If you add tests, introduce a script in `package.json`, document the runner here, and use a consistent naming pattern such as `*.test.ts` alongside the module or under a new `tests/` directory.

## Commit & Pull Request Guidelines
This folder is not a Git repository, so there is no established commit convention to follow. If you add one, prefer short, imperative messages (e.g., “Add tile palette shortcuts”). For pull requests, include a concise summary, list any manual testing steps, and attach screenshots or recordings for UI changes. Call out asset updates explicitly, especially when new files are added under `assets/`.
