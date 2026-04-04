import { cp, readFile, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import process from 'node:process'
import { getEnvVar, setEnvVar } from '../utils/env.js'
import { promptConfirm, promptText } from '../utils/prompt.js'
import { run, runOutput } from '../utils/subprocess.js'
import { parseFirstColumn } from '../utils/table.js'
import type { ProvisionRegion, ProvisionResult } from '../utils/types.js'
import { getSharedRegion } from './regions.js'

type ProvisionDeps = {
  run: typeof run
  runOutput: typeof runOutput
  promptConfirm: typeof promptConfirm
  promptText: typeof promptText
  readFile: typeof readFile
  writeFile: typeof writeFile
  cp: typeof cp
  stdout: Pick<typeof console, 'log'>
  isTTY: boolean
}

const defaultDeps: ProvisionDeps = {
  run,
  runOutput,
  promptConfirm,
  promptText,
  readFile,
  writeFile,
  cp,
  stdout: console,
  isTTY: process.stdin.isTTY,
}

export async function provisionTurso(
  cwd: string,
  region: ProvisionRegion,
  deps: ProvisionDeps = defaultDeps,
): Promise<ProvisionResult> {
  if (!deps.isTTY) {
    throw new Error(
      '`gistajs provision turso` requires an interactive terminal',
    )
  }

  let envPath = join(cwd, '.env')
  let envExamplePath = join(cwd, '.env.example')
  let file = await ensureEnvFile(envPath, envExamplePath, deps)

  let currentUrl = getEnvVar(file, 'DB_URL')
  let currentToken = getEnvVar(file, 'DB_AUTH_TOKEN')

  if (currentUrl) {
    deps.stdout.log('DB_URL is already set in .env')
  }

  if (currentToken) {
    deps.stdout.log('DB_AUTH_TOKEN is already set in .env')
  }

  if (currentUrl || currentToken) {
    let overwrite = await deps.promptConfirm(
      'Overwrite existing DB_URL/DB_AUTH_TOKEN in .env? (y/N) ',
      false,
    )

    if (!overwrite) {
      deps.stdout.log('Cancelled. Existing database credentials were kept.')
      return {
        provider: 'turso',
        status: 'skipped',
      }
    }
  }

  await assertLoggedIn(deps, cwd)

  let orgs = parseOrgTable(await deps.runOutput('turso', ['org', 'list'], cwd))

  if (orgs.length === 0) {
    throw new Error('Could not read any Turso orgs. Check `turso org list`.')
  }

  if (orgs.length > 1) {
    let currentOrg = orgs.find((org) => org.current)
    let slugs = orgs.map((org) => org.slug)
    deps.stdout.log(`\nAvailable orgs: ${slugs.join(', ')}`)
    let answer = await deps.promptText(
      `Org (${currentOrg?.slug ?? slugs[0]}): `,
    )
    let chosen = answer.trim() || currentOrg?.slug || slugs[0]

    if (!slugs.includes(chosen)) {
      throw new Error(`Invalid org. Choose from: ${slugs.join(', ')}`)
    }

    if (!orgs.find((org) => org.slug === chosen)?.current) {
      await deps.run('turso', ['org', 'switch', chosen], cwd)
    }
  }

  let existingDbs = new Set(
    parseFirstColumn(await deps.runOutput('turso', ['db', 'list'], cwd)),
  )
  let groups = parseGroupTable(
    await deps.runOutput('turso', ['group', 'list'], cwd),
  )

  let fallback = basename(cwd).replaceAll('.', '-')
  let name = ''

  while (true) {
    let dbName = await deps.promptText(`Database name (${fallback}): `)
    name = (dbName.trim() || fallback).replaceAll('.', '-')

    if (!existingDbs.has(name)) break

    deps.stdout.log(`Database "${name}" already exists. Pick a different name.`)
  }

  let group = groups.find((entry) =>
    matchesRegion(entry.location, region),
  )?.name

  if (!group) {
    group = `${fallback}-${region.label.toLowerCase().replaceAll(/\s+/g, '-')}`
    deps.stdout.log(
      `No Turso group found in ${region.label}. Creating "${group}"...`,
    )

    try {
      await deps.run(
        'turso',
        ['group', 'create', group, '--location', region.id],
        cwd,
      )
    } catch (error) {
      throw new Error(
        `Could not create a Turso group in ${region.label}. Check \`turso group create\` permissions and try again.`,
      )
    }
  }

  await deps.run('turso', ['db', 'create', name, '--group', group], cwd)

  let url = (
    await deps.runOutput('turso', ['db', 'show', name, '--url'], cwd)
  ).trim()
  let token = (
    await deps.runOutput('turso', ['db', 'tokens', 'create', name], cwd)
  ).trim()

  file = setEnvVar(file, 'DB_URL', url)
  file = setEnvVar(file, 'DB_AUTH_TOKEN', token)
  await deps.writeFile(envPath, file, 'utf8')

  deps.stdout.log('Saved Turso credentials to .env')

  return {
    provider: 'turso',
    status: 'completed',
  }
}

async function ensureEnvFile(
  envPath: string,
  envExamplePath: string,
  deps: Pick<ProvisionDeps, 'cp' | 'readFile' | 'writeFile' | 'stdout'>,
) {
  try {
    return await deps.readFile(envPath, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }

  try {
    await deps.cp(envExamplePath, envPath)
    deps.stdout.log('Created .env from .env.example')
    return await deps.readFile(envPath, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }

  await deps.writeFile(envPath, '', 'utf8')
  deps.stdout.log('Created empty .env')
  return ''
}

async function assertLoggedIn(
  deps: Pick<ProvisionDeps, 'runOutput'>,
  cwd: string,
) {
  try {
    await deps.runOutput('turso', ['auth', 'whoami'], cwd)
  } catch (error) {
    let code = (error as NodeJS.ErrnoException).code

    if (code === 'ENOENT') {
      throw new Error('Required command not found: turso')
    }

    throw new Error('Not logged in. Run `turso auth login` first.')
  }
}

function parseGroupTable(table: string) {
  return table
    .trim()
    .split('\n')
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      let parts = line.split(/\s+/)
      return {
        name: parts[0] || '',
        location: parts[1] || '',
      }
    })
    .filter((group) => group.name)
}

function parseOrgTable(table: string) {
  return table
    .trim()
    .split('\n')
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      let parts = line.split(/\s+/)
      return {
        slug: parts[1] || '',
        current: line.includes('(current)'),
      }
    })
    .filter((org) => org.slug)
}

function matchesRegion(location: string, region: ProvisionRegion) {
  if (!location) return false

  let normalized = location.trim().toLowerCase()

  if (normalized === region.id) return true

  let shared = getSharedRegion(region.id)

  if (!shared) return false

  return (
    normalized === shared.vercel || normalized === shared.label.toLowerCase()
  )
}
