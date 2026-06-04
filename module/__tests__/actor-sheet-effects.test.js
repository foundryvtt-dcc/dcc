import { describe, test, expect } from 'vitest'
import {
  collectTransferredActiveEffects,
  prepareAbilityEffects,
  prepareAttackBonusEffects,
  prepareSaveEffects,
  prepareAttributeEffects
} from '../actor-sheet/effects.mjs'

// Phase 7 (Appendix-A actor-sheet.js shrinkage): the four AE summary builders
// were #private methods with NO prior unit coverage. Extracting them to pure
// free functions makes them directly testable — this whole file is a coverage
// win, not just a relocation guard.

// Minimal active-effect / actor builders. An effect is {id, name, img, disabled,
// isSuppressed, transfer, changes:[{key, value, type}]}.
const effect = (id, changes, extra = {}) => ({
  id,
  name: `Effect ${id}`,
  img: extra.img,
  disabled: extra.disabled ?? false,
  isSuppressed: extra.isSuppressed ?? false,
  transfer: extra.transfer ?? true,
  changes
})

// actor.effects + actor.items[].effects, where each item has system.equipped.
const actor = ({ effects = [], items = [] } = {}) => ({ effects, items })
const item = (effects, equipped) => ({ system: equipped === undefined ? {} : { equipped }, effects })

describe('collectTransferredActiveEffects', () => {
  test('includes enabled, non-suppressed effects directly on the actor', () => {
    const a = actor({ effects: [effect('a', []), effect('b', [])] })
    expect(collectTransferredActiveEffects(a).map(e => e.id)).toEqual(['a', 'b'])
  })

  test('excludes disabled and suppressed actor effects', () => {
    const a = actor({ effects: [effect('on', []), effect('off', [], { disabled: true }), effect('sup', [], { isSuppressed: true })] })
    expect(collectTransferredActiveEffects(a).map(e => e.id)).toEqual(['on'])
  })

  test('includes transferring effects from equipped items, excludes non-transfer ones', () => {
    const a = actor({ items: [item([effect('xfer', []), effect('noxfer', [], { transfer: false })], true)] })
    expect(collectTransferredActiveEffects(a).map(e => e.id)).toEqual(['xfer'])
  })

  test('excludes effects from unequipped items', () => {
    const a = actor({ items: [item([effect('hidden', [])], false)] })
    expect(collectTransferredActiveEffects(a)).toEqual([])
  })

  test('treats an item with no equipped flag as equipped (default true)', () => {
    const a = actor({ items: [item([effect('default', [])], undefined)] })
    expect(collectTransferredActiveEffects(a).map(e => e.id)).toEqual(['default'])
  })
})

describe('prepareAbilityEffects', () => {
  test('buckets ability value/mod/max changes by ability id', () => {
    const a = actor({
      effects: [
        effect('str-up', [{ key: 'system.abilities.str.value', value: '2', type: 'add' }]),
        effect('lck-mod', [{ key: 'system.abilities.lck.mod', value: '1', type: 'add' }])
      ]
    })
    const result = prepareAbilityEffects(a)
    expect(result.str).toHaveLength(1)
    expect(result.str[0]).toEqual({ id: 'str-up', name: 'Effect str-up', img: 'icons/svg/aura.svg', value: '2', type: 'add' })
    expect(result.lck).toHaveLength(1)
    expect(result.agl).toEqual([])
  })

  test('ignores non-ability keys and unknown ability ids', () => {
    const a = actor({
      effects: [
        effect('hp', [{ key: 'system.attributes.hp.value', value: '5', type: 'add' }]),
        effect('bogus', [{ key: 'system.abilities.zzz.value', value: '1', type: 'add' }])
      ]
    })
    const result = prepareAbilityEffects(a)
    expect(Object.values(result).every(b => b.length === 0)).toBe(true)
  })

  test('dedups a single effect with multiple matching changes to one entry per ability', () => {
    const a = actor({
      effects: [effect('double', [
        { key: 'system.abilities.str.value', value: '1', type: 'add' },
        { key: 'system.abilities.str.mod', value: '1', type: 'add' }
      ])]
    })
    expect(prepareAbilityEffects(a).str).toHaveLength(1)
  })

  test('uses the effect img when present, else the aura fallback', () => {
    const a = actor({ effects: [effect('withimg', [{ key: 'system.abilities.agl.value', value: '1', type: 'add' }], { img: 'icons/x.png' })] })
    expect(prepareAbilityEffects(a).agl[0].img).toBe('icons/x.png')
  })

  test('skips effects with no changes array', () => {
    const a = actor({ effects: [{ id: 'nochanges', name: 'n', disabled: false, isSuppressed: false, transfer: true, changes: null }] })
    expect(prepareAbilityEffects(a).str).toEqual([])
  })
})

describe('prepareAttackBonusEffects', () => {
  test('maps hit/damage melee/missile keys to the four buckets', () => {
    const a = actor({
      effects: [
        effect('mh', [{ key: 'system.details.attackHitBonus.melee.adjustment', value: '+1', type: 'add' }]),
        effect('md', [{ key: 'system.details.attackDamageBonus.melee.value', value: '+2', type: 'add' }]),
        effect('rh', [{ key: 'system.details.attackHitBonus.missile.value', value: '+3', type: 'add' }]),
        effect('rd', [{ key: 'system.details.attackDamageBonus.missile.adjustment', value: '+4', type: 'add' }])
      ]
    })
    const result = prepareAttackBonusEffects(a)
    expect(result.meleeHit.map(e => e.id)).toEqual(['mh'])
    expect(result.meleeDamage.map(e => e.id)).toEqual(['md'])
    expect(result.missileHit.map(e => e.id)).toEqual(['rh'])
    expect(result.missileDamage.map(e => e.id)).toEqual(['rd'])
  })

  test('ignores attack-bonus keys with a non-matching leaf', () => {
    const a = actor({ effects: [effect('bad', [{ key: 'system.details.attackHitBonus.melee.somethingElse', value: '+1', type: 'add' }])] })
    const result = prepareAttackBonusEffects(a)
    expect(Object.values(result).every(b => b.length === 0)).toBe(true)
  })
})

describe('prepareSaveEffects', () => {
  test('buckets ref/frt/wil value/otherBonus changes by save id', () => {
    const a = actor({
      effects: [
        effect('ref', [{ key: 'system.saves.ref.value', value: '+1', type: 'add' }]),
        effect('wil', [{ key: 'system.saves.wil.otherBonus', value: '+2', type: 'add' }])
      ]
    })
    const result = prepareSaveEffects(a)
    expect(result.ref.map(e => e.id)).toEqual(['ref'])
    expect(result.wil.map(e => e.id)).toEqual(['wil'])
    expect(result.frt).toEqual([])
  })

  test('ignores unknown save ids', () => {
    const a = actor({ effects: [effect('zzz', [{ key: 'system.saves.zzz.value', value: '1', type: 'add' }])] })
    const result = prepareSaveEffects(a)
    expect(Object.values(result).every(b => b.length === 0)).toBe(true)
  })
})

describe('prepareAttributeEffects', () => {
  test('buckets AC and HP changes', () => {
    const a = actor({
      effects: [
        effect('ac', [{ key: 'system.attributes.ac.value', value: '+1', type: 'add' }]),
        effect('hp', [{ key: 'system.attributes.hp.max', value: '+5', type: 'add' }])
      ]
    })
    const result = prepareAttributeEffects(a)
    expect(result.ac.map(e => e.id)).toEqual(['ac'])
    expect(result.hp.map(e => e.id)).toEqual(['hp'])
  })

  test('an effect changing both AC and HP lands in both buckets', () => {
    const a = actor({
      effects: [effect('both', [
        { key: 'system.attributes.ac.otherMod', value: '+1', type: 'add' },
        { key: 'system.attributes.hp.temp', value: '+3', type: 'add' }
      ])]
    })
    const result = prepareAttributeEffects(a)
    expect(result.ac.map(e => e.id)).toEqual(['both'])
    expect(result.hp.map(e => e.id)).toEqual(['both'])
  })

  test('ignores non-AC/HP attribute keys', () => {
    const a = actor({ effects: [effect('init', [{ key: 'system.attributes.init.value', value: '1', type: 'add' }])] })
    const result = prepareAttributeEffects(a)
    expect(result.ac).toEqual([])
    expect(result.hp).toEqual([])
  })
})

describe('cross-cutting: equipped-item transferred effects feed all four builders', () => {
  test('an equipped item effect modifying an ability shows up in prepareAbilityEffects', () => {
    const a = actor({ items: [item([effect('ring', [{ key: 'system.abilities.lck.value', value: '+3', type: 'add' }])], true)] })
    expect(prepareAbilityEffects(a).lck.map(e => e.id)).toEqual(['ring'])
  })

  test('an unequipped item effect does NOT show up', () => {
    const a = actor({ items: [item([effect('stowed', [{ key: 'system.saves.ref.value', value: '+3', type: 'add' }])], false)] })
    expect(prepareSaveEffects(a).ref).toEqual([])
  })
})
