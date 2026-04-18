/* global Roll, dccRollCreateRollMock */
/**
 * Adapter unit test — Phase 1 (initiative, Path A — formula only).
 *
 * Exercises the dispatcher inside `DCCActor.getInitiativeRoll`:
 *   - default (no dialog) routes to `_getInitiativeRollViaAdapter`,
 *     which asks the lib for a formula via rollCheck(mode:'formula')
 *     and returns a Foundry `Roll`.
 *   - `options.showModifierDialog: true` routes to
 *     `_getInitiativeRollLegacy`, which builds structured DCCRoll
 *     terms (preset-die support required by the dialog).
 *   - `formula instanceof Roll` short-circuits — Foundry's combat flow
 *     reuses a pre-built Roll across combatants.
 *
 * Does not exercise Foundry's native `Combat#rollInitiative` chat
 * emission — the `core.initiativeRoll` flag is set by Foundry core and
 * is what `emoteInitiativeRoll` in module/chat.js gates on. Path A
 * preserves that integration by keeping `getInitiativeRoll`'s contract
 * (returns a Roll, Foundry evaluates and posts).
 */

import { expect, test, vi } from 'vitest'
import '../__mocks__/foundry.js'
import DCCActor from '../actor.js'

vi.mock('../actor-level-change.js')

const actor = new DCCActor()

test('adapter path produces a Roll with init.value baked into the formula', () => {
  dccRollCreateRollMock.mockClear()

  // Mock actor has agl 8 (mod -1), no custom init die — default
  // computeInitiative produces init.value = -1 + otherMod 0 = -1.
  actor.system.attributes.init.die = '1d20'
  actor.system.attributes.init.value = -1

  const roll = actor.getInitiativeRoll()

  expect(roll).toBeInstanceOf(Roll)
  expect(dccRollCreateRollMock).not.toHaveBeenCalled()
  // Formula is the lib's output. Exact shape (collapsed vs. separate
  // terms) is a lib implementation detail; assert the die and the
  // signed modifier both appear.
  expect(roll.formula).toMatch(/1d20/)
  expect(roll.formula).toMatch(/-\s*1/)
})

test('adapter path omits zero modifier when init.value is 0', () => {
  dccRollCreateRollMock.mockClear()
  actor.system.attributes.init.die = '1d20'
  actor.system.attributes.init.value = 0

  const roll = actor.getInitiativeRoll()

  expect(roll).toBeInstanceOf(Roll)
  expect(roll.formula).toBe('1d20')
})

test('adapter path propagates a custom init die to the formula', () => {
  dccRollCreateRollMock.mockClear()
  actor.system.attributes.init.die = '1d24'
  actor.system.attributes.init.value = 2

  const roll = actor.getInitiativeRoll()

  expect(roll).toBeInstanceOf(Roll)
  expect(roll.formula).toMatch(/1d24/)
  expect(roll.formula).toMatch(/\+\s*2/)
})

test('adapter path annotates the die with the two-handed label when such a weapon is equipped', () => {
  dccRollCreateRollMock.mockClear()
  actor.system.attributes.init.die = '1d20'
  actor.system.attributes.init.value = 0

  // Two-handed equipped weapon forces a d16 init die with a Foundry
  // `[label]` annotation — the lib emits a plain formula, the adapter
  // re-injects the annotation. Manual save/restore rather than
  // `vi.spyOn().mockRestore()`, which leaks through the shared
  // collectionFindMock to subsequent tests.
  const originalFind = actor.items.find
  const twoHandedWeapon = {
    system: { twoHanded: true, equipped: true, initiativeDie: '1d16', config: {} }
  }
  actor.items.find = vi.fn((predicate) =>
    predicate(twoHandedWeapon) ? twoHandedWeapon : undefined
  )

  try {
    const roll = actor.getInitiativeRoll()

    expect(roll).toBeInstanceOf(Roll)
    // i18n mock returns the bare key when no translation is registered.
    expect(roll.formula).toMatch(/1d16\[WeaponPropertiesTwoHanded\]/)
  } finally {
    actor.items.find = originalFind
  }
})

test('legacy path kicks in when showModifierDialog is set and invokes DCCRoll.createRoll', () => {
  dccRollCreateRollMock.mockClear()
  actor.system.attributes.init.die = '1d20'
  actor.system.attributes.init.value = -1

  actor.getInitiativeRoll(null, { showModifierDialog: true })

  expect(dccRollCreateRollMock).toHaveBeenCalledTimes(1)
  const [terms, , options] = dccRollCreateRollMock.mock.calls[0]
  expect(terms).toEqual([
    { type: 'Die', formula: '1d20' },
    { type: 'Modifier', label: 'Initiative', formula: '-1' }
  ])
  expect(options).toEqual(expect.objectContaining({
    title: 'Initiative',
    showModifierDialog: true
  }))
})

test('pre-built Roll short-circuit: returns the incoming Roll unchanged', () => {
  dccRollCreateRollMock.mockClear()
  const preBuilt = new Roll('1d20 + 5')
  const result = actor.getInitiativeRoll(preBuilt)

  expect(result).toBe(preBuilt)
  expect(dccRollCreateRollMock).not.toHaveBeenCalled()
})
