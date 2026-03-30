import { isEmojiSequence as isEmojiCluster, segmentGraphemes } from '../../../core/src/unicode.ts'

export function isEmojiSequence(text: string): boolean {
  return isEmojiCluster(text)
}

export function findEmojiSequences(text: string): string[] {
  return segmentGraphemes(text).filter(isEmojiCluster)
}
