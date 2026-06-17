import { describe, test, expect } from 'vitest'
import { buildDamageBreakdown } from '../actor/damage-breakdown.mjs'

// Phase 7 (Appendix-A actor.js shrinkage): _buildDamageBreakdown was a pure
// method (no `this`), so it extracted out of actor.js into a free function in
// actor/damage-breakdown.mjs. It previously had zero direct coverage (only the
// _rollDamage call site exercised it end-to-end), so these are a coverage win.

// Minimal Foundry-Roll-like term shapes.
const die = (total, flavor = '') => ({ total, flavor })
const op = (operator) => ({ operator })

describe('buildDamageBreakdown', () => {
  test('returns null for a single damage type', () => {
    const roll = { terms: [die(6, 'fire')] }
    expect(buildDamageBreakdown(roll)).toBeNull()
  })

  test('returns null when all terms share one (empty) flavor', () => {
    const roll = { terms: [die(3), op('+'), die(2)] }
    // both flavorless -> single bucket -> null
    expect(buildDamageBreakdown(roll)).toBeNull()
  })

  test('builds a breakdown for two distinct damage types', () => {
    const roll = { terms: [die(3, ''), op('+'), die(5, 'fire')] }
    expect(buildDamageBreakdown(roll)).toBe('3 + 5 fire')
  })

  test('skips operator terms and accumulates same-flavor terms', () => {
    const roll = { terms: [die(2, 'cold'), op('+'), die(3, 'cold'), op('+'), die(4, 'fire')] }
    // cold accumulates to 5, fire 4 -> two buckets
    expect(buildDamageBreakdown(roll)).toBe('5 cold + 4 fire')
  })

  test('treats a missing total as 0', () => {
    const roll = { terms: [{ flavor: 'fire' }, op('+'), die(2, 'cold')] }
    expect(buildDamageBreakdown(roll)).toBe('0 fire + 2 cold')
  })

  test('a flavored + flavorless mix renders the bare total without a label', () => {
    const roll = { terms: [die(7, 'acid'), op('+'), die(1)] }
    expect(buildDamageBreakdown(roll)).toBe('7 acid + 1')
  })
})
