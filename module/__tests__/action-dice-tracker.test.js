/**
 * Unit tests for the pure / logic surface of module/action-dice-tracker.mjs
 * (Phase 2 combat-tracker pips). DOM injection (renderPipRow,
 * onRenderCombatTracker) is covered end-to-end against live Foundry in
 * browser-tests/e2e — the unit environment is Node with no jsdom.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
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
  spendCombatantActionDie
} from '../action-dice-tracker.mjs'

// A controllable game stub. settings is a Map keyed "module.key"; i18n echoes.
let settings
beforeEach(() => {
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
})
