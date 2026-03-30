import type { ByeTextPlugin, PluginRegistry, TextDocument } from '../../../core/src/types.ts'

import type { DocumentSnapshot } from './inspector.ts'

export interface DebugPlugin extends ByeTextPlugin {
  inspect(): DocumentSnapshot
  debugDraw(): void
  clearOverlay(): void
}

export function createDebugPlugin(): DebugPlugin {
  let doc: TextDocument | null = null

  const plugin: DebugPlugin = {
    name: 'debug',
    version: '0.1.0',
    install(target: TextDocument, registry: PluginRegistry) {
      doc = target
      registry.expose('debug', plugin)
    },
    teardown() {
      doc = null
    },
    inspect() {
      const state = (doc as TextDocument & { _state?: any })?._state
      return {
        runCount: state?.runs.length ?? 0,
        lineCount: state?.layoutState.lineCount ?? 0,
        totalHeight: state?.layoutState.totalHeight ?? 0,
        cacheHits: state?.measureCache.hits ?? 0,
        cacheMisses: state?.measureCache.misses ?? 0,
        dirtyRange: state?.dirtyRange ?? null,
        version: state?.version ?? 0,
        pluginNames: [...(state?.pluginInstances?.keys?.() ?? [])]
      }
    },
    debugDraw() {},
    clearOverlay() {}
  }

  return plugin
}
