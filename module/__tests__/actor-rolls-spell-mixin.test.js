import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { RollsSpellMixin } from '../actor/rolls-spell-mixin.mjs'
import { promptRollModifierDialog } from '../adapter/roll-dialog.mjs'
import {
  reconcilePlannedActionDie,
  spendPlannedActionDie,
  formatActionDiceChatLine
} from '../action-dice-tracker.mjs'

// The dialog and the action-dice tracker are the two collaborators the
// action-die tests below assert against; everything else in this file runs on a
// bare Base and needs no Foundry.
vi.mock('../adapter/roll-dialog.mjs', () => ({
  promptRollModifierDialog: vi.fn(async () => ({ actionDie: '', modifierTotal: 0 }))
}))
vi.mock('../action-dice-tracker.mjs', () => ({
  planActionDie: vi.fn(() => null),
  actionDicePresetsFromPlan: vi.fn(() => null),
  reconcilePlannedActionDie: vi.fn((plan) => plan),
  spendPlannedActionDie: vi.fn(async () => null),
  formatActionDiceChatLine: vi.fn(() => ''),
  slotRollFormula: vi.fn(() => '')
}))

// Phase 7 (actor.js shrinkage, continued): the spell-check dispatch layer moved
// out of actor.js into actor/rolls-spell-mixin.mjs. These guards pin the
// extraction's shape on a bare Base, alongside the existing behavioral coverage
// in actor.test.js / adapter-spell-check.test.js (which exercise the dispatchers
// through live DCCActor instances and pass unchanged, proving transparent
// composition).

const MEMBERS = [
  'rollSpellCheck',
  '_rollSpellCheckDispatch',
  '_promptSpellCheckDialog',
  '_applySpellCheckDialogToOptions',
  '_rollSpellCheckViaAdapter',
  '_castNakedViaAdapter',
  '_castViaCastSpell',
  '_castViaCalculateSpellCheck',
  '_rollMercurialIfNeeded',
  '_buildSpellCheckFlavor'
]

class Base {}
const Mixed = RollsSpellMixin(Base)

describe('RollsSpellMixin extraction', () => {
  test('is a mixin factory preserving the prototype chain', () => {
    expect(typeof RollsSpellMixin).toBe('function')
    expect(Object.getPrototypeOf(Mixed)).toBe(Base)
  })

  test('carries the full spell-check dispatch surface', () => {
    for (const name of MEMBERS) {
      expect(Object.getOwnPropertyDescriptor(Mixed.prototype, name), `missing: ${name}`).toBeDefined()
    }
  })

  describe('_buildSpellCheckFlavor', () => {
    beforeEach(() => {
      globalThis.CONFIG = { DCC: { abilities: { int: 'DCC.AbilityInt', per: 'DCC.AbilityPer' } } }
      globalThis.game = { i18n: { localize: (k) => `L:${k}` } }
    })

    afterEach(() => {
      delete globalThis.CONFIG
      delete globalThis.game
    })

    test('appends the resolved ability label to the spell name', () => {
      const inst = new Mixed()
      const flavor = inst._buildSpellCheckFlavor({ name: 'Magic Missile' }, { abilityId: 'int' }, null)
      expect(flavor).toBe('Magic Missile (L:DCC.AbilityInt)')
    })

    test('falls back to the profile ability when options omit one', () => {
      const inst = new Mixed()
      const flavor = inst._buildSpellCheckFlavor({ name: 'Choking Cloud' }, {}, { spellCheckAbility: 'per' })
      expect(flavor).toBe('Choking Cloud (L:DCC.AbilityPer)')
    })

    test('falls back to a localized label when the spell item is absent', () => {
      const inst = new Mixed()
      const flavor = inst._buildSpellCheckFlavor(null, {}, null)
      expect(flavor).toBe('L:DCC.SpellCheck')
    })
  })

  // Multiple action dice on the actor-side cast path (#857). The dispatcher
  // plans an extra-die override, but the dialog used to build its Die term from
  // the spell's own (always-first-slot) `spellCheck.die` and
  // `_applySpellCheckDialogToOptions` then wrote that straight back over the
  // override — so with the modifier dialog on, an extra-die cast silently
  // reverted to the primary die.
  describe('_promptSpellCheckDialog — action-die override (#857)', () => {
    const spellItem = {
      name: 'Magic Missile',
      system: {
        spellCheck: { die: '1d20', value: '+4', penalty: '0' },
        config: { inheritCheckPenalty: false }
      }
    }

    let inst

    beforeEach(() => {
      globalThis.game = {
        i18n: {
          localize: (k) => `L:${k}`,
          format: (k) => `F:${k}`
        }
      }
      promptRollModifierDialog.mockClear()
      promptRollModifierDialog.mockResolvedValue({ actionDie: '1d14', modifierTotal: 4 })
      inst = new Mixed()
      inst.system = {
        class: {},
        attributes: { actionDice: { value: '1d20' }, ac: { checkPenalty: '0' } }
      }
      inst.getRollData = () => ({})
    })

    afterEach(() => {
      delete globalThis.game
    })

    const dieTerm = () => promptRollModifierDialog.mock.calls[0][0]
      .find(term => term.type === 'Die')

    test('the planned die wins over the spell\'s first-slot die', async () => {
      await inst._promptSpellCheckDialog(spellItem, { actionDie: '1d14' })

      expect(dieTerm().formula).toBe('1d14')
    })

    test('slot presets are passed through so the dialog can pick a slot', async () => {
      const presets = [
        { formula: '1d20', label: 'Action die 1' },
        { formula: '1d14', label: 'Action die 2' }
      ]

      await inst._promptSpellCheckDialog(spellItem, { actionDie: '1d20', actionDicePresets: presets })

      expect(dieTerm().presets).toEqual(presets)
    })

    test('off-path it still falls back to the spell\'s own die, with no presets', async () => {
      await inst._promptSpellCheckDialog(spellItem, {})

      expect(dieTerm().formula).toBe('1d20')
      expect(dieTerm().presets).toBeUndefined()
    })

    test('with no spell item and no plan it falls back to the actor\'s action die', async () => {
      await inst._promptSpellCheckDialog(null, {})

      expect(dieTerm().formula).toBe('1d20')
    })
  })

  // The spend has to follow the die actually rolled, not the auto-picked slot,
  // so a player choosing another slot in the dialog burns the right one.
  describe('_spendActionDiceLine — reconcile before spend (#857)', () => {
    beforeEach(() => {
      reconcilePlannedActionDie.mockClear()
      spendPlannedActionDie.mockClear()
      formatActionDiceChatLine.mockClear()
    })

    test('re-points the plan at the rolled die before spending it', async () => {
      const inst = new Mixed()
      const plan = { choice: { index: 0 } }
      const repointed = { choice: { index: 1 } }
      reconcilePlannedActionDie.mockReturnValue(repointed)

      await inst._spendActionDiceLine(
        { _actionDicePlan: plan, _actionDiceDefaultFaces: 20 },
        { dice: [{ faces: 14 }] }
      )

      expect(reconcilePlannedActionDie).toHaveBeenCalledWith(plan, 14, {
        action: 'spell',
        defaultFaces: 20
      })
      expect(spendPlannedActionDie).toHaveBeenCalledWith(repointed)
    })

    test('off-path (no plan, no roll) it still spends nothing and renders no line', async () => {
      const inst = new Mixed()
      reconcilePlannedActionDie.mockReturnValue(null)

      await inst._spendActionDiceLine({})

      expect(reconcilePlannedActionDie).toHaveBeenCalledWith(undefined, undefined, {
        action: 'spell',
        defaultFaces: null
      })
      expect(spendPlannedActionDie).toHaveBeenCalledWith(null)
    })
  })
})
