import process from 'node:process'
import { loadCatalog } from './catalog.js'
import { c, logo } from './color.js'
import { createProject } from './create.js'
import { diffStarter } from './diff.js'
import { readProjectStarterPin, writeProjectStarterPin } from './pin.js'
import { promptConfirm, promptForStarter } from './prompt.js'
import { provisionTurso } from './providers/turso.js'
import { loadStarterRelease, validateStarterReleaseKey } from './releases.js'
import type {
  CreateOptions,
  DiffOptions,
  PinOptions,
  ProvisionOptions,
} from './types.js'

export type CliDeps = {
  loadCatalog: typeof loadCatalog
  loadStarterRelease: typeof loadStarterRelease
  createProject: typeof createProject
  diffStarter: typeof diffStarter
  readProjectStarterPin: typeof readProjectStarterPin
  writeProjectStarterPin: typeof writeProjectStarterPin
  provisionTurso: typeof provisionTurso
  promptForStarter: typeof promptForStarter
  promptConfirm: typeof promptConfirm
  stdout: Pick<typeof console, 'log'>
  cwd: string
}

const defaultDeps: CliDeps = {
  loadCatalog,
  loadStarterRelease,
  createProject,
  diffStarter,
  readProjectStarterPin,
  writeProjectStarterPin,
  provisionTurso,
  promptForStarter,
  promptConfirm,
  stdout: console,
  cwd: process.cwd(),
}

class UsageError extends Error {
  command?: string
  constructor(message: string, command?: string) {
    super(message)
    this.name = 'UsageError'
    this.command = command
  }
}

export async function runCli(
  argv = process.argv.slice(2),
  deps: CliDeps = defaultDeps,
) {
  let [command, ...rest] = argv

  if (!command || command === '--help' || command === '-h') {
    deps.stdout.log(getHelpText())
    return
  }

  if (command === 'logo') {
    deps.stdout.log('\n' + logo() + '\n')
    return
  }

  if (command === 'create') {
    let options = parseCreateArgs(rest)
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
    return
  }

  if (command === 'diff') {
    if (rest.length === 0) {
      deps.stdout.log(getHelpText('diff'))
      return
    }

    let options = parseDiffArgs(rest)

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
    return
  }

  if (command === 'pin') {
    let options = parsePinArgs(rest)

    if (!options.releaseKey) {
      throw new UsageError('Release key is required', 'pin')
    }

    let projectPin = await deps.readProjectStarterPin(deps.cwd)
    let release = await deps.loadStarterRelease(projectPin.starter)
    validateStarterReleaseKey(release, options.releaseKey)

    let nextPin = `${projectPin.starter}:${options.releaseKey}`
    let written = await deps.writeProjectStarterPin(deps.cwd, nextPin)
    deps.stdout.log(`Pinned ${written.starter} to ${written.releaseKey}`)
    return
  }

  if (command === 'provision') {
    if (rest.length === 0) {
      deps.stdout.log(getHelpText('provision'))
      return
    }

    let options = parseProvisionArgs(rest)

    if (!options.provider) {
      throw new UsageError('Provider is required', 'provision')
    }

    if (options.provider === 'turso') {
      await deps.provisionTurso(deps.cwd)
      return
    }

    if (options.provider === 'vercel') {
      throw new Error('`gistajs provision vercel` is not implemented yet')
    }

    throw new UsageError(`Unknown provider: ${options.provider}`, 'provision')
  }

  throw new UsageError(`Unknown command: ${command}`)
}

export async function main() {
  try {
    await runCli()
  } catch (error) {
    let message = error instanceof Error ? error.message : String(error)
    console.error(`${c.errorLabel('error:')} ${c.error(message)}`)
    if (error instanceof UsageError) {
      console.error(getHelpText(error.command))
    }
    process.exitCode = 1
  }
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
      if (!argv[index + 1])
        throw new UsageError('--starter requires a value', 'create')
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

export function parsePinArgs(argv: string[]): PinOptions {
  let options: PinOptions = {}

  for (let index = 0; index < argv.length; index += 1) {
    let arg = argv[index]

    if (!arg) continue

    if (!arg.startsWith('--') && !options.releaseKey) {
      options.releaseKey = arg
      continue
    }

    throw new UsageError(`Unknown argument: ${arg}`, 'pin')
  }

  return options
}

export function parseProvisionArgs(argv: string[]): ProvisionOptions {
  let options: ProvisionOptions = {}

  for (let index = 0; index < argv.length; index += 1) {
    let arg = argv[index]

    if (!arg) continue

    if (!arg.startsWith('--') && !options.provider) {
      options.provider = arg
      continue
    }

    throw new UsageError(`Unknown argument: ${arg}`, 'provision')
  }

  return options
}

function getHelpText(command?: string) {
  let header = `  ${c.brand('gistajs')} ${c.dim('— scaffold and manage Gista.js starter projects')}`

  if (command === 'create') {
    return [
      '',
      header,
      '',
      `  ${c.bold('Usage:')}`,
      `    ${c.dim('$')} ${c.bold('gistajs create')} <project-name> [--starter <slug>] [--no-install] [--no-git]`,
      '',
      `  ${c.bold('Examples:')}`,
      `    ${c.dim('$')} gistajs create my-app`,
      `    ${c.dim('$')} gistajs create my-app --starter website`,
      '',
    ].join('\n')
  }

  if (command === 'diff') {
    return [
      '',
      header,
      '',
      `  ${c.bold('Usage:')}`,
      `    ${c.dim('$')} ${c.bold('gistajs diff')} --latest [--stat]`,
      `    ${c.dim('$')} ${c.bold('gistajs diff')} <starter> <from-release-key> <to-release-key> [--stat]`,
      '',
      `  ${c.bold('Examples:')}`,
      `    ${c.dim('$')} gistajs diff --latest`,
      `    ${c.dim('$')} gistajs diff --latest --stat`,
      `    ${c.dim('$')} gistajs diff auth 2026-03-28-001 2026-03-29-001`,
      `    ${c.dim('$')} gistajs diff auth 2026-03-28-001 2026-03-29-001 --stat`,
      '',
    ].join('\n')
  }

  if (command === 'pin') {
    return [
      '',
      header,
      '',
      `  ${c.bold('Usage:')}`,
      `    ${c.dim('$')} ${c.bold('gistajs pin')} <release-key>`,
      '',
      `  ${c.bold('Examples:')}`,
      `    ${c.dim('$')} gistajs pin 2026-04-01-001`,
      '',
    ].join('\n')
  }

  if (command === 'provision') {
    return [
      '',
      header,
      '',
      `  ${c.bold('Usage:')}`,
      `    ${c.dim('$')} ${c.bold('gistajs provision')} <provider>`,
      '',
      `  ${c.bold('Providers:')}`,
      `    turso    Create a Turso database and save credentials to .env`,
      `    vercel   Reserved for deployment provisioning`,
      '',
      `  ${c.bold('Examples:')}`,
      `    ${c.dim('$')} gistajs provision turso`,
      '',
    ].join('\n')
  }

  return [
    '',
    header,
    '',
    `  ${c.bold('Usage:')}`,
    `    ${c.dim('$')} ${c.bold('gistajs create')} <project-name> [--starter <slug>] [--no-install] [--no-git]`,
    `    ${c.dim('$')} ${c.bold('gistajs diff')} --latest [--stat]`,
    `    ${c.dim('$')} ${c.bold('gistajs diff')} <starter> <from-release-key> <to-release-key> [--stat]`,
    `    ${c.dim('$')} ${c.bold('gistajs pin')} <release-key>`,
    `    ${c.dim('$')} ${c.bold('gistajs provision')} <provider>`,
    '',
    `  ${c.bold('Examples:')}`,
    `    ${c.dim('$')} gistajs create my-app`,
    `    ${c.dim('$')} gistajs create my-app --starter website`,
    `    ${c.dim('$')} gistajs diff --latest`,
    `    ${c.dim('$')} gistajs diff --latest --stat`,
    `    ${c.dim('$')} gistajs diff auth 2026-03-28-001 2026-03-29-001`,
    `    ${c.dim('$')} gistajs diff auth 2026-03-28-001 2026-03-29-001 --stat`,
    `    ${c.dim('$')} gistajs pin 2026-04-01-001`,
    `    ${c.dim('$')} gistajs provision turso`,
    '',
  ].join('\n')
}
