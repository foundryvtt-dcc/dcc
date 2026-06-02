/* global Roll, dccRollCreateRollMock */
/**
 * Adapter unit test — Phase 1 (initiative, Path A — formula only).
 *
 * Exercises the dispatcher inside `DCCActor.getInitiativeRoll`:
 *   - default (no dialog) routes to `_getInitiativeRollViaAdapter`,
 *     which asks the lib for a formula via rollCheck(mode:'formula')
 *     and returns a Foundry `Roll`.
 *   - `options.showModifierDialog: true` routes to
 *     `_getInitiativeRollWithDialogViaAdapter` (legacy-decom step 2),
 *     which builds the same structured DCCRoll terms and surfaces the
 *     unified modifier dialog adapter-side via `promptRollModifierDialog`,
 *     handing back the user's dialog-built Roll.
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

test('showModifierDialog routes to the adapter dialog and builds DCCRoll terms', async () => {
  // Legacy-decom step 2: the dialog is handled adapter-side (the former
  // legacy initiative body was deleted at session 25). The adapter
  // surfaces the same modifier dialog via `promptRollModifierDialog`
  // (which wraps DCCRoll.createRoll) and hands back the user's
  // dialog-built Roll. The term shape + dialog request are unchanged.
  dccRollCreateRollMock.mockClear()
  actor.system.attributes.init.die = '1d20'
  actor.system.attributes.init.value = -1

  const result = await actor.getInitiativeRoll(null, { showModifierDialog: true })

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
  // Init has no crit/fumble + Foundry posts the chat, so the adapter
  // dialog path returns the user's Roll directly (no lib round-trip).
  expect(result).toBeInstanceOf(Roll)
})

test('showModifierDialog routes to the adapter for the bitwise-XOR truthy value 1', async () => {
  // The sheet's fillRollOptions builds showModifierDialog via bitwise XOR,
  // which yields 0 or 1 (not true/false). The dispatcher's `if
  // (options.showModifierDialog)` gate treats the numeric `1` as truthy —
  // mirrors the rollAbilityCheck / rollSavingThrow idiom.
  dccRollCreateRollMock.mockClear()
  actor.system.attributes.init.die = '1d20'
  actor.system.attributes.init.value = -1

  await actor.getInitiativeRoll(null, { showModifierDialog: 1 })

  expect(dccRollCreateRollMock).toHaveBeenCalledTimes(1)
})

test('adapter dialog path returns null when the initiative dialog is cancelled', async () => {
  // RollModifierDialog cancel resolves DCCRoll.createRoll with null;
  // the adapter forwards that as null so `rollInit` falls back to its
  // default (no pre-built formula) initiative.
  dccRollCreateRollMock.mockClear()
  dccRollCreateRollMock.mockImplementationOnce(() => null)
  actor.system.attributes.init.die = '1d20'
  actor.system.attributes.init.value = -1

  const result = await actor.getInitiativeRoll(null, { showModifierDialog: true })

  expect(result).toBeNull()
})

test('adapter path re-appends an additive init-die tail (Mutant Horror 1d20+1d3)', () => {
  dccRollCreateRollMock.mockClear()
  // MCC folds the Mutant Horror die into init.die as `1d20+1d3` (see
  // mcc-core-book §9.2a). The lib's single-die model can't represent the
  // additive die, so the adapter re-appends it Foundry-side.
  actor.system.attributes.init.die = '1d20+1d3'
  actor.system.attributes.init.value = 0

  const roll = actor.getInitiativeRoll()

  expect(roll).toBeInstanceOf(Roll)
  expect(dccRollCreateRollMock).not.toHaveBeenCalled()
  expect(roll.formula).toMatch(/1d20/)
  expect(roll.formula).toMatch(/1d3/)
  // Two dice terms survive (the leading d20 + the appended horror die).
  expect(roll.formula.match(/d\d+/g)).toHaveLength(2)
})

test('adapter path preserves a higher-level additive tail with a flat bonus (1d20+1d7+7)', () => {
  dccRollCreateRollMock.mockClear()
  actor.system.attributes.init.die = '1d20+1d7+7'
  actor.system.attributes.init.value = 0

  const roll = actor.getInitiativeRoll()

  expect(roll).toBeInstanceOf(Roll)
  expect(roll.formula).toMatch(/1d7/)
  // The flat +7 baked into the folded init die survives too.
  expect(roll.formula).toMatch(/\+\s*7/)
  expect(roll.formula.match(/d\d+/g)).toHaveLength(2)
})

test('adapter path leaves a plain 1d20 init die unchanged (no additive tail)', () => {
  dccRollCreateRollMock.mockClear()
  actor.system.attributes.init.die = '1d20'
  actor.system.attributes.init.value = 0

  const roll = actor.getInitiativeRoll()

  expect(roll).toBeInstanceOf(Roll)
  expect(roll.formula).toBe('1d20')
  expect(roll.formula.match(/d\d+/g)).toHaveLength(1)
})

test('a weapon init-die override suppresses the additive tail (weapon die wins)', () => {
  dccRollCreateRollMock.mockClear()
  // Compound init.die AND an equipped two-handed weapon: the weapon die
  // replaces the init die entirely (matches `main` + the legacy path), so
  // the folded horror die must NOT be appended.
  actor.system.attributes.init.die = '1d20+1d3'
  actor.system.attributes.init.value = 0

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
    expect(roll.formula).toMatch(/1d16\[WeaponPropertiesTwoHanded\]/)
    // The folded horror die is suppressed when the weapon override wins.
    expect(roll.formula).not.toMatch(/1d3/)
    expect(roll.formula.match(/d\d+/g)).toHaveLength(1)
  } finally {
    actor.items.find = originalFind
  }
})

test('pre-built Roll short-circuit: returns the incoming Roll unchanged', () => {
  dccRollCreateRollMock.mockClear()
  const preBuilt = new Roll('1d20 + 5')
  const result = actor.getInitiativeRoll(preBuilt)

  expect(result).toBe(preBuilt)
  expect(dccRollCreateRollMock).not.toHaveBeenCalled()
})
