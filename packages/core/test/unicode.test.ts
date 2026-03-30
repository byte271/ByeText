import assert from 'node:assert/strict'

import { tokenizeText } from '../src/tokenize.ts'
import { ByeText } from '../src/api.ts'
import { resolveBaseDirection, splitBidiRuns } from '../../plugins/bidi/src/uax9.ts'
import { findEmojiSequences, isEmojiSequence } from '../../plugins/emoji/src/sequences.ts'

import { createMockCanvas } from './mock-canvas.ts'

export function runUnicodeTests(): void {
  const emojiText = 'A👨‍👩‍👧‍👦B'
  const emojiBoundaries = tokenizeText(emojiText)
  assert.ok(emojiBoundaries.some((boundary) => emojiText.slice(boundary.start, boundary.end) === '👨‍👩‍👧‍👦'))
  assert.equal(findEmojiSequences('Hi 👨‍👩‍👧‍👦 🇯🇵').length, 2)
  assert.equal(isEmojiSequence('👨‍👩‍👧‍👦'), true)

  const cjkCanvas = createMockCanvas(120, 120)
  const cjkDoc = ByeText.create({
    canvas: cjkCanvas,
    width: 30,
    height: 120,
    font: { family: 'Mock Sans', size: 10 },
    text: '漢字かな交じり文'
  })
  assert.ok(cjkDoc.getLineCount() > 1)

  const nbspCanvas = createMockCanvas(160, 120)
  const nbspDoc = ByeText.create({
    canvas: nbspCanvas,
    width: 60,
    height: 120,
    font: { family: 'Mock Sans', size: 10 },
    text: 'Hello\u00A0world'
  })
  assert.equal(nbspDoc.getLineCount(), 1)

  const zwspCanvas = createMockCanvas(160, 120)
  const zwspDoc = ByeText.create({
    canvas: zwspCanvas,
    width: 60,
    height: 120,
    font: { family: 'Mock Sans', size: 10 },
    text: 'Hello\u200Bworld'
  })
  assert.ok(zwspDoc.getLineCount() > 1)

  assert.equal(resolveBaseDirection('hello שלום'), 'ltr')
  assert.equal(resolveBaseDirection('שלום hello'), 'rtl')
  assert.deepEqual(splitBidiRuns('abc שלום def').map((run) => run.direction), ['ltr', 'rtl', 'ltr'])
}
