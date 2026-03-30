export type RunId = string

export type FontWeight = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900
export type FontStyle = 'normal' | 'italic' | 'oblique'
export type TextDirection = 'ltr' | 'rtl' | 'auto'
export type DirtyReason = 'insert' | 'delete' | 'style-change' | 'width-change' | 'obstacle-move'
export type EasingName = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'ease-out-cubic' | 'spring'

export interface FontDescriptor {
  family: string
  size: number
  weight?: FontWeight
  style?: FontStyle
  lang?: string | null
}

export interface RunStyle extends FontDescriptor {
  color?: string
  direction?: TextDirection
  letterSpacing?: number
  wordSpacing?: number
  lineHeight?: number
}

export interface Run {
  readonly id: RunId
  readonly text: string
  readonly style: RunStyle
}

export interface TokenBoundary {
  start: number
  end: number
  breakAllowed: boolean
  hardBreak: boolean
  kind: 'word' | 'space' | 'punct' | 'newline' | 'glyph'
}

export interface RunMetrics {
  segmentWidths: Float32Array
  totalWidth: number
  ascent: number
  descent: number
  lineHeight: number
  version: number
  boundaries: TokenBoundary[]
  prefixSums: Float64Array
}

export interface MutableRun extends Run {
  text: string
  style: RunStyle
  metrics: RunMetrics | null
  styleVersion: number
  globalStart: number
  globalEnd: number
}

export interface CharPosition {
  x: number
  y: number
  lineIndex: number
  baseline: number
}

export interface RunSpan {
  runId: RunId
  charStart: number
  charEnd: number
  x: number
  width: number
}

export interface LayoutSegmentConstraint {
  xOffset: number
  maxWidth: number
}

export interface LayoutLineSegment extends LayoutSegmentConstraint {
  width: number
  tokenStart: number
  tokenEnd: number
  runSpans: RunSpan[]
  xPrefix: Float64Array
}

export interface LayoutLine {
  index: number
  y: number
  height: number
  baseline: number
  width: number
  signature: string
  charStart: number
  charEnd: number
  charShift: number
  runSpans: RunSpan[]
  segments: LayoutLineSegment[]
  xOffset: number
  tokenStart: number
  tokenEnd: number
  xPrefix: Float64Array
}

export interface LineMetrics {
  index: number
  y: number
  height: number
  baseline: number
  width: number
  signature: string
  charStart: number
  charEnd: number
  runSpans: RunSpan[]
  segments: LayoutLineSegment[]
}

export interface CharToPositionIndex {
  lineStarts: Int32Array
}

export interface PositionToCharIndex {
  lineYPrefix: Float64Array
}

export interface LayoutState {
  lineCount: number
  totalHeight: number
  lines: LayoutLine[]
  charToPos: CharToPositionIndex
  posToChar: PositionToCharIndex
  version: number
}

export interface DirtyRange {
  charStart: number
  charEnd: number
  reason: DirtyReason
}

export interface CachedMeasurement {
  widths: Float32Array
  totalWidth: number
  ascent: number
  descent: number
  lineHeight: number
  lastUsed: number
  boundaries: TokenBoundary[]
  prefixSums: Float64Array
}

export interface MeasureCache {
  store: Map<string, CachedMeasurement>
  maxSize: number
  hits: number
  misses: number
  generation: number
}

export interface LineCache {
  lines: LayoutLine[]
  prefixSums: Float64Array
  version: number
  dirtyFrom: number
}

export interface DirtyRegion {
  x: number
  y: number
  width: number
  height: number
}

export interface CanvasMeasureResult {
  width: number
  actualBoundingBoxAscent?: number
  actualBoundingBoxDescent?: number
}

export interface CanvasContextLike {
  canvas?: { width: number; height: number }
  font: string
  fillStyle: string | CanvasGradient | CanvasPattern
  direction?: 'inherit' | 'ltr' | 'rtl'
  globalAlpha?: number
  measureText(text: string): CanvasMeasureResult
  fillText(text: string, x: number, y: number): void
  clearRect(x: number, y: number, width: number, height: number): void
  save(): void
  restore(): void
  beginPath(): void
  rect(x: number, y: number, width: number, height: number): void
  clip(): void
  scale?(x: number, y: number): void
  setTransform?(a: number, b: number, c: number, d: number, e: number, f: number): void
}

export interface CanvasLike {
  width: number
  height: number
  getContext(type: '2d'): CanvasContextLike | null
  style?: { width?: string; height?: string }
  getBoundingClientRect?(): { width: number; height: number }
}

export interface CharRange {
  start: number
  end: number
}

export interface CreateOptions {
  canvas: CanvasLike
  text?: string
  width?: number
  height?: number
  font?: FontDescriptor
  plugins?: ByeTextPlugin[]
}

export interface BreakParams {
  runs: MutableRun[]
  tokens: LayoutToken[]
  prefixSums: Float64Array
  width: number
}

export interface RenderState {
  doc: InternalTextDocument
  lines: LayoutLine[]
  dirtyRegions: DirtyRegion[]
}

export interface EditEvent {
  type: 'set-text' | 'insert' | 'delete' | 'style-change' | 'width-change'
  range: CharRange
  text?: string
}

export interface LayoutToken {
  runId: RunId
  runIndex: number
  style: RunStyle
  text: string
  localStart: number
  localEnd: number
  charStart: number
  charEnd: number
  width: number
  breakAllowed: boolean
  hardBreak: boolean
  kind: TokenBoundary['kind']
  ascent: number
  descent: number
  lineHeight: number
}

export interface LayoutConstraint {
  xOffset: number
  maxWidth: number
  segments?: LayoutSegmentConstraint[]
}

export type MeasureHandler = (run: MutableRun, cache: MeasureCache) => RunMetrics | null
export type BreakHandler = (params: BreakParams) => LayoutLine[] | null
export type LayoutHandler = (state: LayoutState) => LayoutState | null
export type ObstacleHandler = (lineIndex: number, y: number, height: number, width: number) => LayoutConstraint | null
export type RenderHandler = (ctx: CanvasContextLike, state: RenderState) => boolean
export type AnimateHandler = (animations: LineAnimation[]) => void
export type EditHandler = (edit: EditEvent) => void

export interface PluginRegistry {
  onMeasure(handler: MeasureHandler): void
  onBreak(handler: BreakHandler): void
  onLayout(handler: LayoutHandler): void
  onObstacle(handler: ObstacleHandler): void
  onRender(handler: RenderHandler): void
  onAnimate(handler: AnimateHandler): void
  onEdit(handler: EditHandler): void
  expose(name: string, value: unknown): void
}

export interface ByeTextPlugin {
  readonly name: string
  readonly version: string
  install(doc: TextDocument, registry: PluginRegistry): void
  teardown?(): void
}

export interface TextDocument {
  destroy(): void
  setText(text: string): void
  setWidth(width: number): void
  setHeight(height: number): void
  layout(): void
  render(): void
  getLineCount(): number
  getTotalHeight(): number
  getLine(index: number): LineMetrics
  charToPosition(charIndex: number): CharPosition
  positionToChar(x: number, y: number): number
  getRunAt(charIndex: number): Run
  insert(charIndex: number, text: string): void
  delete(charStart: number, charEnd: number): void
  setStyle(style: Partial<RunStyle>, range: CharRange): void
  layoutRange(charStart: number, charEnd: number): void
  precompute(): void
  invalidateMeasurements(): void
  use(plugin: ByeTextPlugin): void
  getPlugin<T extends ByeTextPlugin>(name: string): T | null
}

export interface LineAnimation {
  lineIndex: number
  fromY: number
  toY: number
  fromX: number
  toX: number
  fromAlpha: number
  toAlpha: number
  startTime: number
  duration: number
  easing: (t: number) => number
}

export interface PluginRegistryInternal extends PluginRegistry {
  runMeasure(run: MutableRun, cache: MeasureCache): RunMetrics | null
  runBreak(params: BreakParams): LayoutLine[] | null
  runLayout(state: LayoutState): LayoutState | null
  runObstacle(lineIndex: number, y: number, height: number, width: number): LayoutConstraint | null
  runRender(ctx: CanvasContextLike, state: RenderState): boolean
  runAnimate(animations: LineAnimation[]): void
  emitEdit(edit: EditEvent): void
  getExposed<T>(name: string): T | null
}

export interface LinePoolLike {
  acquire(): LayoutLine
  recycle(lines: LayoutLine[]): void
}

export interface DocumentState {
  runs: MutableRun[]
  runLookup: Map<RunId, MutableRun>
  lineCache: LineCache
  measureCache: MeasureCache
  dirtyRange: DirtyRange | null
  layoutWidth: number
  layoutHeight: number
  layoutState: LayoutState
  version: number
  plugins: PluginRegistryInternal
  pluginInstances: Map<string, ByeTextPlugin>
  canvas: CanvasLike
  renderContext: CanvasContextLike
  measureContext: CanvasContextLike
  dirtyRegions: DirtyRegion[]
  defaultStyle: RunStyle
  linePool: LinePoolLike
  destroyed: boolean
  viewport: {
    scrollY: number
    height: number
  }
  devicePixelRatio: number
  lastRenderVersion: number
}

export interface InternalTextDocument extends TextDocument {
  readonly _state: DocumentState
}

export const DEFAULT_FONT: Required<FontDescriptor> = {
  family: 'system-ui',
  size: 16,
  weight: 400,
  style: 'normal',
  lang: null
}

export const EMPTY_LAYOUT: LayoutState = {
  lineCount: 0,
  totalHeight: 0,
  lines: [],
  charToPos: { lineStarts: new Int32Array(0) },
  posToChar: { lineYPrefix: new Float64Array(0) },
  version: 0
}

export function createRunId(): RunId {
  return `run_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`
}

export function normalizeRunStyle(style: Partial<RunStyle> | undefined, base: Partial<RunStyle> = DEFAULT_FONT): RunStyle {
  return {
    family: style?.family ?? base.family ?? DEFAULT_FONT.family,
    size: style?.size ?? base.size ?? DEFAULT_FONT.size,
    weight: style?.weight ?? base.weight ?? DEFAULT_FONT.weight,
    style: style?.style ?? base.style ?? DEFAULT_FONT.style,
    lang: style?.lang ?? base.lang ?? DEFAULT_FONT.lang,
    color: style?.color ?? base.color ?? '#111111',
    direction: style?.direction ?? base.direction ?? 'ltr',
    letterSpacing: style?.letterSpacing ?? base.letterSpacing ?? 0,
    wordSpacing: style?.wordSpacing ?? base.wordSpacing ?? 0,
    lineHeight: style?.lineHeight ?? base.lineHeight
  }
}

export function styleEquals(a: RunStyle, b: RunStyle): boolean {
  return (
    a.family === b.family &&
    a.size === b.size &&
    a.weight === b.weight &&
    a.style === b.style &&
    a.lang === b.lang &&
    a.color === b.color &&
    a.direction === b.direction &&
    a.letterSpacing === b.letterSpacing &&
    a.wordSpacing === b.wordSpacing &&
    a.lineHeight === b.lineHeight
  )
}

export function fontString(style: RunStyle): string {
  const fontStyle = style.style ?? 'normal'
  const fontWeight = style.weight ?? 400
  return `${fontStyle} ${fontWeight} ${style.size}px ${style.family}`
}

export function cloneLine(line: LayoutLine): LayoutLine {
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

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function totalTextLength(runs: MutableRun[]): number {
  let total = 0
  for (const run of runs) {
    total += run.text.length
  }

  return total
}

export function reasonRank(reason: DirtyReason): number {
  switch (reason) {
    case 'width-change':
      return 4
    case 'obstacle-move':
      return 3
    case 'style-change':
      return 2
    case 'insert':
      return 1
    case 'delete':
      return 0
    default:
      return 0
  }
}
