import type { TextDocument } from '../../packages/core/src/types.ts'

export function widthResize(doc: TextDocument): void {
  doc.setWidth(280)
  doc.layout()
}
