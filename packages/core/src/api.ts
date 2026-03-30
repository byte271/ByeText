import { createDocument } from './document.ts'
import type { CreateOptions, TextDocument } from './types.ts'

export const VERSION = '0.1.0'

export const ByeText = {
  create(options: CreateOptions): TextDocument {
    return createDocument(options)
  },
  version: VERSION
}
