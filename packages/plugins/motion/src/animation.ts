import { easeOutCubic } from './easing.ts'
import type { LayoutState, LineAnimation } from '../../../core/src/types.ts'

export interface MotionOptions {
  duration?: number
  threshold?: number
}

export function createLineAnimations(previous: LayoutState | null, next: LayoutState, options: MotionOptions = {}): LineAnimation[] {
  if (!previous) {
    return []
  }

  const duration = options.duration ?? 200
  const threshold = options.threshold ?? 2
  const animations: LineAnimation[] = []

  for (const nextLine of next.lines) {
    const previousLine = previous.lines.find((candidate) => candidate.charStart === nextLine.charStart)
    if (!previousLine) {
      continue
    }

    const deltaY = Math.abs(previousLine.y - nextLine.y)
    const deltaX = Math.abs(previousLine.xOffset - nextLine.xOffset)
    if (deltaY < threshold && deltaX < threshold) {
      continue
    }

    animations.push({
      lineIndex: nextLine.index,
      fromY: previousLine.y,
      toY: nextLine.y,
      fromX: previousLine.xOffset,
      toX: nextLine.xOffset,
      fromAlpha: 1,
      toAlpha: 1,
      startTime: 0,
      duration,
      easing: easeOutCubic
    })
  }

  return animations
}
