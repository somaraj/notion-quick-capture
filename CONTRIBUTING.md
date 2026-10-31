# Contributing

Thanks for helping improve Notion Quick Capture! By taking part you agree to follow our
[Code of Conduct](CODE_OF_CONDUCT.md).

## Getting started

1. Fork the repo and clone your fork.
2. Install Node.js 22 (`nvm use` picks up `.nvmrc`) and run `npm install`.
3. Run `npm run dev` to start the app with hot-reload for the UI.
4. Connect with your own Notion internal integration token (see the README). Use a test page or database.

## Before opening a pull request

- Run `npm run check` (ESLint, TypeScript, Vitest) and `npm run test:e2e` (UI smoke tests in Electron).
  CI runs both on Windows, macOS and Linux.
- Don't have a Mac or Linux machine? Push to your fork: CI builds installers for all three platforms and
  attaches them to the run as **Artifacts** (see [docs/RELEASING.md](docs/RELEASING.md#development-builds-every-push)).
- Run `npm run format` to apply Prettier formatting.
- Add or update tests for logic changes. Pure logic (Markdown conversion, property builders, error handling)
  lives in modules without Electron imports so it can be unit tested — please keep it that way.
- Add a line to `CHANGELOG.md` under **Unreleased** for user-facing changes.
- Keep pull requests focused: one fix or feature per PR.

## Guidelines

- **Security**: the renderer is sandboxed and has no Node.js access. New main-process functionality must be
  exposed through `src/preload/index.ts` and validated with Zod in `src/main/ipc/handlers.ts`.
  Never log tokens or note contents.
- **Privacy**: the app must not contact any service other than the Notion API and GitHub Releases (updates).
  No analytics or telemetry.
- **Dependencies**: prefer small, well-maintained packages; avoid native modules so contributors don't need
  build tools.
- **Commits**: clear, imperative messages (e.g. "Fix date property when end date is empty").

## Reporting bugs

Open an issue using the bug report template. Include the app version, OS and relevant log lines —
and never paste your Notion token. For security issues see [SECURITY.md](SECURITY.md).
