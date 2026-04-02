import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  readProjectStarterPin,
  splitProjectStarterPin,
  writeProjectStarterPin,
} from '../src/pin.js'

let tempRoots: string[] = []

afterEach(async () => {
  let { rm } = await import('node:fs/promises')

  for (let root of tempRoots) {
    await rm(root, { recursive: true, force: true })
  }

  tempRoots = []
})

describe('project pin helpers', () => {
  it('splits a project starter pin', () => {
    expect(splitProjectStarterPin('auth:2026-03-29-001')).toEqual({
      pin: 'auth:2026-03-29-001',
      starter: 'auth',
      releaseKey: '2026-03-29-001',
    })
  })

  it('writes and reads a project starter pin', async () => {
    let root = await mkdtemp(join(tmpdir(), 'gistajs-test-'))
    tempRoots.push(root)
    await writeFile(
      join(root, 'package.json'),
      `${JSON.stringify({ name: 'demo', private: true }, null, 2)}\n`,
    )

    await writeProjectStarterPin(root, 'auth:2026-03-29-001')

    expect(await readProjectStarterPin(root)).toEqual({
      pin: 'auth:2026-03-29-001',
      starter: 'auth',
      releaseKey: '2026-03-29-001',
    })
  })

  it('fails clearly for malformed project pin metadata', async () => {
    let root = await mkdtemp(join(tmpdir(), 'gistajs-test-'))
    tempRoots.push(root)
    await writeFile(
      join(root, 'package.json'),
      `${JSON.stringify({ name: 'demo', gistajs: { pin: 'bad' } }, null, 2)}\n`,
    )

    await expect(readProjectStarterPin(root)).rejects.toThrow(
      'Invalid package.json gistajs.pin "bad". Expected "<starter>:<release-key>".',
    )
  })
})
