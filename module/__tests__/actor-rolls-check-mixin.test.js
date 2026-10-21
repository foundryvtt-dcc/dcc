import { describe, test, expect } from 'vitest'
import { RollsCheckMixin } from '../actor/rolls-check-mixin.mjs'

// Phase 7 (actor.js shrinkage, continued): the ability/luck/initiative/hit-dice/
// saving-throw dispatch layer moved out of actor.js into
// actor/rolls-check-mixin.mjs. This guard pins the extraction's shape on a bare
// Base, alongside the existing behavioral coverage in actor.test.js (which
// exercises the dispatchers through live DCCActor instances and passes unchanged,
// proving transparent composition).

const MEMBERS = [
  'rollAbilityCheck',
  '_rollAbilityCheckViaAdapter',
  '_buildCheckPenaltyNote',
  '_getCheckPenalty',
  '_checkPenaltyDialogTerm',
  '_rollAbilityCheckWithDialog',
  '_rollLuckCheckViaAdapter',
  'getInitiativeRoll',
  '_getInitiativeRollViaAdapter',
  '_getInitiativeRollWithDialogViaAdapter',
  '_initDieAdditiveTerms',
  'rollInit',
  'rollHitDice',
  'rollSavingThrow',
  '_rollSavingThrowViaAdapter',
  '_rollSavingThrowWithDialog'
]

class Base {}
const Mixed = RollsCheckMixin(Base)

describe('RollsCheckMixin extraction', () => {
  test('is a mixin factory preserving the prototype chain', () => {
    expect(typeof RollsCheckMixin).toBe('function')
    expect(Object.getPrototypeOf(Mixed)).toBe(Base)
  })

  test('carries the full check/init/save dispatch surface', () => {
    for (const name of MEMBERS) {
      expect(Object.getOwnPropertyDescriptor(Mixed.prototype, name), `missing: ${name}`).toBeDefined()
    }
  })
})

describe('_checkPenaltyDialogTerm', () => {
  // A zero term would only add an empty column with a checkbox that does
  // nothing, which is why the skill-check dialog already skips it.
  test('leaves the term out when the actor has no check penalty', () => {
    const term = Mixed.prototype._checkPenaltyDialogTerm.call(
      { _getCheckPenalty: () => 0 }, 'str'
    )
    expect(term).toBeNull()
  })

  // The partial is shared with the skill and spell dialogs, where unticking
  // drops the penalty without a chat note.
  test('asks for the ability/save hint', () => {
    const { term } = Mixed.prototype._checkPenaltyDialogTerm.call(
      { _getCheckPenalty: () => -2 }, 'str'
    )
    expect(term.hint).toBe('DCC.RollModifierCheckPenaltyHint')
  })
})
