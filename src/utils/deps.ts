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
}

async function readCliVersion() {
  if (!__GISTAJS_VERSION__) {
    throw new Error('Could not resolve the installed gistajs version')
  }

  return __GISTAJS_VERSION__
}

async function readDefaultProvisionRegion() {
  try {
    let response = await fetch('https://region.turso.io')

    if (!response.ok) return null

    let region = (await response.text()).trim().toLowerCase()
    return region || null
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
}
