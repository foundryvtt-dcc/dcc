/* global game, gameSettingsGetMock */
/**
 * Multiple action dice on the spell-check dispatcher (#857), driven through
 * the entry point the character sheet's cast button uses.
 *
 * These tests used to live in item.test.js against `DCCItem.rollSpellCheck`,
 * which built its own term list and owned its own plan → override → reconcile
 * → spend cycle. #923 retired that duplicate: the sheet now hands the spell
 * document to `DCCActor.rollSpellCheck`, so the budget behavior has to be
 * asserted on the dispatcher. The two rules that only existed on the item path
 * — an authored `spellCheck.die` and a class `spellCheckOverrideDie` both
 * survive a slot step-down — came across with them, and are the reason this
 * file exists rather than the coverage simply being deleted.
 *
 * The action-dice tracker is REAL here; only combat state is faked.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import '../__mocks__/foundry.js'
import DCCActor from '../actor.js'
import DCCItem from '../item.js'

vi.mock('../actor-level-change.js')

// The dispatcher only opens the dialog when `showModifierDialog` is set, and
// none of these casts set it — but the module is imported either way.
vi.mock('../adapter/roll-dialog.mjs', () => ({
  promptRollModifierDialog: vi.fn(async () => null)
}))

/** A level-5 wizard's slots: 1d20 (any) + a spells-only 1d14. */
const wizardSlots = () => [
  { slot: 0, die: 'd20', modifier: 0, use: 'any' },
  { slot: 1, die: 'd14', modifier: 0, use: 'spell' }
]

let combatant
let rolledFormulas
let OriginalRoll

/** Every formula the adapter handed to `new Roll(...)`, in order. */
function captureRolls () {
  rolledFormulas = []
  OriginalRoll = globalThis.Roll
  class RecordingRoll extends OriginalRoll {
    constructor (formula, data) {
      super(formula, data)
      rolledFormulas.push(typeof formula === 'string' ? formula : '')
      this._formula = typeof formula === 'string' ? formula : ''
      this.dice = [{ total: 10, results: [10], options: {}, faces: dieFacesOf(formula) }]
    }
  }
  RecordingRoll.safeEval = OriginalRoll.safeEval
  RecordingRoll.validate = OriginalRoll.validate
  globalThis.Roll = RecordingRoll
}

function dieFacesOf (formula) {
  return parseInt(String(formula).match(/d(\d+)/)?.[1] || '20') || 20
}

/** The action-die formula the spell check actually rolled. */
function rolledDie () {
  const match = String(rolledFormulas[0] ?? '').match(/\d*d\d+/)
  return match ? match[0] : ''
}

/** `spent` is the stored per-round state; null ⇒ a fresh round. */
function enterCombat (actor, spent = null, { round = 3, list = wizardSlots() } = {}) {
  actor.id = 'wiz1'
  combatant = {
    actor: { id: 'wiz1', system: { attributes: { actionDice: { list } } }, isOwner: true },
    isOwner: true,
    getFlag: (scope, key) => (scope === 'dcc' && key === 'actionDice'
      ? (spent ? { round, spent } : undefined)
      : undefined),
    setFlag: vi.fn(async () => {})
  }
  game.combat = { round, combatants: [combatant] }
}

function makeWizard () {
  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  actor.system.class.patron = ''
  actor.system.class.className = 'Wizard'
  actor.system.details.sheetClass = 'Wizard'
  return actor
}

function makeSpell (overrides = {}) {
  const spell = new DCCItem({ name: 'Magic Missile', type: 'spell' }, {})
  spell.system = {
    level: 1,
    config: { castingMode: 'generic', inheritCheckPenalty: true, inheritActionDie: true },
    spellCheck: { die: '1d20', value: '+0', penalty: '-0' },
    results: { table: '', collection: '' },
    lost: false,
    ...overrides
  }
  spell.update = vi.fn().mockResolvedValue(undefined)
  return spell
}

beforeEach(() => {
  captureRolls()
  game.user = { isGM: true }
  gameSettingsGetMock.mockImplementation((module, key) => {
    if (module !== 'dcc') return false
    if (key === 'automateWizardSpellLoss') return true
    // The multiple-action-dice master switch plus in-combat tracking.
    if (key === 'multipleActionDice' || key === 'trackActionDiceInCombat') return true
    return false
  })
})

afterEach(() => {
  globalThis.Roll = OriginalRoll
  delete game.combat
  gameSettingsGetMock.mockReset()
})

describe('spell-check action-dice budget on the dispatcher (#857 / #923)', () => {
  test("the round's first cast uses the spell's own die and spends slot 0", async () => {
    const actor = makeWizard()
    enterCombat(actor)

    await actor.rollSpellCheck({ spellItem: makeSpell() })

    expect(rolledDie()).toBe('1d20')
    expect(combatant.setFlag).toHaveBeenCalledWith('dcc', 'actionDice', expect.objectContaining({
      round: 3,
      spent: [true, false]
    }))
  })

  test("the second cast drops to the wizard's spells-only second action die", async () => {
    const actor = makeWizard()
    enterCombat(actor, [true, false])

    await actor.rollSpellCheck({ spellItem: makeSpell() })

    // The #857 bug: this rolled 1d20 again, because `spellCheck.die` only ever
    // carries the FIRST action die (via getSingleActionDie).
    expect(rolledDie()).toBe('1d14')
    expect(combatant.setFlag).toHaveBeenCalledWith('dcc', 'actionDice', expect.objectContaining({
      round: 3,
      spent: [true, true]
    }))
  })

  test('a third cast is over budget — no die is spent', async () => {
    const actor = makeWizard()
    enterCombat(actor, [true, true])

    await actor.rollSpellCheck({ spellItem: makeSpell() })

    // Nothing left to spend, so the die falls back to the spell's own and the
    // stored state is never rewritten.
    expect(rolledDie()).toBe('1d20')
    expect(combatant.setFlag).not.toHaveBeenCalled()
  })

  test('off-path (setting disabled) the cast is unchanged and spends nothing', async () => {
    const actor = makeWizard()
    enterCombat(actor, [true, false])
    gameSettingsGetMock.mockImplementation((module, key) =>
      module === 'dcc' && key === 'automateWizardSpellLoss')

    await actor.rollSpellCheck({ spellItem: makeSpell() })

    expect(rolledDie()).toBe('1d20')
    expect(combatant.setFlag).not.toHaveBeenCalled()
  })

  test('out of combat there is no budget, so the cast is unchanged', async () => {
    const actor = makeWizard()

    await actor.rollSpellCheck({ spellItem: makeSpell() })

    expect(rolledDie()).toBe('1d20')
  })

  // The two authoring-choice guards. Both came off `DCCItem.rollSpellCheck`
  // when the sheet moved onto the dispatcher (#923) — the dispatcher stepped
  // to the slot die unconditionally, which would have silently discarded a
  // deliberately authored die for every sheet cast.
  test('a spell that opts out of inheritActionDie keeps its own die', async () => {
    const actor = makeWizard()
    enterCombat(actor, [true, false])
    const spell = makeSpell({
      config: { castingMode: 'generic', inheritCheckPenalty: true, inheritActionDie: false },
      spellCheck: { die: '1d24', value: '+0', penalty: '-0' }
    })

    await actor.rollSpellCheck({ spellItem: spell })

    // The authored die is a deliberate choice; the slot must not discard it.
    expect(rolledDie()).toBe('1d24')
    // The action is still taken, so the slot is still spent.
    expect(combatant.setFlag).toHaveBeenCalledWith('dcc', 'actionDice', expect.objectContaining({
      spent: [true, true]
    }))
  })

  test('a class spellCheckOverrideDie survives the slot step-down', async () => {
    const actor = makeWizard()
    actor.system.class.spellCheckOverrideDie = '1d30'
    enterCombat(actor, [true, false])

    await actor.rollSpellCheck({
      spellItem: makeSpell({
        config: { castingMode: 'generic', inheritCheckPenalty: true, inheritActionDie: true },
        spellCheck: { die: '1d30', value: '+0', penalty: '-0' }
      })
    })

    expect(rolledDie()).toBe('1d30')
  })

  test('a naked cast with a class override die also keeps it', async () => {
    const actor = makeWizard()
    actor.system.class.spellCheckOverrideDie = '1d30'
    enterCombat(actor, [true, false])

    await actor.rollSpellCheck({})

    expect(rolledDie()).toBe('1d30')
  })
})
