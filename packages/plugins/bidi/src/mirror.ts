const MIRRORS = new Map([
  ['(', ')'],
  [')', '('],
  ['[', ']'],
  [']', '['],
  ['{', '}'],
  ['}', '{']
])

export function mirrorCharacter(character: string): string {
  return MIRRORS.get(character) ?? character
}
