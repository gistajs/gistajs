# AGENTS

## Purpose

This repository contains `gistajs`, a small TypeScript CLI for scaffolding and managing Gista.js starter projects.

The CLI entrypoint is `src/bin.ts`, which calls `main()` from `src/cli.ts`. The package also exposes a small programmatic API through `src/index.ts`.

## Stack

- Node.js `>=20`
- TypeScript
- `pnpm` for package management
- `tsup` for builds
- `vitest` for tests

## Repository layout

- `src/cli.ts`: top-level command routing, help/error UX, and CLI entry control flow
- `src/commands/*.ts`: per-command argument parsing, orchestration, and command-specific helpers
- `src/providers/*.ts`: provider CLI wrappers for project infrastructure setup
- `src/utils/*.ts`: shared support code such as catalog loading, prompts, release helpers, subprocess helpers, colors, types, and CLI dependency wiring
- `src/index.ts`: public library exports
- `src/bin.ts`: executable entrypoint
- `test/*.test.ts`: CLI, scaffold, and provisioning behavior tests

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
- For provisioning changes, cover provider preflight failures and config-write safeguards.
- Mock catalog loading, prompts, and subprocess-style side effects when validating control flow.

## Build notes

- `tsup.config.ts` builds two outputs:
  - `src/index.ts` to ESM with type declarations
  - `src/bin.ts` to CJS with a shebang for the published `gistajs` binary

## Cautions

- Scaffolding currently relies on network fetches for the starter catalog and starter tarballs.
- `createProject` runs `pnpm install` unless disabled.
- `initGit` may prompt for git identity if none is configured.
- Provisioning flows should wrap external CLIs without assuming stable human-formatted output when machine-readable output is available.
- Avoid overwriting unrelated local changes in the worktree.

## Final response note

- When finishing a task that produced new edits, include a one-line commit message suggestion based on the full current uncommitted diff, not just the most recent change.
