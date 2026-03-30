import type { TextDocument } from '../../packages/core/src/types.ts'

export function insertTyping(doc: TextDocument): void {
  doc.insert(0, 'a')
  doc.layout()
}
