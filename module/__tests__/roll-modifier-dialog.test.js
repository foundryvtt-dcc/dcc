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

// Stamina modifier threshold hit point adjustment on the spellburn term (#921).
// The row is rendered by the dialog template but shown, hidden and labelled
// here as the player clicks the Sta +/- buttons.
describe('_updateSpellburnHpRow', () => {
  // Minimal stand-ins for the row markup dialog-roll-modifiers.html emits
  const makeRow = () => {
    const classes = new Set(['spellburn-adjust-hp-row', 'hidden'])
    const label = { textContent: '' }
    return {
      label,
      classList: {
        toggle: (name, force) => (force ? classes.add(name) : classes.delete(name)),
        contains: (name) => classes.has(name)
      },
      querySelector: (selector) => (selector === '.adjust-hp-label' ? label : null)
    }
  }

  // Keyed on the selector rather than answering every query, so a rename in
  // roll-modifier.js that drifts from dialog-roll-modifiers.html is caught
  const hpCtx = (term, row) => ({
    element: {
      querySelector: (selector) =>
        (selector === `.spellburn-adjust-hp-row[data-term="${term.index}"]` ? row : null)
    },
    _terms: [term],
    getTermByIndex: proto.getTermByIndex
  })

  test('shows the row with the ΔHP wording when the burn crosses a threshold', () => {
    // sta 13 (mod +1) -> 11 (mod 0): Δmod = -1, level 2 -> -2 HP
    const row = makeRow()
    const term = { index: 0, type: 'Spellburn', staStart: 13, sta: 11, level: 2, hpAdjustable: true }
    proto._updateSpellburnHpRow.call(hpCtx(term, row), 0)

    expect(row.classList.contains('hidden')).toBe(false)
    expect(row.label.textContent).toBe('Also adjust hit points by -2 (Stamina modifier +1 → 0, level 2)')
  })

  test('hides the row again when the burn stays inside one modifier band', () => {
    const row = makeRow()
    const term = { index: 0, type: 'Spellburn', staStart: 12, sta: 11, level: 2, hpAdjustable: true }
    proto._updateSpellburnHpRow.call(hpCtx(term, row), 0)

    expect(row.classList.contains('hidden')).toBe(true)
  })

  test('a level 0 character still loses a point per modifier step', () => {
    const row = makeRow()
    const term = { index: 0, type: 'Spellburn', staStart: 13, sta: 11, level: 0, hpAdjustable: true }
    proto._updateSpellburnHpRow.call(hpCtx(term, row), 0)

    expect(row.label.textContent).toContain('by -1')
    expect(row.label.textContent).toContain('level 1')
  })

  test('does nothing when the row is not in the DOM (non-spellburn dialogs)', () => {
    const ctx = { element: { querySelector: () => null }, _terms: [], getTermByIndex: proto.getTermByIndex }
    expect(() => proto._updateSpellburnHpRow.call(ctx, 0)).not.toThrow()
  })

  test('a term that never opted in is skipped without touching the DOM', () => {
    // A term with no level gets no row; querying for one would be a bug
    const term = { index: 0, type: 'Spellburn', staStart: 13, sta: 11, level: 0, hpAdjustable: false }
    const querySelector = vi.fn()
    proto._updateSpellburnHpRow.call({ element: { querySelector }, _terms: [term], getTermByIndex: proto.getTermByIndex }, 0)
    expect(querySelector).not.toHaveBeenCalled()
  })

  test('an adjustable term whose row is missing reports rather than failing silently', () => {
    // This drift between template and term list is how the feature went
    // missing on the sheet cast path (#921) - it must not be quiet
    const term = { index: 0, type: 'Spellburn', staStart: 13, sta: 11, level: 2, hpAdjustable: true }
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    proto._updateSpellburnHpRow.call({ element: { querySelector: () => null }, _terms: [term], getTermByIndex: proto.getTermByIndex }, 0)
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })
})

describe('spellburnAdjustHP action', () => {
  const action = RollModifierDialog.DEFAULT_OPTIONS.actions.spellburnAdjustHP

  test('mirrors the checkbox onto the term the submit callback reads', async () => {
    const term = { index: 0, type: 'Spellburn', adjustHP: true }
    const ctx = { _terms: [term], getTermByIndex: proto.getTermByIndex }

    await action.call(ctx, new Event('change'), { checked: false, dataset: { term: '0' } })
    expect(term.adjustHP).toBe(false)

    await action.call(ctx, new Event('change'), { checked: true, dataset: { term: '0' } })
    expect(term.adjustHP).toBe(true)
  })

  test('ignores a checkbox pointing at a term that no longer exists', async () => {
    const ctx = { _terms: [], getTermByIndex: proto.getTermByIndex }
    await expect(
      action.call(ctx, new Event('change'), { checked: true, dataset: { term: '3' } })
    ).resolves.toBeUndefined()
  })
})

describe('Spellburn term hit point opt-in (#921)', () => {
  const spellburnTerm = (extra = {}) => new RollModifierDialog(null, null, [
    { type: 'Spellburn', formula: '+0', str: 14, agl: 12, sta: 13, ...extra }
  ], {}).terms[0]

  test('a term built with a level offers the HP row, checked, anchored to the pre-burn Stamina', () => {
    expect(spellburnTerm({ level: 3 })).toMatchObject({
      hpAdjustable: true,
      adjustHP: true,
      staStart: 13,
      level: 3
    })
  })

  test('level 0 still offers it — the ΔHP formula floors the multiplier at 1', () => {
    expect(spellburnTerm({ level: 0 })).toMatchObject({ hpAdjustable: true, level: 0 })
  })

  test('a term with no level (dependent modules with their own apply callback) does not', () => {
    expect(spellburnTerm()).toMatchObject({ hpAdjustable: false, adjustHP: false, level: 0 })
  })
})

// The +/- buttons are the only thing that refreshes the preview, so the wire
// from #modifySpellburn to _updateSpellburnHpRow is load-bearing: without it
// the row never appears no matter how much Stamina is burned.
describe('modifySpellburn refreshes the HP row', () => {
  const action = RollModifierDialog.DEFAULT_OPTIONS.actions.modifySpellburn

  const dialogCtx = (term, fields) => ({
    element: { querySelector: (sel) => fields[sel] ?? null },
    _terms: [term],
    terms: [term],
    getTermByIndex: proto.getTermByIndex,
    _updateSpellburnHpRow: vi.fn()
  })

  const fieldsFor = (staValue) => ({
    '#term-0': { value: '+0' },
    '#sta': { value: String(staValue), dataset: { max: String(staValue) } },
    '#str': { value: '12', dataset: { max: '12' } }
  })

  test('burning Stamina refreshes the row', async () => {
    const term = { index: 0, type: 'Spellburn', staStart: 16, sta: 16, level: 2, hpAdjustable: true }
    const ctx = dialogCtx(term, fieldsFor(16))
    await action.call(ctx, new Event('click'), { dataset: { term: '0', mod: '+1', stat: 'sta' } })

    expect(term.sta).toBe(15)
    expect(ctx._updateSpellburnHpRow).toHaveBeenCalledWith('0')
  })

  test('burning Strength does not', async () => {
    const term = { index: 0, type: 'Spellburn', staStart: 16, sta: 16, str: 12, level: 2, hpAdjustable: true }
    const ctx = dialogCtx(term, fieldsFor(16))
    await action.call(ctx, new Event('click'), { dataset: { term: '0', mod: '+1', stat: 'str' } })

    expect(term.str).toBe(11)
    expect(ctx._updateSpellburnHpRow).not.toHaveBeenCalled()
  })
})
