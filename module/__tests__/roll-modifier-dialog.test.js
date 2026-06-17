import { describe, test, expect, vi, beforeEach } from 'vitest'
import '../__mocks__/foundry.js'

// roll-modifier.js RollModifierDialog coverage backfill (audit 2026-06-08: only the
// createRollFromTerms free function was tested). Covers getTermByIndex's attack-vs-
// damage routing and _constructRoll / _constructDamageFormula's terms-array branch
// (the no-DOM path), which builds the final attack + damage formulas and fires each
// term's resolve callback — the live path for every modifier-dialog roll.

const { RollModifierDialog } = await import('../roll-modifier.js')
const proto = RollModifierDialog.prototype

beforeEach(() => {
  // _construct* reads ApplicationV2.RENDER_STATES.NONE in its DOM-vs-array guard.
  globalThis.foundry.applications.api.ApplicationV2.RENDER_STATES = { NONE: 0 }
  // Capture the formula passed to the Roll constructor.
  globalThis.Roll = class { constructor (formula) { this.formula = String(formula); this.options = {} } }
})

// A dialog-like `this` with the DOM disabled (element null -> terms-array branch).
const ctx = (terms, damageTerms) => ({
  element: null,
  _state: 1,
  terms,
  _terms: terms,
  _damageTerms: damageTerms
})

describe('getTermByIndex', () => {
  test('numeric index resolves an attack term from _terms', () => {
    const t = ctx([{ index: 0, formula: '1d20' }, { index: 1, formula: '2' }])
    expect(proto.getTermByIndex.call(t, 1)).toEqual({ index: 1, formula: '2' })
    expect(proto.getTermByIndex.call(t, '0')).toEqual({ index: 0, formula: '1d20' })
  })

  test("a 'damage-N' index resolves from _damageTerms", () => {
    const t = ctx([], [{ index: 'damage-0', formula: '1d6' }, { index: 'damage-1', formula: '2' }])
    expect(proto.getTermByIndex.call(t, 'damage-1')).toEqual({ index: 'damage-1', formula: '2' })
  })
})

describe('_constructRoll (terms-array branch)', () => {
  test('joins attack-term formulas with + and fires each callback', () => {
    const cbA = vi.fn()
    const cbB = vi.fn()
    const t = ctx([
      { index: 0, formula: '1d20', callback: cbA },
      { index: 1, formula: '2', callback: cbB }
    ])
    const roll = proto._constructRoll.call(t)
    expect(roll.formula).toBe('1d20+2')
    expect(cbA).toHaveBeenCalledWith('1d20', expect.objectContaining({ index: 0 }))
    expect(cbB).toHaveBeenCalledWith('2', expect.objectContaining({ index: 1 }))
  })

  test('a single term produces a bare formula', () => {
    const roll = proto._constructRoll.call(ctx([{ index: 0, formula: '1d20' }]))
    expect(roll.formula).toBe('1d20')
  })
})

describe('_constructDamageFormula (terms-array branch)', () => {
  test('joins damage-term formulas with + and fires each callback', () => {
    const cb = vi.fn()
    const t = ctx([], [
      { index: 'damage-0', formula: '1d6', callback: cb },
      { index: 'damage-1', formula: '2' }
    ])
    expect(proto._constructDamageFormula.call(t)).toBe('1d6+2')
    expect(cb).toHaveBeenCalledWith('1d6', expect.any(Object))
  })

  test('returns an empty string when there are no damage terms', () => {
    expect(proto._constructDamageFormula.call(ctx([], null))).toBe('')
  })
})
