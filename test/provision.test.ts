import { describe, expect, it, vi } from 'vitest'
import { provisionTurso } from '../src/providers/turso.js'
import { provisionVercel } from '../src/providers/vercel.js'

let oregon = {
  id: 'aws-us-west-2',
  label: 'Oregon',
  vercel: 'sfo1',
}

describe('provisionTurso', () => {
  it('requires an interactive terminal', async () => {
    await expect(
      provisionTurso('/tmp/demo', oregon, makeDeps({ isTTY: false })),
    ).rejects.toThrow('requires an interactive terminal')
  })

  it('keeps existing credentials when overwrite is declined', async () => {
    let deps = makeDeps({
      readFile: vi
        .fn()
        .mockResolvedValue('DB_URL=old-url\nDB_AUTH_TOKEN=old-token\n'),
      promptConfirm: vi.fn().mockResolvedValue(false),
    })

    await expect(provisionTurso('/tmp/demo', oregon, deps)).resolves.toEqual({
      provider: 'turso',
      status: 'skipped',
    })

    expect(deps.run).not.toHaveBeenCalled()
    expect(deps.writeFile).not.toHaveBeenCalled()
  })

  it('fails clearly when a new region group cannot be created', async () => {
    let deps = makeDeps({
      runOutput: vi.fn(async (_command, args) => {
        if (args.join(' ') === 'auth whoami') {
          return 'alice'
        }

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
      run: vi.fn(async (_command, args) => {
        if (args[0] === 'group' && args[1] === 'create') {
          throw new Error('boom')
        }
      }),
      promptText: vi.fn().mockResolvedValue(''),
    })

    await expect(provisionTurso('/tmp/demo', oregon, deps)).rejects.toThrow(
      'Could not create a Turso group in Oregon',
    )
  })

  it('returns a completed result after writing credentials', async () => {
    let deps = makeDeps({
      runOutput: vi.fn(async (_command, args) => {
        if (args.join(' ') === 'auth whoami') {
          return 'alice'
        }

        if (args.join(' ') === 'org list') {
          return 'NAME SLUG TYPE\nPersonal personal personal (current)\n'
        }

        if (args.join(' ') === 'db list') {
          return 'NAME GROUP LOCATIONS\n'
        }

        if (args.join(' ') === 'group list') {
          return 'NAME LOCATION\ndefault tokyo\n'
        }

        if (args.join(' ') === 'db show demo --url') {
          return 'libsql://demo.turso.io'
        }

        if (args.join(' ') === 'db tokens create demo') {
          return 'secret-token'
        }

        return ''
      }),
      promptText: vi.fn().mockResolvedValue('demo'),
    })

    await expect(provisionTurso('/tmp/demo', oregon, deps)).resolves.toEqual({
      provider: 'turso',
      status: 'completed',
    })

    expect(deps.writeFile).toHaveBeenCalledOnce()
    expect(deps.stdout.log).toHaveBeenCalledWith(
      'Created Turso database demo in Oregon.',
    )
  })

  it('creates a new group when no group matches the selected region', async () => {
    let deps = makeDeps({
      runOutput: vi.fn(async (_command, args) => {
        if (args.join(' ') === 'auth whoami') {
          return 'alice'
        }

        if (args.join(' ') === 'org list') {
          return 'NAME SLUG TYPE\nPersonal personal personal (current)\n'
        }

        if (args.join(' ') === 'db list') {
          return 'NAME GROUP LOCATIONS\n'
        }

        if (args.join(' ') === 'group list') {
          return 'NAME LOCATION\ndefault aws-us-east-1\n'
        }

        if (args.join(' ') === 'db show demo --url') {
          return 'libsql://demo.turso.io'
        }

        if (args.join(' ') === 'db tokens create demo') {
          return 'secret-token'
        }

        return ''
      }),
      promptText: vi.fn().mockResolvedValue('demo'),
    })

    await provisionTurso('/tmp/demo', oregon, deps)

    expect(deps.run).toHaveBeenCalledWith(
      'turso',
      ['group', 'create', 'demo-oregon', '--location', 'aws-us-west-2'],
      '/tmp/demo',
    )
  })

  it('checks Turso auth with a quiet whoami probe', async () => {
    let deps = makeDeps({
      runOutput: vi.fn(async (_command, args) => {
        if (args.join(' ') === 'auth whoami') {
          return 'alice'
        }

        if (args.join(' ') === 'org list') {
          return 'NAME SLUG TYPE\nPersonal personal personal (current)\n'
        }

        if (args.join(' ') === 'db list') {
          return 'NAME GROUP LOCATIONS\n'
        }

        if (args.join(' ') === 'group list') {
          return 'NAME LOCATION\ndefault aws-us-west-2\n'
        }

        if (args.join(' ') === 'db show demo --url') {
          return 'libsql://demo.turso.io'
        }

        if (args.join(' ') === 'db tokens create demo') {
          return 'secret-token'
        }

        return ''
      }),
      promptText: vi.fn().mockResolvedValue('demo'),
    })

    await provisionTurso('/tmp/demo', oregon, deps)

    expect(deps.runOutput).toHaveBeenCalledWith(
      'turso',
      ['auth', 'whoami'],
      '/tmp/demo',
    )
    expect(deps.run).not.toHaveBeenCalledWith(
      'turso',
      ['auth', 'status'],
      '/tmp/demo',
    )
  })
})

describe('provisionVercel', () => {
  it('requires an interactive terminal', async () => {
    await expect(
      provisionVercel('/tmp/demo', oregon, makeVercelDeps({ isTTY: false })),
    ).rejects.toThrow('requires an interactive terminal')
  })

  it('fails clearly when required env vars are missing', async () => {
    await expect(
      provisionVercel(
        '/tmp/demo',
        oregon,
        makeVercelDeps({
          readFile: vi.fn().mockResolvedValue('COOKIE_SECRET=\n'),
        }),
      ),
    ).rejects.toThrow('Missing COOKIE_SECRET in .env')
  })

  it('supports Mumbai when the selected Turso region has a Vercel mapping', async () => {
    let deps = makeVercelDeps({
      runOutput: vi.fn().mockResolvedValue('alice'),
      readFile: vi
        .fn()
        .mockResolvedValue(
          'COOKIE_SECRET=secret\nDB_URL=libsql://demo\nDB_AUTH_TOKEN=token\n',
        ),
    })

    await expect(
      provisionVercel(
        '/tmp/demo',
        {
          id: 'aws-ap-south-1',
          label: 'Mumbai',
          vercel: 'bom1',
        },
        deps,
      ),
    ).resolves.toEqual({
      provider: 'vercel',
      status: 'completed',
    })

    expect(deps.runOutput).toHaveBeenCalledWith(
      'vercel',
      ['whoami'],
      '/tmp/demo',
    )
    expect(deps.stdout.log).toHaveBeenCalledWith(
      'Set your Vercel function region to Mumbai in project settings if you want it to match Turso.',
    )
  })

  it('updates existing env vars and adds missing ones', async () => {
    let deps = makeVercelDeps({
      readFile: vi
        .fn()
        .mockResolvedValue(
          'COOKIE_SECRET=secret\nDB_URL=libsql://demo\nDB_AUTH_TOKEN=token\n',
        ),
      runOutput: vi
        .fn()
        .mockResolvedValue(
          'NAME VALUE TARGET\nCOOKIE_SECRET encrypted production\n',
        ),
    })

    await expect(provisionVercel('/tmp/demo', oregon, deps)).resolves.toEqual({
      provider: 'vercel',
      status: 'completed',
    })

    expect(deps.runInput.mock.calls).toEqual([
      [
        'vercel',
        ['env', 'update', 'COOKIE_SECRET', 'production', '--yes'],
        '/tmp/demo',
        'secret\n',
      ],
      [
        'vercel',
        ['env', 'add', 'DB_URL', 'production', '--force'],
        '/tmp/demo',
        'libsql://demo\n',
      ],
      [
        'vercel',
        ['env', 'add', 'DB_AUTH_TOKEN', 'production', '--force'],
        '/tmp/demo',
        'token\n',
      ],
    ])
  })

  it('links the project when .vercel/project.json is missing', async () => {
    let deps = makeVercelDeps({
      existsSync: vi.fn().mockReturnValue(false),
      readFile: vi
        .fn()
        .mockResolvedValue(
          'COOKIE_SECRET=secret\nDB_URL=libsql://demo\nDB_AUTH_TOKEN=token\n',
        ),
    })

    await provisionVercel('/tmp/demo', oregon, deps)

    expect(deps.run).toHaveBeenCalledWith(
      'vercel',
      ['link', '--yes'],
      '/tmp/demo',
    )
  })

  it('checks Vercel auth with a quiet whoami probe', async () => {
    let deps = makeVercelDeps({
      readFile: vi
        .fn()
        .mockResolvedValue(
          'COOKIE_SECRET=secret\nDB_URL=libsql://demo\nDB_AUTH_TOKEN=token\n',
        ),
    })

    await provisionVercel('/tmp/demo', oregon, deps)

    expect(deps.runOutput).toHaveBeenCalledWith(
      'vercel',
      ['whoami'],
      '/tmp/demo',
    )
    expect(deps.run).not.toHaveBeenCalledWith('vercel', ['whoami'], '/tmp/demo')
  })
})

function makeDeps(overrides: Record<string, unknown> = {}) {
  return {
    run: vi.fn().mockResolvedValue(undefined),
    runChecked: vi.fn().mockResolvedValue(''),
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

function makeVercelDeps(overrides: Record<string, unknown> = {}) {
  return {
    run: vi.fn().mockResolvedValue(undefined),
    runInput: vi.fn().mockResolvedValue(undefined),
    runOutput: vi.fn(async (_command, args) => {
      if (args.join(' ') === 'whoami') {
        return 'alice'
      }

      return 'NAME VALUE TARGET\n'
    }),
    readFile: vi.fn().mockResolvedValue(''),
    existsSync: vi.fn().mockReturnValue(true),
    stdout: { log: vi.fn() },
    isTTY: true,
    ...overrides,
  }
}
