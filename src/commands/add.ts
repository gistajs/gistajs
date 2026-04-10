import { stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { loadInternalAddonManifest } from '../internal/addons/manifest.js'
import {
  planInternalAddonInstall,
  renderInternalAddonInstallPlan,
} from '../internal/addons/plan.js'
import type { CliDeps } from '../utils/deps.js'
import { UsageError } from './error.js'

export function parseAddArgs(argv: string[]) {
  let source: string | undefined

  for (let index = 0; index < argv.length; index += 1) {
    let arg = argv[index]

    if (!arg) continue

    if (!arg.startsWith('--') && !source) {
      source = arg
      continue
    }

    throw new UsageError(`Unknown argument: ${arg}`, 'add')
  }

  if (!source) {
    throw new UsageError('Add-on source is required', 'add')
  }

  return { source }
}

export async function runAddCommand(argv: string[], deps: CliDeps) {
  let options = parseAddArgs(argv)
  let manifestPath = await resolveManifestPath(options.source)
  let spec = await loadInternalAddonManifest(manifestPath)
  let plan = await planInternalAddonInstall(deps.cwd, spec)

  deps.stdout.log(renderInternalAddonInstallPlan(plan))
}

async function resolveManifestPath(source: string) {
  let path = resolve(source)
  let entry

  try {
    entry = await stat(path)
  } catch (error) {
    if ((error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT') {
      throw new Error(`Add-on source not found: ${source}`)
    }

    throw error
  }

  if (entry.isDirectory()) {
    let manifestPath = resolve(path, 'gista.manifest.json')

    try {
      await stat(manifestPath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT') {
        throw new Error(`No gista.manifest.json found in: ${source}`)
      }

      throw error
    }

    return manifestPath
  }

  return path
}
