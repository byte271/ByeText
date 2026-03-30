export type ObstacleId = string

export type ObstacleShape =
  | { type: 'circle'; cx: number; cy: number; r: number }
  | { type: 'rect'; x: number; y: number; w: number; h: number }
  | { type: 'polygon'; points: Array<{ x: number; y: number }> }

export interface Obstacle extends ObstacleShape {
  id: ObstacleId
  padding: number
  side?: 'left' | 'right' | 'both'
}

export interface Bounds {
  left: number
  top: number
  right: number
  bottom: number
}

export function obstacleBounds(obstacle: Obstacle): Bounds {
  if (obstacle.type === 'circle') {
    return {
      left: obstacle.cx - obstacle.r - obstacle.padding,
      top: obstacle.cy - obstacle.r - obstacle.padding,
      right: obstacle.cx + obstacle.r + obstacle.padding,
      bottom: obstacle.cy + obstacle.r + obstacle.padding
    }
  }

  if (obstacle.type === 'rect') {
    return {
      left: obstacle.x - obstacle.padding,
      top: obstacle.y - obstacle.padding,
      right: obstacle.x + obstacle.w + obstacle.padding,
      bottom: obstacle.y + obstacle.h + obstacle.padding
    }
  }

  let left = Number.POSITIVE_INFINITY
  let top = Number.POSITIVE_INFINITY
  let right = Number.NEGATIVE_INFINITY
  let bottom = Number.NEGATIVE_INFINITY

  for (const point of obstacle.points) {
    left = Math.min(left, point.x)
    top = Math.min(top, point.y)
    right = Math.max(right, point.x)
    bottom = Math.max(bottom, point.y)
  }

  return {
    left: left - obstacle.padding,
    top: top - obstacle.padding,
    right: right + obstacle.padding,
    bottom: bottom + obstacle.padding
  }
}
