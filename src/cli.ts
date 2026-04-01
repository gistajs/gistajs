import process from 'node:process'
import { loadCatalog } from './catalog.js'
import { c, logo } from './color.js'
import { createProject } from './create.js'
import { diffStarter } from './diff.js'
import { promptForStarter } from './prompt.js'
import type { CreateOptions, DiffOptions } from './types.js'

type CliDeps = {
  loadCatalog: typeof loadCatalog
  createProject: typeof createProject
  diffStarter: typeof diffStarter
  promptForStarter: typeof promptForStarter
  stdout: Pick<typeof console, 'log'>
}

const defaultDeps: CliDeps = {
  loadCatalog,
  createProject,
  diffStarter,
  promptForStarter,
  stdout: console,
}

class UsageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UsageError'
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
      throw new UsageError('Project name is required')
    }

    let catalog = await deps.loadCatalog(options.catalogUrl)
    let starterName = options.starter || (await deps.promptForStarter(catalog))
    let starter = catalog.find((entry) => entry.slug === starterName)

    if (!starter) {
      throw new UsageError(`Unknown starter: ${starterName}`)
    }

    let root = await deps.createProject(starter, options)
    deps.stdout.log(
      `\n  ${c.brand('gistajs')} ${c.success('Created')} ${c.slug(starter.slug)} project in ${c.path(root)}\n`,
    )
    return
  }

  if (command === 'diff') {
    let options = parseDiffArgs(rest)

    if (!options.starter) {
      throw new UsageError('Starter is required')
    }

    if (!options.fromReleaseKey) {
      throw new UsageError('From release key is required')
    }

    if (!options.toReleaseKey) {
      throw new UsageError('To release key is required')
    }

    let catalog = await deps.loadCatalog(options.catalogUrl)
    let starter = catalog.find((entry) => entry.slug === options.starter)

    if (!starter) {
      throw new UsageError(`Unknown starter: ${options.starter}`)
    }

    let output = await deps.diffStarter(starter, options)
    deps.stdout.log(output.trimEnd())
    return
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
      console.error(getHelpText())
    }
    process.exitCode = 1
  }
}

export function parseCreateArgs(argv: string[]): CreateOptions {
  let options: CreateOptions = {
    install: true,
    git: true,
  }

  for (let index = 0; index < argv.length; index += 1) {
    let arg = argv[index]

    if (!arg) continue

    if (!arg.startsWith('--') && !options.projectName) {
      options.projectName = arg
      continue
    }

    if (arg === '--starter') {
      if (!argv[index + 1]) throw new UsageError('--starter requires a value')
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
        throw new UsageError('--catalog-url requires a value')
      }
      options.catalogUrl = argv[index + 1]
      index += 1
      continue
    }

    throw new UsageError(`Unknown argument: ${arg}`)
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

    if (arg === '--catalog-url') {
      if (!argv[index + 1]) {
        throw new UsageError('--catalog-url requires a value')
      }
      options.catalogUrl = argv[index + 1]
      index += 1
      continue
    }

    throw new UsageError(`Unknown argument: ${arg}`)
  }

  return options
}

function getHelpText() {
  return [
    '',
    `  ${c.brand('gistajs')} ${c.dim('— scaffold Gista.js starter projects')}`,
    '',
    `  ${c.bold('Usage:')}`,
    `    ${c.dim('$')} ${c.bold('gistajs create')} <project-name> [--starter <slug>] [--no-install] [--no-git]`,
    `    ${c.dim('$')} ${c.bold('gistajs diff')} <starter> <from-release-key> <to-release-key>`,
    '',
    `  ${c.bold('Examples:')}`,
    `    ${c.dim('$')} gistajs create my-app`,
    `    ${c.dim('$')} gistajs create my-app --starter website`,
    `    ${c.dim('$')} gistajs diff auth 2026-03-28-001 2026-03-29-001`,
    '',
  ].join('\n')
}
