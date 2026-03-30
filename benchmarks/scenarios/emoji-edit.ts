import type { TextDocument } from '../../packages/core/src/types.ts'

export function emojiEdit(doc: TextDocument): void {
  doc.insert(0, '👨🏽‍🚀 ')
  doc.layout()
  doc.render()
}
