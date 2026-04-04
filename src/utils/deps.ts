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
  stdout: console,
  cwd: process.cwd(),
}
