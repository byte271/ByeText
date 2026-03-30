import { obstacleBounds } from './obstacle.ts'
import type { Obstacle } from './obstacle.ts'

export interface DirtyBand {
  startY: number
  endY: number
}

export function dirtyBandForObstacleChange(previous: Obstacle | null, next: Obstacle | null): DirtyBand | null {
  if (!previous && !next) {
    return null
  }

  if (!previous) {
    const bounds = obstacleBounds(next!)
    return { startY: bounds.top, endY: bounds.bottom }
  }

  if (!next) {
    const bounds = obstacleBounds(previous)
    return { startY: bounds.top, endY: bounds.bottom }
  }

  const oldBounds = obstacleBounds(previous)
  const newBounds = obstacleBounds(next)
  return {
    startY: Math.min(oldBounds.top, newBounds.top),
    endY: Math.max(oldBounds.bottom, newBounds.bottom)
  }
}
