import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as tar from 'tar'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createProject, getStarterTarballUrl } from '../src/commands/create.js'
import { parseCatalog } from '../src/utils/catalog.js'

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
])

afterEach(async () => {
  let { rm } = await import('node:fs/promises')

  for (let root of tempRoots) {
    await rm(root, { recursive: true, force: true })
  }

  tempRoots = []
  vi.restoreAllMocks()
})

describe('getStarterTarballUrl', () => {
  it('builds the codeload URL from the starter repo', () => {
    expect(getStarterTarballUrl(sampleCatalog[1]!)).toBe(
      'https://codeload.github.com/gistajs/db/tar.gz/refs/heads/dev',
    )
  })
})

describe('createProject', () => {
  it('extracts a starter archive, rewrites the package name, and preserves the starter pin', async () => {
    let root = await prepareStarterArchive()
    let projectRoot = join(root, 'demo')

    await createProject(
      sampleCatalog[0]!,
      {
        projectName: 'demo',
        targetDir: projectRoot,
        install: false,
        git: false,
      },
      {
        initGit: vi.fn(),
        promptConfirm: vi.fn(),
        run: vi.fn(),
        stdout: { log: vi.fn() },
      },
    )

    let pkg = JSON.parse(
      await readFile(join(projectRoot, 'package.json'), 'utf8'),
    )
    expect(pkg.name).toBe('demo')
    expect(pkg.gistajs).toEqual({ pin: 'website:2026-03-30-001' })
  })

  it('prefers corepack pnpm for dependency installation', async () => {
    let root = await prepareStarterArchive()
    let run = vi.fn().mockResolvedValue(undefined)
    let projectRoot = join(root, 'demo')

    await createProject(
      sampleCatalog[0]!,
      {
        projectName: 'demo',
        targetDir: projectRoot,
        install: true,
        git: false,
      },
      {
        initGit: vi.fn(),
        promptConfirm: vi.fn().mockResolvedValue(false),
        run,
        stdout: { log: vi.fn() },
      },
    )

    expect(run).toHaveBeenCalledWith(
      'corepack',
      ['pnpm', 'install'],
      projectRoot,
    )
  })

  it('falls back to global pnpm when corepack is unavailable', async () => {
    let root = await prepareStarterArchive()
    let run = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('missing'), { code: 'ENOENT' }),
      )
      .mockResolvedValueOnce(undefined)
    let projectRoot = join(root, 'demo')

    await createProject(
      sampleCatalog[0]!,
      {
        projectName: 'demo',
        targetDir: projectRoot,
        install: true,
        git: false,
      },
      {
        initGit: vi.fn(),
        promptConfirm: vi.fn().mockResolvedValue(false),
        run,
        stdout: { log: vi.fn() },
      },
    )

    expect(run.mock.calls).toEqual([
      ['corepack', ['pnpm', 'install'], projectRoot],
      ['pnpm', ['install'], projectRoot],
    ])
  })

  it('shows a clear error when neither corepack nor pnpm is available', async () => {
    let root = await prepareStarterArchive()
    let run = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('missing'), { code: 'ENOENT' }),
      )
      .mockRejectedValueOnce(
        Object.assign(new Error('missing'), { code: 'ENOENT' }),
      )
    let projectRoot = join(root, 'demo')

    await expect(
      createProject(
        sampleCatalog[0]!,
        {
          projectName: 'demo',
          targetDir: projectRoot,
          install: true,
          git: false,
        },
        {
          initGit: vi.fn(),
          promptConfirm: vi.fn(),
          run,
          stdout: { log: vi.fn() },
        },
      ),
    ).rejects.toThrow(
      'Could not run pnpm install because neither corepack nor pnpm is available.',
    )
  })

  it('prompts to run prep after install when the starter defines it', async () => {
    let root = await prepareStarterArchive({
      scripts: {
        prep: 'node scripts/prep.js',
      },
    })
    let run = vi.fn().mockResolvedValue(undefined)
    let promptConfirm = vi.fn().mockResolvedValue(true)
    let projectRoot = join(root, 'demo')

    await createProject(
      sampleCatalog[0]!,
      {
        projectName: 'demo',
        targetDir: projectRoot,
        install: true,
        git: false,
      },
      {
        initGit: vi.fn(),
        promptConfirm,
        run,
        stdout: { log: vi.fn() },
      },
    )

    expect(promptConfirm).toHaveBeenCalledWith('Run project setup now? (Y/n) ')
    expect(run.mock.calls).toEqual([
      ['corepack', ['pnpm', 'install'], projectRoot],
      ['corepack', ['pnpm', 'prep'], projectRoot],
    ])
  })

  it('skips prep when the prompt is declined', async () => {
    let root = await prepareStarterArchive({
      scripts: {
        prep: 'node scripts/prep.js',
      },
    })
    let run = vi.fn().mockResolvedValue(undefined)
    let promptConfirm = vi.fn().mockResolvedValue(false)
    let projectRoot = join(root, 'demo')

    await createProject(
      sampleCatalog[0]!,
      {
        projectName: 'demo',
        targetDir: projectRoot,
        install: true,
        git: false,
      },
      {
        initGit: vi.fn(),
        promptConfirm,
        run,
        stdout: { log: vi.fn() },
      },
    )

    expect(promptConfirm).toHaveBeenCalledOnce()
    expect(run.mock.calls).toEqual([
      ['corepack', ['pnpm', 'install'], projectRoot],
    ])
  })

  it('does not prompt for prep when the starter does not define it', async () => {
    let root = await prepareStarterArchive()
    let run = vi.fn().mockResolvedValue(undefined)
    let promptConfirm = vi.fn()
    let projectRoot = join(root, 'demo')

    await createProject(
      sampleCatalog[0]!,
      {
        projectName: 'demo',
        targetDir: projectRoot,
        install: true,
        git: false,
      },
      {
        initGit: vi.fn(),
        promptConfirm,
        run,
        stdout: { log: vi.fn() },
      },
    )

    expect(promptConfirm).not.toHaveBeenCalled()
    expect(run.mock.calls).toEqual([
      ['corepack', ['pnpm', 'install'], projectRoot],
    ])
  })

  it('does not prompt for prep when install is skipped', async () => {
    let root = await prepareStarterArchive({
      scripts: {
        prep: 'node scripts/prep.js',
      },
    })
    let promptConfirm = vi.fn()
    let projectRoot = join(root, 'demo')

    await createProject(
      sampleCatalog[0]!,
      {
        projectName: 'demo',
        targetDir: projectRoot,
        install: false,
        git: false,
      },
      {
        initGit: vi.fn(),
        promptConfirm,
        run: vi.fn(),
        stdout: { log: vi.fn() },
      },
    )

    expect(promptConfirm).not.toHaveBeenCalled()
  })

  it('falls back to global pnpm for prep when corepack is unavailable', async () => {
    let root = await prepareStarterArchive({
      scripts: {
        prep: 'node scripts/prep.js',
      },
    })
    let run = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(
        Object.assign(new Error('missing'), { code: 'ENOENT' }),
      )
      .mockResolvedValueOnce(undefined)
    let projectRoot = join(root, 'demo')

    await createProject(
      sampleCatalog[0]!,
      {
        projectName: 'demo',
        targetDir: projectRoot,
        install: true,
        git: false,
      },
      {
        initGit: vi.fn(),
        promptConfirm: vi.fn().mockResolvedValue(true),
        run,
        stdout: { log: vi.fn() },
      },
    )

    expect(run.mock.calls).toEqual([
      ['corepack', ['pnpm', 'install'], projectRoot],
      ['corepack', ['pnpm', 'prep'], projectRoot],
      ['pnpm', ['prep'], projectRoot],
    ])
  })

  it('warns and continues when prep fails', async () => {
    let root = await prepareStarterArchive({
      scripts: {
        prep: 'node scripts/prep.js',
      },
    })
    let stdout = { log: vi.fn() }
    let run = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('prep failed'))
    let projectRoot = join(root, 'demo')

    await expect(
      createProject(
        sampleCatalog[0]!,
        {
          projectName: 'demo',
          targetDir: projectRoot,
          install: true,
          git: false,
        },
        {
          initGit: vi.fn(),
          promptConfirm: vi.fn().mockResolvedValue(true),
          run,
          stdout,
        },
      ),
    ).resolves.toBe(projectRoot)

    expect(stdout.log).toHaveBeenCalledWith(
      expect.stringContaining('Project setup failed. prep failed'),
    )
    expect(stdout.log).toHaveBeenCalledWith(
      expect.stringContaining(`cd ${projectRoot} && pnpm prep`),
    )
  })
})

async function prepareStarterArchive(
  overrides: {
    scripts?: Record<string, string>
  } = {},
) {
  let root = await mkdtemp(join(tmpdir(), 'gistajs-test-'))
  tempRoots.push(root)

  let sourceRoot = join(root, 'source', 'gistajs-website-dev')
  await mkdir(sourceRoot, { recursive: true })
  await writeFile(
    join(sourceRoot, 'package.json'),
    `${JSON.stringify(
      {
        name: 'website',
        ...(overrides.scripts ? { scripts: overrides.scripts } : {}),
        gistajs: { pin: 'website:2026-03-30-001' },
      },
      null,
      2,
    )}\n`,
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
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(response)

  return root
}
