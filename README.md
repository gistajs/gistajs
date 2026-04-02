# gistajs

Small CLI for creating Gista.js starter projects.

## Usage

```bash
npx gistajs create my-app
npx gistajs create my-app --starter website --no-install --no-git
```

### Diff

Compare the starter changes since your project's pinned release:

```bash
npx gistajs diff --latest                            # full diff from project pin to latest release
npx gistajs diff --latest --stat                     # summary only
```

Or compare changes between starter releases:

```bash
npx gistajs diff auth 2026-03-28-001 2026-03-29-001        # full diff
npx gistajs diff auth 2026-03-28-001 2026-03-29-001 --stat # summary only
```

Advance your project pin after accepting an upgrade:

```bash
npx gistajs pin 2026-04-01-001
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
