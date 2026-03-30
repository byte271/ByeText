import type { TokenBoundary } from './types.ts'

const WORD_PATTERN = /[\p{L}\p{N}_]/u

function charLength(text: string, index: number): number {
  const codePoint = text.codePointAt(index)
  if (codePoint === undefined) {
    return 1
  }

  return codePoint > 0xffff ? 2 : 1
}

export function tokenizeText(text: string): TokenBoundary[] {
  const boundaries: TokenBoundary[] = []
  let index = 0

  while (index < text.length) {
    const character = text.slice(index, index + charLength(text, index))

    if (character === '\r') {
      index += 1
      continue
    }

    if (character === '\n') {
      boundaries.push({
        start: index,
        end: index + 1,
        breakAllowed: true,
        hardBreak: true,
        kind: 'newline'
      })
      index += 1
      continue
    }

    if (/\s/u.test(character)) {
      const start = index
      index += character.length
      while (index < text.length) {
        const next = text.slice(index, index + charLength(text, index))
        if (next === '\n' || !/\s/u.test(next)) {
          break
        }

        index += next.length
      }

      boundaries.push({
        start,
        end: index,
        breakAllowed: true,
        hardBreak: false,
        kind: 'space'
      })
      continue
    }

    if (WORD_PATTERN.test(character)) {
      const start = index
      index += character.length
      while (index < text.length) {
        const next = text.slice(index, index + charLength(text, index))
        if (!WORD_PATTERN.test(next)) {
          break
        }

        index += next.length
      }

      boundaries.push({
        start,
        end: index,
        breakAllowed: true,
        hardBreak: false,
        kind: 'word'
      })
      continue
    }

    boundaries.push({
      start: index,
      end: index + character.length,
      breakAllowed: true,
      hardBreak: false,
      kind: 'punct'
    })
    index += character.length
  }

  return boundaries
}

export function buildBreakBitmap(textLength: number, boundaries: TokenBoundary[]): Uint8Array {
  const bitmap = new Uint8Array(textLength + 1)
  for (const boundary of boundaries) {
    if (boundary.breakAllowed || boundary.hardBreak) {
      bitmap[boundary.end] = 1
    }
  }

  bitmap[textLength] = 1
  return bitmap
}
