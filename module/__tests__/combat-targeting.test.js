/**
 * Unit coverage for module/combat-targeting.mjs. Pure helpers, plain
 * token-like objects, no Foundry boot.
 */

import { describe, expect, test } from 'vitest'
import { highestPcTargetLuckMod } from '../combat-targeting.mjs'

const pc = (mod) => ({ actor: { type: 'Player', system: { abilities: { lck: { mod } } } } })
const npc = (mod) => ({ actor: { type: 'NPC', system: { abilities: { lck: { mod } } } } })

describe('highestPcTargetLuckMod', () => {
  test('returns the lone PC target Luck modifier', () => {
    expect(highestPcTargetLuckMod(new Set([pc(2)]))).toBe(2)
  })

  test('returns the highest among several PC targets', () => {
    expect(highestPcTargetLuckMod(new Set([pc(-1), pc(3), pc(1)]))).toBe(3)
  })

  test('ignores non-PC targets', () => {
    expect(highestPcTargetLuckMod(new Set([npc(5), pc(0)]))).toBe(0)
  })

  test('returns null when no PC is targeted', () => {
    expect(highestPcTargetLuckMod(new Set([npc(5)]))).toBeNull()
    expect(highestPcTargetLuckMod(new Set())).toBeNull()
  })

  test('treats a missing/NaN Luck modifier as 0', () => {
    expect(highestPcTargetLuckMod(new Set([{ actor: { type: 'Player', system: {} } }]))).toBe(0)
  })

  test('is null-safe on bad input', () => {
    expect(highestPcTargetLuckMod(null)).toBeNull()
    expect(highestPcTargetLuckMod(undefined)).toBeNull()
  })
})
