import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  loadInternalAddonManifest,
  parseInternalAddonManifest,
} from '../src/internal/addons/manifest.js'
import {
  planInternalAddonInstall,
  renderInternalAddonInstallPlan,
} from '../src/internal/addons/plan.js'

let tempRoots: string[] = []

afterEach(async () => {
  let { rm } = await import('node:fs/promises')

  for (let root of tempRoots) {
    await rm(root, { recursive: true, force: true })
  }

  tempRoots = []
})

describe('internal add-on manifest', () => {
  it('loads an internal add-on manifest from disk', async () => {
    let root = await prepareProjectRoot()
    let manifestPath = await writeManifest(root, {
      id: 'internal:storage',
      slug: 'storage',
      name: 'Storage',
      description: 'Storage',
      version: '0.0.0',
      files: [
        'app/.server/db/schema/storage.ts',
        'app/features/storage/config.ts',
        'app/routes/storage/_layout.tsx',
      ],
      touchpoints: [
        {
          kind: 'schema',
          path: 'app/.server/db/schema.ts',
          description:
            'Import and re-export uploads and attachments from ./.server/db/schema/storage.',
        },
        {
          kind: 'config',
          path: 'app/config/storage-attachables.ts',
          description:
            'Define ATTACHABLES for the host tables that uploads may attach to.',
        },
        {
          kind: 'config',
          path: 'app/config/env.ts',
          description:
            'Ensure env exports the storage-facing values used by this bundle: Env, isProd, isTest, isDev, ORIGIN, and CDN.ORIGIN.',
        },
      ],
    })

    let spec = await loadInternalAddonManifest(manifestPath)

    expect(spec.manifest.slug).toBe('storage')
    expect(spec.manifest.name).toBe('Storage')
    expect(spec.manifest.files).toEqual([
      {
        source: 'app/.server/db/schema/storage.ts',
        target: 'app/.server/db/schema/storage.ts',
      },
      {
        source: 'app/features/storage/config.ts',
        target: 'app/features/storage/config.ts',
      },
      {
        source: 'app/routes/storage/_layout.tsx',
        target: 'app/routes/storage/_layout.tsx',
      },
    ])
    expect(spec.manifest.touchpoints).toEqual([
      {
        kind: 'schema',
        path: 'app/.server/db/schema.ts',
        description:
          'Import and re-export uploads and attachments from ./.server/db/schema/storage.',
      },
      {
        kind: 'config',
        path: 'app/config/storage-attachables.ts',
        description:
          'Define ATTACHABLES for the host tables that uploads may attach to.',
      },
      {
        kind: 'config',
        path: 'app/config/env.ts',
        description:
          'Ensure env exports the storage-facing values used by this bundle: Env, isProd, isTest, isDev, ORIGIN, and CDN.ORIGIN.',
      },
    ])
  })

  it('accepts string file entries as source-equals-target shorthand', () => {
    let spec = parseInternalAddonManifest(
      {
        id: 'internal:storage',
        slug: 'storage',
        name: 'Storage',
        description: 'Storage',
        version: '0.0.0',
        files: ['app/features/storage/config.ts'],
      },
      '/tmp/storage/gista.manifest.json',
    )

    expect(spec.manifest.files).toEqual([
      {
        source: 'app/features/storage/config.ts',
        target: 'app/features/storage/config.ts',
      },
    ])
  })

  it('rejects unsafe relative paths', () => {
    expect(() =>
      parseInternalAddonManifest(
        {
          id: 'internal:bad',
          slug: 'bad',
          name: 'Bad',
          description: 'Broken',
          version: '0.0.0',
          files: [
            {
              source: '../escape.ts',
              target: 'app/escape.ts',
            },
          ],
        },
        '/tmp/bad/gista.manifest.json',
      ),
    ).toThrow('must stay within its root')
  })
})

describe('planInternalAddonInstall', () => {
  it('marks new files as ready and collisions as blocked', async () => {
    let root = await prepareProjectRoot()
    let manifestPath = await writeManifest(root, {
      id: 'internal:storage',
      slug: 'storage',
      name: 'Storage',
      description: 'Storage',
      version: '0.0.0',
      files: [
        {
          source: 'app/config/env.ts',
          target: 'app/config/env.ts',
        },
        {
          source: 'app/routes/storage/prepare.ts',
          target: 'app/routes/storage/prepare.ts',
        },
      ],
      touchpoints: [
        {
          kind: 'schema',
          path: 'app/.server/db/schema.ts',
          description: 'wire schema',
        },
      ],
    })

    await writeFile(
      join(root, 'addon/app/config/env.ts'),
      'export const x = 1\n',
    )
    await writeFile(
      join(root, 'project/app/config/env.ts'),
      'export const x = 2\n',
    )
    await writeFile(
      join(root, 'addon/app/routes/storage/prepare.ts'),
      "export const action = 'ok'\n",
    )

    let spec = await loadInternalAddonManifest(manifestPath)
    let plan = await planInternalAddonInstall(join(root, 'project'), spec)

    expect(plan.blocked).toBe(true)
    expect(plan.files).toEqual([
      {
        source: join(root, 'addon/app/config/env.ts'),
        target: join(root, 'project/app/config/env.ts'),
        effect: 'change',
        status: 'blocked',
        reason: 'Target already exists with different contents',
      },
      {
        source: join(root, 'addon/app/routes/storage/prepare.ts'),
        target: join(root, 'project/app/routes/storage/prepare.ts'),
        effect: 'create',
        status: 'ready',
      },
    ])
  })

  it('reports matching files as noop and renders a dry-run summary', async () => {
    let root = await prepareProjectRoot()
    let manifestPath = await writeManifest(root, {
      id: 'internal:storage',
      slug: 'storage',
      name: 'Storage',
      description: 'Storage',
      version: '0.0.0',
      files: [
        {
          source: 'app/models/upload.ts',
          target: 'app/models/upload.ts',
        },
      ],
      touchpoints: [
        {
          kind: 'config',
          path: 'app/config/storage-attachables.ts',
          description: 'define attachables',
        },
      ],
    })

    await writeFile(
      join(root, 'addon/app/models/upload.ts'),
      'export type Upload = {}\n',
    )
    await writeFile(
      join(root, 'project/app/models/upload.ts'),
      'export type Upload = {}\n',
    )

    let spec = await loadInternalAddonManifest(manifestPath)
    let plan = await planInternalAddonInstall(join(root, 'project'), spec)
    let output = renderInternalAddonInstallPlan(plan)

    expect(plan.blocked).toBe(false)
    expect(plan.files[0]).toMatchObject({
      effect: 'noop',
      status: 'ready',
    })
    expect(output).toContain('Internal add-on plan: Storage (storage@0.0.0)')
    expect(output).toContain('noop')
    expect(output).toContain('Manual touchpoints')
    expect(output).toContain('Summary: 0 create, 0 change, 1 noop, 1 manual')
  })

  it('fails before any project writes when a source file is missing', async () => {
    let root = await prepareProjectRoot()
    let manifestPath = await writeManifest(root, {
      id: 'internal:storage',
      slug: 'storage',
      name: 'Storage',
      description: 'Storage',
      version: '0.0.0',
      files: [
        {
          source: 'app/missing.ts',
          target: 'app/missing.ts',
        },
      ],
    })

    await writeFile(join(root, 'project/app/existing.ts'), 'keep me\n')

    let spec = await loadInternalAddonManifest(manifestPath)

    await expect(
      planInternalAddonInstall(join(root, 'project'), spec),
    ).rejects.toThrow('Internal add-on source file not found')

    expect(await readFile(join(root, 'project/app/existing.ts'), 'utf8')).toBe(
      'keep me\n',
    )
  })
})

async function prepareProjectRoot() {
  let root = await mkdtemp(join(tmpdir(), 'gistajs-addons-test-'))
  tempRoots.push(root)

  await mkdir(join(root, 'addon/app/config'), { recursive: true })
  await mkdir(join(root, 'addon/app/routes/storage'), { recursive: true })
  await mkdir(join(root, 'addon/app/models'), { recursive: true })
  await mkdir(join(root, 'project/app/config'), { recursive: true })
  await mkdir(join(root, 'project/app/routes/storage'), { recursive: true })
  await mkdir(join(root, 'project/app/models'), { recursive: true })

  return root
}

async function writeManifest(root: string, manifest: Record<string, unknown>) {
  let path = join(root, 'addon/gista.manifest.json')
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`)
  return path
}
