import type { TextDocument } from '../../packages/core/src/types.ts'

export function bulkInsert(doc: TextDocument): void {
  doc.insert(0, 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. ')
  doc.layout()
}
