import type { LayoutConstraint, LayoutSegmentConstraint } from '../../../core/src/types.ts'

import { obstacleBounds } from './obstacle.ts'
import type { Obstacle } from './obstacle.ts'

interface ObstructionInterval {
  start: number
  end: number
}

function clampInterval(start: number, end: number, width: number): ObstructionInterval | null {
  const clampedStart = Math.max(0, Math.min(width, start))
  const clampedEnd = Math.max(0, Math.min(width, end))
  if (clampedEnd <= clampedStart) {
    return null
  }

  return {
    start: clampedStart,
    end: clampedEnd
  }
}

function rectInterval(obstacle: Obstacle, y: number, height: number, width: number): ObstructionInterval | null {
  const bounds = obstacleBounds(obstacle)
  if (y + height < bounds.top || y > bounds.bottom) {
    return null
  }

  if (obstacle.side === 'left') {
    return clampInterval(0, bounds.right, width)
  }

  if (obstacle.side === 'right') {
    return clampInterval(bounds.left, width, width)
  }

  return clampInterval(bounds.left, bounds.right, width)
}

function circleInterval(obstacle: Obstacle, y: number, height: number, width: number): ObstructionInterval | null {
  if (obstacle.type !== 'circle') {
    return null
  }

  const distanceY = y + height / 2 - obstacle.cy
  const radius = obstacle.r + obstacle.padding
  const chord = Math.sqrt(Math.max(0, radius * radius - distanceY * distanceY))
  if (!Number.isFinite(chord) || chord === 0) {
    return null
  }

  const left = obstacle.cx - chord
  const right = obstacle.cx + chord
  if (obstacle.side === 'left') {
    return clampInterval(0, right, width)
  }

  if (obstacle.side === 'right') {
    return clampInterval(left, width, width)
  }

  return clampInterval(left, right, width)
}

export function constraintForObstacle(obstacle: Obstacle, y: number, height: number, width: number): ObstructionInterval | null {
  if (obstacle.type === 'circle') {
    return circleInterval(obstacle, y, height, width)
  }

  return rectInterval(obstacle, y, height, width)
}

function mergeIntervals(intervals: ObstructionInterval[]): ObstructionInterval[] {
  const sorted = [...intervals].sort((left, right) => left.start - right.start)
  const merged: ObstructionInterval[] = []

  for (const interval of sorted) {
    const last = merged[merged.length - 1]
    if (!last || interval.start > last.end) {
      merged.push({ ...interval })
      continue
    }

    last.end = Math.max(last.end, interval.end)
  }

  return merged
}

function availableSegments(width: number, intervals: ObstructionInterval[]): LayoutSegmentConstraint[] {
  const segments: LayoutSegmentConstraint[] = []
  let cursor = 0

  for (const interval of intervals) {
    if (interval.start > cursor) {
      segments.push({
        xOffset: cursor,
        maxWidth: interval.start - cursor
      })
    }
    cursor = Math.max(cursor, interval.end)
  }

  if (cursor < width) {
    segments.push({
      xOffset: cursor,
      maxWidth: width - cursor
    })
  }

  return segments.filter((segment) => segment.maxWidth > 8)
}

export function mergeConstraints(width: number, intervals: Array<ObstructionInterval | null>): LayoutConstraint | null {
  const valid = intervals.filter(Boolean) as ObstructionInterval[]
  if (valid.length === 0) {
    return null
  }

  const segments = availableSegments(width, mergeIntervals(valid))
  if (segments.length === 0) {
    return {
      xOffset: 0,
      maxWidth: width
    }
  }

  return {
    xOffset: segments[0]?.xOffset ?? 0,
    maxWidth: segments[0]?.maxWidth ?? width,
    segments
  }
}
