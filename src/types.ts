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
