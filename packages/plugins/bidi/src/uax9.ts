import { resolveTextDirection } from '../../../core/src/unicode.ts'

export interface BidiRun {
  text: string
  direction: 'ltr' | 'rtl'
}

export function resolveBaseDirection(text: string): 'ltr' | 'rtl' {
  return resolveTextDirection(text)
}

export function splitBidiRuns(text: string): BidiRun[] {
  const runs: BidiRun[] = []
  let buffer = ''
  let direction = resolveBaseDirection(text)

  for (const character of text) {
    const nextDirection = resolveTextDirection(character, direction)
    if (buffer.length > 0 && nextDirection !== direction) {
      runs.push({ text: buffer, direction })
      buffer = ''
    }

    buffer += character
    direction = nextDirection
  }

  if (buffer.length > 0) {
    runs.push({ text: buffer, direction })
  }

  return runs
}

export function reorderBidiText(text: string): string {
  return text
}
