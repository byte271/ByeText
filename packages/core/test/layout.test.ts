import assert from 'node:assert/strict'

import { ByeText } from '../src/api.ts'

import { createMockCanvas } from './mock-canvas.ts'

export function runLayoutTests(): void {
  const canvas = createMockCanvas(80, 200)
  const doc = ByeText.create({
    canvas,
    width: 60,
    height: 200,
    font: { family: 'Mock Sans', size: 10 },
    text: 'Alpha Beta Gamma'
  })

  assert.equal(doc.getLineCount(), 3)
  assert.equal(doc.getLine(0).charStart, 0)
  assert.equal(doc.getLine(1).charStart, 6)

  const position = doc.charToPosition(7)
  assert.equal(position.lineIndex, 1)

  const charIndex = doc.positionToChar(position.x + 1, position.y + 1)
  assert.ok(charIndex >= 6)
}
