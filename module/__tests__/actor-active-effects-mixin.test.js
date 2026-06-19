import { describe, test, expect } from 'vitest'
import '../__mocks__/foundry.js'
import { ActiveEffectsMixin } from '../actor/active-effects-mixin.mjs'

// Phase 7 (Appendix-A actor.js shrinkage): the Active-Effects application engine
// moved out of actor.js into actor/active-effects-mixin.mjs. These guards pin the
// extraction itself — the mixin's shape and that the seven handlers behave on a
// bare Base — alongside the behavioral coverage in active-effects.test.js (which
// exercises the members through live DCCActor instances and passes unchanged,
// proving the composition is transparent).

const AE_MEMBERS = [
  'applyActiveEffects',
  '_resolveEffectValue',
  '_applyCustomEffect',
  '_applyAddEffect',
  '_applySubtractEffect',
  '_applyMultiplyEffect',
  '_applyOverrideEffect',
  '_applyUpgradeEffect',
  '_applyDowngradeEffect'
]

describe('ActiveEffectsMixin extraction', () => {
  test('is a mixin factory function', () => {
    expect(typeof ActiveEffectsMixin).toBe('function')
  })

  test('applying the mixin to a Base yields a subclass carrying all 9 members', () => {
    class Base {}
    const Mixed = ActiveEffectsMixin(Base)
    expect(Object.getPrototypeOf(Mixed)).toBe(Base)
    const proto = Mixed.prototype
    for (const name of AE_MEMBERS) {
      expect(Object.getOwnPropertyDescriptor(proto, name), `missing member: ${name}`).toBeDefined()
    }
  })

  describe('handlers operate on a bare Base instance', () => {
    class Base {}
    const Mixed = ActiveEffectsMixin(Base)
    const fresh = () => new Mixed()

    test('_applyAddEffect adds a numeric delta and records the override', () => {
      const inst = fresh()
      inst.system = { attributes: { hp: { value: 10 } } }
      const overrides = {}
      inst._applyAddEffect('system.attributes.hp.value', '5', overrides)
      expect(inst.system.attributes.hp.value).toBe(15)
      expect(overrides['system.attributes.hp.value']).toBe(15)
    })

    test('_applyAddEffect treats a missing current value as 0', () => {
      const inst = fresh()
      inst.system = {}
      const overrides = {}
      inst._applyAddEffect('system.bonus', '3', overrides)
      expect(inst.system.bonus).toBe(3)
    })

    test('_applySubtractEffect subtracts a numeric delta', () => {
      const inst = fresh()
      inst.system = { hp: 10 }
      const overrides = {}
      inst._applySubtractEffect('system.hp', '4', overrides)
      expect(inst.system.hp).toBe(6)
    })

    test('_applyMultiplyEffect skips a null current value', () => {
      const inst = fresh()
      inst.system = { value: null }
      const overrides = {}
      inst._applyMultiplyEffect('system.value', '2', overrides)
      expect(inst.system.value).toBeNull()
      expect(overrides).toEqual({})
    })

    test('_applyOverrideEffect coerces a numeric string but keeps a non-numeric one', () => {
      const inst = fresh()
      inst.system = { a: 0, b: 'x' }
      const overrides = {}
      inst._applyOverrideEffect('system.a', '25', overrides)
      inst._applyOverrideEffect('system.b', 'c', overrides)
      expect(inst.system.a).toBe(25)
      expect(inst.system.b).toBe('c')
    })

    test('_applyUpgradeEffect keeps the higher value; _applyDowngradeEffect keeps the lower', () => {
      const up = fresh()
      up.system = { v: 3 }
      up._applyUpgradeEffect('system.v', '5', {})
      expect(up.system.v).toBe(5)

      const upKeep = fresh()
      upKeep.system = { v: 9 }
      upKeep._applyUpgradeEffect('system.v', '5', {})
      expect(upKeep.system.v).toBe(9)

      const down = fresh()
      down.system = { v: 9 }
      down._applyDowngradeEffect('system.v', '2', {})
      expect(down.system.v).toBe(2)
    })
  })
})
