import {
  getDefaultSharedRegion,
  getSharedRegion,
  sharedRegions,
} from '../providers/regions.js'
import type { CliDeps } from '../utils/deps.js'
import { readProjectPackage } from '../utils/package.js'
import type { ProvisionOptions, ProvisionStatus } from '../utils/types.js'
import { satisfiesVersion } from '../utils/version.js'
import { UsageError } from './error.js'

export function parseProvisionArgs(argv: string[]): ProvisionOptions {
  let options: ProvisionOptions = {}

  for (let index = 0; index < argv.length; index += 1) {
    let arg = argv[index]

    if (!arg) continue

    if (!arg.startsWith('--') && !options.provider) {
      options.provider = arg
      continue
    }

    throw new UsageError(`Unknown argument: ${arg}`, 'provision')
  }

  return options
}

export async function runProvisionCommand(argv: string[], deps: CliDeps) {
  let options = parseProvisionArgs(argv)

  if (!options.provider) {
    await runProjectProvision(deps)
    return
  }

  await runProviderProvision(options.provider, deps)
}

async function runProviderProvision(provider: string, deps: CliDeps) {
  if (provider !== 'turso' && provider !== 'vercel') {
    throw new UsageError(`Unknown provider: ${provider}`, 'provision')
  }

  let pkg = await readProvisionPackage(deps)
  let region = await resolveProjectRegion(pkg, deps)
  await writeProjectRegion(pkg, region.id, deps)

  if (provider === 'turso') {
    await deps.provisionTurso(deps.cwd, region)
    return
  }

  if (provider === 'vercel') {
    await deps.provisionVercel(deps.cwd, region)
    return
  }
}

type ProjectPackage = Record<string, unknown> & {
  gistajs?: {
    pin?: string
    providers?: string[]
    region?: string
  }
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

type ProvisionSummary = Record<ProvisionStatus, string[]>

async function runProjectProvision(deps: CliDeps) {
  let pkg = await readProvisionPackage(deps)
  let providers = pkg.gistajs?.providers

  if (!providers?.length) {
    throw new Error(
      'Current project does not declare any gistajs providers in package.json',
    )
  }

  let requirement =
    pkg.devDependencies?.gistajs || pkg.dependencies?.gistajs || ''

  if (!requirement) {
    throw new Error(
      'Current project does not declare gistajs in dependencies or devDependencies',
    )
  }

  let cliVersion = await deps.getCliVersion()
  assertCliVersion(cliVersion, requirement)
  let region = await resolveProjectRegion(pkg, deps)
  await writeProjectRegion(pkg, region.id, deps)

  let summary: ProvisionSummary = {
    completed: [],
    skipped: [],
    pending: [],
  }

  for (let provider of providers) {
    if (provider === 'turso') {
      let result = await deps.provisionTurso(deps.cwd, region)
      summary[result.status].push(result.provider)
      continue
    }

    if (provider === 'vercel') {
      let result = await deps.provisionVercel(deps.cwd, region)
      summary[result.status].push(result.provider)
      continue
    }

    deps.stdout.log(`Skipping ${provider}. This provider is not supported yet.`)
    summary.pending.push(provider)
  }

  printSummary(summary, deps)
}

async function readProvisionPackage(deps: Pick<CliDeps, 'cwd' | 'readFile'>) {
  return (await readProjectPackage(deps.cwd, deps.readFile)) as ProjectPackage
}

async function writeProjectRegion(
  pkg: ProjectPackage,
  region: string,
  deps: Pick<CliDeps, 'cwd' | 'writeFile'>,
) {
  let nextPkg = {
    ...pkg,
    gistajs: {
      ...(pkg.gistajs || {}),
      region,
    },
  }

  await deps.writeFile(
    `${deps.cwd}/package.json`,
    `${JSON.stringify(nextPkg, null, 2)}\n`,
    'utf8',
  )
}

async function resolveProjectRegion(
  pkg: ProjectPackage,
  deps: Pick<CliDeps, 'getDefaultProvisionRegion' | 'promptText' | 'stdout'>,
) {
  let current = pkg.gistajs?.region ? getSharedRegion(pkg.gistajs.region) : null
  let fallback = current || (await getPromptDefaultRegion(deps))
  let labels = sharedRegions.map((region) => region.label).join(', ')

  deps.stdout.log(`Available regions: ${labels}`)

  if (pkg.gistajs?.region && !current) {
    deps.stdout.log(
      `Current region "${pkg.gistajs.region}" is no longer supported. Choose a new shared region.`,
    )
  }

  while (true) {
    let answer = await deps.promptText(`Region (${fallback.label}): `)
    let selected = getSharedRegion(answer.trim() || fallback.id)

    if (selected) return selected

    deps.stdout.log(`Invalid region. Choose from: ${labels}`)
  }
}

async function getPromptDefaultRegion(
  deps: Pick<CliDeps, 'getDefaultProvisionRegion'>,
) {
  let nearest = await deps.getDefaultProvisionRegion()

  if (nearest) {
    let region = getSharedRegion(nearest)
    if (region) return region
  }

  return getDefaultSharedRegion()
}

function printSummary(
  summary: ProvisionSummary,
  deps: Pick<CliDeps, 'stdout'>,
) {
  deps.stdout.log('')
  deps.stdout.log('Provision summary')
  deps.stdout.log(`completed: ${formatSummaryList(summary.completed)}`)
  deps.stdout.log(`skipped: ${formatSummaryList(summary.skipped)}`)
  deps.stdout.log(`pending: ${formatSummaryList(summary.pending)}`)
}

function formatSummaryList(values: string[]) {
  return values.length > 0 ? values.join(', ') : 'none'
}

function assertCliVersion(version: string, range: string) {
  if (satisfiesVersion(version, range)) {
    return
  }

  throw new Error(
    `Installed gistajs version ${version} does not satisfy project requirement ${range}. Run \`pnpm up gistajs\`.`,
  )
}
