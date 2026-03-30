import type { TextDocument } from '../../packages/core/src/types.ts'

export function scrollRender(doc: TextDocument): void {
  doc.render()
}
