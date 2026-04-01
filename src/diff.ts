import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { run, runOutput } from './subprocess.js'
import type { DiffOptions, StarterSpec } from './types.js'

type DiffDeps = {
  mkdtemp: typeof mkdtemp
  rm: typeof rm
  run: typeof run
  runOutput: typeof runOutput
}

const defaultDeps: DiffDeps = {
  mkdtemp,
  rm,
  run,
  runOutput,
}

export async function diffStarter(
  starter: StarterSpec,
  options: DiffOptions,
  deps: DiffDeps = defaultDeps,
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
