import type {
  BreakParams,
  CanvasContextLike,
  EditEvent,
  LayoutConstraint,
  LayoutLine,
  LayoutState,
  LineAnimation,
  MeasureCache,
  MutableRun,
  PluginRegistryInternal,
  RenderState,
  RunMetrics
} from './types.ts'

export class DefaultPluginRegistry implements PluginRegistryInternal {
  readonly #measureHandlers = []
  readonly #breakHandlers = []
  readonly #layoutHandlers = []
  readonly #obstacleHandlers = []
  readonly #renderHandlers = []
  readonly #animateHandlers = []
  readonly #editHandlers = []
  readonly #exposed = new Map<string, unknown>()

  onMeasure(handler) {
    this.#measureHandlers.push(handler)
  }

  onBreak(handler) {
    this.#breakHandlers.push(handler)
  }

  onLayout(handler) {
    this.#layoutHandlers.push(handler)
  }

  onObstacle(handler) {
    this.#obstacleHandlers.push(handler)
  }

  onRender(handler) {
    this.#renderHandlers.push(handler)
  }

  onAnimate(handler) {
    this.#animateHandlers.push(handler)
  }

  onEdit(handler) {
    this.#editHandlers.push(handler)
  }

  expose(name: string, value: unknown): void {
    this.#exposed.set(name, value)
  }

  runMeasure(run: MutableRun, cache: MeasureCache): RunMetrics | null {
    for (const handler of this.#measureHandlers) {
      const result = handler(run, cache)
      if (result) {
        return result
      }
    }

    return null
  }

  runBreak(params: BreakParams): LayoutLine[] | null {
    for (const handler of this.#breakHandlers) {
      const result = handler(params)
      if (result) {
        return result
      }
    }

    return null
  }

  runLayout(state: LayoutState): LayoutState | null {
    let current: LayoutState | null = null
    for (const handler of this.#layoutHandlers) {
      const result = handler(current ?? state)
      if (result) {
        current = result
      }
    }

    return current
  }

  runObstacle(lineIndex: number, y: number, height: number, width: number): LayoutConstraint | null {
    for (const handler of this.#obstacleHandlers) {
      const result = handler(lineIndex, y, height, width)
      if (result) {
        return result
      }
    }

    return null
  }

  runRender(ctx: CanvasContextLike, state: RenderState): boolean {
    let handled = false
    for (const handler of this.#renderHandlers) {
      handled = handler(ctx, state) || handled
    }

    return handled
  }

  runAnimate(animations: LineAnimation[]): void {
    for (const handler of this.#animateHandlers) {
      handler(animations)
    }
  }

  emitEdit(edit: EditEvent): void {
    for (const handler of this.#editHandlers) {
      handler(edit)
    }
  }

  getExposed<T>(name: string): T | null {
    return (this.#exposed.get(name) as T | undefined) ?? null
  }
}
