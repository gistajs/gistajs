import {
  cp,
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
import { c } from '../utils/color.js'
import type { CliDeps } from '../utils/deps.js'
import { initGit } from '../utils/git.js'
import { run } from '../utils/subprocess.js'
import type { CreateOptions, StarterSpec } from '../utils/types.js'
import { UsageError } from './error.js'

type CreateProjectDeps = {
  initGit: typeof initGit
  run: typeof run
}

const defaultCreateProjectDeps: CreateProjectDeps = {
  initGit,
  run,
}

export function parseCreateArgs(argv: string[]): CreateOptions {
  let options: CreateOptions = {}

  for (let index = 0; index < argv.length; index += 1) {
    let arg = argv[index]

    if (!arg) continue

    if (!arg.startsWith('--') && !options.projectName) {
      options.projectName = arg
      continue
    }

    if (arg === '--starter') {
      if (!argv[index + 1]) {
        throw new UsageError('--starter requires a value', 'create')
      }
      options.starter = argv[index + 1]
      index += 1
      continue
    }

    if (arg === '--no-install') {
      options.install = false
      continue
    }

    if (arg === '--no-git') {
      options.git = false
      continue
    }

    if (arg === '--catalog-url') {
      if (!argv[index + 1]) {
        throw new UsageError('--catalog-url requires a value', 'create')
      }
      options.catalogUrl = argv[index + 1]
      index += 1
      continue
    }

    throw new UsageError(`Unknown argument: ${arg}`, 'create')
  }

  return options
}

export async function runCreateCommand(argv: string[], deps: CliDeps) {
  let options = parseCreateArgs(argv)

  if (!options.projectName) {
    throw new UsageError('Project name is required', 'create')
  }

  let catalog = await deps.loadCatalog(options.catalogUrl)
  let starterName = options.starter || (await deps.promptForStarter(catalog))
  let starter = catalog.find((entry) => entry.slug === starterName)

  if (!starter) {
    throw new UsageError(`Unknown starter: ${starterName}`, 'create')
  }

  if (options.git === undefined) {
    options.git = await deps.promptConfirm('Initialize git? (Y/n) ')
  }

  if (options.install === undefined) {
    options.install = await deps.promptConfirm('Install dependencies? (Y/n) ')
  }

  let root = await deps.createProject(starter, options)
  deps.stdout.log(
    `\n  ${c.brand('gistajs')} ${c.success('Created')} ${c.slug(starter.slug)} project in ${c.path(root)}\n`,
  )
}

export async function createProject(
  starter: StarterSpec,
  options: CreateOptions,
  deps: CreateProjectDeps = defaultCreateProjectDeps,
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
    await copyProject(extracted, root)
    await rewritePackageName(root, basename(root))

    if (options.git !== false) {
      await deps.initGit(root, starter)
    }

    if (options.install !== false) {
      await installDependencies(root, deps.run)
    }

    return root
  } finally {
    await cleanupStaging(staging)
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
    strict: false,
    onwarn: (code, message) => {
      if (
        code === 'TAR_ENTRY_INFO' &&
        message.includes('stripping / from absolute linkpath')
      ) {
        return
      }

      throw new Error(message)
    },
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

async function installDependencies(root: string, runCommand: typeof run) {
  try {
    await runCommand('corepack', ['pnpm', 'install'], root)
    return
  } catch (error) {
    if (!isCommandNotFound(error)) {
      throw error
    }
  }

  try {
    await runCommand('pnpm', ['install'], root)
  } catch (error) {
    if (!isCommandNotFound(error)) {
      throw error
    }

    throw new Error(
      'Could not install dependencies because neither corepack nor pnpm is available. Install Node.js with corepack enabled, or install pnpm and rerun the command.',
    )
  }
}

function getErrorCode(error: unknown) {
  return (error as NodeJS.ErrnoException | undefined)?.code
}

function isCommandNotFound(error: unknown) {
  return getErrorCode(error) === 'ENOENT'
}

async function copyProject(source: string, destination: string) {
  try {
    await rename(source, destination)
    return
  } catch (error) {
    if (!shouldFallbackToCopy(error)) throw error
  }

  await cp(source, destination, {
    recursive: true,
    force: false,
    errorOnExist: true,
  })
}

function shouldFallbackToCopy(error: unknown) {
  let code = getErrorCode(error)
  return code === 'EXDEV' || code === 'EPERM' || code === 'ENOTEMPTY'
}

async function cleanupStaging(root: string) {
  try {
    await rm(root, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    })
  } catch {
    // Temp cleanup should never turn a successful scaffold into a failure.
  }
}

async function assertEmptyTarget(root: string) {
  try {
    await stat(root)
    throw new Error(`Target path already exists: ${root}`)
  } catch (error) {
    if (getErrorCode(error) !== 'ENOENT') throw error
  }
}

async function assertSafeProjectRoot(root: string) {
  let parent = dirname(root)
  await mkdir(parent, { recursive: true })
}
