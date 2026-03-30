import { cloneLine } from './types.ts'
import type {
  LayoutConstraint,
  LayoutLine,
  LayoutLineSegment,
  LayoutSegmentConstraint,
  LayoutToken,
  MutableRun,
  RunSpan
} from './types.ts'

export function buildPrefixSums(widths: ArrayLike<number>): Float64Array {
  const prefix = new Float64Array(widths.length + 1)
  for (let index = 0; index < widths.length; index += 1) {
    prefix[index + 1] = prefix[index] + widths[index]
  }

  return prefix
}

export function fitLine(prefixWidths: Float64Array, start: number, maxWidth: number): number {
  let lo = start
  let hi = prefixWidths.length - 1
  const base = prefixWidths[start] ?? 0

  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1
    const width = (prefixWidths[mid] ?? base) - base
    if (width <= maxWidth) {
      lo = mid
    } else {
      hi = mid - 1
    }
  }

  return lo
}

export function findBreakBefore(tokens: LayoutToken[], index: number, start: number): number {
  if (index <= start) {
    return Math.min(tokens.length, start + 1)
  }

  for (let cursor = index; cursor > start; cursor -= 1) {
    const token = tokens[cursor - 1]
    if (token && (token.hardBreak || token.breakAllowed)) {
      return cursor
    }
  }

  return index
}

function createRunSpans(tokens: LayoutToken[], tokenStart: number, tokenEnd: number, xOffset: number): { runSpans: RunSpan[]; width: number; xPrefix: Float64Array } {
  const runSpans: RunSpan[] = []
  const xPrefix = new Float64Array(Math.max(1, tokenEnd - tokenStart + 1))
  let x = xOffset
  xPrefix[0] = xOffset

  for (let tokenIndex = tokenStart; tokenIndex < tokenEnd; tokenIndex += 1) {
    const token = tokens[tokenIndex]
    if (!token || token.kind === 'newline') {
      xPrefix[tokenIndex - tokenStart + 1] = x
      continue
    }

    const lastSpan = runSpans[runSpans.length - 1]
    if (lastSpan && lastSpan.runId === token.runId && lastSpan.charEnd === token.charStart) {
      lastSpan.charEnd = token.charEnd
      lastSpan.width += token.width
    } else {
      runSpans.push({
        runId: token.runId,
        charStart: token.charStart,
        charEnd: token.charEnd,
        x,
        width: token.width
      })
    }

    x += token.width
    xPrefix[tokenIndex - tokenStart + 1] = x
  }

  return {
    runSpans,
    width: Math.max(0, x - xOffset),
    xPrefix
  }
}

function normalizeConstraintSegments(layoutWidth: number, constraint?: LayoutConstraint | null): LayoutSegmentConstraint[] {
  const sourceSegments = constraint?.segments && constraint.segments.length > 0
    ? constraint.segments
    : [{ xOffset: constraint?.xOffset ?? 0, maxWidth: constraint?.maxWidth ?? layoutWidth }]

  const normalized = sourceSegments
    .map((segment) => {
      const xOffset = Math.max(0, Math.min(layoutWidth, segment.xOffset))
      const maxWidth = Math.max(0, Math.min(layoutWidth - xOffset, segment.maxWidth))
      return {
        xOffset,
        maxWidth
      }
    })
    .filter((segment) => segment.maxWidth > 0)
    .sort((left, right) => left.xOffset - right.xOffset)

  return normalized.length > 0 ? normalized : [{ xOffset: 0, maxWidth: layoutWidth }]
}

function trimTrailingSpaces(tokens: LayoutToken[], tokenStart: number, tokenEnd: number): number {
  let end = tokenEnd
  while (end > tokenStart && tokens[end - 1]?.kind === 'space') {
    end -= 1
  }

  return end
}

function skipLeadingSpaces(tokens: LayoutToken[], tokenIndex: number): number {
  let cursor = tokenIndex
  while (tokens[cursor]?.kind === 'space') {
    cursor += 1
  }

  return cursor
}

function createLineXPrefix(segments: LayoutLineSegment[]): Float64Array {
  if (segments.length === 0) {
    return new Float64Array([0])
  }

  const values: number[] = [segments[0]?.xOffset ?? 0]
  for (const segment of segments) {
    for (let index = 1; index < segment.xPrefix.length; index += 1) {
      values.push(segment.xPrefix[index] ?? segment.xOffset)
    }
  }

  return new Float64Array(values)
}

function lineHeight(tokens: LayoutToken[], tokenStart: number, tokenEnd: number, defaultHeight: number): { ascent: number; descent: number; lineHeight: number } {
  let ascent = 0
  let descent = 0
  let height = defaultHeight

  for (let tokenIndex = tokenStart; tokenIndex < tokenEnd; tokenIndex += 1) {
    const token = tokens[tokenIndex]
    if (!token || token.kind === 'newline') {
      continue
    }

    ascent = Math.max(ascent, token.ascent)
    descent = Math.max(descent, token.descent)
    height = Math.max(height, token.lineHeight)
  }

  if (ascent === 0 && descent === 0) {
    ascent = defaultHeight * 0.8
    descent = defaultHeight * 0.2
  }

  return {
    ascent,
    descent,
    lineHeight: Math.max(height, ascent + descent)
  }
}

export function flattenRunsToTokens(runs: MutableRun[]): LayoutToken[] {
  const tokens: LayoutToken[] = []

  for (let runIndex = 0; runIndex < runs.length; runIndex += 1) {
    const run = runs[runIndex]
    const metrics = run?.metrics
    if (!run || !metrics) {
      continue
    }

    for (let boundaryIndex = 0; boundaryIndex < metrics.boundaries.length; boundaryIndex += 1) {
      const boundary = metrics.boundaries[boundaryIndex]
      if (!boundary) {
        continue
      }

      tokens.push({
        runId: run.id,
        runIndex,
        style: run.style,
        text: run.text.slice(boundary.start, boundary.end),
        localStart: boundary.start,
        localEnd: boundary.end,
        charStart: run.globalStart + boundary.start,
        charEnd: run.globalStart + boundary.end,
        width: metrics.segmentWidths[boundaryIndex] ?? 0,
        breakAllowed: boundary.breakAllowed,
        hardBreak: boundary.hardBreak,
        kind: boundary.kind,
        ascent: metrics.ascent,
        descent: metrics.descent,
        lineHeight: metrics.lineHeight
      })
    }
  }

  return tokens
}

function findTokenIndexForChar(tokens: LayoutToken[], charIndex: number): number {
  let lo = 0
  let hi = tokens.length - 1

  while (lo <= hi) {
    const mid = (lo + hi) >>> 1
    const token = tokens[mid]
    if (!token) {
      break
    }

    if (charIndex < token.charStart) {
      hi = mid - 1
    } else if (charIndex >= token.charEnd) {
      lo = mid + 1
    } else {
      return mid
    }
  }

  return Math.min(tokens.length, lo)
}

export function breakDocument(
  tokens: LayoutToken[],
  prefixSums: Float64Array,
  layoutWidth: number,
  startChar: number,
  startLineIndex: number,
  startY: number,
  defaultLineHeight: number,
  constraintForLine?: (lineIndex: number, y: number, estimatedHeight: number) => LayoutConstraint | null
): LayoutLine[] {
  if (tokens.length === 0) {
    return [
      {
        index: startLineIndex,
        y: startY,
        height: defaultLineHeight,
        baseline: defaultLineHeight * 0.8,
        width: 0,
        charStart: startChar,
        charEnd: startChar,
        runSpans: [],
        segments: [],
        xOffset: 0,
        tokenStart: 0,
        tokenEnd: 0,
        xPrefix: new Float64Array([0])
      }
    ]
  }

  const lines: LayoutLine[] = []
  let lineIndex = startLineIndex
  let y = startY
  let tokenStart = findTokenIndexForChar(tokens, startChar)

  while (tokenStart < tokens.length) {
    const firstToken = tokens[tokenStart]
    const lineConstraint = constraintForLine?.(lineIndex, y, defaultLineHeight) ?? { xOffset: 0, maxWidth: layoutWidth }
    const segments = normalizeConstraintSegments(layoutWidth, lineConstraint)

    if (firstToken?.kind === 'newline') {
      lines.push({
        index: lineIndex,
        y,
        height: defaultLineHeight,
        baseline: defaultLineHeight * 0.8,
        width: 0,
        charStart: firstToken.charStart,
        charEnd: firstToken.charEnd,
        runSpans: [],
        segments: [],
        xOffset: segments[0]?.xOffset ?? 0,
        tokenStart,
        tokenEnd: tokenStart,
        xPrefix: new Float64Array([segments[0]?.xOffset ?? 0])
      })
      tokenStart += 1
      lineIndex += 1
      y += defaultLineHeight
      continue
    }

    let tokenCursor = tokenStart
    let encounteredNewline = false
    const lineSegments: LayoutLineSegment[] = []

    for (const segment of segments) {
      tokenCursor = skipLeadingSpaces(tokens, tokenCursor)
      if (tokenCursor >= tokens.length) {
        break
      }

      if (tokens[tokenCursor]?.kind === 'newline') {
        encounteredNewline = true
        tokenCursor += 1
        break
      }

      let candidateEnd = fitLine(prefixSums, tokenCursor, segment.maxWidth)
      if (candidateEnd <= tokenCursor) {
        candidateEnd = tokenCursor + 1
      }

      let newlineIndex = -1
      for (let tokenIndex = tokenCursor; tokenIndex < candidateEnd; tokenIndex += 1) {
        if (tokens[tokenIndex]?.kind === 'newline') {
          newlineIndex = tokenIndex
          break
        }
      }

      let segmentEnd = newlineIndex >= 0 ? newlineIndex : findBreakBefore(tokens, candidateEnd, tokenCursor)
      if (segmentEnd <= tokenCursor) {
        segmentEnd = Math.min(tokens.length, tokenCursor + 1)
      }

      segmentEnd = trimTrailingSpaces(tokens, tokenCursor, segmentEnd)
      if (segmentEnd <= tokenCursor) {
        continue
      }

      const spans = createRunSpans(tokens, tokenCursor, segmentEnd, segment.xOffset)
      if (spans.runSpans.length === 0) {
        continue
      }

      lineSegments.push({
        xOffset: segment.xOffset,
        maxWidth: segment.maxWidth,
        width: spans.width,
        tokenStart: tokenCursor,
        tokenEnd: segmentEnd,
        runSpans: spans.runSpans,
        xPrefix: spans.xPrefix
      })

      tokenCursor = segmentEnd

      if (newlineIndex >= 0) {
        encounteredNewline = true
        tokenCursor = newlineIndex + 1
        break
      }
    }

    if (lineSegments.length === 0) {
      tokenCursor = skipLeadingSpaces(tokens, tokenCursor)
      if (tokenCursor >= tokens.length) {
        break
      }

      if (tokens[tokenCursor]?.kind === 'newline') {
        lines.push({
          index: lineIndex,
          y,
          height: defaultLineHeight,
          baseline: defaultLineHeight * 0.8,
          width: 0,
          charStart: tokens[tokenCursor]?.charStart ?? startChar,
          charEnd: tokens[tokenCursor]?.charEnd ?? startChar,
          runSpans: [],
          segments: [],
          xOffset: segments[0]?.xOffset ?? 0,
          tokenStart: tokenCursor,
          tokenEnd: tokenCursor,
          xPrefix: new Float64Array([segments[0]?.xOffset ?? 0])
        })
        tokenStart = tokenCursor + 1
        lineIndex += 1
        y += defaultLineHeight
        continue
      }

      const fallbackSegment = segments.reduce((widest, current) => current.maxWidth > widest.maxWidth ? current : widest, segments[0]!)
      const forcedEnd = Math.min(tokens.length, tokenCursor + 1)
      const spans = createRunSpans(tokens, tokenCursor, forcedEnd, fallbackSegment.xOffset)
      lineSegments.push({
        xOffset: fallbackSegment.xOffset,
        maxWidth: fallbackSegment.maxWidth,
        width: spans.width,
        tokenStart: tokenCursor,
        tokenEnd: forcedEnd,
        runSpans: spans.runSpans,
        xPrefix: spans.xPrefix
      })
      tokenCursor = forcedEnd
    }

    const firstSegment = lineSegments[0]
    const lastSegment = lineSegments[lineSegments.length - 1]
    const metrics = lineHeight(tokens, firstSegment.tokenStart, lastSegment.tokenEnd, defaultLineHeight)
    const flattenedSpans = lineSegments.flatMap((segment) => segment.runSpans)
    const charStartIndex = flattenedSpans[0]?.charStart ?? firstToken?.charStart ?? startChar
    const charEndIndex = flattenedSpans[flattenedSpans.length - 1]?.charEnd ?? charStartIndex
    const rightMost = lineSegments.reduce((max, segment) => Math.max(max, segment.xOffset + segment.width), 0)
    const leftMost = firstSegment.xOffset

    lines.push({
      index: lineIndex,
      y,
      height: metrics.lineHeight,
      baseline: metrics.ascent,
      width: Math.max(0, rightMost - leftMost),
      charStart: charStartIndex,
      charEnd: charEndIndex,
      runSpans: flattenedSpans,
      segments: lineSegments,
      xOffset: leftMost,
      tokenStart: firstSegment.tokenStart,
      tokenEnd: lastSegment.tokenEnd,
      xPrefix: createLineXPrefix(lineSegments)
    })

    y += metrics.lineHeight
    lineIndex += 1
    tokenStart = tokenCursor

    if (encounteredNewline) {
      tokenStart = tokenCursor
    }
  }

  return lines.map(cloneLine)
}
