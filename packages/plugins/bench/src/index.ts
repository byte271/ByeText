import type { ByeTextPlugin, PluginRegistry, TextDocument } from '../../../core/src/types.ts'

import { summarize } from './harness.ts'

export interface BenchPlugin extends ByeTextPlugin {
  run(options: { operation: string; runs?: number; warmup?: number }): Promise<ReturnType<typeof summarize>>
}

export function createBenchPlugin(docFactory?: () => TextDocument): BenchPlugin {
  const plugin: BenchPlugin = {
    name: 'bench',
    version: '0.1.0',
    install(_doc: TextDocument, registry: PluginRegistry) {
      registry.expose('bench', plugin)
    },
    async run(options) {
      const runs = options.runs ?? 100
      const samples: number[] = []
      for (let index = 0; index < runs; index += 1) {
        const start = performance.now()
        const doc = docFactory?.()
        if (doc) {
          doc.layout()
        }
        samples.push(performance.now() - start)
      }

      return summarize(options.operation, runs, samples)
    }
  }

  return plugin
}
