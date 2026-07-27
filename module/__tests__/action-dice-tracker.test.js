/**
 * Unit tests for the pure / logic surface of module/action-dice-tracker.mjs
 * (Phase 2 combat-tracker pips). DOM injection (renderPipRow,
 * onRenderCombatTracker) is covered end-to-end against live Foundry in
 * browser-tests/e2e — the unit environment is Node with no jsdom.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { executeAsGM } from '../socket.mjs'

import {
  effectiveSpent,
  buildActionDicePips,
  shouldShowPips,
  getCombatantSlots,
  readActionDiceState,
  multipleActionDiceEnabled,
  trackInCombatEnabled,
  autoResetEnabled,
  resetActiveCombatantActionDice,
  toggleActionDiePip,
  spendCombatantActionDie,
  getCombatantForActor,
  slotRollFormula,
  planActionDie,
  spendPlannedActionDie,
  formatActionDiceChatLine,
  noEligibleActionDieWarning,
  twoWeaponRoleForWeapon,
  companionTwoWeaponRole,
  actionDicePresetsFromPlan,
  reconcilePlannedActionDie,
  settingEnabled,
  writeActionDiceHandler,
  WRITE_ACTION_DICE
} from '../action-dice-tracker.mjs'

// The tracker routes privileged combatant writes through the system socket; mock
// it so the routing decision (direct write vs GM round-trip) is observable.
vi.mock('../socket.mjs', () => ({
  executeAsGM: vi.fn(),
  registerSocketHandler: vi.fn()
}))

// A controllable game stub. settings is a Map keyed "module.key"; i18n echoes.
let settings
beforeEach(() => {
  executeAsGM.mockClear()
  settings = new Map()
  globalThis.game = {
    user: { isGM: true },
    settings: { get: (m, k) => settings.get(`${m}.${k}`) },
    i18n: { localize: (k) => k, format: (k, d) => `${k}:${d.slot}:${d.use}` }
  }
})
afterEach(() => { delete globalThis.game })

const set = (k, v) => settings.set(`dcc.${k}`, v)
const allOn = () => {
  set('multipleActionDice', true)
  set('trackActionDiceInCombat', true)
  set('autoResetActionDice', true)
  set('hideSingleActionDiePips', true)
}

const slots = (n, useByIndex = {}) =>
  Array.from({ length: n }, (_v, i) => ({ slot: i, die: i === 0 ? 'd20' : 'd16', modifier: 0, use: useByIndex[i] || 'any' }))

const combatantWith = (list, flagState) => ({
  actor: { system: { attributes: { actionDice: { list } } }, isOwner: true },
  getFlag: (scope, key) => (scope === 'dcc' && key === 'actionDice' ? flagState : undefined),
  setFlag: vi.fn(async () => {})
})

describe('gating', () => {
  test('multipleActionDiceEnabled reflects the master setting', () => {
    expect(multipleActionDiceEnabled()).toBe(false)
    set('multipleActionDice', true)
    expect(multipleActionDiceEnabled()).toBe(true)
  })

  test('trackInCombatEnabled ANDs master with the sub-option', () => {
    set('multipleActionDice', true)
    expect(trackInCombatEnabled()).toBe(false) // sub-option still off
    set('trackActionDiceInCombat', true)
    expect(trackInCombatEnabled()).toBe(true)
  })

  test('autoResetEnabled is false if the master is off even when the sub-option is on', () => {
    set('autoResetActionDice', true)
    expect(autoResetEnabled()).toBe(false)
    set('multipleActionDice', true)
    expect(autoResetEnabled()).toBe(true)
  })

  test('a throwing settings.get is treated as off', () => {
    globalThis.game.settings.get = () => { throw new Error('not registered') }
    expect(multipleActionDiceEnabled()).toBe(false)
  })

  test('settingEnabled is the shared defensive read for any settings source', () => {
    // Centralized helper (shared with the sheet context + actor prepare) so the
    // try/catch-defaulting-off semantics live in exactly one place.
    const src = { get: (m, k) => k === 'on' }
    expect(settingEnabled(src, 'on')).toBe(true)
    expect(settingEnabled(src, 'off')).toBe(false)
    expect(settingEnabled(undefined, 'on')).toBe(false)
    expect(settingEnabled({ get: () => { throw new Error('boom') } }, 'on')).toBe(false)
  })
})

describe('effectiveSpent', () => {
  test('returns the persisted spends for the current round', () => {
    expect(effectiveSpent({ round: 7, spent: [false, true] }, 7, 2)).toEqual([false, true])
  })

  test('treats a stale (wrong-round) state as all-unspent', () => {
    expect(effectiveSpent({ round: 6, spent: [true, true] }, 7, 2)).toEqual([false, false])
  })

  test('treats a missing state as all-unspent and pads to count', () => {
    expect(effectiveSpent(null, 7, 3)).toEqual([false, false, false])
  })
})

describe('buildActionDicePips', () => {
  test('maps slots to pips with label, restriction and spent flags', () => {
    const s = slots(2, { 1: 'spell' })
    const pips = buildActionDicePips(s, { round: 7, spent: [true, false] }, 7)
    expect(pips).toEqual([
      { index: 0, use: 'any', restricted: false, spent: true, label: '1d20' },
      { index: 1, use: 'spell', restricted: true, spent: false, label: '1d16' }
    ])
  })

  test('a stale state renders all pips ready', () => {
    const pips = buildActionDicePips(slots(2), { round: 1, spent: [true, true] }, 5)
    expect(pips.map(p => p.spent)).toEqual([false, false])
  })
})

describe('shouldShowPips', () => {
  test('false when tracking is off', () => {
    set('multipleActionDice', true) // master on but track off
    expect(shouldShowPips(combatantWith(slots(2)))).toBe(false)
  })

  test('false for zero-die actors', () => {
    allOn()
    expect(shouldShowPips(combatantWith(slots(0)))).toBe(false)
  })

  test('single-die actor hidden when the declutter option is on, shown when off', () => {
    allOn()
    expect(shouldShowPips(combatantWith(slots(1)))).toBe(false)
    set('hideSingleActionDiePips', false)
    expect(shouldShowPips(combatantWith(slots(1)))).toBe(true)
  })

  test('two-die actor always shown when tracking is on', () => {
    allOn()
    expect(shouldShowPips(combatantWith(slots(2)))).toBe(true)
  })
})

describe('accessors', () => {
  test('getCombatantSlots returns the derived list or []', () => {
    expect(getCombatantSlots(combatantWith(slots(2)))).toHaveLength(2)
    expect(getCombatantSlots({ actor: { system: {} } })).toEqual([])
    expect(getCombatantSlots(undefined)).toEqual([])
  })

  test('readActionDiceState reads the flag or null', () => {
    expect(readActionDiceState(combatantWith(slots(1), { round: 3, spent: [true] }))).toEqual({ round: 3, spent: [true] })
    expect(readActionDiceState(combatantWith(slots(1)))).toBeNull()
  })
})

describe('resetActiveCombatantActionDice', () => {
  const combatWith = (combatant, round) => ({ round, combatant })

  test('writes a fresh all-unspent state when the stored state is stale', async () => {
    allOn()
    const c = combatantWith(slots(2), { round: 6, spent: [true, true] })
    await resetActiveCombatantActionDice(combatWith(c, 7))
    expect(c.setFlag).toHaveBeenCalledWith('dcc', 'actionDice', { round: 7, spent: [false, false] })
  })

  test('no-op when the stored state is already current', async () => {
    allOn()
    const c = combatantWith(slots(2), { round: 7, spent: [false, true] })
    await resetActiveCombatantActionDice(combatWith(c, 7))
    expect(c.setFlag).not.toHaveBeenCalled()
  })

  test('no-op when auto-reset is off', async () => {
    set('multipleActionDice', true)
    set('autoResetActionDice', false)
    const c = combatantWith(slots(2), null)
    await resetActiveCombatantActionDice(combatWith(c, 7))
    expect(c.setFlag).not.toHaveBeenCalled()
  })

  test('no-op for a non-GM client', async () => {
    allOn()
    globalThis.game.user.isGM = false
    const c = combatantWith(slots(2), null)
    await resetActiveCombatantActionDice(combatWith(c, 7))
    expect(c.setFlag).not.toHaveBeenCalled()
  })

  test('no-op when the combatant has no action dice', async () => {
    allOn()
    const c = combatantWith(slots(0), null)
    await resetActiveCombatantActionDice(combatWith(c, 7))
    expect(c.setFlag).not.toHaveBeenCalled()
  })
})

describe('toggleActionDiePip', () => {
  test('flips a fresh-round pip and persists the current-round state', async () => {
    const c = combatantWith(slots(2), { round: 3, spent: [false, false] })
    await toggleActionDiePip(c, 1, 3)
    expect(c.setFlag).toHaveBeenCalledWith('dcc', 'actionDice', { round: 3, spent: [false, true] })
  })

  test('toggles back off when already spent', async () => {
    const c = combatantWith(slots(2), { round: 3, spent: [false, true] })
    await toggleActionDiePip(c, 1, 3)
    expect(c.setFlag).toHaveBeenCalledWith('dcc', 'actionDice', { round: 3, spent: [false, false] })
  })

  test('resets a stale state before toggling (new round starts all-ready)', async () => {
    const c = combatantWith(slots(2), { round: 1, spent: [true, true] })
    await toggleActionDiePip(c, 0, 5)
    expect(c.setFlag).toHaveBeenCalledWith('dcc', 'actionDice', { round: 5, spent: [true, false] })
  })

  test('out-of-range index is a no-op', async () => {
    const c = combatantWith(slots(2), { round: 3, spent: [false, false] })
    await toggleActionDiePip(c, 5, 3)
    expect(c.setFlag).not.toHaveBeenCalled()
  })
})

describe('spendCombatantActionDie', () => {
  test('marks the indexed slot spent on the current round', async () => {
    const c = combatantWith(slots(2), { round: 4, spent: [false, false] })
    await spendCombatantActionDie(c, 0, 4)
    expect(c.setFlag).toHaveBeenCalledWith('dcc', 'actionDice', { round: 4, spent: [true, false] })
  })

  test('resets a stale state, then spends', async () => {
    const c = combatantWith(slots(2), { round: 1, spent: [true, true] })
    await spendCombatantActionDie(c, 1, 9)
    expect(c.setFlag).toHaveBeenCalledWith('dcc', 'actionDice', { round: 9, spent: [false, true] })
  })

  test('a GM writes the flag directly (no socket round-trip)', async () => {
    const c = combatantWith(slots(2), { round: 4, spent: [false, false] }) // game.user.isGM = true
    await spendCombatantActionDie(c, 0, 4)
    expect(c.setFlag).toHaveBeenCalledWith('dcc', 'actionDice', { round: 4, spent: [true, false] })
    expect(executeAsGM).not.toHaveBeenCalled()
  })

  test('a non-GM non-owner routes the write to the active GM', async () => {
    globalThis.game.user.isGM = false
    const c = combatantWith(slots(2), { round: 4, spent: [false, false] })
    c.isOwner = false
    c.uuid = 'Combat.x.Combatant.y'
    await spendCombatantActionDie(c, 1, 4)
    expect(c.setFlag).not.toHaveBeenCalled()
    expect(executeAsGM).toHaveBeenCalledWith(WRITE_ACTION_DICE, {
      combatantUuid: 'Combat.x.Combatant.y',
      state: { round: 4, spent: [false, true] }
    })
  })
})

describe('writeActionDiceHandler (GM-side socket handler)', () => {
  const setupCombatant = (writeMock, owns) => ({
    actor: { testUserPermission: vi.fn(() => owns) },
    setFlag: writeMock
  })

  test('writes the requested state when the requester owns the actor', async () => {
    const setFlag = vi.fn(async () => {})
    const combatant = setupCombatant(setFlag, true)
    globalThis.fromUuid = vi.fn(async () => combatant)
    globalThis.game.users = { get: vi.fn(() => ({ id: 'p1' })) }

    await writeActionDiceHandler({ combatantUuid: 'c', state: { round: 3, spent: [true, false] } }, 'p1')
    expect(setFlag).toHaveBeenCalledWith('dcc', 'actionDice', { round: 3, spent: [true, false] })
    delete globalThis.fromUuid
  })

  test('rejects a requester who does not own the actor', async () => {
    const setFlag = vi.fn(async () => {})
    const combatant = setupCombatant(setFlag, false)
    globalThis.fromUuid = vi.fn(async () => combatant)
    globalThis.game.users = { get: vi.fn(() => ({ id: 'intruder' })) }

    await writeActionDiceHandler({ combatantUuid: 'c', state: { round: 3, spent: [true] } }, 'intruder')
    expect(setFlag).not.toHaveBeenCalled()
    delete globalThis.fromUuid
  })

  test('ignores a malformed state', async () => {
    const setFlag = vi.fn(async () => {})
    globalThis.fromUuid = vi.fn(async () => setupCombatant(setFlag, true))
    globalThis.game.users = { get: vi.fn(() => ({ id: 'p1' })) }

    await writeActionDiceHandler({ combatantUuid: 'c', state: { round: 'x' } }, 'p1')
    await writeActionDiceHandler({ combatantUuid: 'c' }, 'p1')
    expect(setFlag).not.toHaveBeenCalled()
    delete globalThis.fromUuid
  })

  // Fail-closed authorization: `userId` is a client claim, so a forged/omitted
  // id that doesn't resolve to a real user must be rejected (not allowed
  // through). Guards the bypass where `game.users.get` returns undefined.
  test('rejects a write when the requesting user cannot be resolved', async () => {
    const setFlag = vi.fn(async () => {})
    const combatant = setupCombatant(setFlag, true)
    globalThis.fromUuid = vi.fn(async () => combatant)
    globalThis.game.users = { get: vi.fn(() => undefined) }

    await writeActionDiceHandler({ combatantUuid: 'c', state: { round: 3, spent: [true] } }, 'ghost')
    expect(setFlag).not.toHaveBeenCalled()
    delete globalThis.fromUuid
  })

  // The payload is a client claim: only whitelisted keys are persisted, and
  // the two-weapon marker only in a well-formed (or explicit-null) shape.
  test('strips unknown keys and malformed two-weapon markers from the payload', async () => {
    const setFlag = vi.fn(async () => {})
    globalThis.fromUuid = vi.fn(async () => setupCombatant(setFlag, true))
    globalThis.game.users = { get: vi.fn(() => ({ id: 'p1' })) }

    await writeActionDiceHandler({
      combatantUuid: 'c',
      state: { round: 3, spent: [1, 0], evil: 'payload', twoWeaponPendingRole: 'bogus', twoWeaponPendingSlot: 'x' }
    }, 'p1')
    expect(setFlag).toHaveBeenCalledWith('dcc', 'actionDice', { round: 3, spent: [true, false] })
    delete globalThis.fromUuid
  })

  // #834 review: the requesting client decides whether a marker clear is
  // needed from ITS replica, which may be stale — the handler must re-check
  // the GM's own stored flag so a dropped marker still gets explicit nulls
  // (setFlag merges) instead of surviving as a free off-hand attack.
  test('clears a GM-side stored marker even when the payload omits it', async () => {
    const setFlag = vi.fn(async () => {})
    const combatant = {
      actor: { testUserPermission: vi.fn(() => true) },
      setFlag,
      getFlag: (scope, key) => (scope === 'dcc' && key === 'actionDice'
        ? { round: 3, spent: [true, false], twoWeaponPendingRole: 'secondary', twoWeaponPendingSlot: 0, twoWeaponPendingAction: 1 }
        : undefined)
    }
    globalThis.fromUuid = vi.fn(async () => combatant)
    globalThis.game.users = { get: vi.fn(() => ({ id: 'p1' })) }

    await writeActionDiceHandler({ combatantUuid: 'c', state: { round: 3, spent: [true, true] } }, 'p1')
    expect(setFlag).toHaveBeenCalledWith('dcc', 'actionDice', {
      round: 3,
      spent: [true, true],
      twoWeaponPendingRole: null,
      twoWeaponPendingSlot: null,
      twoWeaponPendingAction: null
    })
    delete globalThis.fromUuid
  })

  test('persists a well-formed two-weapon marker and an explicit null clear', async () => {
    const setFlag = vi.fn(async () => {})
    globalThis.fromUuid = vi.fn(async () => setupCombatant(setFlag, true))
    globalThis.game.users = { get: vi.fn(() => ({ id: 'p1' })) }

    await writeActionDiceHandler({
      combatantUuid: 'c',
      state: { round: 3, spent: [true, false], twoWeaponPendingRole: 'secondary', twoWeaponPendingSlot: 0, twoWeaponPendingAction: 1 }
    }, 'p1')
    expect(setFlag).toHaveBeenLastCalledWith('dcc', 'actionDice', {
      round: 3, spent: [true, false], twoWeaponPendingRole: 'secondary', twoWeaponPendingSlot: 0, twoWeaponPendingAction: 1
    })

    await writeActionDiceHandler({
      combatantUuid: 'c',
      state: { round: 3, spent: [true, false], twoWeaponPendingRole: null, twoWeaponPendingSlot: null, twoWeaponPendingAction: null }
    }, 'p1')
    expect(setFlag).toHaveBeenLastCalledWith('dcc', 'actionDice', {
      round: 3, spent: [true, false], twoWeaponPendingRole: null, twoWeaponPendingSlot: null, twoWeaponPendingAction: null
    })
    delete globalThis.fromUuid
  })

  // An actor-less combatant has no ownership to check, so it must be rejected
  // rather than written through.
  test('rejects a write for an actor-less combatant', async () => {
    const setFlag = vi.fn(async () => {})
    globalThis.fromUuid = vi.fn(async () => ({ actor: null, setFlag }))
    globalThis.game.users = { get: vi.fn(() => ({ id: 'p1' })) }

    await writeActionDiceHandler({ combatantUuid: 'c', state: { round: 3, spent: [true] } }, 'p1')
    expect(setFlag).not.toHaveBeenCalled()
    delete globalThis.fromUuid
  })
})

// --- Phase 3: roll-path auto-spend --------------------------------------

// A combatant whose actor carries an id (planActionDie matches by actor id).
const makeCombatant = (list, flagState, actorId = 'a1') => ({
  actor: { id: actorId, system: { attributes: { actionDice: { list } } }, isOwner: true },
  getFlag: (scope, key) => (scope === 'dcc' && key === 'actionDice' ? flagState : undefined),
  setFlag: vi.fn(async () => {})
})
const setCombat = (combatant, round = 1) => {
  globalThis.game.combat = { round, combatants: [combatant] }
}

describe('getCombatantForActor', () => {
  test('finds the combatant by actor id', () => {
    const c = makeCombatant(slots(2), null, 'hero')
    setCombat(c)
    expect(getCombatantForActor({ id: 'hero' })).toBe(c)
  })

  test('null when no combat, no actor, or no match', () => {
    expect(getCombatantForActor({ id: 'hero' })).toBeNull() // no game.combat
    setCombat(makeCombatant(slots(2), null, 'hero'))
    expect(getCombatantForActor(null)).toBeNull()
    expect(getCombatantForActor({ id: 'other' })).toBeNull()
  })
})

describe('slotRollFormula', () => {
  test('prefixes the bare die with a count of 1', () => {
    expect(slotRollFormula({ die: 'd14' })).toBe('1d14')
    expect(slotRollFormula({ die: 'd16', modifier: 0 })).toBe('1d16')
    expect(slotRollFormula(undefined)).toBe('')
  })

  test('appends a non-zero per-die rider (D2 1d20+4)', () => {
    expect(slotRollFormula({ die: 'd20', modifier: 4 })).toBe('1d20+4')
    expect(slotRollFormula({ die: 'd16', modifier: -1 })).toBe('1d16-1')
  })

  // D2 (§10): the `1d20+4, 1d20, 1d16` line keeps its rider on slot 0 only, so
  // the +4 is shown once (on the first action, matching the die the incumbent
  // path rolls from `attributes.actionDice.value`) and never leaks onto the
  // extra dice — the guard against double-counting the attack bonus.
  test('a 1d20+4 line rides the +4 on slot 0 and leaves the extras bare', () => {
    const list = [
      { slot: 0, die: 'd20', modifier: 4, use: 'any' },
      { slot: 1, die: 'd20', modifier: 0, use: 'any' },
      { slot: 2, die: 'd16', modifier: 0, use: 'any' }
    ]
    expect(list.map(slotRollFormula)).toEqual(['1d20+4', '1d20', '1d16'])
  })
})

describe('planActionDie', () => {
  test('null on the off-path (master setting off)', () => {
    setCombat(makeCombatant(slots(2), null, 'hero'))
    expect(planActionDie({ id: 'hero' }, 'attack')).toBeNull()
  })

  test('null when the actor is not in combat', () => {
    set('multipleActionDice', true)
    expect(planActionDie({ id: 'hero' }, 'attack')).toBeNull()
  })

  test('null when the combatant has no action-die budget', () => {
    set('multipleActionDice', true)
    setCombat(makeCombatant(slots(0), null, 'hero'))
    expect(planActionDie({ id: 'hero' }, 'attack')).toBeNull()
  })

  test('picks the first slot on a fresh round and counts zero spent', () => {
    set('multipleActionDice', true)
    setCombat(makeCombatant(slots(2), null, 'hero'), 5)
    const plan = planActionDie({ id: 'hero' }, 'attack')
    expect(plan.choice.index).toBe(0)
    expect(plan).toMatchObject({ round: 5, count: 2, spentCount: 0 })
  })

  test('picks the next unspent slot from the stored current-round state', () => {
    set('multipleActionDice', true)
    setCombat(makeCombatant(slots(2), { round: 5, spent: [true, false] }, 'hero'), 5)
    const plan = planActionDie({ id: 'hero' }, 'attack')
    expect(plan.choice.index).toBe(1)
    expect(plan.spentCount).toBe(1)
  })

  test('treats a stale stored state as a fresh round', () => {
    set('multipleActionDice', true)
    setCombat(makeCombatant(slots(2), { round: 1, spent: [true, true] }, 'hero'), 9)
    const plan = planActionDie({ id: 'hero' }, 'attack')
    expect(plan.choice.index).toBe(0)
    expect(plan.spentCount).toBe(0)
  })

  test('over budget — both dice spent — yields a null choice', () => {
    set('multipleActionDice', true)
    setCombat(makeCombatant(slots(2), { round: 5, spent: [true, true] }, 'hero'), 5)
    const plan = planActionDie({ id: 'hero' }, 'attack')
    expect(plan.choice).toBeNull()
    expect(plan.spentCount).toBe(2)
  })

  test('a spells-only extra die is ineligible for an attack', () => {
    set('multipleActionDice', true)
    setCombat(makeCombatant(slots(2, { 1: 'spell' }), { round: 5, spent: [true, false] }, 'hero'), 5)
    const plan = planActionDie({ id: 'hero' }, 'attack')
    expect(plan.choice).toBeNull() // only the spells-only die is left
    // …and the soft filter records the unspent-but-restricted die (D1).
    expect(plan.restrictedUnspentDice).toEqual(['1d16'])
  })

  test('over budget (all spent) records no restricted dice', () => {
    set('multipleActionDice', true)
    setCombat(makeCombatant(slots(2, { 1: 'spell' }), { round: 5, spent: [true, true] }, 'hero'), 5)
    const plan = planActionDie({ id: 'hero' }, 'attack')
    expect(plan.choice).toBeNull()
    expect(plan.restrictedUnspentDice).toEqual([]) // nothing left at all ⇒ over budget, not "no eligible die"
  })

  test("a 'check' action spends the next unrestricted die (skill-check path)", () => {
    set('multipleActionDice', true)
    setCombat(makeCombatant(slots(2), { round: 5, spent: [true, false] }, 'hero'), 5)
    const plan = planActionDie({ id: 'hero' }, 'check')
    expect(plan.choice.index).toBe(1)
    expect(plan.choice.slot.die).toBe('d16')
  })

  test("a spells-only extra die is ineligible for a 'check'", () => {
    set('multipleActionDice', true)
    setCombat(makeCombatant(slots(2, { 1: 'spell' }), { round: 5, spent: [true, false] }, 'hero'), 5)
    const plan = planActionDie({ id: 'hero' }, 'check')
    expect(plan.choice).toBeNull() // spells-only die can't take a skill check
  })
})

describe('spendPlannedActionDie', () => {
  test('null plan returns null and writes nothing', async () => {
    expect(await spendPlannedActionDie(null)).toBeNull()
  })

  test('spends the chosen slot and describes the action', async () => {
    const c = makeCombatant(slots(2), { round: 5, spent: [true, false] }, 'hero')
    setCombat(c, 5)
    set('multipleActionDice', true)
    const plan = planActionDie({ id: 'hero' }, 'attack')
    const descriptor = await spendPlannedActionDie(plan)
    expect(c.setFlag).toHaveBeenCalledWith('dcc', 'actionDice', { round: 5, spent: [true, true] })
    expect(descriptor).toEqual({ actionNumber: 2, count: 2, overBudget: false, noEligibleDie: false, die: '1d16' })
  })

  test('over budget writes nothing and flags the descriptor', async () => {
    const c = makeCombatant(slots(2), { round: 5, spent: [true, true] }, 'hero')
    setCombat(c, 5)
    set('multipleActionDice', true)
    const plan = planActionDie({ id: 'hero' }, 'attack')
    const descriptor = await spendPlannedActionDie(plan)
    expect(c.setFlag).not.toHaveBeenCalled()
    expect(descriptor).toEqual({ actionNumber: 3, count: 2, overBudget: true, noEligibleDie: false, die: '' })
  })

  test('no eligible die (spells-only left) flags noEligibleDie, not plain over budget', async () => {
    const c = makeCombatant(slots(2, { 1: 'spell' }), { round: 5, spent: [true, false] }, 'hero')
    setCombat(c, 5)
    set('multipleActionDice', true)
    const plan = planActionDie({ id: 'hero' }, 'attack')
    const descriptor = await spendPlannedActionDie(plan)
    expect(c.setFlag).not.toHaveBeenCalled() // nothing spent — no eligible die
    expect(descriptor).toEqual({ actionNumber: 2, count: 2, overBudget: true, noEligibleDie: true, die: '' })
  })
})

// Two-weapon fighting (#834): a primary + off-hand pair is ONE action, so the
// pair consumes one die. The first half spends and marks the companion role
// pending on the state; the matching companion attack is free and consumes the
// marker. Unrelated spends and manual toggles must not eat the marker.
describe('two-weapon fighting pairing', () => {
  beforeEach(() => set('multipleActionDice', true))

  test('twoWeaponRoleForWeapon maps the weapon flags (primary wins a misconfigured both)', () => {
    expect(twoWeaponRoleForWeapon({ system: { twoWeaponPrimary: true } })).toBe('primary')
    expect(twoWeaponRoleForWeapon({ system: { twoWeaponSecondary: true } })).toBe('secondary')
    expect(twoWeaponRoleForWeapon({ system: { twoWeaponPrimary: true, twoWeaponSecondary: true } })).toBe('primary')
    expect(twoWeaponRoleForWeapon({ system: {} })).toBeNull()
    expect(twoWeaponRoleForWeapon(undefined)).toBeNull()
  })

  test('companionTwoWeaponRole is the other hand', () => {
    expect(companionTwoWeaponRole('primary')).toBe('secondary')
    expect(companionTwoWeaponRole('secondary')).toBe('primary')
    expect(companionTwoWeaponRole(null)).toBeNull()
  })

  test('the first half spends a die and marks the companion pending', async () => {
    const c = makeCombatant(slots(2), null, 'hero')
    setCombat(c, 3)
    const plan = planActionDie({ id: 'hero' }, 'attack', { twoWeaponRole: 'primary' })
    expect(plan.twoWeaponCompanion).toBe(false)
    expect(plan.choice.index).toBe(0)
    const descriptor = await spendPlannedActionDie(plan)
    expect(c.setFlag).toHaveBeenCalledWith('dcc', 'actionDice', {
      round: 3,
      spent: [true, false],
      twoWeaponPendingRole: 'secondary',
      twoWeaponPendingSlot: 0,
      twoWeaponPendingAction: 1
    })
    // The first half's chat descriptor is a normal spend.
    expect(descriptor).toEqual({ actionNumber: 1, count: 2, overBudget: false, noEligibleDie: false, die: '1d20' })
  })

  test('the companion half is free: same slot, marker consumed, nothing else spent', async () => {
    const c = makeCombatant(slots(2), {
      round: 3, spent: [true, false], twoWeaponPendingRole: 'secondary', twoWeaponPendingSlot: 0, twoWeaponPendingAction: 1
    }, 'hero')
    setCombat(c, 3)
    const plan = planActionDie({ id: 'hero' }, 'attack', { twoWeaponRole: 'secondary' })
    expect(plan.twoWeaponCompanion).toBe(true)
    expect(plan.choice.index).toBe(0) // the pair's slot, not the next unspent
    const descriptor = await spendPlannedActionDie(plan)
    // Marker cleared with explicit nulls (setFlag merges — omitted keys would
    // survive), spends untouched.
    expect(c.setFlag).toHaveBeenCalledWith('dcc', 'actionDice', {
      round: 3,
      spent: [true, false],
      twoWeaponPendingRole: null,
      twoWeaponPendingSlot: null,
      twoWeaponPendingAction: null
    })
    expect(descriptor).toEqual({ actionNumber: 1, count: 2, overBudget: false, noEligibleDie: false, twoWeapon: true, die: '1d20' })
  })

  test('off-hand-first also forms a pair (pending role is primary)', async () => {
    const c = makeCombatant(slots(2), null, 'hero')
    setCombat(c, 3)
    const plan = planActionDie({ id: 'hero' }, 'attack', { twoWeaponRole: 'secondary' })
    await spendPlannedActionDie(plan)
    expect(c.setFlag).toHaveBeenCalledWith('dcc', 'actionDice', expect.objectContaining({
      spent: [true, false],
      twoWeaponPendingRole: 'primary'
    }))
  })

  test('an unrelated spend between the two swings preserves the marker', async () => {
    const c = makeCombatant(slots(2), {
      round: 3, spent: [true, false], twoWeaponPendingRole: 'secondary', twoWeaponPendingSlot: 0, twoWeaponPendingAction: 1
    }, 'hero')
    setCombat(c, 3)
    const plan = planActionDie({ id: 'hero' }, 'check')
    expect(plan.choice.index).toBe(1)
    await spendPlannedActionDie(plan)
    expect(c.setFlag).toHaveBeenCalledWith('dcc', 'actionDice', {
      round: 3,
      spent: [true, true],
      twoWeaponPendingRole: 'secondary',
      twoWeaponPendingSlot: 0,
      twoWeaponPendingAction: 1
    })
  })

  test('the companion keeps the pair\'s action number across an interleaved spend', async () => {
    // Pair opened on slot 0 (action 1), then a check spent slot 1 (action 2).
    const c = makeCombatant(slots(2), {
      round: 3, spent: [true, true], twoWeaponPendingRole: 'secondary', twoWeaponPendingSlot: 0, twoWeaponPendingAction: 1
    }, 'hero')
    setCombat(c, 3)
    const plan = planActionDie({ id: 'hero' }, 'attack', { twoWeaponRole: 'secondary' })
    const descriptor = await spendPlannedActionDie(plan)
    expect(descriptor).toEqual({ actionNumber: 1, count: 2, overBudget: false, noEligibleDie: false, twoWeapon: true, die: '1d20' })
  })

  test('the same hand twice opens a second pair on the next die', async () => {
    const c = makeCombatant(slots(2), {
      round: 3, spent: [true, false], twoWeaponPendingRole: 'secondary', twoWeaponPendingSlot: 0, twoWeaponPendingAction: 1
    }, 'hero')
    setCombat(c, 3)
    // Primary again: the pending marker is for the OTHER hand, so this is a
    // new action — spend slot 1 and re-mark the off-hand as pending there.
    const plan = planActionDie({ id: 'hero' }, 'attack', { twoWeaponRole: 'primary' })
    expect(plan.twoWeaponCompanion).toBe(false)
    expect(plan.choice.index).toBe(1)
    await spendPlannedActionDie(plan)
    expect(c.setFlag).toHaveBeenCalledWith('dcc', 'actionDice', {
      round: 3,
      spent: [true, true],
      twoWeaponPendingRole: 'secondary',
      twoWeaponPendingSlot: 1,
      twoWeaponPendingAction: 2
    })
  })

  test('after a completed pair the next attack spends the second die normally', async () => {
    const c = makeCombatant(slots(2), { round: 3, spent: [true, false] }, 'hero')
    setCombat(c, 3)
    const plan = planActionDie({ id: 'hero' }, 'attack', { twoWeaponRole: 'primary' })
    expect(plan.twoWeaponCompanion).toBe(false)
    expect(plan.choice.index).toBe(1)
    const descriptor = await spendPlannedActionDie(plan)
    expect(descriptor).toEqual({ actionNumber: 2, count: 2, overBudget: false, noEligibleDie: false, die: '1d16' })
  })

  test('a stale (previous-round) marker does not grant a free attack', () => {
    const c = makeCombatant(slots(2), {
      round: 2, spent: [true, false], twoWeaponPendingRole: 'secondary', twoWeaponPendingSlot: 0, twoWeaponPendingAction: 1
    }, 'hero')
    setCombat(c, 3) // new round — stored state is stale
    const plan = planActionDie({ id: 'hero' }, 'attack', { twoWeaponRole: 'secondary' })
    expect(plan.twoWeaponCompanion).toBe(false)
    expect(plan.choice.index).toBe(0)
  })

  test('the round auto-reset clears an old marker with explicit nulls (setFlag merges)', async () => {
    allOn()
    const c = combatantWith(slots(2), {
      round: 6, spent: [true, true], twoWeaponPendingRole: 'secondary', twoWeaponPendingSlot: 0, twoWeaponPendingAction: 1
    })
    await resetActiveCombatantActionDice({ round: 7, combatant: c })
    expect(c.setFlag).toHaveBeenCalledWith('dcc', 'actionDice', {
      round: 7,
      spent: [false, false],
      twoWeaponPendingRole: null,
      twoWeaponPendingSlot: null,
      twoWeaponPendingAction: null
    })
  })

  test('a manual pip toggle preserves the pending marker', async () => {
    const c = combatantWith(slots(2), {
      round: 3, spent: [true, false], twoWeaponPendingRole: 'secondary', twoWeaponPendingSlot: 0, twoWeaponPendingAction: 1
    })
    await toggleActionDiePip(c, 1, 3)
    expect(c.setFlag).toHaveBeenCalledWith('dcc', 'actionDice', {
      round: 3,
      spent: [true, true],
      twoWeaponPendingRole: 'secondary',
      twoWeaponPendingSlot: 0,
      twoWeaponPendingAction: 1
    })
  })

  test('a non-attack action never plans as a companion even with a matching marker', () => {
    const c = makeCombatant(slots(2), {
      round: 3, spent: [true, false], twoWeaponPendingRole: 'secondary', twoWeaponPendingSlot: 0, twoWeaponPendingAction: 1
    }, 'hero')
    setCombat(c, 3)
    const plan = planActionDie({ id: 'hero' }, 'check', { twoWeaponRole: 'secondary' })
    expect(plan.twoWeaponCompanion).toBe(false)
    expect(plan.twoWeaponRole).toBeNull() // roles only apply to attacks
  })
})

describe('formatActionDiceChatLine', () => {
  beforeEach(() => {
    globalThis.game.i18n.format = (k, d) => `${k}|${JSON.stringify(d)}`
  })

  test('empty string for no descriptor (off-path)', () => {
    expect(formatActionDiceChatLine(null)).toBe('')
  })

  test('normal line carries n, m and die', () => {
    expect(formatActionDiceChatLine({ actionNumber: 1, count: 2, overBudget: false, die: '1d20' }))
      .toBe('DCC.ActionDiceChatLine|{"n":1,"m":2,"die":"1d20"}')
  })

  test('over-budget line uses the over-budget key', () => {
    expect(formatActionDiceChatLine({ actionNumber: 3, count: 2, overBudget: true, die: '' }))
      .toBe('DCC.ActionDiceChatLineOverBudget|{"n":3,"m":2}')
  })

  test('no-eligible-die line uses its own key, not over-budget', () => {
    expect(formatActionDiceChatLine({ actionNumber: 2, count: 2, overBudget: true, noEligibleDie: true, die: '' }))
      .toBe('DCC.ActionDiceChatLineNoEligibleDie|{"n":2,"m":2}')
  })

  test('the free two-weapon companion uses the two-weapon key', () => {
    expect(formatActionDiceChatLine({ actionNumber: 1, count: 2, overBudget: false, noEligibleDie: false, twoWeapon: true, die: '1d20' }))
      .toBe('DCC.ActionDiceChatLineTwoWeapon|{"n":1,"m":2,"die":"1d20"}')
  })
})

describe('noEligibleActionDieWarning', () => {
  test('null when there is an eligible die, no plan, or nothing restricted left', () => {
    expect(noEligibleActionDieWarning(null, 'attack')).toBeNull()
    expect(noEligibleActionDieWarning({ choice: { index: 0 }, restrictedUnspentDice: ['1d16'] }, 'attack')).toBeNull()
    expect(noEligibleActionDieWarning({ choice: null, restrictedUnspentDice: [] }, 'attack')).toBeNull()
  })

  test('formats the warning naming the action and the restricted dice', () => {
    globalThis.game.i18n.format = (k, d) => `${k}|${d.action}|${d.dice}`
    const warning = noEligibleActionDieWarning({ choice: null, restrictedUnspentDice: ['1d16'] }, 'attack')
    // action label localizes via DCC.Attack (echoed by the localize stub)
    expect(warning).toBe('DCC.ActionDiceNoEligibleWarning|DCC.Attack|1d16')
  })
})

// --- Issue #834 §3: choosing which action die a roll uses ----------------

// The dialog presets and the post-roll reconcile both derive per-slot
// formulas with the two-weapon penalty applied, so the penalty tests need
// the dice chain on CONFIG.
const withDiceChain = () => {
  globalThis.CONFIG = { DCC: { DICE_CHAIN: [3, 4, 5, 6, 7, 8, 10, 12, 14, 16, 20, 24, 30] } }
}

describe('actionDicePresetsFromPlan', () => {
  beforeEach(() => {
    allOn()
    globalThis.game.i18n.format = (k, d) => `${k}|${JSON.stringify(d)}`
  })
  afterEach(() => { delete globalThis.CONFIG })

  test('null for a null plan or a single-die actor', () => {
    expect(actionDicePresetsFromPlan(null)).toBeNull()
    const c = makeCombatant(slots(1), null, 'hero')
    expect(actionDicePresetsFromPlan({ combatant: c, round: 1 })).toBeNull()
  })

  test('one preset per UNSPENT slot, labeled with its slot number', () => {
    // Slot 0 is spent: it is not offered — the reconcile refuses to land a
    // spend on a spent slot, so a spent preset would roll that die while
    // silently burning the planned slot (#834 review).
    const c = makeCombatant(slots(2), { round: 3, spent: [true, false] }, 'hero')
    const presets = actionDicePresetsFromPlan({ combatant: c, round: 3 })
    expect(presets).toEqual([
      { formula: '1d16', label: 'DCC.ActionDiePresetReady|{"die":"1d16","n":2}' }
    ])
  })

  test('a stale round reads all-ready (every slot offered)', () => {
    const c = makeCombatant(slots(2), { round: 1, spent: [true, true] }, 'hero')
    const presets = actionDicePresetsFromPlan({ combatant: c, round: 2 })
    expect(presets).toHaveLength(2)
    expect(presets.every(p => p.label.startsWith('DCC.ActionDiePresetReady'))).toBe(true)
  })

  test('slots ineligible for the action are dropped (spells-only die, attack)', () => {
    const c = makeCombatant(slots(2, { 1: 'spell' }), null, 'hero')
    const presets = actionDicePresetsFromPlan({ combatant: c, round: 1 })
    expect(presets.map(p => p.formula)).toEqual(['1d20'])
  })

  test('the two-weapon penalty lands on every preset formula', () => {
    withDiceChain()
    const c = makeCombatant(slots(2), null, 'hero')
    const presets = actionDicePresetsFromPlan({ combatant: c, round: 1 }, { twoWeaponPenalty: -1 })
    expect(presets.map(p => p.formula)).toEqual(['1d16', '1d14'])
  })
})

describe('reconcilePlannedActionDie', () => {
  beforeEach(() => { allOn() })
  afterEach(() => { delete globalThis.CONFIG })

  // A live plan for the combatant's next-unspent slot, as planActionDie
  // would produce it (both slots unspent ⇒ slot 0).
  const planFor = (c, round = 1, index = 0) => ({
    combatant: c,
    round,
    choice: { slot: c.actor.system.attributes.actionDice.list[index], index },
    count: c.actor.system.attributes.actionDice.list.length,
    spentCount: 0,
    restrictedUnspentDice: [],
    twoWeaponRole: null,
    twoWeaponCompanion: false
  })

  test('keeps the plan when the rolled die matches the planned slot', () => {
    const c = makeCombatant(slots(2), null, 'hero')
    const plan = planFor(c)
    expect(reconcilePlannedActionDie(plan, 20)).toBe(plan)
  })

  test('re-points the spend at the unspent slot whose die was rolled', () => {
    const c = makeCombatant(slots(2), null, 'hero')
    const plan = planFor(c)
    const reconciled = reconcilePlannedActionDie(plan, 16)
    expect(reconciled.choice.index).toBe(1)
    expect(reconciled.choice.slot.die).toBe('d16')
  })

  test('never re-points at a spent or ineligible slot', () => {
    // slot 1 (d16) already spent ⇒ the auto-pick stands
    const spent = makeCombatant(slots(2), { round: 1, spent: [false, true] }, 'hero')
    expect(reconcilePlannedActionDie(planFor(spent), 16).choice.index).toBe(0)
    // slot 1 restricted to spells ⇒ an attack cannot land on it
    const restricted = makeCombatant(slots(2, { 1: 'spell' }), null, 'hero')
    expect(reconcilePlannedActionDie(planFor(restricted), 16).choice.index).toBe(0)
  })

  test('an unmatched die (untrained 1d10, hand-edit) keeps the auto-pick', () => {
    const c = makeCombatant(slots(2), null, 'hero')
    const plan = planFor(c)
    expect(reconcilePlannedActionDie(plan, 10)).toBe(plan)
  })

  test('the free two-weapon companion is never re-pointed', () => {
    const c = makeCombatant(slots(2), null, 'hero')
    const plan = { ...planFor(c), twoWeaponCompanion: true }
    expect(reconcilePlannedActionDie(plan, 16)).toBe(plan)
  })

  test('matches against the penalized die when two-weapon fighting', () => {
    withDiceChain()
    // Slots d20/d16 at penalty -1 roll as 1d16/1d14: a rolled d14 is the
    // second slot, and a rolled d16 is the (already planned) first.
    const c = makeCombatant(slots(2), null, 'hero')
    expect(reconcilePlannedActionDie(planFor(c), 14, { twoWeaponPenalty: -1 }).choice.index).toBe(1)
    const plan = planFor(c)
    expect(reconcilePlannedActionDie(plan, 16, { twoWeaponPenalty: -1 })).toBe(plan)
  })

  test('null/off-path plans pass through untouched', () => {
    expect(reconcilePlannedActionDie(null, 16)).toBeNull()
    const overBudget = { combatant: makeCombatant(slots(2), null, 'hero'), round: 1, choice: null }
    expect(reconcilePlannedActionDie(overBudget, 16)).toBe(overBudget)
  })

  // #834 review (High): a roll on the roll's DEFAULT die is not evidence of
  // a player choice, even when its faces coincide with another slot — e.g.
  // an untrained weapon's bumped d14 on a `1d20,1d14` warrior must spend
  // slot 0, not re-point to the d14 slot.
  test('a roll matching the default die never re-points', () => {
    const c = makeCombatant(
      [{ slot: 0, die: 'd20', modifier: 0, use: 'any' }, { slot: 1, die: 'd14', modifier: 0, use: 'any' }],
      null, 'hero')
    const plan = planFor(c)
    expect(reconcilePlannedActionDie(plan, 14, { defaultFaces: 14 })).toBe(plan)
    // A deviation from the default still re-points as before.
    expect(reconcilePlannedActionDie(plan, 14, { defaultFaces: 20 }).choice.index).toBe(1)
  })
})

describe('spendPlannedActionDie round guard (#834 review)', () => {
  beforeEach(() => { allOn() })

  test('a plan from a bygone round is not written over the live state', async () => {
    const c = makeCombatant(slots(2), { round: 6, spent: [false, false] }, 'hero')
    setCombat(c, 6) // the combat has moved on to round 6...
    const plan = {
      combatant: c,
      round: 5, // ...but the plan was made in round 5 (dialog left open)
      choice: { slot: c.actor.system.attributes.actionDice.list[0], index: 0 },
      count: 2,
      spentCount: 0,
      restrictedUnspentDice: [],
      twoWeaponRole: null,
      twoWeaponCompanion: false
    }
    const descriptor = await spendPlannedActionDie(plan)
    expect(c.setFlag).not.toHaveBeenCalled()
    expect(descriptor).toEqual({ actionNumber: 1, count: 2, overBudget: false, noEligibleDie: false, die: '1d20' })
  })

  test('a current-round plan still writes normally', async () => {
    const c = makeCombatant(slots(2), null, 'hero')
    setCombat(c, 5)
    const plan = planActionDie(c.actor, 'attack')
    await spendPlannedActionDie(plan)
    expect(c.setFlag).toHaveBeenCalledWith('dcc', 'actionDice', { round: 5, spent: [true, false] })
  })
})
