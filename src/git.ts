import { execFileSync, spawn } from 'node:child_process'
import { promptForGitIdentity } from './prompt.js'
import type { StarterSpec } from './types.js'

type GitIdentity = {
  name: string
  email: string
  saveGlobal: boolean
}

type GitDeps = {
  promptForGitIdentity: typeof promptForGitIdentity
  readGitConfig: typeof readGitConfig
  run: typeof run
}

const defaultDeps: GitDeps = {
  promptForGitIdentity,
  readGitConfig,
  run,
}

export async function initGit(
  root: string,
  starter: StarterSpec,
  deps: GitDeps = defaultDeps,
) {
  await git(root, ['init', '-q', '-b', 'main'], deps)
  let identity = await resolveGitIdentity(root, deps)

  if (!identity) {
    identity = await deps.promptForGitIdentity()
    await git(root, ['config', 'user.name', identity.name], deps)
    await git(root, ['config', 'user.email', identity.email], deps)

    if (identity.saveGlobal) {
      await git(root, ['config', '--global', 'user.name', identity.name], deps)
      await git(
        root,
        ['config', '--global', 'user.email', identity.email],
        deps,
      )
    }
  }

  await git(root, ['add', '.'], deps)
  await git(
    root,
    ['commit', '--quiet', '-m', 'Initial commit from gistajs'],
    deps,
  )

  for (let branch of starter.branches.slice(1)) {
    await git(root, ['branch', branch], deps)
  }

  let defaultBranch = starter.branches[0]

  if (defaultBranch && defaultBranch !== 'main') {
    await git(root, ['checkout', '-q', defaultBranch], deps)
  }
}

async function git(cwd: string, args: string[], deps: GitDeps) {
  await deps.run('git', args, cwd)
}

async function resolveGitIdentity(
  cwd: string,
  deps: GitDeps,
): Promise<GitIdentity | null> {
  let name = deps.readGitConfig(cwd, 'user.name')
  let email = deps.readGitConfig(cwd, 'user.email')

  if (!name || !email) return null

  return { name, email, saveGlobal: false }
}

function readGitConfig(cwd: string, key: string) {
  try {
    return execFileSync('git', ['config', '--get', key], {
      cwd,
      encoding: 'utf-8',
    }).trim()
  } catch {
    return ''
  }
}

export async function run(command: string, args: string[], cwd: string) {
  await new Promise<void>((resolve, reject) => {
    let child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
    })

    child.once('error', reject)
    child.once('exit', (code) => {
      if (code === 0) resolve()
      else
        reject(
          new Error(`${command} ${args.join(' ')} exited with code ${code}`),
        )
    })
  })
}
