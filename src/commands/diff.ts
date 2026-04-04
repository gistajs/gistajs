import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { CliDeps } from '../utils/deps.js'
import { validateStarterReleaseKey } from '../utils/releases.js'
import { run, runOutput } from '../utils/subprocess.js'
import type { DiffOptions, StarterSpec } from '../utils/types.js'
import { UsageError } from './error.js'
import { getHelpText } from './help.js'

type DiffDeps = {
  mkdtemp: typeof mkdtemp
  rm: typeof rm
  run: typeof run
  runOutput: typeof runOutput
}

const defaultDiffDeps: DiffDeps = {
  mkdtemp,
  rm,
  run,
  runOutput,
}

export function parseDiffArgs(argv: string[]): DiffOptions {
  let options: DiffOptions = {}

  for (let index = 0; index < argv.length; index += 1) {
    let arg = argv[index]

    if (!arg) continue

    if (!arg.startsWith('--') && !options.starter) {
      options.starter = arg
      continue
    }

    if (!arg.startsWith('--') && !options.fromReleaseKey) {
      options.fromReleaseKey = arg
      continue
    }

    if (!arg.startsWith('--') && !options.toReleaseKey) {
      options.toReleaseKey = arg
      continue
    }

    if (arg === '--stat') {
      options.stat = true
      continue
    }

    if (arg === '--latest') {
      options.latest = true
      continue
    }

    if (arg === '--catalog-url') {
      if (!argv[index + 1]) {
        throw new UsageError('--catalog-url requires a value', 'diff')
      }
      options.catalogUrl = argv[index + 1]
      index += 1
      continue
    }

    throw new UsageError(`Unknown argument: ${arg}`, 'diff')
  }

  return options
}

export async function runDiffCommand(argv: string[], deps: CliDeps) {
  if (argv.length === 0) {
    deps.stdout.log(getHelpText('diff'))
    return
  }

  let options = parseDiffArgs(argv)

  if (options.latest) {
    if (options.starter || options.fromReleaseKey || options.toReleaseKey) {
      throw new UsageError(
        '--latest does not take positional arguments',
        'diff',
      )
    }

    let projectPin = await deps.readProjectStarterPin(deps.cwd)
    let catalog = await deps.loadCatalog(options.catalogUrl)
    let starter = catalog.find((entry) => entry.slug === projectPin.starter)

    if (!starter) {
      throw new UsageError(`Unknown starter: ${projectPin.starter}`, 'diff')
    }

    let release = await deps.loadStarterRelease(starter.slug)
    validateStarterReleaseKey(release, projectPin.releaseKey)

    if (!release.latest) {
      throw new Error(`Starter "${starter.slug}" has no published releases`)
    }

    if (projectPin.releaseKey === release.latest) {
      deps.stdout.log(
        `Already pinned to latest ${starter.slug} release ${release.latest}`,
      )
      return
    }

    let output = await deps.diffStarter(starter, {
      ...options,
      starter: starter.slug,
      fromReleaseKey: projectPin.releaseKey,
      toReleaseKey: release.latest,
    })
    deps.stdout.log(output.trimEnd())
    return
  }

  if (!options.starter) {
    throw new UsageError('Starter is required', 'diff')
  }

  if (!options.fromReleaseKey) {
    throw new UsageError('From release key is required', 'diff')
  }

  if (!options.toReleaseKey) {
    throw new UsageError('To release key is required', 'diff')
  }

  let catalog = await deps.loadCatalog(options.catalogUrl)
  let starter = catalog.find((entry) => entry.slug === options.starter)

  if (!starter) {
    throw new UsageError(`Unknown starter: ${options.starter}`, 'diff')
  }

  let release = await deps.loadStarterRelease(starter.slug)
  validateStarterReleaseKey(release, options.fromReleaseKey)
  validateStarterReleaseKey(release, options.toReleaseKey)

  let output = await deps.diffStarter(starter, options)
  deps.stdout.log(output.trimEnd())
}

export async function diffStarter(
  starter: StarterSpec,
  options: DiffOptions,
  deps: DiffDeps = defaultDiffDeps,
) {
  if (!options.fromReleaseKey || !options.toReleaseKey) {
    throw new Error('Diff requires both from and to release keys')
  }

  let root = await deps.mkdtemp(join(tmpdir(), 'gistajs-diff-'))
  let repoUrl = getStarterRepoUrl(starter)
  let fromTag = resolveStarterTagName(starter.slug, options.fromReleaseKey)
  let toTag = resolveStarterTagName(starter.slug, options.toReleaseKey)

  try {
    await git(root, ['init', '-q'], deps)
    await git(root, ['remote', 'add', 'origin', repoUrl], deps)
    await fetchTag(root, fromTag, repoUrl, deps)
    await fetchTag(root, toTag, repoUrl, deps)

    let diffArgs = ['diff']
    if (options.stat) diffArgs.push('--stat')
    diffArgs.push(`refs/tags/${fromTag}`, `refs/tags/${toTag}`)

    return await gitOutput(root, diffArgs, repoUrl, deps)
  } finally {
    await deps.rm(root, { recursive: true, force: true })
  }
}

export function resolveStarterTagName(starter: string, releaseKey: string) {
  return `${starter}/${releaseKey}`
}

export function getStarterRepoUrl(starter: StarterSpec) {
  return `https://github.com/${starter.repo}.git`
}

async function fetchTag(
  cwd: string,
  tag: string,
  repoUrl: string,
  deps: DiffDeps,
) {
  try {
    await git(
      cwd,
      [
        'fetch',
        '--quiet',
        '--no-tags',
        'origin',
        `refs/tags/${tag}:refs/tags/${tag}`,
      ],
      deps,
    )
  } catch (error) {
    throw new Error(
      `Failed to fetch tag ${tag} from ${repoUrl}: ${getErrorMessage(error)}`,
    )
  }
}

async function git(cwd: string, args: string[], deps: DiffDeps) {
  await deps.run('git', args, cwd)
}

async function gitOutput(
  cwd: string,
  args: string[],
  repoUrl: string,
  deps: DiffDeps,
) {
  try {
    return await deps.runOutput('git', args, cwd)
  } catch (error) {
    throw new Error(
      `Failed to diff starter snapshots from ${repoUrl}: ${getErrorMessage(error)}`,
    )
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
