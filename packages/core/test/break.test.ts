import assert from 'node:assert/strict'

import { buildPrefixSums, breakDocument, fitLine } from '../src/break.ts'

export function runBreakFitTests(): void {
  const prefix = buildPrefixSums(new Float32Array([50, 10, 40, 10, 50]))
  assert.equal(fitLine(prefix, 0, 60), 2)
  assert.equal(fitLine(prefix, 2, 50), 4)
}

export function runBreakDocumentTests(): void {
  const tokens = [
    { runId: 'a', runIndex: 0, style: { family: 'Mock', size: 10 }, text: 'Alpha', localStart: 0, localEnd: 5, charStart: 0, charEnd: 5, width: 50, breakAllowed: true, hardBreak: false, kind: 'word', ascent: 8, descent: 2, lineHeight: 10 },
    { runId: 'a', runIndex: 0, style: { family: 'Mock', size: 10 }, text: ' ', localStart: 5, localEnd: 6, charStart: 5, charEnd: 6, width: 10, breakAllowed: true, hardBreak: false, kind: 'space', ascent: 8, descent: 2, lineHeight: 10 },
    { runId: 'a', runIndex: 0, style: { family: 'Mock', size: 10 }, text: 'Beta', localStart: 6, localEnd: 10, charStart: 6, charEnd: 10, width: 40, breakAllowed: true, hardBreak: false, kind: 'word', ascent: 8, descent: 2, lineHeight: 10 }
  ]

  const lines = breakDocument(tokens, buildPrefixSums(new Float32Array([50, 10, 40])), 60, 0, 0, 0, 10)

  assert.equal(lines.length, 2)
  assert.equal(lines[0]?.charStart, 0)
  assert.equal(lines[0]?.charEnd, 5)
  assert.equal(lines[1]?.charStart, 6)
  assert.equal(lines[1]?.charEnd, 10)
}
