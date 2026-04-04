import { existsSync } from 'node:fs'
import { readFile as readFileFs } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'
import { getRequiredEnvVar } from '../utils/env.js'
import { run, runInput, runOutput } from '../utils/subprocess.js'
import { parseFirstColumn } from '../utils/table.js'
import type { ProvisionRegion, ProvisionResult } from '../utils/types.js'

type ProvisionDeps = {
  run: typeof run
  runInput: typeof runInput
  runOutput: typeof runOutput
  readFile: typeof readFileFs
  existsSync: typeof existsSync
  stdout: Pick<typeof console, 'log'>
  isTTY: boolean
}

const defaultDeps: ProvisionDeps = {
  run,
  runInput,
  runOutput,
  readFile: readFileFs,
  existsSync,
  stdout: console,
  isTTY: process.stdin.isTTY,
}

const requiredEnvVars = ['COOKIE_SECRET', 'DB_URL', 'DB_AUTH_TOKEN']

export async function provisionVercel(
  cwd: string,
  region: ProvisionRegion,
  deps: ProvisionDeps = defaultDeps,
): Promise<ProvisionResult> {
  if (!deps.isTTY) {
    throw new Error(
      '`gistajs provision vercel` requires an interactive terminal',
    )
  }

  await assertLoggedIn(deps, cwd)

  if (!deps.existsSync(join(cwd, '.vercel', 'project.json'))) {
    deps.stdout.log('Linking this directory to a Vercel project...')
    await deps.run('vercel', ['link'], cwd)
  }

  let envPath = join(cwd, '.env')
  let file = await readEnvFile(envPath, deps)
  let values = requiredEnvVars.map((key) => [key, getRequiredEnvVar(file, key)])
  let existing = parseFirstColumn(
    await deps.runOutput('vercel', ['env', 'ls', 'production'], cwd),
  )

  for (let [key, value] of values) {
    let args = existing.includes(key)
      ? ['env', 'update', key, 'production', '--yes']
      : ['env', 'add', key, 'production', '--force']

    await deps.runInput('vercel', args, cwd, `${value}\n`)
  }

  deps.stdout.log(
    `Set your Vercel function region to ${region.label} in project settings if you want it to match Turso.`,
  )
  deps.stdout.log('Saved COOKIE_SECRET, DB_URL, and DB_AUTH_TOKEN to Vercel.')

  return {
    provider: 'vercel',
    status: 'completed',
  }
}

async function readEnvFile(
  envPath: string,
  deps: Pick<ProvisionDeps, 'readFile'>,
) {
  try {
    return await deps.readFile(envPath, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(
        'Missing .env. Run `pnpm prep` and `gistajs provision` first.',
      )
    }

    throw error
  }
}

async function assertLoggedIn(
  deps: Pick<ProvisionDeps, 'runOutput'>,
  cwd: string,
) {
  try {
    await deps.runOutput('vercel', ['whoami'], cwd)
  } catch (error) {
    let code = (error as NodeJS.ErrnoException).code

    if (code === 'ENOENT') {
      throw new Error('Required command not found: vercel')
    }

    throw new Error('Not logged in. Run `vercel login` first.')
  }
}
