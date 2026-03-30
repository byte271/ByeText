import assert from 'node:assert/strict'

import { ByeText } from '../src/api.ts'

import { createMockCanvas } from './mock-canvas.ts'

export function runIncrementalTests(): void {
  const canvas = createMockCanvas(120, 120)
  const doc = ByeText.create({
    canvas,
    width: 60,
    height: 120,
    font: { family: 'Mock Sans', size: 10 },
    text: 'Alpha Beta Gamma'
  })

  const before = doc.getLineCount()
  doc.insert(0, 'Z ')
  doc.layout()

  assert.ok(doc.getLineCount() >= before)
  assert.equal(doc.getLine(0).charStart, 0)

  doc.delete(0, 2)
  doc.layout()

  assert.equal(doc.getLine(0).charStart, 0)
}
