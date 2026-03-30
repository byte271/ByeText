import { ByeText } from '../packages/core/src/api.ts'
import { createFlowPlugin } from '../packages/plugins/flow/src/index.ts'

import { bulkInsert } from './scenarios/bulk-insert.ts'
import { firstLayout } from './scenarios/first-layout.ts'
import { insertTyping } from './scenarios/insert-typing.ts'
import { obstacleMove } from './scenarios/obstacle-move.ts'
import { scrollRender } from './scenarios/scroll-render.ts'
import { widthResize } from './scenarios/width-resize.ts'

class BenchContext {
  font = 'normal 400 16px system-ui'
  fillStyle = '#111111'

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

const scenarios = [
  ['first-layout', firstLayout],
  ['insert-typing', insertTyping],
  ['bulk-insert', bulkInsert],
  ['width-resize', widthResize],
  ['scroll-render', scrollRender],
  ['obstacle-move', obstacleMove]
] as const

const text = 'ByeText benchmark document. '.repeat(120)

for (const [name, scenario] of scenarios) {
  const canvas = createBenchCanvas()
  const doc = ByeText.create({
    canvas,
    text,
    width: 240,
    height: 180,
    font: { family: 'Mock Sans', size: 14 },
    plugins: [createFlowPlugin()]
  })

  const start = performance.now()
  scenario(doc)
  const duration = performance.now() - start
  console.log(`${name}: ${duration.toFixed(3)}ms`)
}
