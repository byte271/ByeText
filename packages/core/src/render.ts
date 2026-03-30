import { fontString } from './types.ts'
import type {
  CanvasContextLike,
  CanvasLike,
  DirtyRegion,
  InternalTextDocument,
  LayoutLine
} from './types.ts'

const DIRTY_PADDING = 4

class NullCanvasContext implements CanvasContextLike {
  canvas = { width: 0, height: 0 }
  font = ''
  fillStyle = '#111111'
  globalAlpha = 1

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

export function devicePixelRatio(): number {
  return typeof window !== 'undefined' && typeof window.devicePixelRatio === 'number'
    ? window.devicePixelRatio
    : 1
}

export function createRenderContext(canvas: CanvasLike): CanvasContextLike {
  return canvas.getContext('2d') ?? new NullCanvasContext()
}

export function configureCanvas(canvas: CanvasLike, width: number, height: number, ctx: CanvasContextLike): number {
  const dpr = devicePixelRatio()

  canvas.width = Math.max(1, Math.round(width * dpr))
  canvas.height = Math.max(1, Math.round(height * dpr))

  if (canvas.style) {
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
  }

  if (typeof ctx.setTransform === 'function') {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  } else if (typeof ctx.scale === 'function') {
    ctx.scale(dpr, dpr)
  }

  return dpr
}

function overlap(a: DirtyRegion, b: DirtyRegion): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  )
}

export function mergeDirtyRegions(regions: DirtyRegion[]): DirtyRegion[] {
  const merged: DirtyRegion[] = []

  for (const region of regions) {
    let combined = { ...region }
    let changed = true

    while (changed) {
      changed = false
      for (let index = merged.length - 1; index >= 0; index -= 1) {
        const existing = merged[index]
        if (!existing || !overlap(existing, combined)) {
          continue
        }

        combined = {
          x: Math.min(existing.x, combined.x),
          y: Math.min(existing.y, combined.y),
          width: Math.max(existing.x + existing.width, combined.x + combined.width) - Math.min(existing.x, combined.x),
          height: Math.max(existing.y + existing.height, combined.y + combined.height) - Math.min(existing.y, combined.y)
        }
        merged.splice(index, 1)
        changed = true
      }
    }

    merged.push(combined)
  }

  return merged
}

function spansEqual(a: LayoutLine, b: LayoutLine): boolean {
  if (a.runSpans.length !== b.runSpans.length || a.segments.length !== b.segments.length) {
    return false
  }

  for (let index = 0; index < a.runSpans.length; index += 1) {
    const left = a.runSpans[index]
    const right = b.runSpans[index]
    if (
      left?.runId !== right?.runId ||
      left?.charStart !== right?.charStart ||
      left?.charEnd !== right?.charEnd ||
      left?.x !== right?.x ||
      left?.width !== right?.width
    ) {
      return false
    }
  }

  for (let index = 0; index < a.segments.length; index += 1) {
    const left = a.segments[index]
    const right = b.segments[index]
    if (
      left?.xOffset !== right?.xOffset ||
      left?.maxWidth !== right?.maxWidth ||
      left?.width !== right?.width ||
      left?.tokenStart !== right?.tokenStart ||
      left?.tokenEnd !== right?.tokenEnd
    ) {
      return false
    }
  }

  return true
}

export function buildDirtyRegionsForLines(previous: LayoutLine[], next: LayoutLine[], layoutWidth: number): DirtyRegion[] {
  const regions: DirtyRegion[] = []
  const count = Math.max(previous.length, next.length)

  for (let index = 0; index < count; index += 1) {
    const before = previous[index]
    const after = next[index]
    if (
      before &&
      after &&
      before.charStart === after.charStart &&
      before.charEnd === after.charEnd &&
      before.y === after.y &&
      before.height === after.height &&
      before.width === after.width &&
      spansEqual(before, after)
    ) {
      continue
    }

    if (before) {
      regions.push({
        x: 0,
        y: Math.max(0, before.y - DIRTY_PADDING),
        width: layoutWidth,
        height: before.height + DIRTY_PADDING * 2
      })
    }

    if (after) {
      regions.push({
        x: 0,
        y: Math.max(0, after.y - DIRTY_PADDING),
        width: layoutWidth,
        height: after.height + DIRTY_PADDING * 2
      })
    }
  }

  return mergeDirtyRegions(regions)
}

function visibleLines(lines: LayoutLine[], scrollY: number, viewportHeight: number): LayoutLine[] {
  const maxY = scrollY + viewportHeight
  return lines.filter((line) => line.y + line.height >= scrollY && line.y <= maxY)
}

function drawLine(doc: InternalTextDocument, ctx: CanvasContextLike, line: LayoutLine): void {
  const runs = doc._state.runs
  let activeFont = ''
  let activeColor = ''

  for (const span of line.runSpans) {
    const run = runs.find((candidate) => candidate.id === span.runId)
    if (!run) {
      continue
    }

    const localStart = Math.max(0, span.charStart - run.globalStart)
    const localEnd = Math.max(localStart, span.charEnd - run.globalStart)
    const text = run.text.slice(localStart, localEnd)
    const nextFont = fontString(run.style)
    const nextColor = run.style.color ?? '#111111'

    if (nextFont !== activeFont) {
      ctx.font = nextFont
      activeFont = nextFont
    }

    if (nextColor !== activeColor) {
      ctx.fillStyle = nextColor
      activeColor = nextColor
    }

    ctx.fillText(text, span.x, Math.round(line.y) + line.baseline)
  }
}

function drawRegion(doc: InternalTextDocument, ctx: CanvasContextLike, region: DirtyRegion): void {
  const lines = visibleLines(doc._state.layoutState.lines, doc._state.viewport.scrollY, doc._state.viewport.height)
    .filter((line) => line.y + line.height >= region.y && line.y <= region.y + region.height)

  for (const line of lines) {
    drawLine(doc, ctx, line)
  }
}

export function renderDocument(doc: InternalTextDocument): void {
  const state = doc._state
  const ctx = state.renderContext
  const currentDpr = devicePixelRatio()
  if (currentDpr !== state.devicePixelRatio) {
    state.devicePixelRatio = configureCanvas(state.canvas, state.layoutWidth, state.layoutHeight, ctx)
    state.lastRenderVersion = -1
  }

  const dirtyRegions = state.dirtyRegions.length > 0
    ? mergeDirtyRegions(state.dirtyRegions)
    : (state.lastRenderVersion === state.layoutState.version ? [] : buildDirtyRegionsForLines([], state.layoutState.lines, state.layoutWidth))

  if (dirtyRegions.length === 0) {
    return
  }

  const handled = state.plugins.runRender(ctx, {
    doc,
    lines: state.layoutState.lines,
    dirtyRegions
  })

  if (handled) {
    state.dirtyRegions = []
    state.lastRenderVersion = state.layoutState.version
    return
  }

  for (const region of dirtyRegions) {
    ctx.save()
    ctx.beginPath()
    ctx.rect(region.x, region.y, region.width, region.height)
    ctx.clip()
    ctx.clearRect(region.x, region.y, region.width, region.height)
    drawRegion(doc, ctx, region)
    ctx.restore()
  }

  state.dirtyRegions = []
  state.lastRenderVersion = state.layoutState.version
}
