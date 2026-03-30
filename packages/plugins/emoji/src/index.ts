import type { ByeTextPlugin, PluginRegistry, TextDocument } from '../../../core/src/types.ts'
import { findEmojiSequences, isEmojiSequence } from './sequences.ts'

export function createEmojiPlugin(): ByeTextPlugin {
  return {
    name: 'emoji',
    version: '0.1.0',
    install(_doc: TextDocument, registry: PluginRegistry) {
      registry.expose('emoji', { enabled: true, isEmojiSequence, findEmojiSequences })
    }
  }
}

export { findEmojiSequences, isEmojiSequence } from './sequences.ts'
