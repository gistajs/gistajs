import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { CliDeps } from '../src/cli.js'
import { main, runCli } from '../src/cli.js'
import { parseCatalog } from '../src/utils/catalog.js'
import { parseStarterRelease } from '../src/utils/releases.js'

let sampleCatalog = parseCatalog([
  {
    slug: 'website',
    repo: 'gistajs/website',
    branches: ['main'],
    description: 'Static site starter',
  },
  {
    slug: 'db',
    repo: 'gistajs/db',
    branches: ['dev', 'main'],
    description: 'Database starter',
  },
  {
    slug: 'auth',
    repo: 'gistajs/auth',
    branches: ['dev', 'main'],
    description: 'Auth starter',
  },
])

let sampleReleaseByStarter = {
  auth: parseStarterRelease({
    slug: 'auth',
    latest: '2026-03-29-001',
    releases: ['2026-03-29-001', '2026-03-28-001', '2026-03-27-001'],
  }),
}

describe('runCli', () => {
  it('prints help for bare invocation without loading the catalog', async () => {
    let deps = makeCliDeps()

    await runCli([], deps)

    expect(deps.loadCatalog).not.toHaveBeenCalled()
    expect(deps.stdout.log).toHaveBeenCalledOnce()
    expect(deps.stdout.log.mock.calls[0]?.[0]).toContain('Usage:')
  })

  it('prints diff help for bare diff invocation', async () => {
    let deps = makeCliDeps()

    await runCli(['diff'], deps)

    expect(deps.loadCatalog).not.toHaveBeenCalled()
    expect(deps.stdout.log).toHaveBeenCalledOnce()
    expect(deps.stdout.log.mock.calls[0]?.[0]).toContain('gistajs diff')
  })

  it('prints add help for bare add invocation', async () => {
    let deps = makeCliDeps()

    await runCli(['add'], deps)

    expect(deps.stdout.log).toHaveBeenCalledOnce()
    expect(deps.stdout.log.mock.calls[0]?.[0]).toContain('gistajs add')
    expect(deps.stdout.log.mock.calls[0]?.[0]).toContain('--plan')
  })

  it('renders an add-on plan from a local manifest directory', async () => {
    let root = await mkdtemp(join(tmpdir(), 'gistajs-cli-addon-plan-'))
    let projectRoot = join(root, 'project')
    let addonRoot = join(root, 'storage-addon')

    try {
      await mkdir(join(projectRoot, 'app/config'), { recursive: true })
      await mkdir(join(projectRoot, 'app/routes/storage'), { recursive: true })
      await mkdir(join(addonRoot, 'app/config'), { recursive: true })
      await mkdir(join(addonRoot, 'app/routes/storage'), { recursive: true })

      await writeFile(
        join(addonRoot, 'gista.manifest.json'),
        JSON.stringify(
          {
            id: 'internal:storage',
            slug: 'storage',
            name: 'Storage',
            description: 'Storage',
            release: '2026-04-07-001',
            files: ['app/config/env.ts', 'app/routes/storage/prepare.ts'],
            touchpoints: [
              {
                kind: 'config',
                path: 'app/config/storage-attachables.ts',
                description: 'define attachables',
              },
            ],
          },
          null,
          2,
        ) + '\n',
      )

      await writeFile(
        join(addonRoot, 'app/config/env.ts'),
        'export const x = 1\n',
      )
      await writeFile(
        join(addonRoot, 'app/routes/storage/prepare.ts'),
        "export const action = 'ok'\n",
      )
      await writeFile(
        join(projectRoot, 'app/config/env.ts'),
        'export const x = 2\n',
      )

      let deps = makeCliDeps({
        cwd: projectRoot,
      })

      await runCli(['add', addonRoot, '--plan'], deps)

      expect(deps.stdout.log).toHaveBeenCalledOnce()
      expect(deps.stdout.log.mock.calls[0]?.[0]).toContain(
        'Internal add-on plan: Storage (storage@2026-04-07-001)',
      )
      expect(deps.stdout.log.mock.calls[0]?.[0]).toContain(
        'app/routes/storage/prepare.ts',
      )
      expect(deps.stdout.log.mock.calls[0]?.[0]).toContain('Manual touchpoints')
    } finally {
      let { rm } = await import('node:fs/promises')
      await rm(root, { recursive: true, force: true })
    }
  })

  it('requires --plan for add right now', async () => {
    let deps = makeCliDeps()

    await expect(runCli(['add', './storage-addon'], deps)).rejects.toThrow(
      '`gistajs add` is planning-only right now. Re-run with --plan.',
    )
  })

  it('dispatches latest diff from the project pin', async () => {
    let diffStarterMock = vi.fn().mockResolvedValue(' package.json | 2 +-')
    let deps = makeCliDeps({
      cwd: '/tmp/demo',
      loadCatalog: vi.fn().mockResolvedValue(sampleCatalog),
      loadStarterRelease: vi
        .fn()
        .mockResolvedValue(sampleReleaseByStarter.auth),
      readProjectStarterPin: vi.fn().mockResolvedValue({
        pin: 'auth:2026-03-28-001',
        starter: 'auth',
        releaseKey: '2026-03-28-001',
      }),
      diffStarter: diffStarterMock,
    })

    await runCli(['diff', '--latest', '--stat'], deps)

    expect(diffStarterMock).toHaveBeenCalledWith(sampleCatalog[2], {
      latest: true,
      stat: true,
      starter: 'auth',
      fromReleaseKey: '2026-03-28-001',
      toReleaseKey: '2026-03-29-001',
    })
  })

  it('reports a no-op for latest diff when already pinned to latest', async () => {
    let deps = makeCliDeps({
      cwd: '/tmp/demo',
      loadCatalog: vi.fn().mockResolvedValue(sampleCatalog),
      loadStarterRelease: vi
        .fn()
        .mockResolvedValue(sampleReleaseByStarter.auth),
      readProjectStarterPin: vi.fn().mockResolvedValue({
        pin: 'auth:2026-03-29-001',
        starter: 'auth',
        releaseKey: '2026-03-29-001',
      }),
    })

    await runCli(['diff', '--latest'], deps)

    expect(deps.diffStarter).not.toHaveBeenCalled()
    expect(deps.stdout.log).toHaveBeenCalledWith(
      'Already pinned to latest auth release 2026-03-29-001',
    )
  })

  it('dispatches explicit release diff', async () => {
    let diffStarterMock = vi.fn().mockResolvedValue(' package.json | 2 +-')
    let deps = makeCliDeps({
      loadCatalog: vi.fn().mockResolvedValue(sampleCatalog),
      loadStarterRelease: vi
        .fn()
        .mockResolvedValue(sampleReleaseByStarter.auth),
      diffStarter: diffStarterMock,
    })

    await runCli(['diff', 'auth', '2026-03-28-001', '2026-03-29-001'], deps)

    expect(diffStarterMock).toHaveBeenCalledWith(sampleCatalog[2], {
      starter: 'auth',
      fromReleaseKey: '2026-03-28-001',
      toReleaseKey: '2026-03-29-001',
    })
  })

  it('updates the project pin with the pin command', async () => {
    let deps = makeCliDeps({
      cwd: '/tmp/demo',
      loadStarterRelease: vi
        .fn()
        .mockResolvedValue(sampleReleaseByStarter.auth),
      readProjectStarterPin: vi.fn().mockResolvedValue({
        pin: 'auth:2026-03-28-001',
        starter: 'auth',
        releaseKey: '2026-03-28-001',
      }),
      writeProjectStarterPin: vi.fn().mockResolvedValue({
        pin: 'auth:2026-03-29-001',
        starter: 'auth',
        releaseKey: '2026-03-29-001',
      }),
    })

    await runCli(['pin', '2026-03-29-001'], deps)

    expect(deps.writeProjectStarterPin).toHaveBeenCalledWith(
      '/tmp/demo',
      'auth:2026-03-29-001',
    )
  })

  it('dispatches Turso provisioning from the current directory', async () => {
    let deps = makeCliDeps({
      cwd: '/tmp/demo',
      readFile: vi
        .fn()
        .mockResolvedValue(
          makeProjectPackage({ providers: ['turso', 'vercel'] }),
        ),
      promptText: vi.fn().mockResolvedValue(''),
      getDefaultProvisionRegion: vi
        .fn()
        .mockResolvedValue('aws-ap-northeast-1'),
      provisionTurso: vi.fn().mockResolvedValue({
        provider: 'turso',
        status: 'completed',
      }),
    })

    await runCli(['provision', 'turso'], deps)

    expect(deps.provisionTurso).toHaveBeenCalledWith('/tmp/demo', {
      id: 'aws-ap-northeast-1',
      label: 'Tokyo',
      vercel: 'hnd1',
    })
  })

  it('dispatches project-aware provision from package metadata', async () => {
    let steps: string[] = []
    let deps = makeCliDeps({
      cwd: '/tmp/demo',
      readFile: vi
        .fn()
        .mockResolvedValue(
          makeProjectPackage({ providers: ['turso', 'vercel'] }),
        ),
      promptText: vi.fn().mockResolvedValue(''),
      getDefaultProvisionRegion: vi
        .fn()
        .mockResolvedValue('aws-ap-northeast-1'),
      promptConfirm: vi.fn().mockResolvedValue(true),
      provisionTurso: vi.fn().mockImplementation(async () => {
        steps.push('turso')

        return {
          provider: 'turso',
          status: 'completed',
        }
      }),
      runProjectCommand: vi.fn().mockImplementation(async () => {
        steps.push('prep:prod')
      }),
      provisionVercel: vi.fn().mockImplementation(async () => {
        steps.push('vercel')

        return {
          provider: 'vercel',
          status: 'completed',
        }
      }),
    })

    await runCli(['provision'], deps)

    expect(deps.provisionTurso).toHaveBeenCalledWith('/tmp/demo', {
      id: 'aws-ap-northeast-1',
      label: 'Tokyo',
      vercel: 'hnd1',
    })
    expect(deps.runProjectCommand).toHaveBeenCalledWith(
      '/tmp/demo',
      'prep:prod',
    )
    expect(deps.provisionVercel).toHaveBeenCalledWith('/tmp/demo', {
      id: 'aws-ap-northeast-1',
      label: 'Tokyo',
      vercel: 'hnd1',
    })
    expect(steps).toEqual(['turso', 'prep:prod', 'vercel'])
    expect(deps.stdout.log).toHaveBeenCalledWith('Provision summary')
    expect(deps.stdout.log).toHaveBeenCalledWith(
      'completed: turso, prep:prod, vercel',
    )
  })

  it('checks required provider CLIs before prompting for project-aware provision', async () => {
    let deps = makeCliDeps({
      cwd: '/tmp/demo',
      readFile: vi
        .fn()
        .mockResolvedValue(
          makeProjectPackage({ providers: ['turso', 'vercel'] }),
        ),
      assertCommandAvailable: vi.fn(async (_cwd, command) => {
        if (command === 'turso') {
          throw new Error(
            'Required command not found: turso. Install: https://docs.turso.tech/cli/installation',
          )
        }
      }),
      promptText: vi.fn().mockResolvedValue(''),
    })

    await expect(runCli(['provision'], deps)).rejects.toThrow(
      'Required command not found: turso. Install: https://docs.turso.tech/cli/installation',
    )

    expect(deps.promptText).not.toHaveBeenCalled()
    expect(deps.provisionTurso).not.toHaveBeenCalled()
    expect(deps.provisionVercel).not.toHaveBeenCalled()
  })

  it('can skip prep:prod and continue to Vercel', async () => {
    let steps: string[] = []
    let deps = makeCliDeps({
      cwd: '/tmp/demo',
      readFile: vi
        .fn()
        .mockResolvedValue(
          makeProjectPackage({ providers: ['turso', 'vercel'] }),
        ),
      promptText: vi.fn().mockResolvedValue(''),
      promptConfirm: vi.fn().mockResolvedValue(false),
      provisionTurso: vi.fn().mockImplementation(async () => {
        steps.push('turso')

        return {
          provider: 'turso',
          status: 'completed',
        }
      }),
      runProjectCommand: vi.fn().mockImplementation(async () => {
        steps.push('prep:prod')
      }),
      provisionVercel: vi.fn().mockImplementation(async () => {
        steps.push('vercel')

        return {
          provider: 'vercel',
          status: 'completed',
        }
      }),
    })

    await runCli(['provision'], deps)

    expect(steps).toEqual(['turso', 'vercel'])
    expect(deps.runProjectCommand).not.toHaveBeenCalled()
    expect(deps.stdout.log).toHaveBeenCalledWith('completed: turso, vercel')
    expect(deps.stdout.log).toHaveBeenCalledWith('skipped: prep:prod')
  })

  it('stops before Vercel when prep:prod fails', async () => {
    let deps = makeCliDeps({
      cwd: '/tmp/demo',
      readFile: vi
        .fn()
        .mockResolvedValue(
          makeProjectPackage({ providers: ['turso', 'vercel'] }),
        ),
      promptText: vi.fn().mockResolvedValue(''),
      promptConfirm: vi.fn().mockResolvedValue(true),
      provisionTurso: vi.fn().mockResolvedValue({
        provider: 'turso',
        status: 'completed',
      }),
      runProjectCommand: vi.fn().mockRejectedValue(new Error('boom')),
      provisionVercel: vi.fn(),
    })

    await expect(runCli(['provision'], deps)).rejects.toThrow(
      'Production setup failed. Run `pnpm prep:prod` manually.',
    )

    expect(deps.provisionVercel).not.toHaveBeenCalled()
  })

  it('rejects unknown provision providers', async () => {
    let deps = makeCliDeps({
      readFile: vi.fn().mockResolvedValue(makeProjectPackage()),
      promptText: vi.fn().mockResolvedValue(''),
    })

    await expect(runCli(['provision', 'fly'], deps)).rejects.toThrow(
      'Unknown provider: fly',
    )
  })

  it('fails loudly when the installed cli version is too old for the project', async () => {
    let deps = makeCliDeps({
      cwd: '/tmp/demo',
      getCliVersion: vi.fn().mockResolvedValue('0.1.2'),
      readFile: vi.fn().mockResolvedValue(makeProjectPackage()),
    })

    await expect(runCli(['provision'], deps)).rejects.toThrow(
      'Run `pnpm up gistajs`.',
    )
  })

  it('dispatches Vercel provisioning from the current directory', async () => {
    let deps = makeCliDeps({
      cwd: '/tmp/demo',
      readFile: vi.fn().mockResolvedValue(makeProjectPackage()),
      promptText: vi.fn().mockResolvedValue('Virginia'),
      provisionVercel: vi.fn().mockResolvedValue({
        provider: 'vercel',
        status: 'completed',
      }),
    })

    await runCli(['provision', 'vercel'], deps)

    expect(deps.provisionVercel).toHaveBeenCalledWith('/tmp/demo', {
      id: 'aws-us-east-1',
      label: 'Virginia',
      vercel: 'iad1',
    })
  })

  it('keeps an existing saved region when the prompt is left blank', async () => {
    let deps = makeCliDeps({
      cwd: '/tmp/demo',
      readFile: vi
        .fn()
        .mockResolvedValue(
          makeProjectPackage({ region: 'aws-ap-northeast-1' }),
        ),
      promptText: vi.fn().mockResolvedValue(''),
      provisionVercel: vi.fn().mockResolvedValue({
        provider: 'vercel',
        status: 'completed',
      }),
    })

    await runCli(['provision', 'vercel'], deps)

    expect(deps.provisionVercel).toHaveBeenCalledWith('/tmp/demo', {
      id: 'aws-ap-northeast-1',
      label: 'Tokyo',
      vercel: 'hnd1',
    })
  })

  it('falls back to Oregon when the nearest-region lookup is unavailable', async () => {
    let deps = makeCliDeps({
      cwd: '/tmp/demo',
      readFile: vi.fn().mockResolvedValue(makeProjectPackage()),
      promptText: vi.fn().mockResolvedValue(''),
      getDefaultProvisionRegion: vi.fn().mockResolvedValue(null),
      provisionVercel: vi.fn().mockResolvedValue({
        provider: 'vercel',
        status: 'completed',
      }),
    })

    await runCli(['provision', 'vercel'], deps)

    expect(deps.provisionVercel).toHaveBeenCalledWith('/tmp/demo', {
      id: 'aws-us-west-2',
      label: 'Oregon',
      vercel: 'sfo1',
    })
  })

  it('fails clearly when package.json is missing', async () => {
    let deps = makeCliDeps({
      cwd: '/tmp/demo',
      readFile: vi
        .fn()
        .mockRejectedValue(
          Object.assign(new Error('missing'), { code: 'ENOENT' }),
        ),
    })

    await expect(runCli(['provision'], deps)).rejects.toThrow(
      'No package.json found. Run this from a Gista.js project directory.',
    )
  })

  it('fails clearly when package.json is invalid json', async () => {
    let deps = makeCliDeps({
      cwd: '/tmp/demo',
      readFile: vi.fn().mockResolvedValue('{'),
    })

    await expect(runCli(['provision'], deps)).rejects.toThrow(
      'Could not parse package.json in the current directory.',
    )
  })
})

describe('main', () => {
  it('prints usage after usage errors', async () => {
    let error = vi.spyOn(console, 'error').mockImplementation(() => {})
    let previousArgv = process.argv
    let previousExitCode = process.exitCode
    process.argv = ['node', 'gistajs', 'create']
    process.exitCode = undefined

    try {
      await main()
    } finally {
      process.argv = previousArgv
    }

    expect(process.exitCode).toBe(1)
    expect(error).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('Project name is required'),
    )
    expect(error).toHaveBeenNthCalledWith(2, expect.stringContaining('Usage:'))

    process.exitCode = previousExitCode
  })
})

function makeProjectPackage(
  overrides: {
    providers?: string[]
    requirement?: string
    region?: string
    scripts?: Record<string, string>
  } = {},
) {
  return JSON.stringify({
    gistajs: {
      pin: 'form:2026-04-01-001',
      providers: overrides.providers ?? ['turso'],
      ...(overrides.region ? { region: overrides.region } : {}),
    },
    devDependencies: {
      gistajs: overrides.requirement ?? '^0.1.3',
    },
    scripts: overrides.scripts ?? {
      'prep:prod': 'node scripts/prep-prod.js',
    },
  })
}

function makeCliDeps(overrides: Partial<CliDeps> = {}) {
  return {
    loadCatalog: vi.fn(),
    loadStarterRelease: vi.fn().mockResolvedValue(sampleReleaseByStarter.auth),
    createProject: vi.fn(),
    diffStarter: vi.fn(),
    readProjectStarterPin: vi.fn(),
    writeProjectStarterPin: vi.fn(),
    provisionTurso: vi.fn(),
    provisionVercel: vi.fn(),
    promptForStarter: vi.fn(),
    promptConfirm: vi.fn().mockResolvedValue(true),
    promptText: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    stdout: { log: vi.fn() },
    cwd: process.cwd(),
    getCliVersion: vi.fn().mockResolvedValue('0.1.3'),
    getDefaultProvisionRegion: vi.fn().mockResolvedValue(null),
    runProjectCommand: vi.fn().mockResolvedValue(undefined),
    assertCommandAvailable: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as CliDeps & { stdout: { log: ReturnType<typeof vi.fn> } }
}
