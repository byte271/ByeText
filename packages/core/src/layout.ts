import { breakDocument, breakLine, buildPrefixSums, flattenRunsToTokens } from './break.ts'
import { beginMeasurementPass, finishMeasurementPass, measureRun, measureTextFragment } from './measure.ts'
import { buildDirtyRegionsForLines } from './render.ts'
import { clamp, cloneLine, EMPTY_LAYOUT, totalTextLength } from './types.ts'
import type {
  CharPosition,
  InternalTextDocument,
  LayoutLine,
  LayoutState,
  LayoutToken,
  MutableRun,
  RunStyle
} from './types.ts'

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

function spanStart(line: LayoutLine, span: LayoutLine['runSpans'][number]): number {
  return span.charStart + (line.charShift ?? 0)
}

function spanEnd(line: LayoutLine, span: LayoutLine['runSpans'][number]): number {
  return span.charEnd + (line.charShift ?? 0)
}

function shiftedTailWithDelta(
  lines: LayoutLine[],
  fromIndex: number,
  deltaY: number,
  startIndex: number,
  charDelta: number,
  tokenDelta: number
): LayoutLine[] {
  const tail: LayoutLine[] = []
  for (let index = fromIndex; index < lines.length; index += 1) {
    const line = lines[index]
    if (!line) {
      continue
    }

    const copy: LayoutLine = {
      ...line,
      index: startIndex + tail.length,
      y: line.y + deltaY,
      charStart: line.charStart + charDelta,
      charEnd: line.charEnd + charDelta,
      charShift: (line.charShift ?? 0) + charDelta,
      tokenStart: line.tokenStart + tokenDelta,
      tokenEnd: line.tokenEnd + tokenDelta,
      segments: line.segments.map((segment) => ({
        ...segment,
        tokenStart: segment.tokenStart + tokenDelta,
        tokenEnd: segment.tokenEnd + tokenDelta
      }))
    }
    tail.push(copy)
  }

  return tail
}

function lineShapeEqual(next: LayoutLine, previous: LayoutLine): boolean {
  if (
    next.signature !== previous.signature ||
    next.width !== previous.width ||
    next.height !== previous.height ||
    next.xOffset !== previous.xOffset ||
    next.runSpans.length !== previous.runSpans.length ||
    next.segments.length !== previous.segments.length
  ) {
    return false
  }

  for (let index = 0; index < next.runSpans.length; index += 1) {
    const left = next.runSpans[index]
    const right = previous.runSpans[index]
    if (left?.x !== right?.x || left?.width !== right?.width) {
      return false
    }
  }

  for (let index = 0; index < next.segments.length; index += 1) {
    const left = next.segments[index]
    const right = previous.segments[index]
    if (
      left?.xOffset !== right?.xOffset ||
      left?.maxWidth !== right?.maxWidth ||
      left?.width !== right?.width ||
      left?.runSpans.length !== right?.runSpans.length
    ) {
      return false
    }
  }

  return true
}

function canReuseTail(next: LayoutLine, previous: LayoutLine, charDelta: number): boolean {
  return (
    next.charStart === previous.charStart + charDelta &&
    next.charEnd === previous.charEnd + charDelta &&
    lineShapeEqual(next, previous)
  )
}

function incrementalRelayout(doc: InternalTextDocument, tokens: LayoutToken[], prefixSums: Float64Array): LayoutLine[] | null {
  const state = doc._state
  const dirty = state.dirtyRange
  const previous = state.layoutState.lines

  if (!dirty || previous.length === 0) {
    return null
  }

  const firstLineIndex = dirty.reason === 'width-change' ? 0 : findLineIndexForChar(previous, dirty.charStart)
  const firstLine = previous[firstLineIndex]
  if (!firstLine) {
    return null
  }

  const head = previous.slice(0, firstLineIndex)
  const oldTotalChars = previous[previous.length - 1]?.charEnd ?? 0
  const charDelta = totalTextLength(state.runs) - oldTotalChars
  const defaultHeight = defaultLineHeight(state.runs)
  const constraintForLine = (lineIndex: number, y: number, height: number) => state.plugins.runObstacle(lineIndex, y, height, state.layoutWidth)
  const relaid: LayoutLine[] = []
  let lineIndex = firstLineIndex
  let y = head.length > 0 ? (head[head.length - 1]?.y ?? 0) + (head[head.length - 1]?.height ?? 0) : 0
  let tokenStart = firstLine.tokenStart

  while (tokenStart < tokens.length) {
    const result = breakLine(tokens, prefixSums, state.layoutWidth, tokenStart, lineIndex, y, defaultHeight, constraintForLine)
    if (!result) {
      break
    }

    relaid.push(result.line)

    const oldLine = previous[lineIndex]
    if (oldLine && canReuseTail(result.line, oldLine, charDelta)) {
      const tokenDelta = result.line.tokenStart - oldLine.tokenStart
      const tail = shiftedTailWithDelta(previous, lineIndex + 1, result.line.y - oldLine.y, lineIndex + 1, charDelta, tokenDelta)
      return head.concat(relaid, tail)
    }

    tokenStart = result.nextTokenStart
    lineIndex += 1
    y = result.line.y + result.line.height
  }

  return head.concat(relaid)
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

function measureWithinStyle(text: string, style: RunStyle, doc: InternalTextDocument): number {
  return measureTextFragment(text, style, doc._state.measureContext)
}

function findBoundaryIndex(run: MutableRun, localIndex: number, edge: 'start' | 'end'): number {
  const boundaries = run.metrics?.boundaries ?? []
  let lo = 0
  let hi = boundaries.length

  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if ((boundaries[mid]?.[edge] ?? 0) < localIndex) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }

  return lo
}

function measureRunDistance(doc: InternalTextDocument, run: MutableRun, localStart: number, localEnd: number): number {
  if (localEnd <= localStart) {
    return 0
  }

  const metrics = run.metrics
  if (!metrics) {
    return measureWithinStyle(run.text.slice(localStart, localEnd), run.style, doc)
  }

  const startIndex = findBoundaryIndex(run, localStart, 'start')
  const endIndex = findBoundaryIndex(run, localEnd, 'end')
  const endBoundary = metrics.boundaries[endIndex]
  const fullWidth = (metrics.prefixSums[endIndex] ?? 0) - (metrics.prefixSums[startIndex] ?? 0)

  if (!endBoundary || localEnd <= endBoundary.start) {
    return fullWidth
  }

  if (localEnd >= endBoundary.end) {
    return fullWidth + (metrics.segmentWidths[endIndex] ?? 0)
  }

  return fullWidth + measureWithinStyle(run.text.slice(endBoundary.start, localEnd), run.style, doc)
}

function charOffsetForWidth(doc: InternalTextDocument, run: MutableRun, localStart: number, localEnd: number, width: number): number {
  const clampedWidth = Math.max(0, width)
  if (clampedWidth <= 0 || localEnd <= localStart) {
    return localStart
  }

  const metrics = run.metrics
  if (!metrics) {
    let lo = localStart
    let hi = localEnd
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      if (measureWithinStyle(run.text.slice(localStart, mid + 1), run.style, doc) < clampedWidth) {
        lo = mid + 1
      } else {
        hi = mid
      }
    }

    return lo
  }

  const startIndex = findBoundaryIndex(run, localStart, 'start')
  const endIndex = findBoundaryIndex(run, localEnd, 'start')
  const base = metrics.prefixSums[startIndex] ?? 0
  let lo = startIndex
  let hi = endIndex

  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    const current = (metrics.prefixSums[mid + 1] ?? base) - base
    if (current < clampedWidth) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }

  const boundary = metrics.boundaries[lo]
  if (!boundary) {
    return localEnd
  }

  const widthBefore = (metrics.prefixSums[lo] ?? base) - base
  if (clampedWidth <= widthBefore) {
    return boundary.start
  }

  let charLo = Math.max(localStart, boundary.start)
  let charHi = Math.min(localEnd, boundary.end)
  while (charLo < charHi) {
    const mid = (charLo + charHi) >>> 1
    const current = widthBefore + measureWithinStyle(run.text.slice(boundary.start, mid + 1), run.style, doc)
    if (current < clampedWidth) {
      charLo = mid + 1
    } else {
      charHi = mid
    }
  }

  return charLo
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
    const start = spanStart(line, span)
    const end = spanEnd(line, span)
    if (index < start) {
      return { x: span.x, y: line.y, lineIndex, baseline: line.baseline }
    }

    if (index >= start && index <= end) {
      const run = doc._state.runLookup.get(span.runId)
      if (!run) {
        return { x: span.x, y: line.y, lineIndex, baseline: line.baseline }
      }

      const localStart = Math.max(0, start - run.globalStart)
      const localIndex = Math.max(localStart, index - run.globalStart)
      return {
        x: span.x + measureRunDistance(doc, run, localStart, localIndex),
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
    const start = spanStart(line, span)
    const end = spanEnd(line, span)
    if (x < span.x) {
      return start
    }

    if (x <= span.x + span.width) {
      const run = doc._state.runLookup.get(span.runId)
      if (!run) {
        return start
      }

      const localStart = Math.max(0, start - run.globalStart)
      const localEnd = Math.max(localStart, end - run.globalStart)
      const localOffset = charOffsetForWidth(doc, run, localStart, localEnd, x - span.x)
      return Math.min(end, run.globalStart + localOffset)
    }
  }

  return line.charEnd
}

export function getLineAt(doc: InternalTextDocument, index: number): LayoutLine {
  const line = doc._state.layoutState.lines[clamp(index, 0, Math.max(0, doc._state.layoutState.lines.length - 1))]
    ?? EMPTY_LAYOUT.lines[0]!
  if (!line || line.charShift === 0) {
    return line
  }

  const shifted = cloneLine(line)
  shifted.charShift = 0
  shifted.runSpans.forEach((span) => {
    span.charStart += line.charShift
    span.charEnd += line.charShift
  })
  shifted.segments.forEach((segment) => {
    segment.runSpans.forEach((span) => {
      span.charStart += line.charShift
      span.charEnd += line.charShift
    })
  })
  return shifted
}
