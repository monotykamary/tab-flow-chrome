# Agents guide for Tab Flow

## Build, lint, test

- Dev server: `bun run dev` (Vite)
- Production build: `bun run build` (Vite + background + manifest/icons)
- Preview build: `bun run preview`
- Package zip: `bun run package` or `bun run zip`
- Lint: `bun run lint`
- Type-check: `bun run typecheck`
- Tests: none configured. If you add Vitest: `bunx vitest run` and single test: `bunx vitest run -t "pattern" path/to/file.test.ts`.

## Code style (TypeScript + React 18)

- TS is strict; avoid `any`. Prefer explicit return types for public APIs. Place shared types in `src/types`.
- Imports: group as node/external/internal. Prefer `@/` alias (see tsconfig paths) over long `../..`. Prefer named exports; default only when necessary.
- Components: PascalCase file and component names (see `src/components`). Hooks/utls files camelCase (e.g., `utils/storage.ts`). Keep components pure and typed props.
- Styling: TailwindCSS; compose classes with `cn(...)` from `src/utils/cn.ts`. Keep accessibility (aria-*, roles) and keyboard handlers.
- State/effects: prefer React hooks; keep effect deps complete. For lists, provide stable keys.
- Error handling: use try/catch around Chrome APIs and async storage. Never swallow errors; `console.error('context', err)` and return safe fallbacks.
- Formatting: follow ESLint defaults in this repo. Run lint before committing. Editor Prettier is fine but not enforced in repo.
- Naming: booleans `is/has/can`, handlers `handleX`, constants UPPER_SNAKE_CASE, variables/functions camelCase.

## Cursor/Copilot

- No Cursor or Copilot rule files found in this repo at the time of writing.

