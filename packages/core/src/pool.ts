import type { LayoutLine, LinePoolLike } from './types.ts'

function freshLine(): LayoutLine {
  return {
    index: 0,
    y: 0,
    height: 0,
    baseline: 0,
    width: 0,
    signature: '',
    charStart: 0,
    charEnd: 0,
    charShift: 0,
    runSpans: [],
    segments: [],
    xOffset: 0,
    tokenStart: 0,
    tokenEnd: 0,
    xPrefix: new Float64Array([0])
  }
}

export function createLinePool(): LinePoolLike {
  const pool: LayoutLine[] = []

  return {
    acquire(): LayoutLine {
      return pool.pop() ?? freshLine()
    },
    recycle(lines: LayoutLine[]): void {
      for (const line of lines) {
        line.runSpans = []
        line.segments = []
        line.xPrefix = new Float64Array([0])
        pool.push(line)
      }
    }
  }
}
