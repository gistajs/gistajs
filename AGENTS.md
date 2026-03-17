# AGENTS

## Purpose

This repository contains `gistajs`, a small TypeScript CLI for scaffolding Gista.js starter projects.

The CLI entrypoint is `src/bin.ts`, which calls `main()` from `src/cli.ts`. The package also exposes a small programmatic API through `src/index.ts`.

## Stack

- Node.js `>=20`
- TypeScript
- `pnpm` for package management
- `tsup` for builds
- `vitest` for tests

## Repository layout

- `src/cli.ts`: command parsing, help/error UX, and create command flow
- `src/create.ts`: starter download, extraction, package name rewrite, install step
- `src/catalog.ts`: starter catalog fetch and parsing
- `src/git.ts`: git initialization and identity handling
- `src/prompt.ts`: interactive readline prompts
- `src/index.ts`: public library exports
- `src/bin.ts`: executable entrypoint
- `test/cli.test.ts`: CLI and scaffold behavior tests

## Common commands

```bash
pnpm install
pnpm typecheck
pnpm build
pnpm test -- --run
```

## Project-specific constraints

- `src/index.ts` is the package export surface; treat changes there as public API changes.
- Keep invalid CLI invocations side-effect free before catalog loading, prompts, git init, or installs.

## Testing expectations

- Add or update `vitest` coverage for behavior changes, especially in `test/cli.test.ts`.
- For CLI changes, test both valid and invalid invocation paths.
- Mock catalog loading, prompts, and subprocess-style side effects when validating control flow.

## Build notes

- `tsup.config.ts` builds two outputs:
  - `src/index.ts` to ESM with type declarations
  - `src/bin.ts` to CJS with a shebang for the published `gistajs` binary

## Cautions

- Scaffolding currently relies on network fetches for the starter catalog and starter tarballs.
- `createProject` runs `pnpm install` unless disabled.
- `initGit` may prompt for git identity if none is configured.
- Avoid overwriting unrelated local changes in the worktree.

## Final response note

- When finishing a task that produced new edits, include a one-line commit message suggestion based on the full current uncommitted diff, not just the most recent change.
