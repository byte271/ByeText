export interface AnimationScheduler {
  start(step: (time: number) => boolean): void
  stop(): void
  isRunning(): boolean
}

export function createAnimationScheduler(): AnimationScheduler {
  let running = false
  let frame = 0

  const request = typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame.bind(globalThis)
    : (callback: FrameRequestCallback) => setTimeout(() => callback(Date.now()), 16) as unknown as number

  const cancel = typeof cancelAnimationFrame === 'function'
    ? cancelAnimationFrame.bind(globalThis)
    : (id: number) => clearTimeout(id)

  return {
    start(step) {
      if (running) {
        return
      }

      running = true
      const loop = (time: number) => {
        if (!running) {
          return
        }

        const keepGoing = step(time)
        if (!keepGoing) {
          running = false
          return
        }

        frame = request(loop)
      }

      frame = request(loop)
    },
    stop() {
      if (!running) {
        return
      }

      running = false
      cancel(frame)
    },
    isRunning() {
      return running
    }
  }
}
