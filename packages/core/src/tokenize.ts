import type { TokenBoundary } from './types.ts'
import {
  isBreakableSpace,
  isClosingPunctuation,
  isEmojiSequence,
  isGlyphBreak,
  isOpeningPunctuation,
  isWordJoiner,
  isWordUnit,
  isZeroWidthBreak,
  segmentGraphemesWithOffsets
} from './unicode.ts'

function isWordSegment(segment: string, previousIsWord: boolean, nextSegment: string | undefined): boolean {
  return isWordUnit(segment)
    || (previousIsWord && nextSegment !== undefined && (isWordUnit(nextSegment) || isGlyphBreak(nextSegment)) && isWordJoiner(segment))
}

function kindForGrapheme(segment: string): TokenBoundary['kind'] {
  if (isEmojiSequence(segment) || isGlyphBreak(segment)) {
    return 'glyph'
  }

  return 'punct'
}

function pushBoundary(boundaries: TokenBoundary[], start: number, end: number, kind: TokenBoundary['kind'], breakAllowed: boolean, hardBreak = false): void {
  boundaries.push({ start, end, kind, breakAllowed, hardBreak })
}

function applyLineBreakTuning(text: string, boundaries: TokenBoundary[]): TokenBoundary[] {
  for (let index = 0; index < boundaries.length; index += 1) {
    const boundary = boundaries[index]
    if (!boundary || boundary.hardBreak) {
      continue
    }

    const tokenText = text.slice(boundary.start, boundary.end)
    if (isOpeningPunctuation(tokenText)) {
      boundary.breakAllowed = false
    }

    const next = boundaries[index + 1]
    if (!next || next.hardBreak) {
      continue
    }

    if (isClosingPunctuation(text.slice(next.start, next.end))) {
      boundary.breakAllowed = false
    }
  }

  return boundaries
}

export function tokenizeText(text: string): TokenBoundary[] {
  const boundaries: TokenBoundary[] = []
  const graphemes = segmentGraphemesWithOffsets(text)
  let index = 0

  while (index < graphemes.length) {
    const current = graphemes[index]
    const value = current?.segment ?? ''
    const next = graphemes[index + 1]?.segment

    if (!current) {
      index += 1
      continue
    }

    if (value === '\r' && graphemes[index + 1]?.segment === '\n') {
      pushBoundary(boundaries, current.start, graphemes[index + 1]?.end ?? current.end, 'newline', true, true)
      index += 2
      continue
    }

    if (value === '\r') {
      index += 1
      continue
    }

    if (value === '\n') {
      pushBoundary(boundaries, current.start, current.end, 'newline', true, true)
      index += 1
      continue
    }

    if (isZeroWidthBreak(value)) {
      pushBoundary(boundaries, current.start, current.end, 'space', true)
      index += 1
      continue
    }

    if (isBreakableSpace(value)) {
      const start = current.start
      let end = current.end
      index += 1
      while (index < graphemes.length && isBreakableSpace(graphemes[index]?.segment ?? '')) {
        end = graphemes[index]?.end ?? end
        index += 1
      }
      pushBoundary(boundaries, start, end, 'space', true)
      continue
    }

    if (isEmojiSequence(value) || isGlyphBreak(value)) {
      pushBoundary(boundaries, current.start, current.end, 'glyph', true)
      index += 1
      continue
    }

    if (isWordSegment(value, false, next)) {
      const start = current.start
      let end = current.end
      let previousIsWord = isWordUnit(value)
      index += 1
      while (index < graphemes.length && isWordSegment(graphemes[index]?.segment ?? '', previousIsWord, graphemes[index + 1]?.segment)) {
        const segment = graphemes[index]?.segment ?? ''
        previousIsWord = isWordUnit(segment)
        end = graphemes[index]?.end ?? end
        index += 1
      }
      pushBoundary(boundaries, start, end, 'word', true)
      continue
    }

    pushBoundary(boundaries, current.start, current.end, kindForGrapheme(value), true)
    index += 1
  }

  return applyLineBreakTuning(text, boundaries)
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
