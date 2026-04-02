import { describe, expect, it } from 'vitest'
import {
  parseStarterRelease,
  validateStarterReleaseKey,
} from '../src/releases.js'

let sampleRelease = parseStarterRelease({
  slug: 'auth',
  latest: '2026-03-29-001',
  releases: ['2026-03-29-001', '2026-03-28-001', '2026-03-27-001'],
})

describe('starter releases', () => {
  it('parses a starter release manifest entry', () => {
    expect(sampleRelease).toEqual({
      slug: 'auth',
      latest: '2026-03-29-001',
      releases: ['2026-03-29-001', '2026-03-28-001', '2026-03-27-001'],
    })
  })

  it('validates a release key for a starter', () => {
    expect(validateStarterReleaseKey(sampleRelease, '2026-03-28-001')).toBe(
      '2026-03-28-001',
    )
  })

  it('rejects invalid starter and release combinations', () => {
    expect(() =>
      validateStarterReleaseKey(sampleRelease, '2026-03-30-001'),
    ).toThrow('Release key "2026-03-30-001" does not apply to starter "auth"')
  })
})
