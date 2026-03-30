import type { ByeTextPlugin, PluginRegistry, TextDocument } from '../../../core/src/types.ts'
import { reorderBidiText, resolveBaseDirection, splitBidiRuns } from './uax9.ts'

export function createBidiPlugin(): ByeTextPlugin {
  return {
    name: 'bidi',
    version: '0.1.0',
    install(_doc: TextDocument, registry: PluginRegistry) {
      registry.expose('bidi', { enabled: true, reorderBidiText, resolveBaseDirection, splitRuns: splitBidiRuns })
    }
  }
}

export { reorderBidiText, resolveBaseDirection, splitBidiRuns } from './uax9.ts'
