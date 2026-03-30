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

  const viewportCanvas = createMockCanvas(160, 120)
  const viewportDoc = ByeText.create({
    canvas: viewportCanvas,
    width: 50,
    height: 120,
    font: { family: 'Mock Sans', size: 10 },
    text: 'Alpha Beta Gamma Delta'
  }) as typeof doc & { _state: { viewport: { scrollY: number; height: number }; lastRenderVersion: number } }

  viewportDoc._state.viewport.height = 8
  viewportDoc._state.lastRenderVersion = -1
  viewportCanvas.context.drawCalls.length = 0
  viewportDoc.render()

  assert.equal(viewportCanvas.context.drawCalls.length, 1)
}
