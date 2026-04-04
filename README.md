# gistajs

Small CLI for scaffolding and managing Gista.js starter projects.

## Usage

```bash
npx gistajs create my-app
npx gistajs create my-app --starter website --no-install --no-git
```

Today the CLI covers project creation, starter diffs, and pin management.
Provisioning flows such as Turso or Vercel are intended to live here as first-class commands rather than as ad hoc per-starter scripts.

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

### Pin Model

Scaffolded projects carry one base starter lineage for their lifetime.
That baseline lives in `package.json` as `gistajs.pin`:

```json
{
  "gistajs": {
    "pin": "form:2026-04-01-001"
  }
}
```

`gistajs diff --latest` uses that pin as the starting point and compares it to the latest published release for the same starter.
After you accept an upgrade, advance the pin explicitly with `gistajs pin <release-key>`.

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
