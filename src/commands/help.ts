import { c } from '../utils/color.js'

export function getHelpText(command?: string) {
  let header = `  ${c.brand('gistajs')} ${c.dim('— scaffold and manage Gista.js starter projects')}`

  if (command === 'create') {
    return [
      '',
      header,
      '',
      `  ${c.bold('Usage:')}`,
      `    ${c.dim('$')} ${c.bold('gistajs create')} <project-name> [--starter <slug>] [--no-install] [--no-git]`,
      '',
      `  ${c.bold('Examples:')}`,
      `    ${c.dim('$')} gistajs create my-app`,
      `    ${c.dim('$')} gistajs create my-app --starter website`,
      '',
    ].join('\n')
  }

  if (command === 'diff') {
    return [
      '',
      header,
      '',
      `  ${c.bold('Usage:')}`,
      `    ${c.dim('$')} ${c.bold('gistajs diff')} --latest [--stat]`,
      `    ${c.dim('$')} ${c.bold('gistajs diff')} <starter> <from-release-key> <to-release-key> [--stat]`,
      '',
      `  ${c.bold('Examples:')}`,
      `    ${c.dim('$')} gistajs diff --latest`,
      `    ${c.dim('$')} gistajs diff --latest --stat`,
      `    ${c.dim('$')} gistajs diff auth 2026-03-28-001 2026-03-29-001`,
      `    ${c.dim('$')} gistajs diff auth 2026-03-28-001 2026-03-29-001 --stat`,
      '',
    ].join('\n')
  }

  if (command === 'pin') {
    return [
      '',
      header,
      '',
      `  ${c.bold('Usage:')}`,
      `    ${c.dim('$')} ${c.bold('gistajs pin')} <release-key>`,
      '',
      `  ${c.bold('Examples:')}`,
      `    ${c.dim('$')} gistajs pin 2026-04-01-001`,
      '',
    ].join('\n')
  }

  if (command === 'provision') {
    return [
      '',
      header,
      '',
      `  ${c.bold('Usage:')}`,
      `    ${c.dim('$')} ${c.bold('gistajs provision')} [provider]`,
      '',
      `  ${c.bold('Providers:')}`,
      `    turso    Create a Turso database and save credentials to .env`,
      `    vercel   Link Vercel and sync production env vars`,
      '',
      `  ${c.bold('Examples:')}`,
      `    ${c.dim('$')} gistajs provision`,
      `    ${c.dim('$')} gistajs provision turso`,
      `    ${c.dim('$')} gistajs provision vercel`,
      '',
    ].join('\n')
  }

  return [
    '',
    header,
    '',
    `  ${c.bold('Usage:')}`,
    `    ${c.dim('$')} ${c.bold('gistajs create')} <project-name> [--starter <slug>] [--no-install] [--no-git]`,
    `    ${c.dim('$')} ${c.bold('gistajs diff')} --latest [--stat]`,
    `    ${c.dim('$')} ${c.bold('gistajs diff')} <starter> <from-release-key> <to-release-key> [--stat]`,
    `    ${c.dim('$')} ${c.bold('gistajs pin')} <release-key>`,
    `    ${c.dim('$')} ${c.bold('gistajs provision')} [provider]`,
    '',
    `  ${c.bold('Examples:')}`,
    `    ${c.dim('$')} gistajs create my-app`,
    `    ${c.dim('$')} gistajs create my-app --starter website`,
    `    ${c.dim('$')} gistajs diff --latest`,
    `    ${c.dim('$')} gistajs diff --latest --stat`,
    `    ${c.dim('$')} gistajs diff auth 2026-03-28-001 2026-03-29-001`,
    `    ${c.dim('$')} gistajs diff auth 2026-03-28-001 2026-03-29-001 --stat`,
    `    ${c.dim('$')} gistajs pin 2026-04-01-001`,
    `    ${c.dim('$')} gistajs provision`,
    `    ${c.dim('$')} gistajs provision turso`,
    `    ${c.dim('$')} gistajs provision vercel`,
    '',
  ].join('\n')
}
