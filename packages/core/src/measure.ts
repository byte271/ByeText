import { fontString } from './types.ts'
import type {
  CachedMeasurement,
  CanvasContextLike,
  CanvasLike,
  MeasureCache,
  MutableRun,
  RunMetrics,
  RunStyle
} from './types.ts'
import { tokenizeText } from './tokenize.ts'
import { buildPrefixSums } from './break.ts'

class HeuristicCanvasContext implements CanvasContextLike {
  canvas = { width: 0, height: 0 }
  font = ''
  fillStyle = '#111111'
  globalAlpha = 1

  measureText(text: string) {
    const fontMatch = /(\d+(?:\.\d+)?)px/.exec(this.font)
    const size = fontMatch ? Number(fontMatch[1]) : 16
    let width = 0
    for (const character of text) {
      if (character === ' ') {
        width += size * 0.35
      } else if (/[A-Z]/.test(character)) {
        width += size * 0.72
      } else if (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(character)) {
        width += size
      } else if (/[.,;:'"!?]/.test(character)) {
        width += size * 0.3
      } else {
        width += size * 0.58
      }
    }

    return {
      width,
      actualBoundingBoxAscent: size * 0.8,
      actualBoundingBoxDescent: size * 0.2
    }
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

function createOffscreenCanvasContext(): CanvasContextLike | null {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(1, 1)
    return canvas.getContext('2d') as CanvasContextLike | null
  }

  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const canvas = document.createElement('canvas')
    return canvas.getContext('2d') as CanvasContextLike | null
  }

  return null
}

export function createMeasureContext(canvas?: CanvasLike): CanvasContextLike {
  const existing = canvas?.getContext('2d')
  if (existing) {
    return existing
  }

  return createOffscreenCanvasContext() ?? new HeuristicCanvasContext()
}

export function createMeasureCache(maxSize = 512): MeasureCache {
  return {
    store: new Map<string, CachedMeasurement>(),
    maxSize,
    hits: 0,
    misses: 0,
    generation: 0
  }
}

export function beginMeasurementPass(cache: MeasureCache): void {
  cache.generation += 1
}

export function finishMeasurementPass(cache: MeasureCache): void {
  if (cache.store.size <= cache.maxSize) {
    return
  }

  const entries = [...cache.store.entries()].sort((left, right) => left[1].lastUsed - right[1].lastUsed)
  const excess = cache.store.size - cache.maxSize
  for (let index = 0; index < excess; index += 1) {
    const entry = entries[index]
    if (entry) {
      cache.store.delete(entry[0])
    }
  }
}

function cacheKey(style: RunStyle, text: string): string {
  return [
    style.family,
    style.size,
    style.weight ?? 400,
    style.style ?? 'normal',
    style.letterSpacing ?? 0,
    style.wordSpacing ?? 0,
    text
  ].join('|')
}

function segmentWidth(ctx: CanvasContextLike, text: string, style: RunStyle, kind: 'word' | 'space' | 'punct' | 'newline' | 'glyph'): number {
  if (kind === 'newline') {
    return 0
  }

  const baseWidth = ctx.measureText(text).width
  const letterSpacing = style.letterSpacing ?? 0
  const wordSpacing = kind === 'space' ? (style.wordSpacing ?? 0) : 0
  const letterAdjustment = text.length > 1 ? letterSpacing * (text.length - 1) : 0
  return baseWidth + letterAdjustment + wordSpacing
}

function buildRunMetrics(entry: CachedMeasurement, version: number): RunMetrics {
  return {
    segmentWidths: entry.widths,
    totalWidth: entry.totalWidth,
    ascent: entry.ascent,
    descent: entry.descent,
    lineHeight: entry.lineHeight,
    version,
    boundaries: entry.boundaries,
    prefixSums: entry.prefixSums
  }
}

export function measureRun(run: MutableRun, ctx: CanvasContextLike, cache: MeasureCache): RunMetrics {
  const key = cacheKey(run.style, run.text)
  const cached = cache.store.get(key)
  if (cached) {
    cache.hits += 1
    cached.lastUsed = cache.generation
    return buildRunMetrics(cached, run.styleVersion)
  }

  cache.misses += 1
  ctx.font = fontString(run.style)
  const boundaries = tokenizeText(run.text)
  const widths = new Float32Array(boundaries.length)

  for (let index = 0; index < boundaries.length; index += 1) {
    const boundary = boundaries[index]
    if (!boundary) {
      continue
    }

    widths[index] = segmentWidth(ctx, run.text.slice(boundary.start, boundary.end), run.style, boundary.kind)
  }

  const metricsSample = ctx.measureText(run.text || 'Mg')
  const ascent = metricsSample.actualBoundingBoxAscent ?? run.style.size * 0.8
  const descent = metricsSample.actualBoundingBoxDescent ?? run.style.size * 0.2
  const lineHeight = run.style.lineHeight ?? Math.max(run.style.size * 1.25, ascent + descent)
  const prefixSums = buildPrefixSums(widths)
  let totalWidth = 0
  for (const width of widths) {
    totalWidth += width
  }

  const measurement: CachedMeasurement = {
    widths,
    totalWidth,
    ascent,
    descent,
    lineHeight,
    lastUsed: cache.generation,
    boundaries,
    prefixSums
  }

  cache.store.set(key, measurement)
  return buildRunMetrics(measurement, run.styleVersion)
}

export function measureTextFragment(text: string, style: RunStyle, ctx: CanvasContextLike): number {
  if (text.length === 0) {
    return 0
  }

  ctx.font = fontString(style)
  return ctx.measureText(text).width + Math.max(0, text.length - 1) * (style.letterSpacing ?? 0)
}

export function clearMeasureCache(cache: MeasureCache): void {
  cache.store.clear()
  cache.hits = 0
  cache.misses = 0
}
