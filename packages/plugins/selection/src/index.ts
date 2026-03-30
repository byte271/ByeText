import type { ByeTextPlugin, PluginRegistry, TextDocument } from '../../../core/src/types.ts'

import type { SelectionRange } from './selection.ts'

export interface SelectionPlugin extends ByeTextPlugin {
  setSelection(range: SelectionRange | null): void
  getSelection(): SelectionRange | null
}

export function createSelectionPlugin(): SelectionPlugin {
  let selection: SelectionRange | null = null

  const plugin: SelectionPlugin = {
    name: 'selection',
    version: '0.1.0',
    install(_doc: TextDocument, registry: PluginRegistry) {
      registry.expose('selection', plugin)
    },
    setSelection(range) {
      selection = range
    },
    getSelection() {
      return selection
    }
  }

  return plugin
}
