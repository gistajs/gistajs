export type StarterSpec = {
  slug: string
  repo: string
  branches: string[]
  description: string
}

export type StarterReleaseSpec = {
  slug: string
  latest: string | null
  releases: string[]
}

export type CreateOptions = {
  projectName?: string
  starter?: string
  targetDir?: string
  install?: boolean
  git?: boolean
  catalogUrl?: string
}

export type DiffOptions = {
  starter?: string
  fromReleaseKey?: string
  toReleaseKey?: string
  latest?: boolean
  stat?: boolean
  catalogUrl?: string
}

export type PinOptions = {
  releaseKey?: string
}

export type ProvisionProvider = 'turso' | 'vercel'

export type ProvisionStatus = 'completed' | 'skipped' | 'pending'

export type ProvisionOptions = {
  provider?: ProvisionProvider | string
}

export type ProvisionRegion = {
  id: string
  label: string
  vercel: string
}

export type ProvisionResult = {
  provider: ProvisionProvider | string
  status: ProvisionStatus
}
