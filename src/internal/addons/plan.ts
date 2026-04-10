import { readFile, stat } from 'node:fs/promises'
import { relative, resolve } from 'node:path'
import type {
  InternalAddonInstallPlan,
  InternalAddonPlanFile,
  InternalAddonSpec,
} from './types.js'

type PlanDeps = {
  readFile: typeof readFile
  stat: typeof stat
}

const defaultDeps: PlanDeps = {
  readFile,
  stat,
}

export async function planInternalAddonInstall(
  projectRoot: string,
  spec: InternalAddonSpec,
  deps: PlanDeps = defaultDeps,
) {
  let root = resolve(projectRoot)
  let files: InternalAddonPlanFile[] = []

  for (let entry of spec.manifest.files) {
    let source = resolve(spec.root, entry.source)
    let target = resolve(root, entry.target)

    assertInsideRoot(root, target, entry.target)
    await assertFileExists(source, deps)

    let effect = await getFileEffect(source, target, deps)
    let blocked = effect === 'change'

    files.push({
      source,
      target,
      effect,
      status: blocked ? 'blocked' : 'ready',
      ...(blocked && {
        reason: 'Target already exists with different contents',
      }),
    })
  }

  return {
    addon: {
      id: spec.manifest.id,
      slug: spec.manifest.slug,
      name: spec.manifest.name,
      description: spec.manifest.description,
      release: spec.manifest.release,
    },
    projectRoot: root,
    files,
    touchpoints: spec.manifest.touchpoints,
    dependencies: spec.manifest.dependencies,
    env: spec.manifest.env,
    blocked: files.some((file) => file.status === 'blocked'),
  } satisfies InternalAddonInstallPlan
}

export function renderInternalAddonInstallPlan(plan: InternalAddonInstallPlan) {
  let lines = [
    `Internal add-on plan: ${plan.addon.name} (${plan.addon.slug}@${plan.addon.release})`,
    '',
  ]

  for (let file of plan.files) {
    let label = `${file.status === 'blocked' ? 'block' : file.effect}`.padEnd(6)
    let target = relative(plan.projectRoot, file.target) || '.'
    let detail =
      file.effect === 'noop' ? 'already matches' : `from ${file.source}`

    lines.push(`${label} ${target} ${detail}`)

    if (file.reason) {
      lines.push(`       ${file.reason}`)
    }
  }

  if (plan.touchpoints.length > 0) {
    lines.push('', 'Manual touchpoints')

    for (let step of plan.touchpoints) {
      lines.push(`manual ${step.path} ${step.description}`)
    }
  }

  if (Object.keys(plan.dependencies).length > 0) {
    lines.push('', 'Dependencies')

    for (let [name, version] of Object.entries(plan.dependencies)) {
      lines.push(`dep    ${name}@${version}`)
    }
  }

  if (plan.env.length > 0) {
    lines.push('', 'Environment')

    for (let name of plan.env) {
      lines.push(`env    ${name}`)
    }
  }

  let creates = countFiles(plan, 'create')
  let changes = countFiles(plan, 'change')
  let noops = countFiles(plan, 'noop')
  lines.push(
    '',
    `Summary: ${creates} create, ${changes} change, ${noops} noop, ${plan.touchpoints.length} manual`,
  )

  return lines.join('\n')
}

async function getFileEffect(
  source: string,
  target: string,
  deps: PlanDeps,
): Promise<InternalAddonPlanFile['effect']> {
  let targetExists = await pathExists(target, deps)
  if (!targetExists) return 'create'

  let [sourceText, targetText] = await Promise.all([
    deps.readFile(source, 'utf8'),
    deps.readFile(target, 'utf8'),
  ])

  return sourceText === targetText ? 'noop' : 'change'
}

async function assertFileExists(path: string, deps: PlanDeps) {
  try {
    let entry = await deps.stat(path)
    if (!entry.isFile()) {
      throw new Error(`Internal add-on source is not a file: ${path}`)
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT') {
      throw new Error(`Internal add-on source file not found: ${path}`)
    }

    throw error
  }
}

async function pathExists(path: string, deps: PlanDeps) {
  try {
    await deps.stat(path)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT') {
      return false
    }

    throw error
  }
}

function assertInsideRoot(root: string, path: string, relativePath: string) {
  if (path === root) return
  if (path.startsWith(root + '/')) return

  throw new Error(
    `Internal add-on target escapes project root: ${relativePath}`,
  )
}

function countFiles(
  plan: InternalAddonInstallPlan,
  effect: InternalAddonPlanFile['effect'],
) {
  return plan.files.filter((file) => file.effect === effect).length
}
