import type { CliDeps } from '../utils/deps.js'
import type { ProvisionOptions } from '../utils/types.js'
import { UsageError } from './error.js'
import { getHelpText } from './help.js'

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

export async function runProvisionCommand(argv: string[], deps: CliDeps) {
  if (argv.length === 0) {
    deps.stdout.log(getHelpText('provision'))
    return
  }

  let options = parseProvisionArgs(argv)

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
