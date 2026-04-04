import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { createProject } from '../commands/create.js'
import { diffStarter } from '../commands/diff.js'
import {
  readProjectStarterPin,
  writeProjectStarterPin,
} from '../commands/pin.js'
import { provisionTurso } from '../providers/turso.js'
import { loadCatalog } from './catalog.js'
import { promptConfirm, promptForStarter } from './prompt.js'
import { loadStarterRelease } from './releases.js'

type ReadTextFile = (path: string, encoding: 'utf8') => Promise<string>

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
  readFile: ReadTextFile
  stdout: Pick<typeof console, 'log'>
  cwd: string
  getCliVersion: () => Promise<string>
}

async function readCliVersion() {
  let file = await readFile(
    new URL('../../package.json', import.meta.url),
    'utf8',
  )
  let pkg = JSON.parse(file) as { version?: string }

  if (!pkg.version) {
    throw new Error('Could not resolve the installed gistajs version')
  }

  return pkg.version
}

export const defaultDeps: CliDeps = {
  loadCatalog,
  loadStarterRelease,
  createProject,
  diffStarter,
  readProjectStarterPin,
  writeProjectStarterPin,
  provisionTurso,
  promptForStarter,
  promptConfirm,
  readFile,
  stdout: console,
  cwd: process.cwd(),
  getCliVersion: readCliVersion,
}
