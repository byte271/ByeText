import type { ByeTextPlugin, PluginRegistry, TextDocument } from '../../../core/src/types.ts'

import { createLineAnimations } from './animation.ts'
import { createAnimationScheduler } from './scheduler.ts'
import type { MotionOptions } from './animation.ts'
import type { LayoutState, LineAnimation } from '../../../core/src/types.ts'

export interface MotionPlugin extends ByeTextPlugin {
  setOptions(options: MotionOptions): void
  skipNext(): void
  isAnimating(): boolean
  getAnimations(): LineAnimation[]
}

export function createMotionPlugin(initialOptions: MotionOptions = {}): MotionPlugin {
  const scheduler = createAnimationScheduler()
  let options = { duration: 200, threshold: 2, ...initialOptions }
  let previous: LayoutState | null = null
  let animations: LineAnimation[] = []
  let skipNextLayout = false

  const plugin: MotionPlugin = {
    name: 'motion',
    version: '0.1.0',
    install(_doc: TextDocument, registry: PluginRegistry) {
      registry.onLayout((nextState) => {
        if (skipNextLayout) {
          skipNextLayout = false
          previous = nextState
          animations = []
          return null
        }

        animations = createLineAnimations(previous, nextState, options)
        previous = nextState
        if (animations.length > 0) {
          scheduler.start(() => false)
        }
        return null
      })
      registry.expose('motion', plugin)
    },
    teardown() {
      scheduler.stop()
      animations = []
      previous = null
    },
    setOptions(nextOptions) {
      options = { ...options, ...nextOptions }
    },
    skipNext() {
      skipNextLayout = true
    },
    isAnimating() {
      return scheduler.isRunning()
    },
    getAnimations() {
      return animations
    }
  }

  return plugin
}
