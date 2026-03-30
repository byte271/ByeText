import type { ByeTextPlugin, PluginRegistry, TextDocument } from '../../../core/src/types.ts'
import { segmentGraphemes } from './uax29.ts'

export function createGraphemePlugin(): ByeTextPlugin {
  return {
    name: 'grapheme',
    version: '0.1.0',
    install(_doc: TextDocument, registry: PluginRegistry) {
      registry.expose('grapheme', { enabled: true, segment: segmentGraphemes })
    }
  }
}

export { segmentGraphemes } from './uax29.ts'
