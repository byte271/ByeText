import assert from 'node:assert/strict'

import { createMeasureCache, beginMeasurementPass, finishMeasurementPass, measureRun } from '../src/measure.ts'

import { createMockCanvas } from './mock-canvas.ts'

export function runMeasureTests(): void {
  const canvas = createMockCanvas()
  const ctx = canvas.getContext('2d')!
  const cache = createMeasureCache(4)
  const run = {
    id: 'run_1',
    text: 'Hello world',
    style: { family: 'Mock Sans', size: 10, weight: 400, style: 'normal', color: '#000', direction: 'ltr', letterSpacing: 0, wordSpacing: 0 },
    metrics: null,
    styleVersion: 1,
    globalStart: 0,
    globalEnd: 11
  }

  beginMeasurementPass(cache)
  const first = measureRun(run, ctx, cache)
  finishMeasurementPass(cache)
  beginMeasurementPass(cache)
  const second = measureRun(run, ctx, cache)
  finishMeasurementPass(cache)

  assert.equal(first.totalWidth, 110)
  assert.equal(second.totalWidth, 110)
  assert.equal(cache.hits, 1)
  assert.equal(cache.misses, 1)
}

export function runMeasureEvictionTests(): void {
  const canvas = createMockCanvas()
  const ctx = canvas.getContext('2d')!
  const cache = createMeasureCache(1)

  beginMeasurementPass(cache)
  measureRun({
    id: 'run_a',
    text: 'Alpha',
    style: { family: 'Mock Sans', size: 10, weight: 400, style: 'normal', color: '#000', direction: 'ltr', letterSpacing: 0, wordSpacing: 0 },
    metrics: null,
    styleVersion: 1,
    globalStart: 0,
    globalEnd: 5
  }, ctx, cache)
  finishMeasurementPass(cache)

  beginMeasurementPass(cache)
  measureRun({
    id: 'run_b',
    text: 'Beta',
    style: { family: 'Mock Sans', size: 10, weight: 400, style: 'normal', color: '#000', direction: 'ltr', letterSpacing: 0, wordSpacing: 0 },
    metrics: null,
    styleVersion: 1,
    globalStart: 0,
    globalEnd: 4
  }, ctx, cache)
  finishMeasurementPass(cache)

  assert.equal(cache.store.size, 1)
}
