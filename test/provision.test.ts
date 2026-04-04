import { describe, expect, it, vi } from 'vitest'
import { provisionTurso } from '../src/providers/turso.js'

describe('provisionTurso', () => {
  it('requires an interactive terminal', async () => {
    await expect(
      provisionTurso('/tmp/demo', makeDeps({ isTTY: false })),
    ).rejects.toThrow('requires an interactive terminal')
  })

  it('keeps existing credentials when overwrite is declined', async () => {
    let deps = makeDeps({
      readFile: vi
        .fn()
        .mockResolvedValue('DB_URL=old-url\nDB_AUTH_TOKEN=old-token\n'),
      promptConfirm: vi.fn().mockResolvedValue(false),
    })

    await provisionTurso('/tmp/demo', deps)

    expect(deps.run).not.toHaveBeenCalled()
    expect(deps.writeFile).not.toHaveBeenCalled()
  })

  it('fails clearly when no groups can be parsed', async () => {
    let deps = makeDeps({
      run: vi.fn().mockResolvedValue(undefined),
      runOutput: vi.fn(async (_command, args) => {
        if (args.join(' ') === 'org list') {
          return 'NAME SLUG TYPE\nPersonal personal personal (current)\n'
        }

        if (args.join(' ') === 'db list') {
          return 'NAME GROUP LOCATIONS\n'
        }

        if (args.join(' ') === 'group list') {
          return 'NAME LOCATION\n'
        }

        return ''
      }),
      promptText: vi.fn().mockResolvedValue(''),
    })

    await expect(provisionTurso('/tmp/demo', deps)).rejects.toThrow(
      'Could not read any Turso groups',
    )
  })
})

function makeDeps(overrides: Record<string, unknown> = {}) {
  return {
    run: vi.fn().mockResolvedValue(undefined),
    runOutput: vi.fn().mockResolvedValue(''),
    promptConfirm: vi.fn().mockResolvedValue(true),
    promptText: vi.fn().mockResolvedValue(''),
    readFile: vi.fn().mockResolvedValue(''),
    writeFile: vi.fn().mockResolvedValue(undefined),
    cp: vi.fn().mockResolvedValue(undefined),
    stdout: { log: vi.fn() },
    isTTY: true,
    ...overrides,
  }
}
