import type { TextDocument } from '../../packages/core/src/types.ts'

export function obstacleMove(doc: TextDocument): void {
  const flow = doc.getPlugin<any>('flow')
  if (!flow) {
    return
  }

  const id = flow.addObstacle({ type: 'circle', cx: 80, cy: 40, r: 20 })
  flow.updateObstacle(id, { cx: 120 })
}
