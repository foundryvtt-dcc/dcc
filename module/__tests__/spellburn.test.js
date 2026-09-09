/* global foundry, game, ui */
/**
 * Tests for the shared spellburn helper (module/spellburn.mjs).
 *
 * Issue #923: spellburn used to be built and applied in three independent
 * places (the item cast path, the adapter's roll dialog + apply sites, and
 * dependent modules like XCC). Every one of them re-derived the term, the
 * burn -> post-burn-score conversion, and the `logSpellburn` call, which is
 * how #921 shipped complete on one path and entirely absent from another.
 * This module is the single owner; these tests pin its contract so the
 * call sites can be thin.
 *
 * Mocks for Foundry Classes/Functions are found in __mocks__/foundry.js
 **/

import { beforeEach, describe, expect, test, vi } from 'vitest'
import '../__mocks__/foundry.js'
import { logSpellburn } from '../ability-score-log.js'
import {
  applySpellburn,
  buildSpellburnTerm,
  scoresFromBurnAmounts,
  spellburnDescriptor,
  spellburnTermFromDescriptor
} from '../spellburn.mjs'

// The apply mechanics (actor.update shape, log entries, ΔHP) are covered in
// ability-score-log.test.js; here we only care that the helper hands the
// right arguments to it and copes when it rejects.
vi.mock('../ability-score-log.js', () => ({
  logSpellburn: vi.fn()
}))

/** A minimal caster: Str 14 / Agl 12 / Sta 13, level 4. */
function makeActor (overrides = {}) {
  return foundry.utils.mergeObject({
    name: 'Test Wizard',
    system: {
      abilities: {
        str: { value: 14 },
        agl: { value: 12 },
        sta: { value: 13 }
      },
      details: { level: { value: 4 } }
    }
  }, overrides, { inplace: false })
}

beforeEach(() => {
  vi.clearAllMocks()
  logSpellburn.mockResolvedValue(undefined)
})

describe('spellburnDescriptor', () => {
  test('reads the three physical abilities and the caster level off the actor', () => {
    expect(spellburnDescriptor(makeActor())).toEqual({
      str: 14, agl: 12, sta: 13, level: 4
    })
  })

  test('a caster with no level recorded still reports a numeric level', () => {
    // 0 is a number, so the dialog still offers the hit point row; only an
    // ABSENT level suppresses it (see DCCSpellburnTerm's isNaN gate).
    const actor = makeActor()
    delete actor.system.details
    expect(spellburnDescriptor(actor).level).toBe(0)
  })

  test('string ability scores are coerced to numbers', () => {
    const actor = makeActor({ system: { abilities: { str: { value: '9' } } } })
    expect(spellburnDescriptor(actor).str).toBe(9)
  })
})

describe('scoresFromBurnAmounts', () => {
  test('converts burn AMOUNTS to post-burn SCORES', () => {
    expect(scoresFromBurnAmounts(makeActor(), { str: 3, agl: 0, sta: 2 }))
      .toEqual({ str: 11, agl: 12, sta: 11 })
  })

  test('an unburned ability keeps its current value', () => {
    // A no-change value is a no-op on the write side and produces no log
    // entry, so unburned abilities can be passed through unchanged.
    expect(scoresFromBurnAmounts(makeActor(), { sta: 1 }))
      .toEqual({ str: 14, agl: 12, sta: 12 })
  })

  test('floors at 0, not 1 — DCC RAW allows burning an ability to 0', () => {
    expect(scoresFromBurnAmounts(makeActor(), { str: 99, agl: 0, sta: 0 }).str).toBe(0)
  })

  test('a burn of 0 is not treated as a burn', () => {
    expect(scoresFromBurnAmounts(makeActor(), { str: 0, agl: 0, sta: 0 }))
      .toEqual({ str: 14, agl: 12, sta: 13 })
  })

  test('a negative amount is ignored rather than granting ability points', () => {
    // A malformed commitment must not turn a burn into a gain: positive log
    // entries are not healable, so an invented point would be permanent
    // (the same class of bug as the staminaHpDelta sign fix in #921).
    expect(scoresFromBurnAmounts(makeActor(), { str: -3, agl: 0, sta: 0 }).str).toBe(14)
  })
})

describe('applySpellburn', () => {
  test('forwards the post-burn scores, source and adjustHP to logSpellburn', async () => {
    const actor = makeActor()
    await applySpellburn(actor, { str: 14, agl: 12, sta: 11 }, 'Magic Missile', { adjustHP: true })

    expect(logSpellburn).toHaveBeenCalledWith(
      actor,
      { str: 14, agl: 12, sta: 11 },
      'Magic Missile',
      { adjustHP: true }
    )
  })

  test('defaults adjustHP to false — a term that was never offered a checkbox must not opt in', async () => {
    await applySpellburn(makeActor(), { str: 13, agl: 12, sta: 13 }, 'Spider Climb')

    expect(logSpellburn).toHaveBeenCalledWith(
      expect.anything(), expect.anything(), 'Spider Climb', { adjustHP: false }
    )
  })

  test('a rejected apply notifies the player rather than only the console', async () => {
    logSpellburn.mockRejectedValue(new Error('permission denied'))

    await expect(applySpellburn(makeActor(), { str: 11, agl: 12, sta: 13 }, 'Magic Shield'))
      .resolves.toBeUndefined()

    // The spell-check card is about to claim the burn was paid; a
    // console-only failure leaves the sheet silently disagreeing with it.
    expect(ui.notifications.error).toHaveBeenCalledWith(game.i18n.localize('DCC.SpellburnApplyFailed'))
  })
})

describe('spellburnTermFromDescriptor', () => {
  test('builds the Spellburn term from the descriptor', () => {
    const term = spellburnTermFromDescriptor({ str: 14, agl: 12, sta: 13, level: 4 }, () => {})

    expect(term).toMatchObject({
      type: 'Spellburn',
      formula: '+0',
      str: 14,
      agl: 12,
      sta: 13,
      level: 4
    })
    expect(typeof term.callback).toBe('function')
  })

  test('an absent level is passed through as undefined so the HP row is suppressed', () => {
    // `DCCSpellburnTerm` gates the checkbox on `!isNaN(parseInt(level))`.
    // Coercing an absent level to 0 would defeat that gate, which is what
    // keeps the row away from callers that never wired up `adjustHP`.
    const term = spellburnTermFromDescriptor({ str: 14, agl: 12, sta: 13 }, () => {})
    expect(term.level).toBeUndefined()
  })

  test.each([
    ['null', null],
    ['empty string', ''],
    ['non-numeric', 'four']
  ])('a %s level is passed through as undefined', (_label, level) => {
    const term = spellburnTermFromDescriptor({ str: 14, agl: 12, sta: 13, level }, () => {})
    expect(term.level).toBeUndefined()
  })

  test('a level of 0 IS passed through — 0 is a real level, not an absent one', () => {
    const term = spellburnTermFromDescriptor({ str: 14, agl: 12, sta: 13, level: 0 }, () => {})
    expect(term.level).toBe(0)
  })

  test('the callback hands the commitment to onCommit and applies nothing itself', () => {
    const onCommit = vi.fn()
    const term = spellburnTermFromDescriptor({ str: 14, agl: 12, sta: 13, level: 4 }, onCommit)

    // The dialog mutates term.str/agl/sta in place to the POST-burn scores.
    term.callback('+0', { str: 11, agl: 12, sta: 12, adjustHP: true })

    expect(onCommit).toHaveBeenCalledWith({
      str: 11, agl: 12, sta: 12, adjustHP: true, total: 4
    })
    expect(logSpellburn).not.toHaveBeenCalled()
  })

  test('total is the sum of points burned across all three abilities', () => {
    const onCommit = vi.fn()
    const term = spellburnTermFromDescriptor({ str: 14, agl: 12, sta: 13, level: 1 }, onCommit)

    term.callback('+0', { str: 12, agl: 9, sta: 13, adjustHP: false })

    expect(onCommit.mock.calls[0][0].total).toBe(5)
  })

  test('adjustHP fails closed on anything but an explicit true', () => {
    const onCommit = vi.fn()
    const term = spellburnTermFromDescriptor({ str: 14, agl: 12, sta: 13, level: 1 }, onCommit)

    for (const value of [undefined, false, 'true', 1, null]) {
      onCommit.mockClear()
      term.callback('+0', { str: 14, agl: 12, sta: 12, adjustHP: value })
      expect(onCommit.mock.calls[0][0].adjustHP).toBe(false)
    }
  })
})

describe('buildSpellburnTerm', () => {
  test('builds the term from the actor, carrying the caster level', () => {
    const term = buildSpellburnTerm(makeActor())

    expect(term).toMatchObject({
      type: 'Spellburn', formula: '+0', str: 14, agl: 12, sta: 13, level: 4
    })
  })

  test('the callback applies the burn through logSpellburn with the source', async () => {
    const term = buildSpellburnTerm(makeActor(), { source: 'Magic Missile' })

    term.callback('+0', { str: 14, agl: 12, sta: 11, adjustHP: true })
    await vi.waitFor(() => expect(logSpellburn).toHaveBeenCalled())

    expect(logSpellburn).toHaveBeenCalledWith(
      expect.anything(),
      { str: 14, agl: 12, sta: 11 },
      'Magic Missile',
      { adjustHP: true }
    )
  })

  test('the callback forwards an unticked checkbox as adjustHP false', async () => {
    const term = buildSpellburnTerm(makeActor(), { source: 'Magic Missile' })

    term.callback('+0', { str: 14, agl: 12, sta: 11, adjustHP: false })
    await vi.waitFor(() => expect(logSpellburn).toHaveBeenCalled())

    expect(logSpellburn).toHaveBeenCalledWith(
      expect.anything(), expect.anything(), expect.anything(), { adjustHP: false }
    )
  })

  test('onBurn observes the total burned', () => {
    const onBurn = vi.fn()
    const term = buildSpellburnTerm(makeActor(), { source: 'Magic Missile', onBurn })

    term.callback('+0', { str: 12, agl: 12, sta: 12, adjustHP: false })

    // MCC glowburn IS spellburn and its patron manifestation keys off the
    // amount burned, so the total has to reach the result hook.
    expect(onBurn).toHaveBeenCalledWith(3, expect.objectContaining({ total: 3 }))
  })

  test('a rejected apply from the synchronous callback still notifies the player', async () => {
    logSpellburn.mockRejectedValue(new Error('nope'))
    const term = buildSpellburnTerm(makeActor(), { source: 'Magic Missile' })

    // The term callback is synchronous — the rejection has to be caught
    // inside the helper or it surfaces as an unhandled rejection.
    term.callback('+0', { str: 13, agl: 12, sta: 13, adjustHP: false })

    await vi.waitFor(() => expect(ui.notifications.error)
      .toHaveBeenCalledWith(game.i18n.localize('DCC.SpellburnApplyFailed')))
  })

  test('is exposed for dependent modules without a source or observer', () => {
    // XCC builds Spellburn terms on its own class sheets; calling with just
    // the actor has to produce a term that logs like a core cast (#923).
    const term = buildSpellburnTerm(makeActor())
    term.callback('+0', { str: 14, agl: 12, sta: 12 })

    expect(logSpellburn).toHaveBeenCalledWith(
      expect.anything(), { str: 14, agl: 12, sta: 12 }, '', { adjustHP: false }
    )
  })
})
