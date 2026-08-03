/* global Hooks */
/**
 * Unit coverage for `module/actor/spell-result-hook.mjs` — the shared
 * `dcc.afterSpellCheckResult` emitter used by the adapter spell-check
 * terminals (`_castNakedViaAdapter`, `_castViaCastSpell`,
 * `_castViaCalculateSpellCheck`). End-to-end firing through the dispatcher
 * is covered in `adapter-spell-check.test.js`; this pins the payload
 * normalization (the contract MCC consumes) in isolation.
 */

import { describe, expect, test, vi, beforeEach } from 'vitest'
import '../__mocks__/foundry.js'
import { emitAfterSpellCheckResult, sumSpellburn } from '../actor/spell-result-hook.mjs'

describe('sumSpellburn', () => {
  test('sums str/agl/sta points burned', () => {
    expect(sumSpellburn({ str: 1, agl: 2, sta: 3 })).toBe(6)
  })

  test('treats missing components and non-numeric values as zero', () => {
    expect(sumSpellburn({ sta: 4 })).toBe(4)
    expect(sumSpellburn({ str: 'x', agl: null, sta: 2 })).toBe(2)
  })

  test('returns 0 for null / non-object input', () => {
    expect(sumSpellburn(undefined)).toBe(0)
    expect(sumSpellburn(null)).toBe(0)
    expect(sumSpellburn(5)).toBe(0)
  })
})

describe('emitAfterSpellCheckResult', () => {
  let callAllSpy

  beforeEach(() => {
    callAllSpy = vi.spyOn(Hooks, 'callAll').mockImplementation(() => {})
    callAllSpy.mockClear()
  })

  function payloadFrom () {
    const call = callAllSpy.mock.calls.findLast(c => c[0] === 'dcc.afterSpellCheckResult')
    return call ? { actor: call[1], payload: call[2] } : null
  }

  test('fires the hook with the documented key set, mapping the lib result', () => {
    const actor = { name: 'Wizzo' }
    const foundryRoll = { total: 18, dice: [{ total: 14 }] }
    const result = { total: 18, natural: 14, critical: false, fumble: false, tier: 'success-minor' }

    emitAfterSpellCheckResult(actor, {
      foundryRoll,
      result,
      spellItem: { id: 'spell1' },
      castingMode: 'wizard',
      suppressPatronTaint: false,
      spellburn: 2
    })

    const { actor: hookActor, payload } = payloadFrom()
    expect(hookActor).toBe(actor)
    expect(payload).toEqual({
      roll: foundryRoll,
      item: { id: 'spell1' },
      naturalRoll: 14,
      total: 18,
      result: null,
      crit: false,
      fumble: false,
      disapprovalFailure: false,
      success: true,
      castingMode: 'wizard',
      patronTaint: null,
      suppressPatronTaint: false,
      spellburn: 2
    })
  })

  test('classifies crit/fumble from the lib result flags and a failure tier as not-success', () => {
    emitAfterSpellCheckResult({}, {
      foundryRoll: { total: 1, dice: [{ total: 1 }] },
      result: { total: 1, natural: 1, critical: false, fumble: true, tier: 'failure' },
      spellItem: null,
      castingMode: 'cleric'
    })
    const { payload } = payloadFrom()
    expect(payload.fumble).toBe(true)
    expect(payload.crit).toBe(false)
    expect(payload.success).toBe(false)
    expect(payload.naturalRoll).toBe(1)
    expect(payload.item).toBe(null)
  })

  test('defaults item to null, suppressPatronTaint to false, spellburn to 0', () => {
    emitAfterSpellCheckResult({}, {
      foundryRoll: { total: 12, dice: [{ total: 12 }] },
      result: { total: 12, natural: 12, tier: 'success' },
      castingMode: 'generic'
    })
    const { payload } = payloadFrom()
    expect(payload.item).toBe(null)
    expect(payload.suppressPatronTaint).toBe(false)
    expect(payload.spellburn).toBe(0)
    expect(payload.success).toBe(true)
  })

  test('surfaces a drawn TableResult as the payload result, defaulting to null', () => {
    // The spell-check terminals have no Foundry TableResult (the lib
    // classifies tiers), but the skill-table terminal draws one and passes
    // it through as `tableResult` — legacy `processSpellCheck` put the drawn
    // result on this key for Turn Unholy / Lay on Hands / Divine Aid.
    const drawn = [{ text: 'The unholy flee' }]
    emitAfterSpellCheckResult({}, {
      foundryRoll: { total: 16, dice: [{ total: 16 }] },
      result: { total: 16, natural: 16, tier: 'success' },
      tableResult: drawn,
      castingMode: 'cleric'
    })
    expect(payloadFrom().payload.result).toBe(drawn)

    emitAfterSpellCheckResult({}, {
      foundryRoll: { total: 16, dice: [{ total: 16 }] },
      result: { total: 16, natural: 16, tier: 'success' },
      castingMode: 'cleric'
    })
    expect(payloadFrom().payload.result).toBe(null)
  })

  test('falls back to the rolled die total for naturalRoll when the result omits it', () => {
    emitAfterSpellCheckResult({}, {
      foundryRoll: { total: 9, dice: [{ total: 9 }] },
      result: { total: 9, tier: 'failure' },
      castingMode: 'wizard'
    })
    expect(payloadFrom().payload.naturalRoll).toBe(9)
  })
})
