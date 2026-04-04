import { spawn } from 'node:child_process'

export async function run(
  command: string,
  args: string[],
  cwd: string,
): Promise<void> {
  await exec(command, args, cwd, false)
}

export async function runOutput(
  command: string,
  args: string[],
  cwd: string,
): Promise<string> {
  return await exec(command, args, cwd, true)
}

async function exec(
  command: string,
  args: string[],
  cwd: string,
  capture: boolean,
) {
  return await new Promise<string>((resolve, reject) => {
    let stdout = ''
    let stderr = ''
    let child = spawn(command, args, {
      cwd,
      stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    })

    if (capture) {
      child.stdout!.on('data', (chunk) => {
        stdout += String(chunk)
      })

      child.stderr!.on('data', (chunk) => {
        stderr += String(chunk)
      })
    }

    child.once('error', reject)
    child.once('exit', (code) => {
      if (code === 0) {
        resolve(stdout)
        return
      }

      let detail = capture ? stderr.trim() : ''
      reject(
        new Error(
          detail || `${command} ${args.join(' ')} exited with code ${code}`,
        ),
      )
    })
  })
}
