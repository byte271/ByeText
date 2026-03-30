export interface GraphemeSegment {
  segment: string
  start: number
  end: number
}

const GRAPHEME_SEGMENTER = typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  : null

const BREAKABLE_SPACE_PATTERN = /^[\u0009\u0020\u1680\u2000-\u2006\u2008-\u200A\u205F\u3000]$/u
const ZERO_WIDTH_BREAK_PATTERN = /^[\u200B]$/u
const WORD_UNIT_PATTERN = /^[\p{Alphabetic}\p{Number}\p{Mark}\p{Connector_Punctuation}]$/u
const WORD_JOINER_PATTERN = /^['’\u00A0\u202F\u2060]$/u
const GLYPH_BREAK_PATTERN = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u
const EMOJI_PATTERN = /[\p{Extended_Pictographic}\p{Regional_Indicator}]/u
const OPENING_PUNCTUATION_PATTERN = /^[([{«“‘‹〈《「『【〔〖〘〚]$/u
const CLOSING_PUNCTUATION_PATTERN = /^[)\]}»”’›〉》」』】〕〗〙〛、。，．！？：；,.!?;:%]$/u
const RTL_PATTERN = /[\p{Script=Hebrew}\p{Script=Arabic}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}\p{Script=Adlam}]/u
const LTR_PATTERN = /[\p{Alphabetic}]/u
const MARK_OR_MODIFIER_PATTERN = /^\p{Mark}$|^[\uFE0E\uFE0F]$|^\p{Emoji_Modifier}$/u
const REGIONAL_INDICATOR_PATTERN = /^\p{Regional_Indicator}$/u

export function charLength(text: string, index: number): number {
  const codePoint = text.codePointAt(index)
  return codePoint !== undefined && codePoint > 0xffff ? 2 : 1
}

export function segmentGraphemesWithOffsets(text: string): GraphemeSegment[] {
  if (GRAPHEME_SEGMENTER) {
    return Array.from(GRAPHEME_SEGMENTER.segment(text), (part) => ({
      segment: part.segment,
      start: part.index,
      end: part.index + part.segment.length
    }))
  }

  const graphemes: GraphemeSegment[] = []
  let start = 0

  while (start < text.length) {
    let end = start + charLength(text, start)
    while (end < text.length) {
      const next = text.slice(end, end + charLength(text, end))
      if (MARK_OR_MODIFIER_PATTERN.test(next)) {
        end += next.length
        continue
      }

      if (next === '\u200D') {
        end += next.length + (end + next.length < text.length ? charLength(text, end + next.length) : 0)
        continue
      }

      const current = text.slice(start, end)
      if (REGIONAL_INDICATOR_PATTERN.test(next) && [...current].every((char) => REGIONAL_INDICATOR_PATTERN.test(char)) && [...current].length % 2 === 1) {
        end += next.length
        continue
      }

      break
    }

    graphemes.push({ segment: text.slice(start, end), start, end })
    start = end
  }

  return graphemes
}

export function segmentGraphemes(text: string): string[] {
  return segmentGraphemesWithOffsets(text).map((part) => part.segment)
}

export function isBreakableSpace(segment: string): boolean {
  return BREAKABLE_SPACE_PATTERN.test(segment)
}

export function isZeroWidthBreak(segment: string): boolean {
  return ZERO_WIDTH_BREAK_PATTERN.test(segment)
}

export function isWordUnit(segment: string): boolean {
  return WORD_UNIT_PATTERN.test(segment)
}

export function isWordJoiner(segment: string): boolean {
  return WORD_JOINER_PATTERN.test(segment)
}

export function isGlyphBreak(segment: string): boolean {
  return GLYPH_BREAK_PATTERN.test(segment)
}

export function isEmojiSequence(text: string): boolean {
  if (text.length === 0) {
    return false
  }

  let sawEmoji = false
  for (const character of text) {
    if (EMOJI_PATTERN.test(character)) {
      sawEmoji = true
      continue
    }

    if (character === '\u200D' || MARK_OR_MODIFIER_PATTERN.test(character)) {
      continue
    }

    return false
  }

  return sawEmoji
}

export function isOpeningPunctuation(segment: string): boolean {
  return OPENING_PUNCTUATION_PATTERN.test(segment)
}

export function isClosingPunctuation(segment: string): boolean {
  return CLOSING_PUNCTUATION_PATTERN.test(segment)
}

export function resolveTextDirection(text: string, fallback: 'ltr' | 'rtl' = 'ltr'): 'ltr' | 'rtl' {
  for (const character of text) {
    if (RTL_PATTERN.test(character)) {
      return 'rtl'
    }

    if (LTR_PATTERN.test(character)) {
      return 'ltr'
    }
  }

  return fallback
}
