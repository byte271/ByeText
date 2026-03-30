export interface DocumentSnapshot {
  runCount: number
  lineCount: number
  totalHeight: number
  cacheHits: number
  cacheMisses: number
  dirtyRange: unknown
  version: number
  pluginNames: string[]
}
