import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as tar from 'tar'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseCatalog } from '../src/catalog.js'
import { parseCreateArgs } from '../src/cli.js'
import { createProject, getStarterTarballUrl } from '../src/create.js'

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
