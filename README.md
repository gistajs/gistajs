# gistajs

Small CLI for creating Gista.js starter projects.

## Usage

```bash
npx gistajs create my-app
npx gistajs create my-app --starter website --no-install --no-git
```

### Diff

Compare changes between starter releases:

```bash
npx gistajs diff auth 2026-03-28-001 2026-03-29-001        # full diff
npx gistajs diff auth 2026-03-28-001 2026-03-29-001 --stat # summary only
```

## Development

```bash
pnpm install
pnpm typecheck
pnpm build
pnpm test
pnpm build && node dist/bin.cjs logo
```

## Release

```bash
pnpm np
```
