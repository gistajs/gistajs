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
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

type ProvisionSummary = Record<ProvisionStatus, string[]>

type ProjectProvisionDeps = Pick<
  CliDeps,
  | 'cwd'
  | 'assertCommandAvailable'
  | 'getCliVersion'
  | 'getDefaultProvisionRegion'
  | 'promptConfirm'
  | 'promptText'
  | 'provisionTurso'
  | 'provisionVercel'
  | 'readFile'
  | 'runProjectCommand'
  | 'stdout'
  | 'writeFile'
>

async function runProjectProvision(deps: ProjectProvisionDeps) {
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
  await assertProviderCommands(providers, deps)
  let region = await resolveProjectRegion(pkg, deps)
  await writeProjectRegion(pkg, region.id, deps)

  let summary: ProvisionSummary = {
    completed: [],
    skipped: [],
    pending: [],
  }
  let shouldOfferPrepProd =
    providers.includes('turso') &&
    providers.includes('vercel') &&
    Boolean(pkg.scripts?.['prep:prod'])
  let ranPrepProd = false

  for (let provider of providers) {
    if (provider === 'turso') {
      let result = await deps.provisionTurso(deps.cwd, region)
      summary[result.status].push(result.provider)
      continue
    }

    if (provider === 'vercel') {
      if (shouldOfferPrepProd && !ranPrepProd) {
        let ran = await maybeRunProductionSetup(deps)
        summary[ran ? 'completed' : 'skipped'].push('prep:prod')
        ranPrepProd = true
      }

      let result = await deps.provisionVercel(deps.cwd, region)
      summary[result.status].push(result.provider)
      continue
    }

    deps.stdout.log(`Skipping ${provider}. This provider is not supported yet.`)
    summary.pending.push(provider)
  }

  printSummary(summary, deps)
}

async function assertProviderCommands(
  providers: string[],
  deps: Pick<CliDeps, 'assertCommandAvailable' | 'cwd'>,
) {
  let commands = providers.filter(
    (provider): provider is 'turso' | 'vercel' =>
      provider === 'turso' || provider === 'vercel',
  )

  for (let command of new Set(commands)) {
    await deps.assertCommandAvailable(deps.cwd, command)
  }
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

async function maybeRunProductionSetup(
  deps: Pick<CliDeps, 'cwd' | 'promptConfirm' | 'runProjectCommand'>,
) {
  let shouldRun = await deps.promptConfirm('Run production setup now? (Y/n) ')

  if (!shouldRun) return false

  try {
    await deps.runProjectCommand(deps.cwd, 'prep:prod')
  } catch {
    throw new Error('Production setup failed. Run `pnpm prep:prod` manually.')
  }

  return true
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
