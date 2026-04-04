import { describe, expect, it, vi } from 'vitest'
import { parseCatalog } from '../src/utils/catalog.js'

let sampleCatalog = parseCatalog([
  {
    slug: 'website',
    repo: 'gistajs/website',
    branches: ['main'],
    description: 'Static site starter',
  },
])

describe('git identity prompts', () => {
  it('asks for git identity when none is configured', async () => {
    let promptForGitIdentity = vi.fn().mockResolvedValue({
      name: 'Test User',
      email: 'test@example.com',
      saveGlobal: false,
    })

    let git = await import('../src/utils/git.js')
    await git.initGit('/tmp/example', sampleCatalog[0]!, {
      promptForGitIdentity,
      readGitConfig: () => '',
      run: async () => {},
    })

    expect(promptForGitIdentity).toHaveBeenCalled()
  })
})
