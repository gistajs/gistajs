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

export async function runChecked(
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

export async function assertCommand(
  runFn: typeof run,
  cwd: string,
  command: string,
  args: string[],
  failureMessage: string,
) {
  try {
    await runFn(command, args, cwd)
  } catch (error) {
    let code = (error as NodeJS.ErrnoException).code

    if (code === 'ENOENT') {
      throw new Error(`Required command not found: ${command}`)
    }

    throw new Error(failureMessage)
  }
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
