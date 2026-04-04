import process from 'node:process'
import { runCreateCommand } from './commands/create.js'
import { runDiffCommand } from './commands/diff.js'
import { UsageError } from './commands/error.js'
import { getHelpText } from './commands/help.js'
import { runPinCommand } from './commands/pin.js'
import { runProvisionCommand } from './commands/provision.js'
import { c, logo } from './utils/color.js'
import { defaultDeps } from './utils/deps.js'

export type { CliDeps } from './utils/deps.js'

export async function runCli(argv = process.argv.slice(2), deps = defaultDeps) {
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
    await runCreateCommand(rest, deps)
    return
  }

  if (command === 'diff') {
    await runDiffCommand(rest, deps)
    return
  }

  if (command === 'pin') {
    await runPinCommand(rest, deps)
    return
  }

  if (command === 'provision') {
    await runProvisionCommand(rest, deps)
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
      console.error(getHelpText(error.command))
    }
    process.exitCode = 1
  }
}
