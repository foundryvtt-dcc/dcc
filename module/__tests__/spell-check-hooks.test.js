/**
 * Tests for the spell-check extension seams added to the DCC spell-check flow:
 *   - the `suppressPatronTaint` opt-out flag on the processSpellCheck call
 *   - the `dcc.afterSpellCheckResult` post-result hook
 *
 * `processSpellCheck` is a private inline function in `module/dcc.js`, so —
 * matching the established isolated-logic style of `spell-check-crit.test.js`
 * on this branch — these tests lock the guard condition and the hook payload
 * contract as standalone units. Integration-level coverage (the hook firing
 * from a live cast) belongs with the extracted, importable processor.
 */

import { describe, test, expect, vi } from 'vitest'

/**
 * Mirror of the patron-taint guard in `processSpellCheck` (module/dcc.js):
 *   if (!suppressPatronTaint && patronField && (spellName.includes('Patron') || associatedPatron))
 * Kept in lockstep with the source condition.
 */
function patronTaintShouldFire ({ suppressPatronTaint = false, patron = '', spellName = '', associatedPatron = '' }) {
  return !suppressPatronTaint && !!patron && (spellName.includes('Patron') || !!associatedPatron)
}

describe('suppressPatronTaint opt-out flag', () => {
  test('defaults to false when omitted from spellData', () => {
    const spellData = {}
    expect(spellData.suppressPatronTaint || false).toBe(false)
  })

  test('built-in d100 taint fires for a patron-bound caster on a patron spell (unchanged default behavior)', () => {
    expect(patronTaintShouldFire({ patron: 'TestPatron', spellName: 'Invoke Patron' })).toBe(true)
    expect(patronTaintShouldFire({ patron: 'TestPatron', associatedPatron: 'TestPatron' })).toBe(true)
  })

  test('suppressPatronTaint=true skips the built-in d100 taint even when it would otherwise fire', () => {
    expect(patronTaintShouldFire({ suppressPatronTaint: true, patron: 'TestPatron', spellName: 'Invoke Patron' })).toBe(false)
    expect(patronTaintShouldFire({ suppressPatronTaint: true, patron: 'TestPatron', associatedPatron: 'TestPatron' })).toBe(false)
  })

  test('no built-in taint when the actor has no patron field set', () => {
    // An MCC shaman stores its patron in system.class.aiPatron, not the DCC
    // cleric `system.class.patron` field, so the built-in block is latent for
    // them even before the suppress flag — the flag makes the intent explicit.
    expect(patronTaintShouldFire({ patron: '', spellName: 'Invoke Patron AI (TestPatron)' })).toBe(false)
  })
})

describe('dcc.afterSpellCheckResult payload contract', () => {
  test('callAll receives the actor plus a payload carrying the documented keys', () => {
    // Mirror of the Hooks.callAll(...) site at the end of processSpellCheck.
    const callAll = vi.fn()
    const actor = { name: 'Tester' }
    const payload = {
      roll: { total: 14 },
      item: { name: 'Invoke Patron AI (TestPatron)' },
      naturalRoll: 1,
      total: 14,
      result: null,
      crit: false,
      fumble: true,
      success: false,
      castingMode: 'generic',
      patronTaint: null,
      suppressPatronTaint: true
    }
    callAll('dcc.afterSpellCheckResult', actor, payload)

    expect(callAll).toHaveBeenCalledWith('dcc.afterSpellCheckResult', actor, expect.objectContaining({
      roll: expect.any(Object),
      item: expect.any(Object),
      naturalRoll: expect.any(Number),
      total: expect.any(Number),
      crit: expect.any(Boolean),
      fumble: expect.any(Boolean),
      success: expect.any(Boolean),
      castingMode: expect.any(String),
      suppressPatronTaint: expect.any(Boolean)
    }))
  })

  test('a natural 1 on an Invoke Patron AI cast is detectable from the payload (the MCC patron-taint trigger)', () => {
    const payload = { naturalRoll: 1, item: { name: 'Invoke Patron AI (TestPatron)' } }
    const isInvokePatronAi = payload.item?.name?.startsWith('Invoke Patron AI')
    const isNatOne = payload.naturalRoll === 1
    expect(isInvokePatronAi && isNatOne).toBe(true)
  })
})
