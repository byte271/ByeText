import type { CanvasContextLike } from '../../../core/src/types.ts'

export function drawDebugOverlay(ctx: CanvasContextLike, lines: Array<{ y: number; height: number; width: number }>): void {
  for (const line of lines) {
    ctx.clearRect(0, line.y, Math.max(0, line.width), Math.max(0, line.height))
  }
}
