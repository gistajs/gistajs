import { readFileSync } from 'node:fs'
import { defineConfig } from 'tsup'

let pkg = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
)
let version = JSON.stringify(pkg.version)

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: 'esm',
    dts: true,
    clean: true,
    define: {
      __GISTAJS_VERSION__: version,
    },
  },
  {
    entry: ['src/bin.ts'],
    format: 'cjs',
    clean: true,
    define: {
      __GISTAJS_VERSION__: version,
    },
    outExtension() {
      return { js: '.cjs' }
    },
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
])
