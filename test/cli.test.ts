import { describe, expect, it, vi } from 'vitest'
import { parseCatalog } from '../src/catalog.js'
import type { CliDeps } from '../src/cli.js'
import {
  main,
  parseCreateArgs,
  parseDiffArgs,
  parsePinArgs,
  runCli,
} from '../src/cli.js'
import { parseStarterRelease } from '../src/releases.js'

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

describe('parseCreateArgs', () => {
  it('parses starter flags', () => {
    expect(
      parseCreateArgs(['my-app', '--starter', 'db', '--no-install']),
    ).toEqual({
      projectName: 'my-app',
      starter: 'db',
      install: false,
    })
  })

  it('rejects missing starter values', () => {
    expect(() => parseCreateArgs(['my-app', '--starter'])).toThrow(
      '--starter requires a value',
    )
  })
})

describe('parseDiffArgs', () => {
  it('parses starter release keys', () => {
    expect(parseDiffArgs(['auth', '2026-03-28-001', '2026-03-29-001'])).toEqual(
      {
        starter: 'auth',
        fromReleaseKey: '2026-03-28-001',
        toReleaseKey: '2026-03-29-001',
      },
    )
  })

  it('parses --latest flag', () => {
    expect(parseDiffArgs(['--latest'])).toEqual({ latest: true })
  })
})

describe('parsePinArgs', () => {
  it('parses a release key', () => {
    expect(parsePinArgs(['2026-04-01-001'])).toEqual({
      releaseKey: '2026-04-01-001',
    })
  })
})

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

function makeCliDeps(overrides: Partial<CliDeps> = {}) {
  return {
    loadCatalog: vi.fn(),
    loadStarterRelease: vi.fn().mockResolvedValue(sampleReleaseByStarter.auth),
    createProject: vi.fn(),
    diffStarter: vi.fn(),
    readProjectStarterPin: vi.fn(),
    writeProjectStarterPin: vi.fn(),
    promptForStarter: vi.fn(),
    promptConfirm: vi.fn(),
    stdout: { log: vi.fn() },
    cwd: process.cwd(),
    ...overrides,
  } as CliDeps & { stdout: { log: ReturnType<typeof vi.fn> } }
}
