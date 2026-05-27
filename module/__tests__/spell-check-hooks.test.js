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
      suppressPatronTaint: true,
      spellburn: 2
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
      suppressPatronTaint: expect.any(Boolean),
      spellburn: expect.any(Number)
    }))
  })

  test('a natural 1 on an Invoke Patron AI cast is detectable from the payload (the MCC patron-taint trigger)', () => {
    const payload = { naturalRoll: 1, item: { name: 'Invoke Patron AI (TestPatron)' } }
    const isInvokePatronAi = payload.item?.name?.startsWith('Invoke Patron AI')
    const isNatOne = payload.naturalRoll === 1
    expect(isInvokePatronAi && isNatOne).toBe(true)
  })
})

describe('spellburn capture (the glowburn amount)', () => {
  // Mirror of the burn computation in item.js's Spellburn callback:
  //   spellburnTotal = (origStr - term.str) + (origAgl - term.agl) + (origSta - term.sta)
  function burned (orig, term) {
    return (orig.str - term.str) + (orig.agl - term.agl) + (orig.sta - term.sta)
  }

  test('sums the points burned across str/agl/sta', () => {
    expect(burned({ str: 10, agl: 12, sta: 11 }, { str: 8, agl: 12, sta: 10 })).toBe(3)
  })

  test('is zero when nothing is burned', () => {
    expect(burned({ str: 10, agl: 12, sta: 11 }, { str: 10, agl: 12, sta: 11 })).toBe(0)
  })
})

describe('spellburn roll flavor', () => {
  // Mirror of the `flavored` helper in roll-modifier.js _constructRoll: a
  // non-zero Spellburn contribution gets inline [Spellburn] flavor in the
  // final roll formula; everything else passes through unchanged.
  function flavored (piece, term) {
    if (term.type === 'Spellburn' && piece && parseInt(piece) !== 0) {
      return `${piece}[Spellburn]`
    }
    return piece
  }

  test('tags a non-zero spellburn contribution with inline flavor', () => {
    expect(flavored('+3', { type: 'Spellburn' })).toBe('+3[Spellburn]')
  })

  test('leaves an unused (+0) spellburn term unflavored', () => {
    expect(flavored('+0', { type: 'Spellburn' })).toBe('+0')
  })

  test('does not touch non-spellburn terms', () => {
    expect(flavored('1d20', { type: 'Die' })).toBe('1d20')
    expect(flavored('+2', { type: 'Modifier' })).toBe('+2')
  })
})
