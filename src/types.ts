export type StarterSpec = {
  slug: string
  repo: string
  branches: string[]
  description: string
}

export type CreateOptions = {
  projectName?: string
  starter?: string
  targetDir?: string
  install?: boolean
  git?: boolean
  catalogUrl?: string
}
