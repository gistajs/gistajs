import { readFile, writeFile } from 'node:fs/promises'
import process from 'node:process'
import { createProject } from '../commands/create.js'
import { diffStarter } from '../commands/diff.js'
import {
  readProjectStarterPin,
  writeProjectStarterPin,
} from '../commands/pin.js'
import { provisionTurso } from '../providers/turso.js'
import { provisionVercel } from '../providers/vercel.js'
import { loadCatalog } from './catalog.js'
import { promptConfirm, promptForStarter, promptText } from './prompt.js'
import { loadStarterRelease } from './releases.js'
import { assertCommand, run } from './subprocess.js'

declare const __GISTAJS_VERSION__: string

type ReadTextFile = (path: string, encoding: 'utf8') => Promise<string>
type WriteTextFile = (
  path: string,
  data: string,
  encoding: 'utf8',
) => Promise<void>

export type CliDeps = {
  loadCatalog: typeof loadCatalog
  loadStarterRelease: typeof loadStarterRelease
  createProject: typeof createProject
  diffStarter: typeof diffStarter
  readProjectStarterPin: typeof readProjectStarterPin
  writeProjectStarterPin: typeof writeProjectStarterPin
  provisionTurso: typeof provisionTurso
  provisionVercel: typeof provisionVercel
  promptForStarter: typeof promptForStarter
  promptConfirm: typeof promptConfirm
  promptText: typeof promptText
  readFile: ReadTextFile
  writeFile: WriteTextFile
  stdout: Pick<typeof console, 'log'>
  cwd: string
  getCliVersion: () => Promise<string>
  getDefaultProvisionRegion: () => Promise<string | null>
  runProjectCommand: (cwd: string, script: string) => Promise<void>
  assertCommandAvailable: (cwd: string, command: string) => Promise<void>
}

async function readCliVersion() {
  if (!__GISTAJS_VERSION__) {
    throw new Error('Could not resolve the installed gistajs version')
  }

  return __GISTAJS_VERSION__
}

async function runProjectCommand(cwd: string, script: string) {
  await run('pnpm', [script], cwd)
}

async function assertCommandAvailable(cwd: string, command: string) {
  let installHint = installHints[command]

  await assertCommand(
    run,
    cwd,
    command,
    ['--help'],
    installHint
      ? `Required command not found: ${command}. ${installHint}`
      : `Required command not found: ${command}`,
  )
}

const installHints: Record<string, string> = {
  atlas:
    'Install: https://atlasgo.io/guides/evaluation/install. If you have mise installed: `mise use -g atlas`',
  turso: 'Install: https://docs.turso.tech/cli/installation',
  vercel:
    'Install: https://vercel.com/docs/cli. If you have mise installed: `mise use -g npm:vercel`',
}

async function readDefaultProvisionRegion() {
  try {
    let response = await fetch('https://region.turso.io')

    if (!response.ok) return null

    let body = (await response.text()).trim()

    if (!body) return null

    try {
      let parsed = JSON.parse(body) as { server?: string }
      let region = parsed.server?.trim().toLowerCase()
      return region || null
    } catch {
      return body.toLowerCase()
    }
  } catch {
    return null
  }
}

export const defaultDeps: CliDeps = {
  loadCatalog,
  loadStarterRelease,
  createProject,
  diffStarter,
  readProjectStarterPin,
  writeProjectStarterPin,
  provisionTurso,
  provisionVercel,
  promptForStarter,
  promptConfirm,
  promptText,
  readFile,
  writeFile,
  stdout: console,
  cwd: process.cwd(),
  getCliVersion: readCliVersion,
  getDefaultProvisionRegion: readDefaultProvisionRegion,
  runProjectCommand,
  assertCommandAvailable,
}
