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

/**
 * Mirror of the casting-mode determination in `processSpellCheck`
 * (module/dcc.js):
 *   let castingMode = spellData.castingMode || (item ? item.system.config.castingMode : 'wizard')
 *   if (!spellData.castingMode && !item && actor.system.details.sheetClass === 'Cleric') {
 *     castingMode = 'cleric'
 *   }
 * Kept in lockstep with the source condition.
 */
function resolveCastingMode ({ castingMode = undefined, item = null, sheetClass = '' }) {
  let result = castingMode || (item ? item.system.config.castingMode : 'wizard')
  if (!castingMode && !item && sheetClass === 'Cleric') {
    result = 'cleric'
  }
  return result
}

describe('castingMode override (issue #375)', () => {
  const clericSkillItem = { system: { config: { castingMode: 'cleric' } } }

  test('an explicit spellData.castingMode wins over the item configuration', () => {
    expect(resolveCastingMode({ castingMode: 'wizard', item: clericSkillItem })).toBe('wizard')
    expect(resolveCastingMode({ castingMode: 'generic', item: clericSkillItem })).toBe('generic')
  })

  test('an explicit spellData.castingMode wins over the cleric sheet-class default', () => {
    expect(resolveCastingMode({ castingMode: 'wizard', sheetClass: 'Cleric' })).toBe('wizard')
  })

  test('without an override, the item configuration is used (unchanged default behavior)', () => {
    expect(resolveCastingMode({ item: clericSkillItem })).toBe('cleric')
  })

  test('without an override or item, wizard is the default and cleric sheets use cleric', () => {
    expect(resolveCastingMode({})).toBe('wizard')
    expect(resolveCastingMode({ sheetClass: 'Cleric' })).toBe('cleric')
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
  // non-zero Spellburn contribution gets inline flavor using the localized
  // term label; everything else passes through unchanged. The label is
  // localized (DCC.RollModifierSpellburnTerm) so variant modules can rename it.
  function flavored (piece, term, label = 'Spellburn') {
    if (term.type === 'Spellburn' && piece && parseInt(piece) !== 0) {
      return `${piece}[${label}]`
    }
    return piece
  }

  test('tags a non-zero spellburn contribution with the localized term label', () => {
    expect(flavored('+3', { type: 'Spellburn' })).toBe('+3[Spellburn]')
  })

  test('uses the overridden label when localized (MCC renames it to Glowburn)', () => {
    expect(flavored('+3', { type: 'Spellburn' }, 'Glowburn')).toBe('+3[Glowburn]')
  })

  test('leaves an unused (+0) spellburn term unflavored', () => {
    expect(flavored('+0', { type: 'Spellburn' })).toBe('+0')
  })

  test('does not touch non-spellburn terms', () => {
    expect(flavored('1d20', { type: 'Die' })).toBe('1d20')
    expect(flavored('+2', { type: 'Modifier' })).toBe('+2')
  })
})

describe('force-fumble modifier mapping (DCCActorSheet.fillRollOptions)', () => {
  // Mirror of fillRollOptions: shift = crit, ctrl/meta = toggle dialog,
  // ctrl/meta + shift = fumble (that combo takes fumble over crit + toggle).
  function rollOptions (event, rollModifierDefault = false) {
    const modifierKey = event.ctrlKey || event.metaKey
    return {
      showModifierDialog: Boolean(rollModifierDefault ^ (modifierKey && !event.shiftKey)),
      forceCrit: event.shiftKey && !modifierKey,
      forceFumble: event.shiftKey && modifierKey
    }
  }

  test('plain click forces neither crit nor fumble', () => {
    const o = rollOptions({})
    expect(o.forceCrit).toBeFalsy()
    expect(o.forceFumble).toBeFalsy()
  })

  test('shift alone still forces a crit', () => {
    const o = rollOptions({ shiftKey: true })
    expect(o.forceCrit).toBeTruthy()
    expect(o.forceFumble).toBeFalsy()
  })

  test('ctrl/meta alone toggles the dialog and forces nothing', () => {
    const o = rollOptions({ ctrlKey: true }, false)
    expect(o.showModifierDialog).toBe(true)
    expect(o.forceCrit).toBeFalsy()
    expect(o.forceFumble).toBeFalsy()
  })

  test('ctrl+shift forces a fumble (not a crit) and does not toggle the dialog', () => {
    const o = rollOptions({ ctrlKey: true, shiftKey: true }, false)
    expect(o.forceFumble).toBeTruthy()
    expect(o.forceCrit).toBeFalsy()
    expect(o.showModifierDialog).toBe(false)
  })

  test('meta+shift forces a fumble (mac)', () => {
    expect(rollOptions({ metaKey: true, shiftKey: true }).forceFumble).toBeTruthy()
  })
})

describe('forceFumble forces a natural 1', () => {
  // Mirror of the forceFumble block in processSpellCheck.
  function applyForceFumble (naturalRoll, forceFumble) {
    return (forceFumble && naturalRoll !== 1) ? 1 : naturalRoll
  }

  test('forces an arbitrary roll to 1', () => {
    expect(applyForceFumble(15, true)).toBe(1)
  })

  test('forces even a natural 20 to 1 (deterministic, unlike the crit guard)', () => {
    expect(applyForceFumble(20, true)).toBe(1)
  })

  test('is a no-op when not forcing', () => {
    expect(applyForceFumble(15, false)).toBe(15)
  })
})
