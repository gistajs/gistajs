type Version = {
  major: number
  minor: number
  patch: number
  prerelease: boolean
}

export function satisfiesVersion(version: string, range: string) {
  let normalized = normalizeRange(range)

  if (!normalized || normalized === '*' || normalized === 'latest') {
    return true
  }

  let parsedVersion = parseVersion(version)

  if (!parsedVersion) {
    return false
  }

  return normalized
    .split('||')
    .map((part) => part.trim())
    .filter(Boolean)
    .some((part) => {
      let comparators = part.split(/\s+/).filter(Boolean)
      return comparators.every((comparator) =>
        satisfiesComparator(parsedVersion, comparator),
      )
    })
}

function normalizeRange(range: string) {
  if (range.startsWith('workspace:')) {
    return range.slice('workspace:'.length)
  }

  return range
}

function parseVersion(value: string) {
  let match = value.match(
    /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/,
  )

  if (!match) {
    return null
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: Boolean(match[4]),
  } satisfies Version
}

function compareVersion(left: Version, right: Version) {
  if (left.major !== right.major) {
    return left.major - right.major
  }

  if (left.minor !== right.minor) {
    return left.minor - right.minor
  }

  return left.patch - right.patch
}

function satisfiesComparator(version: Version, comparator: string) {
  if (comparator === '*') {
    return true
  }

  if (comparator.startsWith('^')) {
    return satisfiesCaret(version, comparator.slice(1))
  }

  if (comparator.startsWith('~')) {
    return satisfiesTilde(version, comparator.slice(1))
  }

  let match = comparator.match(/^(<=|>=|<|>|=)?(.+)$/)
  let operator = match?.[1] || '='
  let target = parseVersion(match?.[2] || '')

  if (!target) {
    return false
  }

  if (version.prerelease && !target.prerelease) {
    return false
  }

  let comparison = compareVersion(version, target)
  let ops: Record<string, (n: number) => boolean> = {
    '=': (n) => n === 0,
    '>=': (n) => n >= 0,
    '<=': (n) => n <= 0,
    '>': (n) => n > 0,
    '<': (n) => n < 0,
  }

  return ops[operator]?.(comparison) ?? false
}

function satisfiesCaret(version: Version, rawTarget: string) {
  let target = parseVersion(rawTarget)

  if (!target || compareVersion(version, target) < 0) {
    return false
  }

  if (version.prerelease && !target.prerelease) {
    return false
  }

  if (target.major > 0) {
    return version.major === target.major
  }

  if (target.minor > 0) {
    return version.major === 0 && version.minor === target.minor
  }

  return (
    version.major === 0 && version.minor === 0 && version.patch === target.patch
  )
}

function satisfiesTilde(version: Version, rawTarget: string) {
  let target = parseVersion(rawTarget)

  if (!target || compareVersion(version, target) < 0) {
    return false
  }

  if (version.prerelease && !target.prerelease) {
    return false
  }

  return version.major === target.major && version.minor === target.minor
}
