/* global Hooks, gameSettingsGetMock, dccRollCreateRollMock */
/**
 * Adapter round-trip test — Phase 3 session 2 (weapon attack).
 *
 * Dispatcher + adapter coverage:
 *   DCCActor.rollToHit →
 *     (happy path — automate on or off) → _rollToHitViaAdapter
 *     (backstab on a thief — session 9) → _rollToHitViaAdapter with isBackstab
 *     (showModifierDialog — session 13 / A6) → _rollToHitViaAdapter with damageTerms
 *     (non-deed dice in bonus — session 14 / A7) → _rollToHitViaAdapter (Foundry total authoritative)
 *
 * A7 closes gate exhaustiveness: every runtime input now routes via
 * adapter. `_rollToHitLegacy` is dead code pending D1 retirement.
 *
 * Adapter-path validation points:
 *   - `dcc.modifyAttackRollTerms` hook still fires with the legacy-shape
 *     terms array.
 *   - `DCCRoll.createRoll` is still invoked for chat rendering (same
 *     shape as legacy).
 *   - The result carries `libResult` populated from the lib's
 *     `makeAttackRoll` so `rollWeaponAttack` can surface it as
 *     `dcc.libResult` chat flags.
 */

import { expect, test, vi } from 'vitest'
import '../__mocks__/foundry.js'
import DCCActor from '../actor.js'
import DCCItem from '../item.js'
import { buildAttackInput, hookTermsToBonuses, normalizeLibDie, parseDeedAttackBonus } from '../adapter/attack-input.mjs'
import { logDispatch } from '../adapter/debug.mjs'

vi.mock('../actor-level-change.js')

// Mock logDispatch so tests can assert on dispatch-path selection
// deterministically (vitest's reporter intercepts console.log before
// spies see it).
vi.mock('../adapter/debug.mjs', () => ({
  logDispatch: vi.fn(),
  warnIfDivergent: vi.fn()
}))

function makeSimpleWeapon (overrides = {}) {
  return new DCCItem({
    name: 'longsword',
    type: 'weapon',
    system: {
      actionDie: '1d20',
      toHit: '+2',
      critRange: 20,
      damage: '1d8',
      melee: true,
      equipped: true,
      twoWeaponPrimary: false,
      twoWeaponSecondary: false,
      ...overrides
    }
  })
}

function withAutomate (enabled) {
  const original = gameSettingsGetMock.getMockImplementation()
  gameSettingsGetMock.mockImplementation((module, key) => {
    if (module === 'dcc' && key === 'automateDamageFumblesCrits') return enabled
    if (module === 'dcc' && key === 'strictCriticalHits') return false
    if (module === 'dcc' && key === 'checkWeaponEquipment') return false
    return original ? original(module, key) : undefined
  })
  return () => gameSettingsGetMock.mockImplementation(original)
}

function assertDispatched (path, rollType = 'rollWeaponAttack') {
  return logDispatch.mock.calls.some(args =>
    args[0] === rollType && args[1] === path
  )
}

/**
 * Mock `DCCRoll.createRoll` to return a Roll with two dice terms — the
 * action die at `dice[0]` and a deed die at `dice[1]`. Required for the
 * deed-die adapter path: `_rollToHitViaAdapter` throws if `deedDie` is
 * set on the input but the Roll only produced one dice term.
 *
 * Returns a restore function that reverts the mock.
 */
function withDeedDiceRoll (d20Natural = 10, deedNatural = 2) {
  const previous = dccRollCreateRollMock.getMockImplementation()
  dccRollCreateRollMock.mockImplementation(() => ({
    total: d20Natural + deedNatural,
    formula: '1d20+1d3+0',
    options: { dcc: {} },
    dice: [
      { total: d20Natural, formula: '1d20', options: {} },
      { total: deedNatural, formula: '1d3', options: {} }
    ],
    terms: [
      { apply: false, class: 'Die', options: { flavor: null }, evaluated: false, number: 1, faces: 20, modifiers: [], results: [] }
    ],
    evaluate: async () => {},
    render: async () => '',
    toAnchor: () => ({ outerHTML: '' })
  }))
  return () => {
    if (previous) dccRollCreateRollMock.mockImplementation(previous)
    else dccRollCreateRollMock.mockReset()
  }
}

test('adapter path fires for simplest weapon with automate on', async () => {
  logDispatch.mockClear()
  dccRollCreateRollMock.mockClear()
  const hookCallSpy = vi.fn(() => true)
  const originalCall = Hooks.call
  Hooks.call = hookCallSpy
  const restore = withAutomate(true)

  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  const weapon = makeSimpleWeapon()

  try {
    await actor.rollToHit(weapon, {})
  } finally {
    restore()
    Hooks.call = originalCall
  }

  expect(assertDispatched('adapter')).toBe(true)
  expect(
    hookCallSpy.mock.calls.some(args => args[0] === 'dcc.modifyAttackRollTerms')
  ).toBe(true)
  expect(dccRollCreateRollMock).toHaveBeenCalled()
})

test('adapter path result carries lib classification + modifier list', async () => {
  logDispatch.mockClear()
  const restore = withAutomate(true)
  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  const weapon = makeSimpleWeapon()

  let result
  try {
    result = await actor.rollToHit(weapon, {})
  } finally {
    restore()
  }

  expect(result).toBeDefined()
  expect(result.rolled).toBe(true)
  expect(result.libResult).toBeDefined()
  expect(result.libResult.die).toBe('d20')
  expect(Array.isArray(result.libResult.modifiers)).toBe(true)
  // `natural` is populated from `attackRoll.dice[0].total` at runtime; the
  // unit mock doesn't expose `total` on the dice term, so assert only
  // that the field exists on the result object.
  expect('natural' in result.libResult).toBe(true)
  expect(typeof result.libResult.isCriticalThreat).toBe('boolean')
  expect(typeof result.libResult.isFumble).toBe('boolean')
})

test('adapter path fires when automate off (session 12 / A5)', async () => {
  // A5: `automateDamageFumblesCrits` gates the downstream damage /
  // crit / fumble chain inside `rollWeaponAttack`, not the attack-side
  // adapter. Verify the attack routes via adapter regardless, with
  // `libResult` populated so the chat flags still surface lib data.
  logDispatch.mockClear()
  const restore = withAutomate(false)
  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  const weapon = makeSimpleWeapon()

  let result
  try {
    result = await actor.rollToHit(weapon, {})
  } finally {
    restore()
  }

  expect(assertDispatched('adapter')).toBe(true)
  expect(assertDispatched('legacy')).toBe(false)
  expect(result.libResult).toBeDefined()
})

test('adapter path fires when options.backstab is set (session 9)', async () => {
  logDispatch.mockClear()
  const restore = withAutomate(true)
  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  actor.system.class.backstab = '+3'
  const weapon = makeSimpleWeapon({ backstabDamage: '1d10' })

  try {
    await actor.rollToHit(weapon, { backstab: true })
  } finally {
    restore()
  }

  expect(assertDispatched('adapter')).toBe(true)
  expect(assertDispatched('legacy')).toBe(false)
})

test('adapter path with backstab sets isBackstab + class:backstab RollBonus', async () => {
  logDispatch.mockClear()
  const restore = withAutomate(true)
  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  // L3 chaotic thief backstab bonus (Table 1-9).
  actor.system.class.backstab = '+7'
  const weapon = makeSimpleWeapon()

  let result
  try {
    result = await actor.rollToHit(weapon, { backstab: true })
  } finally {
    restore()
  }

  expect(result.libResult).toBeDefined()
  // `bonuses` aggregate in the lib result has a `class:backstab` entry
  // with value 7.
  const backstabEntry = result.libResult.bonuses?.find(b => b.id === 'class:backstab')
  expect(backstabEntry).toBeDefined()
  expect(backstabEntry.effect).toEqual({ type: 'modifier', value: 7 })
  expect(backstabEntry.source).toEqual({ type: 'class', id: 'thief' })
})

test('adapter path fires when options.showModifierDialog is set (session 13 / A6)', async () => {
  // A6: modifier-dialog case now routes via adapter with `damageTerms`
  // threaded into `DCCRoll.createRoll` so the dialog can modify both
  // attack and damage in one step. `modifiedDamageFormula` from the
  // dialog result flows through identically to legacy.
  logDispatch.mockClear()
  dccRollCreateRollMock.mockClear()
  const restore = withAutomate(true)
  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  const weapon = makeSimpleWeapon()

  try {
    await actor.rollToHit(weapon, { showModifierDialog: true })
  } finally {
    restore()
  }

  expect(assertDispatched('adapter')).toBe(true)
  expect(assertDispatched('legacy')).toBe(false)
  // Verify the adapter passed damageTerms through when the dialog is
  // requested (legacy parity — dialog needs damage terms to render the
  // damage-modification fields).
  const createRollCall = dccRollCreateRollMock.mock.calls.at(-1)
  expect(createRollCall).toBeDefined()
  const createRollOptions = createRollCall[2]
  expect(createRollOptions.showModifierDialog).toBe(true)
  expect(Array.isArray(createRollOptions.damageTerms)).toBe(true)
  expect(createRollOptions.damageTerms).toHaveLength(1)
  expect(createRollOptions.damageTerms[0].formula).toBe('1d8')
})

test('adapter path skips damageTerms when dialog shown but weapon has no damage', async () => {
  // Gate defensive: `rollOptions.damageTerms` should NOT be set if the
  // weapon lacks a damage formula — mirrors legacy branch at
  // `if (options.showModifierDialog && weapon.system?.damage)`.
  logDispatch.mockClear()
  dccRollCreateRollMock.mockClear()
  const restore = withAutomate(true)
  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  const weapon = makeSimpleWeapon({ damage: '' })

  try {
    await actor.rollToHit(weapon, { showModifierDialog: true })
  } finally {
    restore()
  }

  const createRollCall = dccRollCreateRollMock.mock.calls.at(-1)
  const createRollOptions = createRollCall[2]
  expect(createRollOptions.damageTerms).toBeUndefined()
})

test('adapter path fires for two-weapon primary weapons (session 11 / A4)', async () => {
  logDispatch.mockClear()
  const restore = withAutomate(true)
  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  // item.js:prepareBaseData would normally bake this — mirror the
  // post-prepare state here: action die bumped from d20 to d16,
  // tagged with the off-hand label.
  const weapon = makeSimpleWeapon({
    twoWeaponPrimary: true,
    actionDie: '1d16[2w-primary]'
  })

  try {
    await actor.rollToHit(weapon, {})
  } finally {
    restore()
  }

  expect(assertDispatched('adapter')).toBe(true)
  expect(assertDispatched('legacy')).toBe(false)
})

test('adapter path surfaces twoWeapon flags on libResult', async () => {
  logDispatch.mockClear()
  const restore = withAutomate(true)
  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  const weapon = makeSimpleWeapon({
    twoWeaponSecondary: true,
    actionDie: '1d14[2w-off-hand]'
  })

  let result
  try {
    result = await actor.rollToHit(weapon, {})
  } finally {
    restore()
  }

  expect(result.libResult).toBeDefined()
  // Lib die is the bumped die (the `[tag]` flavor stripped by
  // normalizeLibDie). DCC's two-weapon mechanic is a dice-chain
  // reduction — no flat penalty in the modifiers list.
  expect(result.libResult.die).toBe('d14')
  expect(result.libResult.isTwoWeaponSecondary).toBe(true)
  expect(result.libResult.isTwoWeaponPrimary).toBe(false)
  // Sanity: no `two-weapon fighting` source on the lib's modifier list.
  // (Pre-0.5.0 the lib had `AttackInput.twoWeaponPenalty` for a flat
  // -1/-2 ruleset we deliberately didn't use; 0.5.0 removed that field
  // and adopted DCC's dice-chain model natively.)
  const flatTwoWeaponMod = result.libResult.modifiers.find(m => m.source === 'two-weapon fighting')
  expect(flatTwoWeaponMod).toBeUndefined()
})

test('adapter path fires when actor + weapon both carry a deed-die formula (session 10)', async () => {
  logDispatch.mockClear()
  const restore = withAutomate(true)
  const restoreRoll = withDeedDiceRoll()
  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  // L1 warrior: +1d3 attack bonus (deed die). The weapon's toHit gets
  // built from this in real Foundry via prepareBaseData; the unit mock
  // requires us to set both.
  actor.system.details.attackBonus = '+1d3'
  const weapon = makeSimpleWeapon({ toHit: '+1d3+0' })

  try {
    await actor.rollToHit(weapon, {})
  } finally {
    restoreRoll()
    restore()
  }

  expect(assertDispatched('adapter')).toBe(true)
  expect(assertDispatched('legacy')).toBe(false)
})

test('adapter path throws when deedDie is set but Roll has no dice[1] (session 11 hardening)', async () => {
  logDispatch.mockClear()
  const restore = withAutomate(true)
  // Default mock: dccRollCreateRollMock returns a Roll with only one
  // dice term. With deedDie set on the lib input, the mismatch should
  // surface immediately rather than silently producing deedSucceed=false
  // every time.
  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  actor.system.details.attackBonus = '+1d3'
  const weapon = makeSimpleWeapon({ toHit: '+1d3+0' })

  let caught
  try {
    await actor.rollToHit(weapon, {})
  } catch (err) {
    caught = err
  } finally {
    restore()
  }

  expect(caught).toBeDefined()
  expect(String(caught?.message)).toMatch(/deed-die expected on attackRoll\.dice\[1\]/)
})

test('adapter path consumes exactly one natural for non-deed weapons (sequenced-roller contract)', async () => {
  // The sequenced roller throws on over-consumption rather than
  // silently feeding 0 (a future lib version that adds a third
  // internal roll would otherwise silently turn it into a fumble).
  // The closure is internal — this test exercises the simple-weapon
  // path end-to-end and asserts no throw fires when the lib's call
  // count matches the naturals length.
  logDispatch.mockClear()
  const restore = withAutomate(true)
  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  const weapon = makeSimpleWeapon()

  let result
  try {
    result = await actor.rollToHit(weapon, {})
  } finally {
    restore()
  }
  expect(result.libResult).toBeDefined()
})

test('adapter path fires when the actor attackBonus has dice that do not match the deed-die pattern (session 14 / A7)', async () => {
  // A7: multi-dice or mid-string dice patterns no longer fall to
  // legacy. Foundry's Roll evaluates the dice portion natively;
  // `buildAttackInput` takes the leading integer for the lib's flat
  // `attackBonus` and drops the trailing dice — consistent with
  // `hookTermsToBonuses`'s documented drop of dice-bearing hook
  // terms. `warnIfDivergent` surfaces the mismatch; chat total comes
  // from the Foundry Roll.
  logDispatch.mockClear()
  const restore = withAutomate(true)
  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  // Pathological / unsupported by the deed parser: two separate dice.
  actor.system.details.attackBonus = '+1d3+1d4'
  const weapon = makeSimpleWeapon()

  try {
    await actor.rollToHit(weapon, {})
  } finally {
    restore()
  }

  expect(assertDispatched('adapter')).toBe(true)
  expect(assertDispatched('legacy')).toBe(false)
})

test('adapter path fires when the weapon toHit has dice mid-string (session 14 / A7)', async () => {
  // A7: leading flat + trailing die (`+2+1d3`) is a legitimate
  // pattern from magical weapons that grant deed-die-style bonuses
  // on top of a base. Routes via adapter; the lib sees the flat
  // portion, Foundry handles the dice.
  logDispatch.mockClear()
  const restore = withAutomate(true)
  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  const weapon = makeSimpleWeapon({ toHit: '+2+1d3' })

  try {
    await actor.rollToHit(weapon, {})
  } finally {
    restore()
  }

  expect(assertDispatched('adapter')).toBe(true)
  expect(assertDispatched('legacy')).toBe(false)
})

test('buildAttackInput translates weapon + actor to the lib AttackInput shape', () => {
  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  const weapon = makeSimpleWeapon({ toHit: '+3', critRange: 19 })

  const input = buildAttackInput(actor, weapon)

  expect(input.attackType).toBe('melee')
  expect(input.actionDie).toBe('d20')
  expect(input.threatRange).toBe(19)
  expect(input.attackBonus).toBe(3)
  // Ability mod folded into attackBonus (weapon.toHit bakes it in)
  expect(input.abilityModifier).toBe(0)
})

test('buildAttackInput marks missile weapons correctly', () => {
  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  const weapon = makeSimpleWeapon({ melee: false, toHit: '-1' })

  const input = buildAttackInput(actor, weapon)

  expect(input.attackType).toBe('missile')
  expect(input.attackBonus).toBe(-1)
})

test('hookTermsToBonuses translates Modifier-kind terms with parseable formulas', () => {
  const bonuses = hookTermsToBonuses([
    { type: 'Modifier', label: 'Firing Into Melee', formula: '-1' },
    { type: 'Modifier', label: 'Medium Range', formula: '-2' },
    { type: 'Modifier', label: 'Whole Number', formula: 3 }
  ])

  expect(bonuses).toHaveLength(3)
  expect(bonuses[0].effect).toEqual({ type: 'modifier', value: -1 })
  expect(bonuses[0].category).toBe('circumstance')
  expect(bonuses[0].label).toBe('Firing Into Melee')
  expect(bonuses[1].effect.value).toBe(-2)
  expect(bonuses[2].effect.value).toBe(3)
})

test('hookTermsToBonuses skips non-Modifier terms and unparseable formulas', () => {
  const bonuses = hookTermsToBonuses([
    { type: 'Die', formula: '1d20' },
    { type: 'Compound', formula: '+2' },
    { type: 'Modifier', label: 'Dice Bump', formula: '1d3' },
    { type: 'Modifier', label: 'Empty', formula: '' }
  ])

  expect(bonuses).toEqual([])
})

test('hookTermsToBonuses handles empty / missing input safely', () => {
  expect(hookTermsToBonuses([])).toEqual([])
  expect(hookTermsToBonuses(null)).toEqual([])
  expect(hookTermsToBonuses(undefined)).toEqual([])
})

test('adapter path surfaces hook-injected Modifier terms via libResult.bonuses', async () => {
  logDispatch.mockClear()
  const originalCall = Hooks.call
  Hooks.call = (hook, terms) => {
    if (hook === 'dcc.modifyAttackRollTerms') {
      terms.push({ type: 'Modifier', label: 'QoL Penalty', formula: '-1' })
    }
    return true
  }
  const restore = withAutomate(true)

  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  const weapon = makeSimpleWeapon()

  let result
  try {
    result = await actor.rollToHit(weapon, {})
  } finally {
    restore()
    Hooks.call = originalCall
  }

  expect(result.libResult.bonuses).toHaveLength(1)
  expect(result.libResult.bonuses[0].label).toBe('QoL Penalty')
  expect(result.libResult.bonuses[0].effect.value).toBe(-1)
  // The lib aggregates the hook bonus into `totalBonus` alongside the
  // +2 toHit; assert on the single aggregated `bonuses` modifier the
  // lib emits so the translator's contribution is observable.
  const bonusAggregate = result.libResult.modifiers.find(m => m.source === 'bonuses')
  expect(bonusAggregate).toBeDefined()
  expect(bonusAggregate.value).toBe(-1)
})

test('adapter path leaves libResult.bonuses empty when no hook pushes terms', async () => {
  logDispatch.mockClear()
  const restore = withAutomate(true)
  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  const weapon = makeSimpleWeapon()

  let result
  try {
    result = await actor.rollToHit(weapon, {})
  } finally {
    restore()
  }

  expect(result.libResult.bonuses).toEqual([])
})

test('normalizeLibDie strips the leading count from Foundry-style die strings', () => {
  expect(normalizeLibDie('1d20')).toBe('d20')
  expect(normalizeLibDie('1d16')).toBe('d16')
  expect(normalizeLibDie('d24')).toBe('d24')
  expect(normalizeLibDie('')).toBe('d20')
  expect(normalizeLibDie(null)).toBe('d20')
})

test('adapter path reflects in-place dice-chain bump of terms[0].formula', async () => {
  logDispatch.mockClear()
  const originalCall = Hooks.call
  Hooks.call = (hook, terms) => {
    if (hook === 'dcc.modifyAttackRollTerms') {
      // Simulate dcc-qol long-range: rewrite the action die in place
      // (DiceChain.bumpDie('1d20') === '1d16').
      terms[0].formula = '1d16'
    }
    return true
  }
  const restore = withAutomate(true)

  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  const weapon = makeSimpleWeapon()

  let result
  try {
    result = await actor.rollToHit(weapon, {})
  } finally {
    restore()
    Hooks.call = originalCall
  }

  // Pre-fix: stuck on 'd20'. Post-fix: matches the bumped die.
  expect(result.libResult.die).toBe('d16')
})

test('adapter path keeps libResult.die on the original action die when the hook leaves terms[0] alone', async () => {
  logDispatch.mockClear()
  const originalCall = Hooks.call
  Hooks.call = (hook, terms) => {
    if (hook === 'dcc.modifyAttackRollTerms') {
      // Hook listener that only adds a flat penalty — does not touch
      // the action die. The post-hook re-read should be a no-op.
      terms.push({ type: 'Modifier', label: 'Cover', formula: '-1' })
    }
    return true
  }
  const restore = withAutomate(true)

  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  const weapon = makeSimpleWeapon()

  let result
  try {
    result = await actor.rollToHit(weapon, {})
  } finally {
    restore()
    Hooks.call = originalCall
  }

  expect(result.libResult.die).toBe('d20')
})

test('parseDeedAttackBonus matches deed-die formulas with optional count + multiple flat mods', () => {
  expect(parseDeedAttackBonus('+1d3+0')).toEqual({ deedDie: 'd3', attackBonus: 0 })
  expect(parseDeedAttackBonus('+1d3+2')).toEqual({ deedDie: 'd3', attackBonus: 2 })
  expect(parseDeedAttackBonus('+d4-1')).toEqual({ deedDie: 'd4', attackBonus: -1 })
  expect(parseDeedAttackBonus('1d3+2+1')).toEqual({ deedDie: 'd3', attackBonus: 3 })
  expect(parseDeedAttackBonus('+1d5')).toEqual({ deedDie: 'd5', attackBonus: 0 })
})

test('parseDeedAttackBonus rejects non-deed-die / mixed-dice / negative-die inputs', () => {
  expect(parseDeedAttackBonus('+3')).toBeNull()
  expect(parseDeedAttackBonus('+1d3+1d4')).toBeNull()
  expect(parseDeedAttackBonus('+2+1d3')).toBeNull()
  expect(parseDeedAttackBonus('-1d3')).toBeNull()
  expect(parseDeedAttackBonus('')).toBeNull()
  expect(parseDeedAttackBonus(null)).toBeNull()
  expect(parseDeedAttackBonus(undefined)).toBeNull()
})

test('buildAttackInput surfaces deedDie + flat attackBonus when toHit has a deed pattern', () => {
  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  const weapon = makeSimpleWeapon({ toHit: '+1d3+2' })

  const input = buildAttackInput(actor, weapon)

  expect(input.deedDie).toBe('d3')
  expect(input.attackBonus).toBe(2)
  expect(input.actionDie).toBe('d20')
})

test('buildAttackInput omits deedDie for plain numeric toHits', () => {
  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  const weapon = makeSimpleWeapon({ toHit: '+3' })

  const input = buildAttackInput(actor, weapon)

  expect('deedDie' in input).toBe(false)
  expect(input.attackBonus).toBe(3)
})
