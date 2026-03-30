export interface BenchResult {
  operation: string
  runs: number
  meanMs: number
  p50Ms: number
  p95Ms: number
  p99Ms: number
  minMs: number
  maxMs: number
  stddevMs: number
}

function percentile(values: number[], ratio: number): number {
  if (values.length === 0) {
    return 0
  }

  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))
  return sorted[index] ?? 0
}

export function summarize(operation: string, runs: number, samples: number[]): BenchResult {
  const meanMs = samples.reduce((total, value) => total + value, 0) / Math.max(1, samples.length)
  const variance = samples.reduce((total, value) => total + (value - meanMs) ** 2, 0) / Math.max(1, samples.length)

  return {
    operation,
    runs,
    meanMs,
    p50Ms: percentile(samples, 0.5),
    p95Ms: percentile(samples, 0.95),
    p99Ms: percentile(samples, 0.99),
    minMs: Math.min(...samples),
    maxMs: Math.max(...samples),
    stddevMs: Math.sqrt(variance)
  }
}
