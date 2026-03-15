import process from 'node:process'
import { loadCatalog } from './catalog.js'
import { createProject } from './create.js'
import { promptForStarter } from './prompt.js'
import type { CreateOptions } from './types.js'

export async function runCli(argv = process.argv.slice(2)) {
  let [command, ...rest] = argv

  if (!command || command === '--help' || command === '-h') {
    printHelp()
    return
  }

  if (command !== 'create') {
    throw new Error(`Unknown command: ${command}`)
  }

  let options = parseCreateArgs(rest)
  let catalog = await loadCatalog(options.catalogUrl)
  let starterName = options.starter || (await promptForStarter(catalog))
  let starter = catalog.find((entry) => entry.slug === starterName)

  if (!starter) {
    throw new Error(`Unknown starter: ${starterName}`)
  }

  if (!options.projectName) {
    throw new Error('Project name is required')
  }

  let root = await createProject(starter, options)
  console.log(`Created ${starter.slug} project in ${root}`)
}

export async function main() {
  try {
    await runCli()
  } catch (error) {
    let message = error instanceof Error ? error.message : String(error)
    console.error(message)
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
      if (!argv[index + 1]) throw new Error('--starter requires a value')
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
      if (!argv[index + 1]) throw new Error('--catalog-url requires a value')
      options.catalogUrl = argv[index + 1]
      index += 1
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  return options
}

function printHelp() {
  console.log(
    [
      'Usage:',
      '  gistajs create <project-name> [--starter <slug>] [--no-install] [--no-git]',
    ].join('\n'),
  )
}
