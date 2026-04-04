import { spawn } from 'node:child_process'

export async function run(
  command: string,
  args: string[],
  cwd: string,
): Promise<void> {
  await exec(command, args, cwd, {
    capture: false,
  })
}

export async function runOutput(
  command: string,
  args: string[],
  cwd: string,
): Promise<string> {
  return await exec(command, args, cwd, {
    capture: true,
  })
}

export async function runInput(
  command: string,
  args: string[],
  cwd: string,
  input: string,
): Promise<void> {
  await exec(command, args, cwd, {
    capture: false,
    input,
  })
}

async function exec(
  command: string,
  args: string[],
  cwd: string,
  options: {
    capture: boolean
    input?: string
  },
) {
  return await new Promise<string>((resolve, reject) => {
    let { capture, input } = options
    let captureOutput = capture || input !== undefined
    let stdout = ''
    let stderr = ''
    let child = spawn(command, args, {
      cwd,
      stdio: captureOutput ? ['pipe', 'pipe', 'pipe'] : 'inherit',
    })

    if (captureOutput) {
      child.stdout!.on('data', (chunk) => {
        stdout += String(chunk)
      })

      child.stderr!.on('data', (chunk) => {
        stderr += String(chunk)
      })
    }

    if (input !== undefined) {
      child.stdin!.end(input)
    }

    child.once('error', reject)
    child.once('exit', (code) => {
      if (code === 0) {
        resolve(stdout)
        return
      }

      let detail = captureOutput ? stderr.trim() : ''
      reject(
        new Error(
          detail || `${command} ${args.join(' ')} exited with code ${code}`,
        ),
      )
    })
  })
}
