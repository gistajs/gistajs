import type { StarterReleaseSpec } from './types.js'

export const DEFAULT_RELEASES_BASE_URL =
  'https://gistajs.com/manifests/starters'

export async function loadStarterRelease(
  starter: string,
  baseUrl = DEFAULT_RELEASES_BASE_URL,
) {
  let url = `${baseUrl}/${starter}.json`
  let response = await fetch(url)

  if (!response.ok) {
    throw new Error(
      `Starter release request failed for "${starter}": ${response.status}`,
    )
  }

  let data = await response.json()
  return parseStarterRelease(data)
}

export function validateStarterReleaseKey(
  release: StarterReleaseSpec,
  releaseKey: string,
) {
  if (!release.releases.includes(releaseKey)) {
    throw new Error(
      `Release key "${releaseKey}" does not apply to starter "${release.slug}"`,
    )
  }

  return releaseKey
}

export function parseStarterRelease(data: unknown): StarterReleaseSpec {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Invalid starter release entry')
  }

  let entry = data as Record<string, unknown>
  let slug = entry.slug
  let latest = entry.latest
  let releases = entry.releases

  if (typeof slug !== 'string' || !slug) {
    throw new Error('Invalid starter release slug')
  }

  if (latest !== null && (typeof latest !== 'string' || !latest)) {
    throw new Error(`Invalid latest release for ${slug}`)
  }

  if (
    !Array.isArray(releases) ||
    releases.some((releaseKey) => typeof releaseKey !== 'string' || !releaseKey)
  ) {
    throw new Error(`Invalid releases for ${slug}`)
  }

  if (latest && releases[0] !== latest) {
    throw new Error(`Latest release for ${slug} must match the first release`)
  }

  return {
    slug,
    latest,
    releases: [...releases],
  }
}
