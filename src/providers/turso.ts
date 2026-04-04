import { cp, readFile, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import process from 'node:process'
import { promptConfirm, promptText } from '../utils/prompt.js'
import { run, runOutput } from '../utils/subprocess.js'

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
  deps: ProvisionDeps = defaultDeps,
) {
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
      return
    }
  }

  await assertCommand(
    deps,
    cwd,
    'turso',
    ['auth', 'status'],
    'Not logged in. Run `turso auth login` first.',
  )

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
  let groups = parseFirstColumn(
    await deps.runOutput('turso', ['group', 'list'], cwd),
  )

  if (groups.length === 0) {
    throw new Error(
      'Could not read any Turso groups. Create one first or check `turso group list`.',
    )
  }

  let fallback = basename(cwd).replaceAll('.', '-')
  let name = ''

  while (true) {
    let dbName = await deps.promptText(`Database name (${fallback}): `)
    name = (dbName.trim() || fallback).replaceAll('.', '-')

    if (!existingDbs.has(name)) break

    deps.stdout.log(`Database "${name}" already exists. Pick a different name.`)
  }

  let group = groups[0]

  if (groups.length > 1) {
    deps.stdout.log(`\nAvailable groups: ${groups.join(', ')}`)

    while (true) {
      let answer = await deps.promptText(`Group (${groups[0]}): `)
      group = answer.trim() || groups[0]

      if (groups.includes(group)) break

      deps.stdout.log(`Invalid group. Choose from: ${groups.join(', ')}`)
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

async function assertCommand(
  deps: Pick<ProvisionDeps, 'run'>,
  cwd: string,
  command: string,
  args: string[],
  failureMessage: string,
) {
  try {
    await deps.run(command, args, cwd)
  } catch (error) {
    let code = (error as NodeJS.ErrnoException).code

    if (code === 'ENOENT') {
      throw new Error(`Required command not found: ${command}`)
    }

    throw new Error(failureMessage)
  }
}

function getEnvVar(file: string, key: string) {
  return file.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1]?.trim() ?? ''
}

function setEnvVar(file: string, key: string, value: string) {
  if (file.match(new RegExp(`^${key}=.*$`, 'm'))) {
    return file.replace(new RegExp(`^${key}=.*$`, 'm'), `${key}=${value}`)
  }

  return `${file.trimEnd()}\n${key}=${value}\n`
}

function parseFirstColumn(table: string) {
  return table
    .trim()
    .split('\n')
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\s+/)[0])
    .filter(Boolean)
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
