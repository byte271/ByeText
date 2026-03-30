import { runBreakDocumentTests, runBreakFitTests } from './break.test.ts'
import { runFlowTests } from './flow.test.ts'
import { runIncrementalTests } from './incremental.test.ts'
import { runLayoutTests } from './layout.test.ts'
import { runMeasureEvictionTests, runMeasureTests } from './measure.test.ts'
import { runRenderTests } from './render.test.ts'
import { runUnicodeTests } from './unicode.test.ts'

const tests: Array<{ name: string; run: () => void }> = [
  { name: 'measure/cache', run: runMeasureTests },
  { name: 'measure/eviction', run: runMeasureEvictionTests },
  { name: 'break/fit', run: runBreakFitTests },
  { name: 'break/document', run: runBreakDocumentTests },
  { name: 'flow/split-gap', run: runFlowTests },
  { name: 'layout/queries', run: runLayoutTests },
  { name: 'render/basic', run: runRenderTests },
  { name: 'incremental/edit', run: runIncrementalTests },
  { name: 'unicode/compat', run: runUnicodeTests }
]

let failures = 0

for (const test of tests) {
  try {
    test.run()
    console.log(`PASS ${test.name}`)
  } catch (error) {
    failures += 1
    console.error(`FAIL ${test.name}`)
    console.error(error)
  }
}

if (failures > 0) {
  process.exitCode = 1
} else {
  console.log(`PASS ${tests.length} tests`)
}
