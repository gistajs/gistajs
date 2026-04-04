export function getEnvVar(file: string, key: string) {
  return file.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1]?.trim() ?? ''
}

export function setEnvVar(file: string, key: string, value: string) {
  if (file.match(new RegExp(`^${key}=.*$`, 'm'))) {
    return file.replace(new RegExp(`^${key}=.*$`, 'm'), `${key}=${value}`)
  }

  return `${file.trimEnd()}\n${key}=${value}\n`
}

export function getRequiredEnvVar(file: string, key: string) {
  let value = getEnvVar(file, key)

  if (!value) {
    throw new Error(
      `Missing ${key} in .env. Provision Turso and prep the app first.`,
    )
  }

  return value
}
