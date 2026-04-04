import { describe, expect, it } from 'vitest'
import { satisfiesVersion } from '../src/utils/version.js'

describe('satisfiesVersion', () => {
  it('supports exact versions', () => {
    expect(satisfiesVersion('0.1.3', '0.1.3')).toBe(true)
    expect(satisfiesVersion('0.1.2', '0.1.3')).toBe(false)
  })

  it('supports caret ranges', () => {
    expect(satisfiesVersion('0.1.3', '^0.1.3')).toBe(true)
    expect(satisfiesVersion('0.1.9', '^0.1.3')).toBe(true)
    expect(satisfiesVersion('0.2.0', '^0.1.3')).toBe(false)
  })

  it('supports tilde ranges', () => {
    expect(satisfiesVersion('1.4.2', '~1.4.0')).toBe(true)
    expect(satisfiesVersion('1.5.0', '~1.4.0')).toBe(false)
  })

  it('supports comparator ranges', () => {
    expect(satisfiesVersion('0.1.3', '>=0.1.3 <0.2.0')).toBe(true)
    expect(satisfiesVersion('0.2.0', '>=0.1.3 <0.2.0')).toBe(false)
  })

  it('supports workspace-prefixed ranges', () => {
    expect(satisfiesVersion('0.1.3', 'workspace:^0.1.3')).toBe(true)
  })

  it('allows wildcard and latest requirements', () => {
    expect(satisfiesVersion('0.1.3', '*')).toBe(true)
    expect(satisfiesVersion('0.1.3', 'latest')).toBe(true)
  })

  it('returns false for unsupported or invalid version shapes', () => {
    expect(satisfiesVersion('0.1.3', '1.x')).toBe(false)
    expect(satisfiesVersion('0.1.3-beta.1', '^0.1.3')).toBe(false)
    expect(satisfiesVersion('not-a-version', '^0.1.3')).toBe(false)
  })
})
