import type { CanvasContextLike, CanvasLike } from '../src/types.ts'

export interface MockDrawCall {
  text: string
  x: number
  y: number
  font: string
  fillStyle: string
}

export interface MockCanvas extends CanvasLike {
  readonly context: MockCanvasContext
}

export class MockCanvasContext implements CanvasContextLike {
  canvas = { width: 0, height: 0 }
  font = 'normal 400 16px system-ui'
  fillStyle = '#111111'
  direction: 'inherit' | 'ltr' | 'rtl' = 'ltr'
  globalAlpha = 1
  readonly drawCalls: MockDrawCall[] = []
  readonly cleared: Array<{ x: number; y: number; width: number; height: number }> = []

  measureText(text: string) {
    return {
      width: text.length * 10,
      actualBoundingBoxAscent: 8,
      actualBoundingBoxDescent: 2
    }
  }

  fillText(text: string, x: number, y: number): void {
    this.drawCalls.push({
      text,
      x,
      y,
      font: this.font,
      fillStyle: String(this.fillStyle)
    })
  }

  clearRect(x: number, y: number, width: number, height: number): void {
    this.cleared.push({ x, y, width, height })
  }

  save(): void {}
  restore(): void {}
  beginPath(): void {}
  rect(): void {}
  clip(): void {}
  scale(): void {}
  setTransform(): void {}
}

export function createMockCanvas(width = 240, height = 160): MockCanvas {
  const context = new MockCanvasContext()
  const canvas: MockCanvas = {
    width,
    height,
    style: {},
    context,
    getContext(type: '2d') {
      return type === '2d' ? context : null
    }
  }

  context.canvas = canvas
  return canvas
}
