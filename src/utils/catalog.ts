import type { StarterSpec } from './types.js'

export const DEFAULT_CATALOG_URL = 'https://gistajs.com/manifests/starters.json'

export async function loadCatalog(url = DEFAULT_CATALOG_URL) {
  let response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Catalog request failed: ${response.status}`)
  }

  let data = await response.json()
  return parseCatalog(data)
}

export function parseCatalog(data: unknown): StarterSpec[] {
  if (!Array.isArray(data)) throw new Error('Invalid starter catalog')

  return data.map(parseStarter)
}

function parseStarter(data: unknown): StarterSpec {
  if (!data || typeof data !== 'object') throw new Error('Invalid starter')

  let entry = data as Record<string, unknown>
  let slug = entry.slug
  let repo = entry.repo
  let branches = entry.branches
  let description = entry.description

  if (
    typeof slug !== 'string' ||
    typeof repo !== 'string' ||
    typeof description !== 'string'
  ) {
    throw new Error('Invalid starter entry')
  }

  if (
    !Array.isArray(branches) ||
    branches.length === 0 ||
    branches.some((branch) => typeof branch !== 'string' || !branch)
  ) {
    throw new Error(`Invalid branches for ${slug}`)
  }

  return { slug, repo, branches, description }
}
