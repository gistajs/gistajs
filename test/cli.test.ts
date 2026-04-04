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
      provisionTurso: vi.fn().mockImplementation(async () => {
        steps.push('turso')

        return {
          provider: 'turso',
          status: 'completed',
        }
      }),
      runProjectCommand: vi.fn().mockImplementation(async () => {
        steps.push('atlas:prod')
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
      'atlas:prod',
    )
    expect(deps.provisionVercel).toHaveBeenCalledWith('/tmp/demo', {
      id: 'aws-ap-northeast-1',
      label: 'Tokyo',
      vercel: 'hnd1',
    })
    expect(steps).toEqual(['turso', 'atlas:prod', 'vercel'])
    expect(deps.stdout.log).toHaveBeenCalledWith('Applied production schema.')
    expect(deps.stdout.log).toHaveBeenCalledWith('Provision summary')
    expect(deps.stdout.log).toHaveBeenCalledWith(
      'completed: turso, atlas, vercel',
    )
  })

  it('runs atlas after a skipped Turso step and before Vercel', async () => {
    let steps: string[] = []
    let deps = makeCliDeps({
      cwd: '/tmp/demo',
      readFile: vi
        .fn()
        .mockResolvedValue(
          makeProjectPackage({ providers: ['turso', 'vercel'] }),
        ),
      promptText: vi.fn().mockResolvedValue(''),
      provisionTurso: vi.fn().mockImplementation(async () => {
        steps.push('turso')

        return {
          provider: 'turso',
          status: 'skipped',
        }
      }),
      runProjectCommand: vi.fn().mockImplementation(async () => {
        steps.push('atlas:prod')
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

    expect(steps).toEqual(['turso', 'atlas:prod', 'vercel'])
    expect(deps.stdout.log).toHaveBeenCalledWith('completed: atlas, vercel')
    expect(deps.stdout.log).toHaveBeenCalledWith('skipped: turso')
  })

  it('stops before Vercel when atlas:prod fails', async () => {
    let deps = makeCliDeps({
      cwd: '/tmp/demo',
      readFile: vi
        .fn()
        .mockResolvedValue(
          makeProjectPackage({ providers: ['turso', 'vercel'] }),
        ),
      promptText: vi.fn().mockResolvedValue(''),
      provisionTurso: vi.fn().mockResolvedValue({
        provider: 'turso',
        status: 'completed',
      }),
      runProjectCommand: vi.fn().mockRejectedValue(new Error('boom')),
      provisionVercel: vi.fn(),
    })

    await expect(runCli(['provision'], deps)).rejects.toThrow(
      'Could not apply production schema. Run `pnpm atlas:prod` manually.',
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
    promptConfirm: vi.fn(),
    promptText: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    stdout: { log: vi.fn() },
    cwd: process.cwd(),
    getCliVersion: vi.fn().mockResolvedValue('0.1.3'),
    getDefaultProvisionRegion: vi.fn().mockResolvedValue(null),
    runProjectCommand: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as CliDeps & { stdout: { log: ReturnType<typeof vi.fn> } }
}
