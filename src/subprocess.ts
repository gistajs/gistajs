import { spawn } from 'node:child_process'

export async function run(command: string, args: string[], cwd: string) {
  await new Promise<void>((resolve, reject) => {
    let child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
    })

    child.once('error', reject)
    child.once('exit', (code) => {
      if (code === 0) resolve()
      else {
        reject(
          new Error(`${command} ${args.join(' ')} exited with code ${code}`),
        )
      }
    })
  })
}
