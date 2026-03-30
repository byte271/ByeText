export function linear(t: number): number {
  return t
}

export function easeIn(t: number): number {
  return t * t
}

export function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t)
}

export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

export function spring(t: number, stiffness = 200, damping = 20): number {
  const b = damping / (2 * Math.sqrt(stiffness))
  const omega = Math.sqrt(Math.max(0.0001, 1 - b * b))
  return 1 - Math.exp(-b * t * 10) * Math.cos(omega * t * 10)
}
