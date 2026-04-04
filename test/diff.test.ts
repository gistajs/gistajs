import { describe, expect, it, vi } from 'vitest'
import { diffStarter } from '../src/commands/diff.js'
import { parseCatalog } from '../src/utils/catalog.js'

let sampleCatalog = parseCatalog([
  {
    slug: 'auth',
    repo: 'gistajs/auth',
    branches: ['dev', 'main'],
    description: 'Auth starter',
  },
])

describe('diffStarter', () => {
  it('fetches both tags and diffs them by tag ref', async () => {
    let run = vi.fn().mockResolvedValue(undefined)
    let runOutput = vi.fn().mockResolvedValue(' package.json | 2 +-')
    let rm = vi.fn().mockResolvedValue(undefined)

    let output = await diffStarter(
      sampleCatalog[0]!,
      {
        starter: 'auth',
        fromReleaseKey: '2026-03-28-001',
        toReleaseKey: '2026-03-29-001',
      },
      {
        mkdtemp: vi.fn().mockResolvedValue('/tmp/gistajs-diff-test'),
        rm,
        run,
        runOutput,
      },
    )

    expect(output).toBe(' package.json | 2 +-')
    expect(run.mock.calls).toEqual([
      ['git', ['init', '-q'], '/tmp/gistajs-diff-test'],
      [
        'git',
        ['remote', 'add', 'origin', 'https://github.com/gistajs/auth.git'],
        '/tmp/gistajs-diff-test',
      ],
      [
        'git',
        [
          'fetch',
          '--quiet',
          '--no-tags',
          'origin',
          'refs/tags/auth/2026-03-28-001:refs/tags/auth/2026-03-28-001',
        ],
        '/tmp/gistajs-diff-test',
      ],
      [
        'git',
        [
          'fetch',
          '--quiet',
          '--no-tags',
          'origin',
          'refs/tags/auth/2026-03-29-001:refs/tags/auth/2026-03-29-001',
        ],
        '/tmp/gistajs-diff-test',
      ],
    ])
    expect(runOutput).toHaveBeenCalledWith(
      'git',
      [
        'diff',
        'refs/tags/auth/2026-03-28-001',
        'refs/tags/auth/2026-03-29-001',
      ],
      '/tmp/gistajs-diff-test',
    )
    expect(rm).toHaveBeenCalledWith('/tmp/gistajs-diff-test', {
      recursive: true,
      force: true,
    })
  })

  it('passes --stat to git when stat option is set', async () => {
    let run = vi.fn().mockResolvedValue(undefined)
    let runOutput = vi.fn().mockResolvedValue(' package.json | 2 +-')
    let rm = vi.fn().mockResolvedValue(undefined)

    await diffStarter(
      sampleCatalog[0]!,
      {
        starter: 'auth',
        fromReleaseKey: '2026-03-28-001',
        toReleaseKey: '2026-03-29-001',
        stat: true,
      },
      {
        mkdtemp: vi.fn().mockResolvedValue('/tmp/gistajs-diff-test'),
        rm,
        run,
        runOutput,
      },
    )

    expect(runOutput).toHaveBeenCalledWith(
      'git',
      [
        'diff',
        '--stat',
        'refs/tags/auth/2026-03-28-001',
        'refs/tags/auth/2026-03-29-001',
      ],
      '/tmp/gistajs-diff-test',
    )
  })
})
