/**
 * Tests for the Active Effect attribute-key autocomplete (#904)
 */

import { expect, test, describe, vi, beforeEach, afterEach } from 'vitest'
import '../__mocks__/foundry.js'
import {
  isSanctionedEffectKey,
  getEffectKeyOptions,
  onRenderActiveEffectConfig
} from '../active-effect-key-autocomplete.mjs'

/**
 * Build a fake actor exposing just what the autocomplete reads:
 * documentName, system.toObject() and system.skills labels
 * @param {object} data - Raw system data
 * @returns {object}
 */
function fakeActor (data) {
  return {
    documentName: 'Actor',
    system: {
      ...data,
      toObject () { return data }
    }
  }
}

const playerSystemData = {
  abilities: {
    str: { value: 10, max: 10, mod: 0, otherMod: 0 },
    lck: { value: 10, max: 10, mod: 0, otherMod: 0 }
  },
  attributes: {
    ac: { value: 10, checkPenalty: 0, otherMod: 0 },
    actionDice: { value: '1d20', options: [{ value: '1d20', label: '1d20' }] },
    critical: { die: '1d4', table: 'I' },
    fumble: { die: '1d4' },
    hp: { value: 5, max: 5 },
    init: { die: '1d20', otherMod: 0, value: '+0' },
    speed: { value: '30', base: '30', otherMod: 0 }
  },
  details: {
    attackHitBonus: {
      melee: { value: '+0', adjustment: '+0' },
      missile: { value: '+0', adjustment: '+0' }
    },
    attackDamageBonus: {
      melee: { value: '+0', adjustment: '+0' },
      missile: { value: '+0', adjustment: '+0' }
    }
  },
  saves: {
    frt: { value: '+0', otherBonus: '' },
    ref: { value: '+0', otherBonus: '' },
    wil: { value: '+0', otherBonus: '' }
  },
  class: {
    className: 'Thief',
    luckDie: '1d3',
    backstab: '0',
    spellCheckOtherMod: null
  },
  skills: {
    sneakSilently: { label: 'DCC.SneakSilently', ability: 'agl', value: '0', otherMod: 0 },
    detectSecretDoors: { label: 'DCC.HeightenedSenses', ability: 'int', value: '+4', otherMod: 0 }
  }
}

describe('isSanctionedEffectKey', () => {
  test('accepts modifier-style fields', () => {
    expect(isSanctionedEffectKey('system.abilities.str.otherMod')).toBe(true)
    expect(isSanctionedEffectKey('system.saves.ref.otherBonus')).toBe(true)
    expect(isSanctionedEffectKey('system.skills.sneakSilently.otherMod')).toBe(true)
    expect(isSanctionedEffectKey('system.class.spellCheckOtherMod')).toBe(true)
    expect(isSanctionedEffectKey('system.details.attackHitBonus.melee.adjustment')).toBe(true)
    expect(isSanctionedEffectKey('system.details.attackDamageBonus.missile.adjustment')).toBe(true)
  })

  test('accepts dice-chain and class extras', () => {
    expect(isSanctionedEffectKey('system.attributes.actionDice.value')).toBe(true)
    expect(isSanctionedEffectKey('system.attributes.critical.die')).toBe(true)
    expect(isSanctionedEffectKey('system.attributes.fumble.die')).toBe(true)
    expect(isSanctionedEffectKey('system.class.luckDie')).toBe(true)
    expect(isSanctionedEffectKey('system.class.backstab')).toBe(true)
  })

  test('rejects editable base values and derived fields', () => {
    expect(isSanctionedEffectKey('system.abilities.str.value')).toBe(false)
    expect(isSanctionedEffectKey('system.abilities.str.max')).toBe(false)
    expect(isSanctionedEffectKey('system.abilities.str.mod')).toBe(false)
    expect(isSanctionedEffectKey('system.attributes.hp.value')).toBe(false)
    expect(isSanctionedEffectKey('system.attributes.hp.max')).toBe(false)
    expect(isSanctionedEffectKey('system.attributes.ac.value')).toBe(false)
    expect(isSanctionedEffectKey('system.saves.ref.value')).toBe(false)
    expect(isSanctionedEffectKey('system.skills.sneakSilently.value')).toBe(false)
    expect(isSanctionedEffectKey('system.details.attackHitBonus.melee.value')).toBe(false)
  })
})

describe('getEffectKeyOptions', () => {
  test('derives keys from the parent actor schema, excluding base values', () => {
    const effect = { parent: fakeActor(playerSystemData) }
    const options = getEffectKeyOptions(effect)
    const values = options.map(o => o.value)

    expect(values).toContain('system.abilities.str.otherMod')
    expect(values).toContain('system.attributes.ac.otherMod')
    expect(values).toContain('system.attributes.actionDice.value')
    expect(values).toContain('system.details.attackHitBonus.melee.adjustment')
    expect(values).toContain('system.saves.wil.otherBonus')
    expect(values).toContain('system.class.luckDie')
    expect(values).toContain('system.skills.sneakSilently.otherMod')

    expect(values).not.toContain('system.attributes.hp.value')
    expect(values).not.toContain('system.abilities.str.value')
    expect(values).not.toContain('system.abilities.str.mod')
    expect(values).not.toContain('system.saves.frt.value')
  })

  test('labels known keys and skill keys from actor data', () => {
    const effect = { parent: fakeActor(playerSystemData) }
    const options = getEffectKeyOptions(effect)
    const byValue = Object.fromEntries(options.map(o => [o.value, o.label]))

    expect(byValue['system.abilities.str.otherMod']).toBe('Strength')
    expect(byValue['system.saves.frt.otherBonus']).toBe('Fortitude')
    // Skill label comes from the actor's own data (class/module overrides win)
    expect(byValue['system.skills.detectSecretDoors.otherMod']).toBe('HeightenedSenses')
  })

  test('walks up to the owning actor for effects on owned items', () => {
    const actor = fakeActor(playerSystemData)
    const effect = { parent: { documentName: 'Item', parent: actor } }
    const values = getEffectKeyOptions(effect).map(o => o.value)
    expect(values).toContain('system.abilities.lck.otherMod')
    expect(values).not.toContain('system.attributes.hp.value')
  })

  test('falls back to the curated list for unowned items', () => {
    const effect = { parent: { documentName: 'Item', parent: null } }
    const options = getEffectKeyOptions(effect)
    const curated = global.CONFIG.DCC.activeEffectKeyLabels
    expect(options.length).toBe(Object.keys(curated).length)
    const values = options.map(o => o.value)
    expect(values).toContain('system.class.luckDie')
    expect(values).toContain('system.skills.shieldBash.otherMod')
  })

  test('falls back to the curated list when the actor has no matching fields', () => {
    const effect = { parent: fakeActor({ details: { notes: '' } }) }
    const options = getEffectKeyOptions(effect)
    expect(options.length).toBe(Object.keys(global.CONFIG.DCC.activeEffectKeyLabels).length)
  })
})

describe('onRenderActiveEffectConfig', () => {
  /** Minimal stand-in for a DOM node */
  class FakeNode {
    constructor (tagName) {
      this.tagName = tagName.toUpperCase()
      this.children = []
      this.attributes = {}
      this.className = ''
      this.id = ''
    }

    appendChild (child) {
      this.children.push(child)
      return child
    }

    replaceChildren (...nodes) {
      this.children = nodes
    }

    setAttribute (name, value) {
      this.attributes[name] = value
    }

    getAttribute (name) {
      return this.attributes[name]
    }
  }

  /** Fake app root exposing the two selectors the handler uses */
  function fakeRoot (keyInputs) {
    return {
      children: [],
      appendChild (child) {
        this.children.push(child)
        return child
      },
      querySelector (selector) {
        if (selector.startsWith('datalist')) {
          return this.children.find(c => c.tagName === 'DATALIST') ?? null
        }
        return null
      },
      querySelectorAll (selector) {
        return selector.startsWith('input') ? keyInputs : []
      }
    }
  }

  beforeEach(() => {
    vi.stubGlobal('document', { createElement: tag => new FakeNode(tag) })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('injects a datalist and points key inputs at it', () => {
    const keyInputs = [new FakeNode('input'), new FakeNode('input')]
    const root = fakeRoot(keyInputs)
    const app = { id: 'ActiveEffectConfig-test', document: { parent: fakeActor(playerSystemData) } }

    onRenderActiveEffectConfig(app, root)

    const datalist = root.children.find(c => c.tagName === 'DATALIST')
    expect(datalist).toBeDefined()
    expect(datalist.id).toBe('ActiveEffectConfig-test-effect-key-list')
    expect(datalist.children.length).toBeGreaterThan(0)
    expect(datalist.children.map(o => o.value)).toContain('system.abilities.str.otherMod')
    for (const input of keyInputs) {
      expect(input.getAttribute('list')).toBe('ActiveEffectConfig-test-effect-key-list')
    }
  })

  test('re-render reuses the existing datalist instead of duplicating it', () => {
    const root = fakeRoot([])
    const app = { id: 'ActiveEffectConfig-test', document: { parent: fakeActor(playerSystemData) } }

    onRenderActiveEffectConfig(app, root)
    onRenderActiveEffectConfig(app, root)

    const datalists = root.children.filter(c => c.tagName === 'DATALIST')
    expect(datalists.length).toBe(1)
  })
})
