import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { RollsSpellMixin } from '../actor/rolls-spell-mixin.mjs'

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
})
