import { describe, expect, it } from 'vitest'
import { greetFor, hourFor, orbY, phaseFor } from './theme'

describe('phaseFor', () => {
  it('hour boundaries', () => {
    const cases: [number, string][] = [[0, 'night'], [4.99, 'night'], [5, 'dawn'], [8.99, 'dawn'], [9, 'day'], [15.99, 'day'], [16, 'dusk'], [18.99, 'dusk'], [19, 'night'], [23.5, 'night']]
    for (const [h, p] of cases) expect(phaseFor(h), String(h)).toBe(p)
  })
})
describe('greetFor', () => {
  it('follows the clock', () => {
    expect(greetFor(4)).toBe('Good evening')
    expect(greetFor(5)).toBe('Good morning')
    expect(greetFor(11.9)).toBe('Good morning')
    expect(greetFor(12)).toBe('Good afternoon')
    expect(greetFor(16.9)).toBe('Good afternoon')
    expect(greetFor(17)).toBe('Good evening')
  })
})
describe('hourFor', () => {
  it('auto uses the clock, forced phases use their sample hour', () => {
    expect(hourFor('auto', new Date(2026, 10, 14, 7, 30))).toBe(7.5)
    expect(phaseFor(hourFor('dawn'))).toBe('dawn')
    expect(phaseFor(hourFor('day'))).toBe('day')
    expect(phaseFor(hourFor('dusk'))).toBe('dusk')
    expect(phaseFor(hourFor('night'))).toBe('night')
  })
})
describe('orbY', () => {
  it('sun is highest at noon and low at sunrise/sunset; moon is highest at midnight', () => {
    expect(orbY(12)).toBe('6.0%')
    expect(parseFloat(orbY(5))).toBeCloseTo(32, 0)
    expect(parseFloat(orbY(19))).toBeCloseTo(32, 0)
    expect(orbY(0)).toBe('6.0%')
  })
})
