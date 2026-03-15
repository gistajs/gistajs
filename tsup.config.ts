import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: 'esm',
    dts: true,
    clean: true,
  },
  {
    entry: ['src/bin.ts'],
    format: 'cjs',
    clean: true,
    outExtension() {
      return { js: '.cjs' }
    },
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
])
