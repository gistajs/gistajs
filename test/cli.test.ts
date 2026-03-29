import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as tar from 'tar'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseCatalog } from '../src/catalog.js'
import { main, parseCreateArgs, parseDiffArgs, runCli } from '../src/cli.js'
import { createProject, getStarterTarballUrl } from '../src/create.js'
import {
  diffStarter,
  getStarterRepoUrl,
  resolveStarterTagName,
} from '../src/diff.js'

let tempRoots: string[] = []
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

afterEach(async () => {
  let { rm } = await import('node:fs/promises')

  for (let root of tempRoots) {
    await rm(root, { recursive: true, force: true })
  }

  tempRoots = []
  vi.restoreAllMocks()
})

describe('parseCreateArgs', () => {
  it('parses starter flags', () => {
    expect(
      parseCreateArgs(['my-app', '--starter', 'db', '--no-install']),
    ).toEqual({
      projectName: 'my-app',
      starter: 'db',
      install: false,
      git: true,
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

  it('rejects missing catalog url values', () => {
    expect(() => parseDiffArgs(['auth', 'a', 'b', '--catalog-url'])).toThrow(
      '--catalog-url requires a value',
    )
  })
})

describe('runCli', () => {
  it('prints help for bare invocation without loading the catalog', async () => {
    let loadCatalog = vi.fn()
    let stdout = { log: vi.fn() }

    await runCli([], {
      loadCatalog,
      createProject: vi.fn(),
      diffStarter: vi.fn(),
      promptForStarter: vi.fn(),
      stdout,
    })

    expect(loadCatalog).not.toHaveBeenCalled()
    expect(stdout.log).toHaveBeenCalledOnce()
    expect(stdout.log.mock.calls[0]?.[0]).toContain('Usage:')
    expect(stdout.log.mock.calls[0]?.[0]).toContain('gistajs create my-app')
  })

  it('prints help for --help without loading the catalog', async () => {
    let loadCatalog = vi.fn()
    let stdout = { log: vi.fn() }

    await runCli(['--help'], {
      loadCatalog,
      createProject: vi.fn(),
      diffStarter: vi.fn(),
      promptForStarter: vi.fn(),
      stdout,
    })

    expect(loadCatalog).not.toHaveBeenCalled()
    expect(stdout.log).toHaveBeenCalledOnce()
    expect(stdout.log.mock.calls[0]?.[0]).toContain('Examples:')
  })

  it('rejects create without a project name before any side effects', async () => {
    let loadCatalog = vi.fn()
    let promptForStarter = vi.fn()

    await expect(
      runCli(['create'], {
        loadCatalog,
        createProject: vi.fn(),
        diffStarter: vi.fn(),
        promptForStarter,
        stdout: { log: vi.fn() },
      }),
    ).rejects.toThrow('Project name is required')

    expect(loadCatalog).not.toHaveBeenCalled()
    expect(promptForStarter).not.toHaveBeenCalled()
  })

  it('rejects unknown commands before loading the catalog', async () => {
    let loadCatalog = vi.fn()

    await expect(
      runCli(['bogus'], {
        loadCatalog,
        createProject: vi.fn(),
        diffStarter: vi.fn(),
        promptForStarter: vi.fn(),
        stdout: { log: vi.fn() },
      }),
    ).rejects.toThrow('Unknown command: bogus')

    expect(loadCatalog).not.toHaveBeenCalled()
  })

  it('rejects diff without all required args before any side effects', async () => {
    let loadCatalog = vi.fn()

    await expect(
      runCli(['diff', 'auth', '2026-03-28-001'], {
        loadCatalog,
        createProject: vi.fn(),
        diffStarter: vi.fn(),
        promptForStarter: vi.fn(),
        stdout: { log: vi.fn() },
      }),
    ).rejects.toThrow('To release key is required')

    expect(loadCatalog).not.toHaveBeenCalled()
  })

  it('dispatches diff with the resolved starter and args', async () => {
    let loadCatalog = vi.fn().mockResolvedValue(sampleCatalog)
    let diffStarterMock = vi.fn().mockResolvedValue(' package.json | 2 +-')
    let stdout = { log: vi.fn() }

    await runCli(['diff', 'auth', '2026-03-28-001', '2026-03-29-001'], {
      loadCatalog,
      createProject: vi.fn(),
      diffStarter: diffStarterMock,
      promptForStarter: vi.fn(),
      stdout,
    })

    expect(loadCatalog).toHaveBeenCalledOnce()
    expect(diffStarterMock).toHaveBeenCalledWith(sampleCatalog[2], {
      starter: 'auth',
      fromReleaseKey: '2026-03-28-001',
      toReleaseKey: '2026-03-29-001',
    })
    expect(stdout.log).toHaveBeenCalledWith(' package.json | 2 +-')
  })
})

describe('parseCatalog', () => {
  it('parses starter entries', () => {
    expect(sampleCatalog).toHaveLength(3)
  })
})

describe('getStarterTarballUrl', () => {
  it('builds the codeload URL from the starter repo', () => {
    expect(getStarterTarballUrl(sampleCatalog[1]!)).toBe(
      'https://codeload.github.com/gistajs/db/tar.gz/refs/heads/dev',
    )
  })
})

describe('createProject', () => {
  it('extracts a starter archive and rewrites the package name', async () => {
    let root = await mkdtemp(join(tmpdir(), 'gistajs-test-'))
    tempRoots.push(root)

    let sourceRoot = join(root, 'source', 'gistajs-website-dev')
    await mkdir(sourceRoot, { recursive: true })
    await writeFile(
      join(sourceRoot, 'package.json'),
      `${JSON.stringify({ name: 'website' }, null, 2)}\n`,
    )

    let archivePath = join(root, 'website.tgz')
    await tar.c(
      {
        gzip: true,
        cwd: join(root, 'source'),
        file: archivePath,
      },
      ['gistajs-website-dev'],
    )

    let bytes = await readFile(archivePath)
    let response = new Response(new Blob([bytes]))
    globalThis.fetch = async () => response

    let projectRoot = join(root, 'demo')
    await createProject(sampleCatalog[0]!, {
      projectName: 'demo',
      targetDir: projectRoot,
      install: false,
      git: false,
    })

    let pkg = JSON.parse(
      await readFile(join(projectRoot, 'package.json'), 'utf8'),
    )
    expect(pkg.name).toBe('demo')
  })
})

describe('diffStarter', () => {
  it('resolves starter tag names with the starter prefix', () => {
    expect(resolveStarterTagName('auth', '2026-03-29-001')).toBe(
      'auth/2026-03-29-001',
    )
  })

  it('builds the starter repo url from the catalog entry', () => {
    expect(getStarterRepoUrl(sampleCatalog[2]!)).toBe(
      'https://github.com/gistajs/auth.git',
    )
  })

  it('fetches both tags and diffs them by tag ref', async () => {
    let run = vi.fn().mockResolvedValue(undefined)
    let runOutput = vi.fn().mockResolvedValue(' package.json | 2 +-')
    let rm = vi.fn().mockResolvedValue(undefined)

    let output = await diffStarter(
      sampleCatalog[2]!,
      {
        starter: 'auth',
        fromReleaseKey: '2026-03-28-001',
        toReleaseKey: '2026-03-29-001',
      },
      {
        mkdtemp: vi.fn().mockResolvedValue('/tmp/gistajs-diff-test'),
        rm,
        run,
        runOutput,
      },
    )

    expect(output).toBe(' package.json | 2 +-')
    expect(run.mock.calls).toEqual([
      ['git', ['init', '-q'], '/tmp/gistajs-diff-test'],
      [
        'git',
        ['remote', 'add', 'origin', 'https://github.com/gistajs/auth.git'],
        '/tmp/gistajs-diff-test',
      ],
      [
        'git',
        [
          'fetch',
          '--quiet',
          '--no-tags',
          'origin',
          'refs/tags/auth/2026-03-28-001:refs/tags/auth/2026-03-28-001',
        ],
        '/tmp/gistajs-diff-test',
      ],
      [
        'git',
        [
          'fetch',
          '--quiet',
          '--no-tags',
          'origin',
          'refs/tags/auth/2026-03-29-001:refs/tags/auth/2026-03-29-001',
        ],
        '/tmp/gistajs-diff-test',
      ],
    ])
    expect(runOutput).toHaveBeenCalledWith(
      'git',
      [
        'diff',
        '--stat',
        'refs/tags/auth/2026-03-28-001',
        'refs/tags/auth/2026-03-29-001',
      ],
      '/tmp/gistajs-diff-test',
    )
    expect(rm).toHaveBeenCalledWith('/tmp/gistajs-diff-test', {
      recursive: true,
      force: true,
    })
  })
})

describe('git identity prompts', () => {
  it('asks for git identity when none is configured', async () => {
    let promptForGitIdentity = vi.fn().mockResolvedValue({
      name: 'Test User',
      email: 'test@example.com',
      saveGlobal: false,
    })

    let git = await import('../src/git.js')
    await git.initGit('/tmp/example', sampleCatalog[0]!, {
      promptForGitIdentity,
      readGitConfig: () => '',
      run: async () => {},
    })

    expect(promptForGitIdentity).toHaveBeenCalled()
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
    expect(error).toHaveBeenNthCalledWith(1, 'Project name is required')
    expect(error).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('Usage:'),
    )
    expect(error).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('gistajs create my-app'),
    )

    process.exitCode = previousExitCode
  })
})
