export class UsageError extends Error {
  command?: string

  constructor(message: string, command?: string) {
    super(message)
    this.name = 'UsageError'
    this.command = command
  }
}
