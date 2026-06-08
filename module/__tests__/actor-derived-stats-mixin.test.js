import { describe, test, expect, vi, beforeEach } from 'vitest'
import { DerivedStatsMixin } from '../actor/derived-stats-mixin.mjs'

// Phase 7 (Appendix-A actor.js shrinkage): the four derived-stat computation
// helpers moved out of actor.js into actor/derived-stats-mixin.mjs. These guards
// pin the extraction's shape + behavior on a bare Base, alongside the existing
// behavioral coverage in actor.test.js (which exercises them through live
// DCCActor instances and passes unchanged, proving transparent composition).

const MEMBERS = [
  'computeMeleeAndMissileAttackAndDamage',
  'computeSavingThrows',
  'computeSpellCheck',
  'computeInitiative'
]

class Base {}
const Mixed = DerivedStatsMixin(Base)

describe('DerivedStatsMixin extraction', () => {
  beforeEach(() => {
    globalThis.Hooks = { callAll: vi.fn() }
  })

  test('is a mixin factory carrying all four compute helpers', () => {
    expect(typeof DerivedStatsMixin).toBe('function')
    expect(Object.getPrototypeOf(Mixed)).toBe(Base)
    for (const name of MEMBERS) {
      expect(Object.getOwnPropertyDescriptor(Mixed.prototype, name), `missing: ${name}`).toBeDefined()
    }
  })

  test('computeSavingThrows sums ability mod + class/other bonuses and honors override', () => {
    const inst = new Mixed()
    inst.system = {
      abilities: { per: { mod: 1 }, agl: { mod: 2 }, sta: { mod: 3 } },
      saves: {
        ref: { classBonus: 1, otherBonus: 0, override: '' },
        frt: { classBonus: 2, otherBonus: 1, override: '' },
        wil: { classBonus: 0, otherBonus: 0, override: 5 } // override wins
      }
    }
    inst.computeSavingThrows()
    expect(inst.system.saves.ref.value).toBe('+3') // agl 2 + class 1
    expect(inst.system.saves.frt.value).toBe('+6') // sta 3 + class 2 + other 1
    expect(inst.system.saves.wil.value).toBe('+5') // override
  })

  test('computeInitiative adds agl mod + otherMod, plus class level when configured', () => {
    const base = {
      abilities: { agl: { mod: 2 } },
      attributes: { init: { value: 0, otherMod: 1 } },
      details: { level: { value: 3 } }
    }
    const noLevel = new Mixed()
    noLevel.system = structuredClone(base)
    noLevel.computeInitiative({ addClassLevelToInitiative: false })
    expect(noLevel.system.attributes.init.value).toBe(3) // 2 + 1

    const withLevel = new Mixed()
    withLevel.system = structuredClone(base)
    withLevel.computeInitiative({ addClassLevelToInitiative: true })
    expect(withLevel.system.attributes.init.value).toBe(6) // 2 + 1 + level 3
  })

  test('computeSpellCheck composes level + ability mod and fires the stable hook', () => {
    const inst = new Mixed()
    inst.system = {
      class: { spellCheckAbility: 'int', spellCheckOtherMod: null, spellCheckOverride: '' },
      abilities: { int: { mod: 2 }, per: { mod: 0 }, sta: { mod: 0 }, lck: { mod: 0 } },
      details: { level: { value: 3 } }
    }
    inst.computeSpellCheck()
    // Preserved behavior: level.value (number) + abilityMod (string '+2') builds a
    // concatenated formula string '3+2', then ensurePlus prepends '+' -> '+3+2'.
    expect(inst.system.class.spellCheck).toBe('+3+2')
    expect(globalThis.Hooks.callAll).toHaveBeenCalledWith('dcc.afterComputeSpellCheck', inst)
  })

  test('computeSpellCheck no-ops without a class block', () => {
    const inst = new Mixed()
    inst.system = {}
    expect(() => inst.computeSpellCheck()).not.toThrow()
    expect(globalThis.Hooks.callAll).not.toHaveBeenCalled()
  })
})
