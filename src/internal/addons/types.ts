export type InternalAddonFile = {
  source: string
  target: string
}

export type InternalAddonTouchpoint = {
  kind: string
  path: string
  description: string
}

export type InternalAddonManifest = {
  id: string
  slug: string
  name: string
  description: string
  version: string
  files: InternalAddonFile[]
  touchpoints: InternalAddonTouchpoint[]
  dependencies: Record<string, string>
  env: string[]
}

export type InternalAddonSpec = {
  manifestPath: string
  root: string
  manifest: InternalAddonManifest
}

export type InternalAddonPlanFileEffect = 'create' | 'change' | 'noop'
export type InternalAddonPlanFileStatus = 'ready' | 'blocked'

export type InternalAddonPlanFile = {
  source: string
  target: string
  effect: InternalAddonPlanFileEffect
  status: InternalAddonPlanFileStatus
  reason?: string
}

export type InternalAddonInstallPlan = {
  addon: Pick<
    InternalAddonManifest,
    'id' | 'slug' | 'name' | 'description' | 'version'
  >
  projectRoot: string
  files: InternalAddonPlanFile[]
  touchpoints: InternalAddonTouchpoint[]
  dependencies: Record<string, string>
  env: string[]
  blocked: boolean
}
