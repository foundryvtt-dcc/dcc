import { describe, test, expect, vi, beforeEach } from 'vitest'
import { DerivedStatsMixin } from '../actor/derived-stats-mixin.mjs'

// Phase 7 (Appendix-A actor.js shrinkage): the four derived-stat computation
// helpers moved out of actor.js into actor/derived-stats-mixin.mjs. These guards
// pin the extraction's shape + behavior on a bare Base, alongside the existing
// behavioral coverage in actor.test.js (which exercises them through live
// DCCActor instances and passes unchanged, proving transparent composition).

const MEMBERS = [
  'computeAbilityModifiers',
  'computeMeleeAndMissileAttackAndDamage',
  'computeSavingThrows',
  'computeSpellCheck',
  'computeInitiative'
]

class Base {}
const Mixed = DerivedStatsMixin(Base)

// Real DCC RAW modifier table thresholds used by the otherMod tests below
const ABILITY_MODIFIERS = {
  0: -4, 1: -4, 2: -3, 3: -3, 4: -2, 5: -2, 6: -1, 7: -1, 8: -1, 9: 0, 10: 0, 11: 0, 12: 0, 13: 1, 14: 1, 15: 1, 16: 2, 17: 2, 18: 3
}

describe('DerivedStatsMixin extraction', () => {
  beforeEach(() => {
    globalThis.Hooks = { callAll: vi.fn() }
    globalThis.CONFIG = { DCC: { abilityModifiers: ABILITY_MODIFIERS } }
  })

  test('is a mixin factory carrying all compute helpers', () => {
    expect(typeof DerivedStatsMixin).toBe('function')
    expect(Object.getPrototypeOf(Mixed)).toBe(Base)
    for (const name of MEMBERS) {
      expect(Object.getOwnPropertyDescriptor(Mixed.prototype, name), `missing: ${name}`).toBeDefined()
    }
  })

  test('computeAbilityModifiers derives mod from value + otherMod (#801)', () => {
    const inst = new Mixed()
    inst.system = {
      abilities: {
        str: { value: 12, otherMod: 1, max: 12 }, // 12+1=13 crosses into +1
        agl: { value: 13, otherMod: 2, max: 13 }, // 13+2=15 stays at +1
        sta: { value: 15, otherMod: 1, max: 15 }, // 15+1=16 bumps to +2
        per: { value: 9, otherMod: -1, max: 9 }, // 9-1=8 drops to -1
        int: { value: 10, otherMod: 0, max: 10 }, // no shift
        lck: { value: 11, max: 18 } // otherMod absent entirely
      }
    }
    inst.computeAbilityModifiers()
    const a = inst.system.abilities
    expect(a.str.mod).toBe(1)
    expect(a.str.effectiveValue).toBe(13)
    expect(a.agl.mod).toBe(1)
    expect(a.sta.mod).toBe(2)
    expect(a.per.mod).toBe(-1)
    expect(a.per.effectiveValue).toBe(8)
    expect(a.int.mod).toBe(0)
    expect(a.lck.mod).toBe(0)
    expect(a.lck.effectiveValue).toBe(11)
  })

  test('computeAbilityModifiers keeps maxMod on the raw max, unshifted by otherMod', () => {
    const inst = new Mixed()
    inst.system = {
      abilities: {
        lck: { value: 15, otherMod: 1, max: 15 } // effective 16 -> mod +2, but maxMod stays +1
      }
    }
    inst.computeAbilityModifiers()
    expect(inst.system.abilities.lck.mod).toBe(2)
    expect(inst.system.abilities.lck.maxMod).toBe(1)
  })

  test('computeAbilityModifiers: maxMod stays 0 in the 9-12 band even when otherMod shifts mod (#801 review)', () => {
    // The table is 0 (falsy) for max 9-12; a `||` fallback would leak the
    // effective-derived mod (+1 here) into maxMod. It must stay 0.
    const inst = new Mixed()
    inst.system = {
      abilities: {
        str: { value: 12, otherMod: 1, max: 12 }, // effective 13 -> mod +1
        lck: { value: 12, otherMod: 1 } // max absent -> falls back to BASE-derived mod
      }
    }
    inst.computeAbilityModifiers()
    expect(inst.system.abilities.str.mod).toBe(1)
    expect(inst.system.abilities.str.maxMod).toBe(0) // table[12], not the effective mod
    expect(inst.system.abilities.lck.mod).toBe(1)
    expect(inst.system.abilities.lck.maxMod).toBe(0) // base-derived (12 -> 0), not effective
  })

  test('computeAbilityModifiers clamps out-of-range effective scores to the table edges (#801 review)', () => {
    const inst = new Mixed()
    inst.system = {
      abilities: {
        sta: { value: 0, otherMod: -1, max: 10 }, // effective -1 -> clamp to 0 -> -4 (not 0)
        str: { value: 18, otherMod: 5, max: 18 } // effective 23 -> beyond this table (top 18) -> +3
      }
    }
    inst.computeAbilityModifiers()
    expect(inst.system.abilities.sta.mod).toBe(-4)
    expect(inst.system.abilities.sta.effectiveValue).toBe(-1) // display keeps the raw arithmetic
    expect(inst.system.abilities.str.mod).toBe(3)
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
