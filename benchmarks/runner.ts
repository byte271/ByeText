import { ByeText } from '../packages/core/src/api.ts'
import { createFlowPlugin } from '../packages/plugins/flow/src/index.ts'
import { summarize } from '../packages/plugins/bench/src/harness.ts'

import { bulkInsert } from './scenarios/bulk-insert.ts'
import { emojiEdit } from './scenarios/emoji-edit.ts'
import { firstLayout } from './scenarios/first-layout.ts'
import { insertTyping } from './scenarios/insert-typing.ts'
import { obstacleMove } from './scenarios/obstacle-move.ts'
import { scrollRender } from './scenarios/scroll-render.ts'
import { unicodeRelayout } from './scenarios/unicode-relayout.ts'
import { widthResize } from './scenarios/width-resize.ts'
import type { ByeTextPlugin, TextDocument } from '../packages/core/src/types.ts'

class BenchContext {
  font = 'normal 400 16px system-ui'
  fillStyle = '#111111'
  direction: 'inherit' | 'ltr' | 'rtl' = 'ltr'

  measureText(text: string) {
    return { width: text.length * 8, actualBoundingBoxAscent: 12, actualBoundingBoxDescent: 4 }
  }

  fillText(): void {}
  clearRect(): void {}
  save(): void {}
  restore(): void {}
  beginPath(): void {}
  rect(): void {}
  clip(): void {}
  scale(): void {}
  setTransform(): void {}
}

function createBenchCanvas(width = 320, height = 240) {
  const context = new BenchContext()
  return {
    width,
    height,
    style: {},
    getContext() {
      return context
    }
  }
}

interface BenchmarkCase {
  name: string
  text: string
  scenario: (doc: TextDocument) => void
  width?: number
  height?: number
  runs?: number
  plugins?: ByeTextPlugin[]
}

const latinText = 'ByeText benchmark document. '.repeat(120)
const emojiText = 'Launch 👨🏽‍🚀 with families 👨‍👩‍👧‍👦 and flags 🇺🇸🇯🇵 across the paragraph. '.repeat(48)
const bidiText = 'English שלום العربية فارسی 12345 mixed direction content. '.repeat(64)
const unicodeBreakText = '漢字かな交じり文\u200Bsoft break opportunities and Hello\u00A0world keep-together pairs. '.repeat(56)

const benchmarks: BenchmarkCase[] = [
  { name: 'latin/first-layout', text: latinText, scenario: firstLayout, runs: 30 },
  { name: 'latin/insert-typing', text: latinText, scenario: insertTyping, runs: 30 },
  { name: 'latin/bulk-insert', text: latinText, scenario: bulkInsert, runs: 30 },
  { name: 'latin/width-resize', text: latinText, scenario: widthResize, runs: 30 },
  { name: 'latin/scroll-render', text: latinText, scenario: scrollRender, runs: 30 },
  { name: 'flow/obstacle-move', text: latinText, scenario: obstacleMove, runs: 30, plugins: [createFlowPlugin()] },
  { name: 'unicode/linebreak-layout', text: unicodeBreakText, scenario: firstLayout, runs: 30 },
  { name: 'unicode/relayout', text: unicodeBreakText, scenario: unicodeRelayout, runs: 30 },
  { name: 'emoji/edit', text: emojiText, scenario: emojiEdit, runs: 30 },
  { name: 'bidi/first-layout', text: bidiText, scenario: firstLayout, runs: 30 },
  { name: 'bidi/scroll-render', text: bidiText, scenario: scrollRender, runs: 30 }
]

const format = (value: number) => value.toFixed(3).padStart(7)

const results = benchmarks.map((bench) => {
  const samples: number[] = []
  for (let run = 0; run < (bench.runs ?? 20); run += 1) {
    const canvas = createBenchCanvas(bench.width ?? 320, bench.height ?? 240)
    const doc = ByeText.create({
      canvas,
      text: bench.text,
      width: bench.width ?? 240,
      height: bench.height ?? 180,
      font: { family: 'Mock Sans', size: 14 },
      plugins: bench.plugins ?? []
    })

    const start = performance.now()
    bench.scenario(doc)
    samples.push(performance.now() - start)
    doc.destroy()
  }

  return {
    ...summarize(bench.name, bench.runs ?? 20, samples),
    textLength: bench.text.length,
    samplesMs: samples.map((sample) => Number(sample.toFixed(3)))
  }
})

for (const result of results) {
  console.log(
    `${result.operation.padEnd(24)} mean ${format(result.meanMs)}ms  p95 ${format(result.p95Ms)}ms  max ${format(result.maxMs)}ms  chars ${String(result.textLength).padStart(5)}`
  )
}

console.log('\nDetailed benchmark data:')
console.log(JSON.stringify(results, null, 2))
