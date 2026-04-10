import pc from 'picocolors'

export const c = {
  brand: (s: string) => pc.bold(pc.cyan(s)),
  success: (s: string) => pc.bold(pc.green(s)),
  path: (s: string) => pc.underline(s),
  slug: (s: string) => pc.cyan(s),
  prompt: (s: string) => pc.bold(pc.yellow(s)),
  error: (s: string) => pc.red(s),
  errorLabel: (s: string) => pc.bold(pc.red(s)),
  warn: (s: string) => pc.bold(pc.yellow(s)),
  info: (s: string) => pc.bold(pc.cyan(s)),
  dim: (s: string) => pc.dim(s),
  bold: (s: string) => pc.bold(s),
}

// prettier-ignore
const LOGO = [
  "   ____ _     _           _     ",
  "  / ___(_)___| |_ __ _   (_)___ ",
  " | |  _| / __| __/ _` |  | / __|",
  " | |_| | \\__ \\ || (_| |_ | \\__ \\",
  "  \\____|_|___/\\__\\__,_(_)/ |___/",
  "                       |__/     ",
];

function lerp(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t)
}

function rgb(r: number, g: number, b: number, text: string) {
  return `\x1b[38;2;${r};${g};${b}m${text}\x1b[39m`
}

export function logo() {
  // matrix gradient: #00ff41 → #008f11
  let from = [0x00, 0xff, 0x41] as const
  let to = [0x00, 0x8f, 0x11] as const
  let total = LOGO.length

  return LOGO.map((line, i) => {
    let t = total <= 1 ? 0 : i / (total - 1)
    let r = lerp(from[0], to[0], t)
    let g = lerp(from[1], to[1], t)
    let b = lerp(from[2], to[2], t)
    return rgb(r, g, b, line)
  }).join('\n')
}
