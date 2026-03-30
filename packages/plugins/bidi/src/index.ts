import type { ByeTextPlugin, PluginRegistry, TextDocument } from '../../../core/src/types.ts'

export function createBidiPlugin(): ByeTextPlugin {
  return {
    name: 'bidi',
    version: '0.1.0',
    install(_doc: TextDocument, registry: PluginRegistry) {
      registry.expose('bidi', { enabled: true })
    }
  }
}
