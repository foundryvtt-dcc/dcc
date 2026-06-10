/**
 * Regression coverage for computed Speed (issue #739).
 *
 * Before the fix the computeSpeed block derived its "preserve active effect"
 * modifier as `currentValue - baseSpeed`, which algebraically cancelled
 * baseSpeed — so changing Base Speed in the Config menu never reached the
 * sheet. The fix derives the active-effect contribution from `_source` instead
 * and adds a manual `speed.otherMod`, giving:
 *   value = base + otherMod + armorPenalty + activeEffectDelta
 *
 * The arithmetic lives in the pure static DCCActor.computeSpeedValue so it can
 * be exercised without a full actor prepare cycle (the mocked Foundry Actor
 * base class does not implement prepareDerivedData).
 *
 * Mocks for Foundry Classes/Functions are found in __mocks__/foundry.js
 **/

import { expect, test, vi } from 'vitest'
import '../__mocks__/foundry.js'
import DCCActor from '../actor'

// Mock the actor-level-change module (matches actor.test.js)
vi.mock('../actor-level-change.js')

test('computed speed reflects the configured Base Speed (#739)', () => {
  // base 20 with a stale displayed value of 30 and no active effect -> 20
  expect(DCCActor.computeSpeedValue({
    base: '20', otherMod: 0, armorPenalty: 0, currentValue: '30', sourceValue: '30'
  })).toBe(20)
})

test('computed speed adds the manual speed otherMod', () => {
  expect(DCCActor.computeSpeedValue({
    base: '30', otherMod: 5, armorPenalty: 0, currentValue: '30', sourceValue: '30'
  })).toBe(35)
})

test('computed speed combines base, otherMod and armor speed penalty', () => {
  expect(DCCActor.computeSpeedValue({
    base: '30', otherMod: 5, armorPenalty: -5, currentValue: '30', sourceValue: '30'
  })).toBe(30)
})

test('computed speed preserves an active-effect modifier on speed.value', () => {
  // in-memory value 40 (post +10 effect) vs persisted 30 -> +10 delta on base
  expect(DCCActor.computeSpeedValue({
    base: '30', otherMod: 0, armorPenalty: 0, currentValue: '40', sourceValue: '30'
  })).toBe(40)
})

test('computed speed ignores the delta when no persisted value is available', () => {
  // sourceValue undefined -> no active-effect delta, base wins
  expect(DCCActor.computeSpeedValue({
    base: '20', otherMod: 0, armorPenalty: 0, currentValue: '30', sourceValue: undefined
  })).toBe(20)
})

test('computed speed treats non-numeric inputs as zero', () => {
  expect(DCCActor.computeSpeedValue({})).toBe(0)
})

test('computed speed parses unit-bearing values (e.g. 30 feet written with a tick)', () => {
  // base "30'" with a -5 armor penalty and no active effect -> 25
  expect(DCCActor.computeSpeedValue({
    base: "30'", otherMod: 0, armorPenalty: -5, currentValue: "30'", sourceValue: "30'"
  })).toBe(25)
})
