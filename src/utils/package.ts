import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

type ReadTextFile = (path: string, encoding: 'utf8') => Promise<string>

export async function readProjectPackage(
  root: string,
  readFileFn: ReadTextFile = (p, e) => readFile(p, e),
): Promise<Record<string, unknown>> {
  let path = join(root, 'package.json')
  let source: string

  try {
    source = await readFileFn(path, 'utf8')
  } catch (error) {
    let code = (error as NodeJS.ErrnoException).code

    if (code === 'ENOENT') {
      throw new Error(
        'No package.json found. Run this from a Gista.js project directory.',
      )
    }

    throw error
  }

  try {
    let pkg = JSON.parse(source)

    if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg)) {
      throw new Error('package.json must contain a JSON object')
    }

    return pkg as Record<string, unknown>
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Could not parse package.json in the current directory.')
    }

    throw error
  }
}
