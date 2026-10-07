import { describe, expect, test } from 'vitest'
import { normalizeSpellLevel, spellCheckSucceeded } from '../spell-check-success.mjs'

describe('normalizeSpellLevel', () => {
  test('keeps a real spell level', () => {
    expect(normalizeSpellLevel(3)).toBe(3)
    expect(normalizeSpellLevel('2')).toBe(2)
  })

  test('treats a missing, zero or invalid level as 1', () => {
    expect(normalizeSpellLevel(undefined)).toBe(1)
    expect(normalizeSpellLevel(null)).toBe(1)
    expect(normalizeSpellLevel(0)).toBe(1)
    expect(normalizeSpellLevel('')).toBe(1)
    expect(normalizeSpellLevel('abc')).toBe(1)
  })
})

describe('spellCheckSucceeded (#979)', () => {
  test('applies the 10 + 2 × level threshold', () => {
    expect(spellCheckSucceeded({ total: 11, level: 1 })).toBe(false)
    expect(spellCheckSucceeded({ total: 12, level: 1 })).toBe(true)
    expect(spellCheckSucceeded({ total: 15, level: 3 })).toBe(false)
    expect(spellCheckSucceeded({ total: 16, level: 3 })).toBe(true)
  })

  test('a level-0 or level-less spell uses the level-1 threshold of 12', () => {
    expect(spellCheckSucceeded({ total: 11, level: 0 })).toBe(false)
    expect(spellCheckSucceeded({ total: 11 })).toBe(false)
    expect(spellCheckSucceeded({ total: 12, level: 0 })).toBe(true)
  })

  test('a fumble fails whatever the total', () => {
    expect(spellCheckSucceeded({ total: 25, level: 1, fumble: true })).toBe(false)
  })

  test('a disapproval-range natural fails whatever the total', () => {
    expect(spellCheckSucceeded({ total: 25, level: 1, disapprovalFailure: true })).toBe(false)
  })
})
