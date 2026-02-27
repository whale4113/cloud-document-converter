# Repository Guidelines

## Project Structure & Module Organization

This repo is a pnpm + Turborepo monorepo for **Cloud Document Converter** (a browser extension that converts Lark cloud docs to Markdown).

- `apps/chrome-extension/`: Vue-based extension (UI in `src/pages/`, shared UI in `src/components/`, scripts in `src/scripts/`).
- `apps/chrome-extension-e2e/`: Playwright-based E2E tests for the extension (live Feishu validation + env unit tests).
- `packages/lark/`: core Lark Doc/Docx → Markdown transformer.
- `packages/common/`: shared utilities used across workspaces.
- `packages/typescript-config/`: shared `tsconfig` presets.
- `.changeset/`: versioning notes for multi-package releases.
- `**/tests/*.test.ts`: tests across Vitest / Playwright / node:test depending on workspace; build outputs generally land in `dist/`.

## Build, Test, and Development Commands

Toolchain: Node `22.12.0` (see `.node-version`) and pnpm (see `package.json#packageManager`).

- Install deps: `pnpm install`
- Build all workspaces: `pnpm run build`
- Type-check all: `pnpm run type-check`
- Test all: `pnpm run test`
- E2E env unit tests: `pnpm run test:e2e:unit`
- Install Playwright browser deps: `pnpm run test:e2e:install`
- Run extension E2E: `pnpm run test:e2e`
- Run extension E2E in debug mode: `pnpm run test:e2e:debug`
- Lint: `pnpm run lint`
- Format check / fix: `pnpm run format-check` / `pnpm run format`
- Run one package: `pnpm --filter @dolphin/lark test`

Extension development:

- Dev server for pages: `pnpm --filter @dolphin/chrome-extension dev:pages`
- Build extension: `pnpm --filter @dolphin/chrome-extension build`
- Run in a browser (after build): `pnpm -C apps/chrome-extension exec web-ext run --source-dir dist --target chromium`
- Run live copy-markdown assertion (headless):  
  `CDC_E2E_HEADLESS=1 CDC_E2E_TARGET_URL='https://my.feishu.cn/wiki/Ez2WwNvB2iMjd9kXMw3cfbqDnTe' CDC_E2E_EXPECTED_TEXT='源内容' pnpm run test:e2e --grep @live`

## Coding Style & Naming Conventions

- TypeScript (ESM) throughout; prefer small, typed functions and explicit exports.
- Indentation: 2 spaces.
- Prettier: no semicolons, single quotes (see `.prettierrc`).
- ESLint: `typescript-eslint` strict configs; keep `pnpm run lint` clean before opening a PR.
- Naming: tests use `*.test.ts`; workspace packages use the `@dolphin/*` scope.

## Testing Guidelines

- Frameworks:
  - Vitest (workspace unit tests, often with `happy-dom` for DOM-like tests).
  - Playwright (`apps/chrome-extension-e2e/`) for extension E2E.
  - node:test for E2E env/config parsing unit tests.
- Put tests in `tests/` within the workspace; keep inline snapshots minimal and stable.
- Live E2E defaults to Feishu URL `https://my.feishu.cn/wiki/Ez2WwNvB2iMjd9kXMw3cfbqDnTe` and expected text `源内容`; override with `CDC_E2E_TARGET_URL` / `CDC_E2E_EXPECTED_TEXT` when needed.

## Commit & Pull Request Guidelines

- Commits generally follow Conventional Commits: `feat(scope): ...`, `fix(scope): ...`, `chore: ...`, `refactor(scope): ...`.
- If you change behavior or user-facing output, add a Changeset: `pnpm exec changeset add`.
- PRs should include: clear description, linked issue, and a GIF/video for behavior/UI changes (see `.github/PULL_REQUEST_TEMPLATE.md`). Ensure CI is green (`test`, `lint`, `format-check`, `type-check`).

## Security & Configuration Tips

- Don’t commit tokens, cookies, or private document content. When adding fixtures/snapshots, use synthetic or sanitized data.
- Don’t commit persistent browser profile data from E2E (e.g. `apps/chrome-extension-e2e/.cache/user-data-live`).
