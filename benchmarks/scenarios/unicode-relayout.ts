import type { TextDocument } from '../../packages/core/src/types.ts'

export function unicodeRelayout(doc: TextDocument): void {
  doc.setWidth(132)
  doc.layout()
  doc.render()
}
