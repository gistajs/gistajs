import {
  mkdtemp,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import process from 'node:process'
import type { ReadEntry } from 'tar'
import * as tar from 'tar'
import { initGit, run } from './git.js'
import type { CreateOptions, StarterSpec } from './types.js'

export async function createProject(
  starter: StarterSpec,
  options: CreateOptions,
) {
  let root = resolve(
    process.cwd(),
    options.targetDir || options.projectName || starter.slug,
  )

  await assertEmptyTarget(root)

  let staging = await mkdtemp(join(tmpdir(), 'gistajs-'))
  let archivePath = join(staging, 'starter.tgz')
  let extractRoot = join(staging, 'extract')

  try {
    await mkdir(extractRoot, { recursive: true })
    await downloadStarter(starter, archivePath)
    await extractStarter(archivePath, extractRoot)

    let extracted = await findExtractedRoot(extractRoot)
    await assertSafeProjectRoot(root)
    await rename(extracted, root)
    await rewritePackageName(root, basename(root))

    if (options.git !== false) {
      await initGit(root, starter)
    }

    if (options.install !== false) {
      await run('pnpm', ['install'], root)
    }

    return root
  } finally {
    await rm(staging, { recursive: true, force: true })
  }
}

export function getStarterTarballUrl(starter: StarterSpec) {
  let defaultBranch = starter.branches[0]

  if (!defaultBranch) {
    throw new Error(`Starter ${starter.slug} has no branches configured`)
  }

  return `https://codeload.github.com/${starter.repo}/tar.gz/refs/heads/${defaultBranch}`
}

async function downloadStarter(starter: StarterSpec, destination: string) {
  let response = await fetch(getStarterTarballUrl(starter))

  if (!response.ok || !response.body) {
    throw new Error(`Failed to download ${starter.slug} starter`)
  }

  let chunks: Buffer[] = []

  for await (let chunk of response.body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  await writeFile(destination, Buffer.concat(chunks))
}

async function extractStarter(archivePath: string, destination: string) {
  await tar.x({
    file: archivePath,
    cwd: destination,
    strict: true,
    onentry: (entry: ReadEntry) => {
      let normalized = entry.path.replace(/\\/g, '/')

      if (normalized.startsWith('/') || normalized.includes('../')) {
        throw new Error(`Unsafe archive entry: ${entry.path}`)
      }
    },
  })
}

async function findExtractedRoot(root: string) {
  let children = await readdir(root, { withFileTypes: true })
  let directories = children.filter((entry) => entry.isDirectory())

  if (directories.length !== 1) {
    throw new Error('Expected one extracted starter directory')
  }

  return join(root, directories[0].name)
}

async function rewritePackageName(root: string, projectName: string) {
  let path = join(root, 'package.json')
  let source = await readFile(path, 'utf8')
  let pkg = JSON.parse(source) as Record<string, unknown>

  if (typeof pkg.name === 'string') {
    pkg.name = projectName
    await writeFile(path, `${JSON.stringify(pkg, null, 2)}\n`)
  }
}

async function assertEmptyTarget(root: string) {
  try {
    await stat(root)
    throw new Error(`Target path already exists: ${root}`)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
}

async function assertSafeProjectRoot(root: string) {
  let parent = dirname(root)
  await mkdir(parent, { recursive: true })
}
