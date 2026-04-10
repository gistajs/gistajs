import { readFile, stat } from 'node:fs/promises'
import { relative, resolve } from 'node:path'
import { c } from '../../utils/color.js'
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

const LABEL_WIDTH = 8
const DETAIL_PREFIX = ' '.repeat(LABEL_WIDTH + 1)

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
    addonRoot: spec.root,
    files,
    touchpoints: spec.manifest.touchpoints,
    dependencies: spec.manifest.dependencies,
    env: spec.manifest.env,
    blocked: files.some((file) => file.status === 'blocked'),
  } satisfies InternalAddonInstallPlan
}

export function renderInternalAddonInstallPlan(plan: InternalAddonInstallPlan) {
  let lines = [
    `${c.bold('Add-on plan')} ${c.bold(plan.addon.name)} ${c.dim(`(${plan.addon.slug}@${plan.addon.release})`)}`,
    '',
  ]

  for (let file of plan.files) {
    let label = formatFileLabel(file)
    let target = relative(plan.projectRoot, file.target) || '.'
    let source = relative(plan.addonRoot, file.source) || '.'

    lines.push(`${label} ${c.path(target)}`)

    if (file.effect === 'noop') {
      lines.push(`${DETAIL_PREFIX}${c.dim('already matches')}`)
    } else if (source !== target) {
      lines.push(`${DETAIL_PREFIX}${c.dim('from')} ${c.dim(source)}`)
    }

    if (file.reason) {
      lines.push(`${DETAIL_PREFIX}${c.error(file.reason)}`)
    }
  }

  if (plan.touchpoints.length > 0) {
    lines.push('', c.bold('Manual touchpoints'), '')

    for (let step of plan.touchpoints) {
      lines.push(`${formatSectionLabel('manual')} ${c.path(step.path)}`)
      lines.push(`${DETAIL_PREFIX}${c.dim(step.description)}`)
    }
  }

  if (Object.keys(plan.dependencies).length > 0) {
    lines.push('', c.bold('Dependencies'))

    for (let [name, version] of Object.entries(plan.dependencies)) {
      lines.push(`${formatSectionLabel('dep')} ${name}@${version}`)
    }
  }

  if (plan.env.length > 0) {
    lines.push('', c.bold('Environment'))

    for (let name of plan.env) {
      lines.push(`${formatSectionLabel('env')} ${name}`)
    }
  }

  let creates = countFiles(plan, 'create')
  let changes = countFiles(plan, 'change')
  let noops = countFiles(plan, 'noop')
  lines.push(
    '',
    `${c.bold('Summary')} ${c.bold(String(creates))} create, ${c.bold(String(changes))} change, ${c.bold(String(noops))} noop, ${c.bold(String(plan.touchpoints.length))} manual`,
  )

  return lines.join('\n')
}

function formatFileLabel(file: InternalAddonPlanFile) {
  let label =
    file.status === 'blocked'
      ? 'blocked'
      : file.effect === 'create'
        ? 'create'
        : file.effect === 'change'
          ? 'change'
          : 'noop'

  let text = label.padEnd(LABEL_WIDTH)

  if (file.status === 'blocked') {
    return c.errorLabel(text)
  }

  if (file.effect === 'create') {
    return c.success(text)
  }

  if (file.effect === 'change') {
    return c.warn(text)
  }

  return c.dim(text)
}

function formatSectionLabel(label: string) {
  return c.info(label.padEnd(LABEL_WIDTH))
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
