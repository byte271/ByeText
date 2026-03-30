import { createLinePool } from './pool.ts'
import { DefaultPluginRegistry } from './plugin.ts'
import { clearMeasureCache, createMeasureCache, createMeasureContext } from './measure.ts'
import { charToPosition as layoutCharToPosition, getLineAt, positionToChar as layoutPositionToChar, runLayout } from './layout.ts'
import { configureCanvas, createRenderContext, renderDocument } from './render.ts'
import {
  clamp,
  createRunId,
  EMPTY_LAYOUT,
  normalizeRunStyle,
  reasonRank,
  styleEquals,
  totalTextLength
} from './types.ts'
import type {
  ByeTextPlugin,
  CharRange,
  CreateOptions,
  DirtyRange,
  InternalTextDocument,
  MutableRun,
  Run,
  RunStyle,
  TextDocument
} from './types.ts'

function createRun(text: string, style: RunStyle): MutableRun {
  return {
    id: createRunId(),
    text,
    style,
    metrics: null,
    styleVersion: 1,
    globalStart: 0,
    globalEnd: text.length
  }
}

function reindexRuns(runs: MutableRun[]): void {
  let cursor = 0
  for (const run of runs) {
    run.globalStart = cursor
    cursor += run.text.length
    run.globalEnd = cursor
  }
}

function mergeAdjacentRuns(runs: MutableRun[]): MutableRun[] {
  const merged: MutableRun[] = []
  for (const run of runs) {
    if (run.text.length === 0) {
      continue
    }

    const previous = merged[merged.length - 1]
    if (previous && styleEquals(previous.style, run.style)) {
      previous.text += run.text
      previous.metrics = null
      previous.styleVersion += 1
    } else {
      merged.push({ ...run, metrics: null })
    }
  }

  reindexRuns(merged)
  return merged
}

function markDirty(doc: InternalTextDocument, start: number, end: number, reason: DirtyRange['reason']): void {
  const state = doc._state
  if (state.dirtyRange === null) {
    state.dirtyRange = { charStart: start, charEnd: end, reason }
    return
  }

  state.dirtyRange.charStart = Math.min(state.dirtyRange.charStart, start)
  state.dirtyRange.charEnd = Math.max(state.dirtyRange.charEnd, end)
  if (reasonRank(reason) > reasonRank(state.dirtyRange.reason)) {
    state.dirtyRange.reason = reason
  }
}

function findRunIndexAt(runs: MutableRun[], charIndex: number): { index: number; offset: number } {
  if (runs.length === 0) {
    return { index: 0, offset: 0 }
  }

  const total = totalTextLength(runs)
  const target = clamp(charIndex, 0, total)
  for (let index = 0; index < runs.length; index += 1) {
    const run = runs[index]
    if (run && target <= run.globalEnd) {
      return { index, offset: target - run.globalStart }
    }
  }

  return { index: runs.length - 1, offset: runs[runs.length - 1]?.text.length ?? 0 }
}

function styleAt(doc: InternalTextDocument, charIndex: number): RunStyle {
  if (doc._state.runs.length === 0) {
    return doc._state.defaultStyle
  }

  const { index } = findRunIndexAt(doc._state.runs, charIndex)
  return doc._state.runs[index]?.style ?? doc._state.defaultStyle
}

function replaceRuns(doc: InternalTextDocument, runs: MutableRun[]): void {
  doc._state.runs = mergeAdjacentRuns(runs)
  reindexRuns(doc._state.runs)
}

function setTextInternal(doc: InternalTextDocument, text: string): void {
  replaceRuns(doc, text.length > 0 ? [createRun(text, doc._state.defaultStyle)] : [])
  markDirty(doc, 0, Math.max(0, text.length), 'insert')
}

function splitRun(run: MutableRun, offset: number): MutableRun[] {
  if (offset <= 0 || offset >= run.text.length) {
    return [{ ...run, metrics: null }]
  }

  const start = createRun(run.text.slice(0, offset), run.style)
  const end = createRun(run.text.slice(offset), run.style)
  start.styleVersion = run.styleVersion
  end.styleVersion = run.styleVersion
  return [start, end]
}

function setStyleInternal(doc: InternalTextDocument, style: Partial<RunStyle>, range: CharRange): void {
  const start = clamp(range.start, 0, totalTextLength(doc._state.runs))
  const end = clamp(range.end, start, totalTextLength(doc._state.runs))
  const nextRuns: MutableRun[] = []

  for (const run of doc._state.runs) {
    if (run.globalEnd <= start || run.globalStart >= end) {
      nextRuns.push({ ...run, metrics: null })
      continue
    }

    const localStart = Math.max(0, start - run.globalStart)
    const localEnd = Math.min(run.text.length, end - run.globalStart)
    const parts = splitRun(run, localStart)
    const editable = parts.pop()
    if (parts.length > 0) {
      nextRuns.push(...parts)
    }

    if (!editable) {
      continue
    }

    const styledParts = splitRun(editable, localEnd - localStart)
    const target = styledParts.shift()
    if (target) {
      const updated = createRun(target.text, normalizeRunStyle(style, target.style))
      updated.styleVersion = target.styleVersion + 1
      nextRuns.push(updated)
    }

    nextRuns.push(...styledParts)
  }

  replaceRuns(doc, nextRuns)
  markDirty(doc, start, end, 'style-change')
  doc._state.plugins.emitEdit({ type: 'style-change', range: { start, end } })
}

function insertInternal(doc: InternalTextDocument, charIndex: number, text: string): void {
  if (text.length === 0) {
    return
  }

  if (doc._state.runs.length === 0) {
    replaceRuns(doc, [createRun(text, doc._state.defaultStyle)])
    markDirty(doc, 0, text.length, 'insert')
    doc._state.plugins.emitEdit({ type: 'insert', range: { start: 0, end: text.length }, text })
    return
  }

  const index = clamp(charIndex, 0, totalTextLength(doc._state.runs))
  const insertStyle = styleAt(doc, Math.max(0, index - 1))
  const location = findRunIndexAt(doc._state.runs, index)
  const nextRuns: MutableRun[] = []

  for (let runIndex = 0; runIndex < doc._state.runs.length; runIndex += 1) {
    const run = doc._state.runs[runIndex]
    if (!run) {
      continue
    }

    if (runIndex !== location.index) {
      nextRuns.push({ ...run, metrics: null })
      continue
    }

    const offset = location.offset
    if (styleEquals(run.style, insertStyle)) {
      const updated = createRun(run.text.slice(0, offset) + text + run.text.slice(offset), run.style)
      updated.styleVersion = run.styleVersion + 1
      nextRuns.push(updated)
    } else {
      const parts = splitRun(run, offset)
      if (parts[0]) {
        nextRuns.push(parts[0])
      }
      nextRuns.push(createRun(text, insertStyle))
      if (parts[1]) {
        nextRuns.push(parts[1])
      }
    }
  }

  replaceRuns(doc, nextRuns)
  markDirty(doc, index, index + text.length, 'insert')
  doc._state.plugins.emitEdit({ type: 'insert', range: { start: index, end: index + text.length }, text })
}

function deleteInternal(doc: InternalTextDocument, charStart: number, charEnd: number): void {
  const total = totalTextLength(doc._state.runs)
  const start = clamp(charStart, 0, total)
  const end = clamp(charEnd, start, total)
  if (start === end) {
    return
  }

  const nextRuns: MutableRun[] = []
  for (const run of doc._state.runs) {
    if (run.globalEnd <= start || run.globalStart >= end) {
      nextRuns.push({ ...run, metrics: null })
      continue
    }

    const localStart = Math.max(0, start - run.globalStart)
    const localEnd = Math.min(run.text.length, end - run.globalStart)
    const left = run.text.slice(0, localStart)
    const right = run.text.slice(localEnd)
    if (left.length > 0) {
      nextRuns.push(createRun(left, run.style))
    }
    if (right.length > 0) {
      nextRuns.push(createRun(right, run.style))
    }
  }

  replaceRuns(doc, nextRuns)
  markDirty(doc, start, end, 'delete')
  doc._state.plugins.emitEdit({ type: 'delete', range: { start, end } })
}

export function createDocument(options: CreateOptions): TextDocument {
  const renderContext = createRenderContext(options.canvas)
  const measureContext = createMeasureContext(options.canvas)
  const defaultStyle = normalizeRunStyle(options.font)
  const width = options.width ?? options.canvas.width
  const height = options.height ?? options.canvas.height

  const dpr = configureCanvas(options.canvas, width, height, renderContext)

  const doc: InternalTextDocument = {
    _state: {
      runs: [],
      lineCache: { lines: [], prefixSums: new Float64Array(0), version: 0, dirtyFrom: 0 },
      measureCache: createMeasureCache(512),
      dirtyRange: null,
      layoutWidth: width,
      layoutHeight: height,
      layoutState: EMPTY_LAYOUT,
      version: 0,
      plugins: new DefaultPluginRegistry(),
      pluginInstances: new Map<string, ByeTextPlugin>(),
      canvas: options.canvas,
      renderContext,
      measureContext,
      dirtyRegions: [],
      defaultStyle,
      linePool: createLinePool(),
      destroyed: false,
      viewport: { scrollY: 0, height },
      devicePixelRatio: dpr,
      lastRenderVersion: -1
    },
    destroy(): void {
      if (doc._state.destroyed) {
        return
      }

      doc._state.destroyed = true
      for (const plugin of doc._state.pluginInstances.values()) {
        plugin.teardown?.()
      }
      doc._state.pluginInstances.clear()
      doc._state.runs = []
      doc._state.lineCache.lines = []
      doc._state.layoutState = EMPTY_LAYOUT
      doc._state.dirtyRegions = []
      clearMeasureCache(doc._state.measureCache)
    },
    setText(text: string): void {
      setTextInternal(doc, text)
    },
    setWidth(widthValue: number): void {
      if (widthValue === doc._state.layoutWidth) {
        return
      }

      doc._state.layoutWidth = Math.max(1, widthValue)
      doc._state.devicePixelRatio = configureCanvas(doc._state.canvas, doc._state.layoutWidth, doc._state.layoutHeight, doc._state.renderContext)
      markDirty(doc, 0, totalTextLength(doc._state.runs), 'width-change')
      doc._state.plugins.emitEdit({ type: 'width-change', range: { start: 0, end: totalTextLength(doc._state.runs) } })
    },
    setHeight(heightValue: number): void {
      doc._state.layoutHeight = Math.max(1, heightValue)
      doc._state.viewport.height = doc._state.layoutHeight
      doc._state.devicePixelRatio = configureCanvas(doc._state.canvas, doc._state.layoutWidth, doc._state.layoutHeight, doc._state.renderContext)
    },
    layout(): void {
      runLayout(doc)
    },
    render(): void {
      if (doc._state.dirtyRange) {
        runLayout(doc)
      }
      renderDocument(doc)
    },
    getLineCount(): number {
      return doc._state.layoutState.lineCount
    },
    getTotalHeight(): number {
      return doc._state.layoutState.totalHeight
    },
    getLine(index: number) {
      return getLineAt(doc, index)
    },
    charToPosition(charIndex: number) {
      return layoutCharToPosition(doc, charIndex)
    },
    positionToChar(x: number, y: number) {
      return layoutPositionToChar(doc, x, y)
    },
    getRunAt(charIndex: number): Run {
      if (doc._state.runs.length === 0) {
        return createRun('', doc._state.defaultStyle)
      }

      const { index } = findRunIndexAt(doc._state.runs, charIndex)
      return doc._state.runs[index] ?? doc._state.runs[0]!
    },
    insert(charIndex: number, text: string): void {
      insertInternal(doc, charIndex, text)
    },
    delete(charStart: number, charEnd: number): void {
      deleteInternal(doc, charStart, charEnd)
    },
    setStyle(style: Partial<RunStyle>, range: CharRange): void {
      setStyleInternal(doc, style, range)
    },
    layoutRange(charStart: number, charEnd: number): void {
      markDirty(doc, charStart, charEnd, 'insert')
      runLayout(doc)
    },
    precompute(): void {
      runLayout(doc)
    },
    invalidateMeasurements(): void {
      clearMeasureCache(doc._state.measureCache)
      for (const run of doc._state.runs) {
        run.metrics = null
      }
      markDirty(doc, 0, totalTextLength(doc._state.runs), 'style-change')
    },
    use(plugin: ByeTextPlugin): void {
      if (doc._state.pluginInstances.has(plugin.name)) {
        return
      }

      plugin.install(doc, doc._state.plugins)
      doc._state.pluginInstances.set(plugin.name, plugin)
    },
    getPlugin<T extends ByeTextPlugin>(name: string): T | null {
      return (doc._state.plugins.getExposed<T>(name) ?? doc._state.pluginInstances.get(name) ?? null) as T | null
    }
  }

  setTextInternal(doc, options.text ?? '')
  options.plugins?.forEach((plugin) => doc.use(plugin))
  runLayout(doc)
  return doc
}
