import process from 'node:process'
import readline from 'node:readline/promises'
import type { StarterSpec } from './types.js'

export async function promptForStarter(starters: StarterSpec[]) {
  let rl = createPrompt()
  try {
    let options = starters
      .map(
        (starter, index) =>
          `${index + 1}. ${starter.slug} - ${starter.description}`,
      )
      .join('\n')

    let answer = await rl.question(`Choose a starter:\n${options}\n> `)
    let index = Number.parseInt(answer.trim(), 10) - 1
    let starter = starters[index]

    if (!starter) throw new Error('Invalid starter selection')

    return starter.slug
  } finally {
    rl.close()
  }
}

export async function promptForGitIdentity() {
  let rl = createPrompt()

  try {
    console.log(
      'Before I make the first commit, Git needs a name and email to attach to it.',
    )

    let name = (await rl.question('Your name: ')).trim()
    let email = (await rl.question('Your email: ')).trim()

    if (!name) throw new Error('Name is required to make the first commit')
    if (!email) throw new Error('Email is required to make the first commit')

    let saveGlobal = await confirm(
      rl,
      'Save this as your default Git identity for future projects too? (y/N) ',
    )

    return { name, email, saveGlobal }
  } finally {
    rl.close()
  }
}

function createPrompt() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
}

async function confirm(rl: readline.Interface, message: string) {
  let answer = (await rl.question(message)).trim().toLowerCase()
  return answer === 'y' || answer === 'yes'
}
