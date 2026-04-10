import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import type { InternalAddonSpec } from './types.js'

type ReadManifestDeps = {
  readFile: typeof readFile
}

const defaultDeps: ReadManifestDeps = {
  readFile,
}

export async function loadInternalAddonManifest(
  manifestPath: string,
  deps: ReadManifestDeps = defaultDeps,
) {
  let source = await deps.readFile(manifestPath, 'utf8')
  let value = JSON.parse(source) as unknown

  return parseInternalAddonManifest(value, manifestPath)
}

export function parseInternalAddonManifest(
  value: unknown,
  manifestPath: string,
): InternalAddonSpec {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Internal add-on manifest must be a JSON object')
  }

  let raw = value as Record<string, unknown>
  let files = parseFiles(raw.files)
  let touchpoints = parseTouchpoints(raw.touchpoints)
  let dependencies = parseDependencies(raw.dependencies)
  let env = parseEnv(raw.env)

  return {
    manifestPath: resolve(manifestPath),
    root: dirname(resolve(manifestPath)),
    manifest: {
      id: readString(raw.id, 'id'),
      slug: readString(raw.slug, 'slug'),
      name: readString(raw.name, 'name'),
      description: readString(raw.description, 'description'),
      version: readString(raw.version, 'version'),
      files,
      touchpoints,
      dependencies,
      env,
    },
  }
}

function parseFiles(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('Internal add-on manifest requires a non-empty files array')
  }

  return value.map((entry, index) => {
    if (typeof entry === 'string') {
      let path = readRelativePath(entry, `files[${index}]`)
      return {
        source: path,
        target: path,
      }
    }

    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(
        `Internal add-on manifest file[${index}] must be a string or object`,
      )
    }

    let raw = entry as Record<string, unknown>
    return {
      source: readRelativePath(raw.source, `files[${index}].source`),
      target: readRelativePath(raw.target, `files[${index}].target`),
    }
  })
}

function parseTouchpoints(value: unknown) {
  if (value === undefined) return []
  if (!Array.isArray(value)) {
    throw new Error('Internal add-on manifest touchpoints must be an array')
  }

  return value.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(
        `Internal add-on manifest touchpoint[${index}] must be an object`,
      )
    }

    let raw = entry as Record<string, unknown>
    return {
      kind: readString(raw.kind, `touchpoints[${index}].kind`),
      path: readRelativePath(raw.path, `touchpoints[${index}].path`),
      description: readString(
        raw.description,
        `touchpoints[${index}].description`,
      ),
    }
  })
}

function parseDependencies(value: unknown) {
  if (value === undefined) return {}
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Internal add-on manifest dependencies must be an object')
  }

  let entries = Object.entries(value as Record<string, unknown>)
  let deps: Record<string, string> = {}

  for (let [name, version] of entries) {
    if (typeof version !== 'string' || version.length === 0) {
      throw new Error(`Internal add-on dependency ${name} must be a string`)
    }
    deps[name] = version
  }

  return deps
}

function parseEnv(value: unknown) {
  if (value === undefined) return []
  if (!Array.isArray(value)) {
    throw new Error('Internal add-on manifest env must be an array')
  }

  return value.map((entry, index) => readString(entry, `env[${index}]`))
}

function readString(value: unknown, field: string) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(
      `Internal add-on manifest ${field} must be a non-empty string`,
    )
  }

  return value
}

function readRelativePath(value: unknown, field: string) {
  let path = readString(value, field)

  if (path.startsWith('/') || path.includes('..')) {
    throw new Error(
      `Internal add-on manifest ${field} must stay within its root`,
    )
  }

  return path
}
