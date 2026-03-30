import assert from 'node:assert/strict'

import { ByeText } from '../src/api.ts'
import { createFlowPlugin } from '../../plugins/flow/src/index.ts'

import { createMockCanvas } from './mock-canvas.ts'

export function runFlowTests(): void {
  const canvas = createMockCanvas(320, 220)
  const flow = createFlowPlugin()
  const doc = ByeText.create({
    canvas,
    width: 240,
    height: 220,
    font: { family: 'Mock Sans', size: 10 },
    text: 'One long paragraph of measured words that should visibly split around a centered obstacle while staying on the same visual line.',
    plugins: [flow]
  })

  flow.addObstacle({ type: 'circle', cx: 120, cy: 30, r: 28 }, { padding: 8, side: 'both' })
  doc.layout()

  const splitLine = Array.from({ length: doc.getLineCount() }, (_, index) => doc.getLine(index))
    .find((line) => line.segments.length > 1)

  assert.ok(splitLine, 'expected a line with two flow segments around the obstacle')
}
