import assert from 'node:assert/strict'

import { ByeText } from '../src/api.ts'

import { createMockCanvas } from './mock-canvas.ts'

export function runRenderTests(): void {
  const canvas = createMockCanvas(120, 80)
  const doc = ByeText.create({
    canvas,
    width: 60,
    height: 80,
    font: { family: 'Mock Sans', size: 10 },
    text: 'Alpha Beta'
  })

  doc.render()

  assert.ok(canvas.context.drawCalls.length > 0)
  assert.ok(canvas.context.cleared.length > 0)
}
