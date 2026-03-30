export function isEmojiSequence(text: string): boolean {
  return /\p{Extended_Pictographic}/u.test(text)
}
