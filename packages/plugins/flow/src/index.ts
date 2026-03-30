import type { ByeTextPlugin, PluginRegistry, TextDocument } from '../../../core/src/types.ts'

import { constraintForObstacle, mergeConstraints } from './constraint.ts'
import type { Obstacle, ObstacleId, ObstacleShape } from './obstacle.ts'

export interface FlowPlugin extends ByeTextPlugin {
  addObstacle(shape: ObstacleShape, options?: { padding?: number; side?: 'left' | 'right' | 'both' }): ObstacleId
  updateObstacle(id: ObstacleId, shape: Partial<ObstacleShape>): void
  removeObstacle(id: ObstacleId): void
  getObstacles(): Obstacle[]
}

function obstacleId(): ObstacleId {
  return `obs_${Math.random().toString(36).slice(2, 10)}`
}

export function createFlowPlugin(): FlowPlugin {
  const obstacles = new Map<ObstacleId, Obstacle>()
  let installedDoc: TextDocument | null = null

  const plugin: FlowPlugin = {
    name: 'flow',
    version: '0.1.0',
    install(doc: TextDocument, registry: PluginRegistry) {
      installedDoc = doc
      registry.onObstacle((_lineIndex, y, height, width) => {
        const constraint = mergeConstraints(
          width,
          [...obstacles.values()].map((obstacle) => constraintForObstacle(obstacle, y, height, width))
        )
        return constraint
      })
      registry.expose('flow', plugin)
    },
    teardown() {
      obstacles.clear()
      installedDoc = null
    },
    addObstacle(shape, options) {
      const id = obstacleId()
      obstacles.set(id, {
        ...shape,
        id,
        padding: options?.padding ?? 0,
        side: options?.side ?? 'both'
      })
      installedDoc?.layout()
      return id
    },
    updateObstacle(id, shape) {
      const current = obstacles.get(id)
      if (!current) {
        return
      }

      obstacles.set(id, { ...current, ...shape })
      installedDoc?.layout()
    },
    removeObstacle(id) {
      if (obstacles.delete(id)) {
        installedDoc?.layout()
      }
    },
    getObstacles() {
      return [...obstacles.values()]
    }
  }

  return plugin
}
