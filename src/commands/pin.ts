import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { CliDeps } from '../utils/deps.js'
import { validateStarterReleaseKey } from '../utils/releases.js'
import type { PinOptions } from '../utils/types.js'
import { UsageError } from './error.js'

type ProjectPackage = Record<string, unknown>

export type ProjectStarterPin = {
  pin: string
  starter: string
  releaseKey: string
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

export async function runPinCommand(argv: string[], deps: CliDeps) {
  let options = parsePinArgs(argv)

  if (!options.releaseKey) {
    throw new UsageError('Release key is required', 'pin')
  }

  let projectPin = await deps.readProjectStarterPin(deps.cwd)
  let release = await deps.loadStarterRelease(projectPin.starter)
  validateStarterReleaseKey(release, options.releaseKey)

  let nextPin = `${projectPin.starter}:${options.releaseKey}`
  let written = await deps.writeProjectStarterPin(deps.cwd, nextPin)
  deps.stdout.log(`Pinned ${written.starter} to ${written.releaseKey}`)
}

export function splitProjectStarterPin(pin: string): ProjectStarterPin {
  if (typeof pin !== 'string' || pin.trim() === '') {
    throw new Error(
      'Expected package.json gistajs.pin to be a non-empty string like "auth:2026-03-29-001"',
    )
  }

  let [starter, releaseKey, extra] = pin.split(':')

  if (!starter || !releaseKey || extra) {
    throw new Error(
      `Invalid package.json gistajs.pin "${pin}". Expected "<starter>:<release-key>".`,
    )
  }

  return { pin, starter, releaseKey }
}

export async function readProjectStarterPin(root: string) {
  let pkg = await readProjectPackage(root)
  let gistajs = pkg.gistajs

  if (!gistajs || typeof gistajs !== 'object' || Array.isArray(gistajs)) {
    throw new Error(
      'Missing package.json gistajs metadata. Expected gistajs.pin like "auth:2026-03-29-001".',
    )
  }

  let pin = (gistajs as Record<string, unknown>).pin

  if (typeof pin !== 'string') {
    throw new Error(
      'Missing package.json gistajs.pin. Expected "<starter>:<release-key>".',
    )
  }

  return splitProjectStarterPin(pin)
}

export async function writeProjectStarterPin(root: string, pin: string) {
  let pkg = await readProjectPackage(root)
  let parsed = splitProjectStarterPin(pin)
  let gistajs =
    pkg.gistajs &&
    typeof pkg.gistajs === 'object' &&
    !Array.isArray(pkg.gistajs)
      ? { ...(pkg.gistajs as Record<string, unknown>) }
      : {}

  gistajs.pin = parsed.pin

  await writeFile(
    join(root, 'package.json'),
    `${JSON.stringify({ ...pkg, gistajs }, null, 2)}\n`,
  )

  return parsed
}

async function readProjectPackage(root: string): Promise<ProjectPackage> {
  let path = join(root, 'package.json')
  let source: string

  try {
    source = await readFile(path, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT') {
      throw new Error(`Could not find package.json in ${root}`)
    }

    throw error
  }

  try {
    let pkg = JSON.parse(source)

    if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg)) {
      throw new Error('package.json must contain a JSON object')
    }

    return pkg as ProjectPackage
  } catch (error) {
    let message = error instanceof Error ? error.message : String(error)
    throw new Error(`Invalid package.json: ${message}`)
  }
}
