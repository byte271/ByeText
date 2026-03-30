import { buildPrefixSums, breakDocument, flattenRunsToTokens } from './break.ts'
import { beginMeasurementPass, finishMeasurementPass, measureRun, measureTextFragment } from './measure.ts'
import { buildDirtyRegionsForLines } from './render.ts'
import { clamp, EMPTY_LAYOUT, totalTextLength } from './types.ts'
import type {
  CharPosition,
  InternalTextDocument,
  LayoutLine,
  LayoutState,
  LayoutToken,
  MutableRun,
  RunStyle
} from './types.ts'

function cloneLine(line: LayoutLine): LayoutLine {
  return {
    ...line,
    runSpans: line.runSpans.map((span) => ({ ...span })),
    segments: line.segments.map((segment) => ({
      ...segment,
      runSpans: segment.runSpans.map((span) => ({ ...span })),
      xPrefix: new Float64Array(segment.xPrefix)
    })),
    xPrefix: new Float64Array(line.xPrefix)
  }
}

function buildLayoutState(lines: LayoutLine[], version: number): LayoutState {
  const lineStarts = new Int32Array(lines.length)
  const yPrefix = new Float64Array(lines.length + 1)

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    lineStarts[index] = line?.charStart ?? 0
    yPrefix[index] = line?.y ?? 0
  }

  if (lines.length > 0) {
    const lastLine = lines[lines.length - 1]
    yPrefix[lines.length] = (lastLine?.y ?? 0) + (lastLine?.height ?? 0)
  }

  return {
    lineCount: lines.length,
    totalHeight: yPrefix[lines.length] ?? 0,
    lines,
    charToPos: { lineStarts },
    posToChar: { lineYPrefix: yPrefix },
    version
  }
}

function defaultLineHeight(runs: MutableRun[]): number {
  return runs[0]?.style.lineHeight ?? Math.max(16, (runs[0]?.style.size ?? 16) * 1.25)
}

function findLineIndexForChar(lines: LayoutLine[], charIndex: number): number {
  if (lines.length === 0) {
    return 0
  }

  let lo = 0
  let hi = lines.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1
    const line = lines[mid]
    if (!line) {
      break
    }

    if (charIndex < line.charStart) {
      hi = mid - 1
    } else if (charIndex > line.charEnd) {
      lo = mid + 1
    } else {
      return mid
    }
  }

  return clamp(lo, 0, Math.max(0, lines.length - 1))
}

function findLineIndexForY(lines: LayoutLine[], yPrefix: Float64Array, y: number): number {
  if (lines.length === 0) {
    return 0
  }

  let lo = 0
  let hi = lines.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1
    const start = yPrefix[mid] ?? 0
    const end = yPrefix[mid + 1] ?? start
    if (y < start) {
      hi = mid - 1
    } else if (y > end) {
      lo = mid + 1
    } else {
      return mid
    }
  }

  return clamp(lo, 0, Math.max(0, lines.length - 1))
}

function shiftedTail(lines: LayoutLine[], fromIndex: number, deltaY: number, startIndex: number): LayoutLine[] {
  const tail: LayoutLine[] = []
  for (let index = fromIndex; index < lines.length; index += 1) {
    const line = lines[index]
    if (!line) {
      continue
    }

    const copy = cloneLine(line)
    copy.index = startIndex + tail.length
    copy.y += deltaY
    tail.push(copy)
  }

  return tail
}

function incrementalRelayout(doc: InternalTextDocument, tokens: LayoutToken[], prefixSums: Float64Array): LayoutLine[] | null {
  const state = doc._state
  const dirty = state.dirtyRange
  const previous = state.layoutState.lines

  if (!dirty || previous.length === 0) {
    return null
  }

  const totalChars = Math.max(1, totalTextLength(state.runs))
  if (dirty.reason === 'width-change' || (dirty.charEnd - dirty.charStart) / totalChars > 0.3) {
    return null
  }

  const firstLineIndex = findLineIndexForChar(previous, dirty.charStart)
  const firstLine = previous[firstLineIndex]
  if (!firstLine) {
    return null
  }

  const head = previous.slice(0, firstLineIndex).map(cloneLine)
  const yOffset = head.length > 0 ? (head[head.length - 1]?.y ?? 0) + (head[head.length - 1]?.height ?? 0) : 0
  const relaid = breakDocument(
    tokens,
    prefixSums,
    state.layoutWidth,
    firstLine.charStart,
    firstLineIndex,
    yOffset,
    defaultLineHeight(state.runs),
    (lineIndex, y, height) => state.plugins.runObstacle(lineIndex, y, height, state.layoutWidth)
  )

  let stableOldIndex = -1
  let stableNewIndex = -1
  let searchFrom = firstLineIndex

  for (let newIndex = 0; newIndex < relaid.length; newIndex += 1) {
    const nextLine = relaid[newIndex]
    if (!nextLine) {
      continue
    }

    for (let oldIndex = searchFrom; oldIndex < previous.length; oldIndex += 1) {
      const oldLine = previous[oldIndex]
      if (!oldLine) {
        continue
      }

      if (
        oldLine.charStart === nextLine.charStart &&
        oldLine.charEnd === nextLine.charEnd &&
        oldLine.height === nextLine.height
      ) {
        stableOldIndex = oldIndex
        stableNewIndex = newIndex
        searchFrom = oldIndex
        break
      }

      if (oldLine.charStart > nextLine.charStart) {
        break
      }
    }

    if (stableOldIndex >= 0) {
      break
    }
  }

  if (stableOldIndex < 0 || stableNewIndex < 0) {
    return head.concat(relaid)
  }

  const rebuilt = relaid.slice(0, stableNewIndex + 1)
  const newStable = rebuilt[rebuilt.length - 1]
  const oldStable = previous[stableOldIndex]
  if (!newStable || !oldStable) {
    return head.concat(relaid)
  }

  const deltaY = (newStable.y + newStable.height) - (oldStable.y + oldStable.height)
  const tail = shiftedTail(previous, stableOldIndex + 1, deltaY, firstLineIndex + rebuilt.length)
  return head.concat(rebuilt, tail)
}

export function runLayout(doc: InternalTextDocument): LayoutState {
  const state = doc._state
  const previous = state.layoutState

  beginMeasurementPass(state.measureCache)
  for (const run of state.runs) {
    run.metrics = state.plugins.runMeasure(run, state.measureCache) ?? measureRun(run, state.measureContext, state.measureCache)
  }

  const tokens = flattenRunsToTokens(state.runs)
  const widths = new Float32Array(tokens.length)
  for (let index = 0; index < tokens.length; index += 1) {
    widths[index] = tokens[index]?.width ?? 0
  }

  const prefixSums = buildPrefixSums(widths)
  const pluginLines = state.plugins.runBreak({
    runs: state.runs,
    tokens,
    prefixSums,
    width: state.layoutWidth
  })

  const lines = pluginLines
    ?? incrementalRelayout(doc, tokens, prefixSums)
    ?? breakDocument(
      tokens,
      prefixSums,
      state.layoutWidth,
      0,
      0,
      0,
      defaultLineHeight(state.runs),
      (lineIndex, y, height) => state.plugins.runObstacle(lineIndex, y, height, state.layoutWidth)
    )

  const nextState = state.plugins.runLayout(buildLayoutState(lines, state.version + 1)) ?? buildLayoutState(lines, state.version + 1)
  state.lineCache = {
    lines: nextState.lines,
    prefixSums: nextState.posToChar.lineYPrefix,
    version: nextState.version,
    dirtyFrom: state.dirtyRange ? findLineIndexForChar(nextState.lines, state.dirtyRange.charStart) : 0
  }
  state.layoutState = nextState
  state.dirtyRegions = buildDirtyRegionsForLines(previous.lines, nextState.lines, state.layoutWidth)
  state.version = nextState.version
  state.dirtyRange = null
  finishMeasurementPass(state.measureCache)
  return nextState
}

function findRunById(doc: InternalTextDocument, runId: string) {
  return doc._state.runs.find((run) => run.id === runId) ?? null
}

function measureWithinStyle(text: string, style: RunStyle, doc: InternalTextDocument): number {
  return measureTextFragment(text, style, doc._state.measureContext)
}

export function charToPosition(doc: InternalTextDocument, charIndex: number): CharPosition {
  const state = doc._state
  const totalChars = totalTextLength(state.runs)
  const index = clamp(charIndex, 0, totalChars)
  const lines = state.layoutState.lines

  if (lines.length === 0) {
    return { x: 0, y: 0, lineIndex: 0, baseline: defaultLineHeight(state.runs) * 0.8 }
  }

  const lineIndex = findLineIndexForChar(lines, index)
  const line = lines[lineIndex]
  if (!line) {
    return { x: 0, y: 0, lineIndex: 0, baseline: defaultLineHeight(state.runs) * 0.8 }
  }

  if (index <= line.charStart) {
    return { x: line.xOffset, y: line.y, lineIndex, baseline: line.baseline }
  }

  for (const span of line.runSpans) {
    if (index < span.charStart) {
      return { x: span.x, y: line.y, lineIndex, baseline: line.baseline }
    }

    if (index >= span.charStart && index <= span.charEnd) {
      const run = findRunById(doc, span.runId)
      if (!run) {
        return { x: span.x, y: line.y, lineIndex, baseline: line.baseline }
      }

      const localStart = Math.max(0, span.charStart - run.globalStart)
      const localIndex = Math.max(localStart, index - run.globalStart)
      return {
        x: span.x + measureWithinStyle(run.text.slice(localStart, localIndex), run.style, doc),
        y: line.y,
        lineIndex,
        baseline: line.baseline
      }
    }
  }

  const lastSpan = line.runSpans[line.runSpans.length - 1]
  return {
    x: lastSpan ? lastSpan.x + lastSpan.width : line.xOffset + line.width,
    y: line.y,
    lineIndex,
    baseline: line.baseline
  }
}

export function positionToChar(doc: InternalTextDocument, x: number, y: number): number {
  const state = doc._state
  const lines = state.layoutState.lines
  if (lines.length === 0) {
    return 0
  }

  const lineIndex = findLineIndexForY(lines, state.layoutState.posToChar.lineYPrefix, y)
  const line = lines[lineIndex]
  if (!line) {
    return 0
  }

  if (x <= line.xOffset) {
    return line.charStart
  }

  for (const span of line.runSpans) {
    if (x < span.x) {
      return span.charStart
    }

    if (x <= span.x + span.width) {
      const run = findRunById(doc, span.runId)
      if (!run) {
        return span.charStart
      }

      const localStart = Math.max(0, span.charStart - run.globalStart)
      const localEnd = Math.max(localStart, span.charEnd - run.globalStart)
      for (let cursor = localStart; cursor <= localEnd; cursor += 1) {
        const width = measureWithinStyle(run.text.slice(localStart, cursor), run.style, doc)
        if (span.x + width >= x) {
          return run.globalStart + cursor
        }
      }

      return span.charEnd
    }
  }

  return line.charEnd
}

export function getLineAt(doc: InternalTextDocument, index: number): LayoutLine {
  return doc._state.layoutState.lines[clamp(index, 0, Math.max(0, doc._state.layoutState.lines.length - 1))]
    ?? EMPTY_LAYOUT.lines[0]!
}
