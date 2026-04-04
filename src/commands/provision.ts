import type { CliDeps } from '../utils/deps.js'
import type {
  ProvisionOptions,
  ProvisionResult,
  ProvisionStatus,
} from '../utils/types.js'
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
  if (provider === 'turso') {
    await deps.provisionTurso(deps.cwd)
    return
  }

  if (provider === 'vercel') {
    throw new Error('`gistajs provision vercel` is not implemented yet')
  }

  throw new UsageError(`Unknown provider: ${provider}`, 'provision')
}

type ProjectPackage = {
  gistajs?: {
    pin?: string
    providers?: string[]
  }
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

type ProvisionSummary = {
  completed: string[]
  skipped: string[]
  pending: string[]
}

async function runProjectProvision(deps: CliDeps) {
  let pkg = await readProjectPackage(deps)
  let providers = pkg.gistajs?.providers

  if (!providers?.length) {
    throw new Error(
      'Current project does not declare any gistajs providers in package.json',
    )
  }

  let requirement = getProjectCliRequirement(pkg)

  if (!requirement) {
    throw new Error(
      'Current project does not declare gistajs in dependencies or devDependencies',
    )
  }

  let cliVersion = await deps.getCliVersion()
  assertCliVersion(cliVersion, requirement)

  let summary: ProvisionSummary = {
    completed: [],
    skipped: [],
    pending: [],
  }

  for (let provider of providers) {
    if (provider === 'turso') {
      let result = await deps.provisionTurso(deps.cwd)
      recordResult(summary, result)
      continue
    }

    if (provider === 'vercel') {
      deps.stdout.log(
        'Skipping vercel. `gistajs provision vercel` is not implemented yet.',
      )
      summary.pending.push(provider)
      continue
    }

    deps.stdout.log(`Skipping ${provider}. This provider is not supported yet.`)
    summary.pending.push(provider)
  }

  printSummary(summary, deps)
}

async function readProjectPackage(deps: Pick<CliDeps, 'cwd' | 'readFile'>) {
  let path = `${deps.cwd}/package.json`

  try {
    let file = await deps.readFile(path, 'utf8')
    return JSON.parse(file) as ProjectPackage
  } catch (error) {
    let code = (error as NodeJS.ErrnoException).code

    if (code === 'ENOENT') {
      throw new Error(
        'No package.json found. Run this from a Gista.js project directory.',
      )
    }

    if (error instanceof SyntaxError) {
      throw new Error('Could not parse package.json in the current directory.')
    }

    throw error
  }
}

function getProjectCliRequirement(pkg: ProjectPackage) {
  return pkg.devDependencies?.gistajs || pkg.dependencies?.gistajs || ''
}

function recordResult(summary: ProvisionSummary, result: ProvisionResult) {
  if (result.status === 'completed') {
    summary.completed.push(result.provider)
    return
  }

  if (result.status === 'skipped') {
    summary.skipped.push(result.provider)
    return
  }

  summary.pending.push(result.provider)
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
