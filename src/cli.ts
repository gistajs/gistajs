import process from 'node:process'
import { loadCatalog } from './catalog.js'
import { createProject } from './create.js'
import { promptForStarter } from './prompt.js'
import type { CreateOptions } from './types.js'

type CliDeps = {
  loadCatalog: typeof loadCatalog
  createProject: typeof createProject
  promptForStarter: typeof promptForStarter
  stdout: Pick<typeof console, 'log'>
}

const defaultDeps: CliDeps = {
  loadCatalog,
  createProject,
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

  if (command !== 'create') {
    throw new UsageError(`Unknown command: ${command}`)
  }

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
  deps.stdout.log(`Created ${starter.slug} project in ${root}`)
}

export async function main() {
  try {
    await runCli()
  } catch (error) {
    let message = error instanceof Error ? error.message : String(error)
    console.error(message)
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

function getHelpText() {
  return [
    'Usage:',
    '  gistajs create <project-name> [--starter <slug>] [--no-install] [--no-git]',
    '',
    'Examples:',
    '  gistajs create my-app',
    '  gistajs create my-app --starter website',
    '',
    'Run `gistajs` with no arguments to show this help.',
  ].join('\n')
}
