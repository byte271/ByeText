import type { TextDocument } from '../../packages/core/src/types.ts'

export function firstLayout(doc: TextDocument): void {
  doc.layout()
}
