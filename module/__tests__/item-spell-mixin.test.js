import { describe, test, expect, vi, beforeEach } from 'vitest'
import '../__mocks__/foundry.js'
import SpellItemMixin, { SpellItemMixin as NamedMixin } from '../item/spell-mixin.mjs'
import DCCItem from '../item.js'

vi.mock('../dice-chain.js', () => ({
  default: { bumpDie: vi.fn((die) => die) }
}))
vi.mock('../utilities.js', () => ({
  ensurePlus: vi.fn((value) => (String(value).startsWith('-') ? String(value) : `+${value}`)),
  getFirstDie: vi.fn(() => null)
}))

// Deterministic Roll stub: `new Roll('@value', { value })` resolves total to the
// looked-up value, mirroring the manifestation/mercurial lookup-by-value path.
class FakeRoll {
  constructor (formula, data = {}) {
    this.formula = formula
    this.data = data
    this.total = data.value ?? 0
    this.dice = []
  }

  async evaluate () { this.evaluated = true; return this }
  toMessage (msg) { FakeRoll.lastMessage = msg; return msg }
}

// Phase 7 (Appendix-A item.js shrinkage): the spell-item roll block moved out of
// item.js into item/spell-mixin.mjs. These guards pin the extraction's shape and
// that DCCItem composes it as the OUTERMOST mixin layer, plus behavioral cover
// for hasExistingManifestation / hasExistingMercurialMagic and the
// manifestation / mercurial lookup-and-stow paths — none of which had any prior
// unit coverage. (rollSpellCheck behavior is already covered in item.test.js.)
describe('SpellItemMixin extraction', () => {
  const SPELL_MEMBERS = ['rollSpellCheck', 'hasExistingManifestation', 'hasExistingMercurialMagic', 'rollManifestation', 'rollMercurialMagic']

  describe('composition guards', () => {
    test('default and named exports are the same mixin factory function', () => {
      expect(typeof SpellItemMixin).toBe('function')
      expect(NamedMixin).toBe(SpellItemMixin)
    })

    test('applying the mixin yields a subclass carrying all five spell methods', () => {
      class Base {}
      const Mixed = SpellItemMixin(Base)
      expect(Object.getPrototypeOf(Mixed)).toBe(Base)
      for (const name of SPELL_MEMBERS) {
        expect(typeof Object.getOwnPropertyDescriptor(Mixed.prototype, name).value, `${name} should be a method`).toBe('function')
      }
    })

    test('DCCItem composes all three item mixins — spell + currency + container surfaces coexist', () => {
      const item = new DCCItem({ type: 'spell', name: 'Magic Missile' }, {})
      for (const name of SPELL_MEMBERS) {
        expect(typeof item[name], `DCCItem instance missing spell method: ${name}`).toBe('function')
      }
      expect(typeof item.needsValueRoll).toBe('function') // currency mixin
      expect('canContainItem' in item).toBe(true) // container mixin
    })

    test('SpellItemMixin is the outermost layer (DCCItem -> Spell -> Currency -> Container -> Item)', () => {
      const spellLayer = Object.getPrototypeOf(DCCItem)
      expect(Object.getOwnPropertyDescriptor(spellLayer.prototype, 'rollSpellCheck')).toBeDefined()
      // The spell layer does NOT own the currency/container members.
      expect(Object.getOwnPropertyDescriptor(spellLayer.prototype, 'needsValueRoll')).toBeUndefined()
      expect(Object.getOwnPropertyDescriptor(spellLayer.prototype, 'canContainItem')).toBeUndefined()
    })
  })

  describe('hasExistingManifestation / hasExistingMercurialMagic', () => {
    const makeSpell = (system) => {
      const item = new DCCItem({ type: 'spell', name: 'Probe' }, {})
      item.system = system
      return item
    }

    test('hasExistingManifestation is falsy when neither value nor description is set', () => {
      const item = makeSpell({ manifestation: { value: 0, description: '' } })
      expect(item.hasExistingManifestation()).toBeFalsy()
    })

    test('hasExistingManifestation is truthy when a value is present', () => {
      const item = makeSpell({ manifestation: { value: 42, description: '' } })
      expect(item.hasExistingManifestation()).toBeTruthy()
    })

    test('hasExistingManifestation is truthy when only a description is present', () => {
      const item = makeSpell({ manifestation: { value: 0, description: '<p>A glow</p>' } })
      expect(item.hasExistingManifestation()).toBeTruthy()
    })

    test('hasExistingMercurialMagic is falsy when value/summary/description are all empty', () => {
      const item = makeSpell({ mercurialEffect: { value: 0, summary: '', description: '' } })
      expect(item.hasExistingMercurialMagic()).toBeFalsy()
    })

    test('hasExistingMercurialMagic is truthy when a summary is present', () => {
      const item = makeSpell({ mercurialEffect: { value: 0, summary: 'A spark', description: '' } })
      expect(item.hasExistingMercurialMagic()).toBeTruthy()
    })
  })

  describe('rollManifestation / rollMercurialMagic — type/actor guards and lookup stow', () => {
    let actor
    beforeEach(() => {
      global.Roll = FakeRoll
      global.ChatMessage = { getSpeaker: vi.fn(() => ({})) }
      global.game = {
        settings: { get: vi.fn(() => 'dcc-core-book.dcc-core-spell-side-effect-tables') },
        i18n: { localize: vi.fn((k) => k), format: vi.fn((k) => k) },
        packs: { get: vi.fn(() => null) },
        tables: { getName: vi.fn(() => null), contents: [] }
      }
      global.CONFIG = { DCC: { abilities: { lck: 'DCC.AbilityLck' }, mercurialMagicTables: {}, mercurialMagicTable: null } }
      actor = {
        name: 'Caster',
        system: { abilities: { lck: { value: 13, mod: 1 }, str: {}, agl: {}, sta: {} }, details: {} }
      }
    })

    const makeSpell = () => {
      const item = new DCCItem({ type: 'spell', name: 'Probe Spell' }, {})
      item.update = vi.fn()
      return item
    }

    test('rollManifestation no-ops for a non-spell item', async () => {
      const item = makeSpell()
      Object.defineProperty(item, 'type', { value: 'weapon', configurable: true })
      await item.rollManifestation(7)
      expect(item.update).not.toHaveBeenCalled()
    })

    test('rollManifestation no-ops when the item has no actor', async () => {
      const item = makeSpell()
      item.actor = null
      await item.rollManifestation(7)
      expect(item.update).not.toHaveBeenCalled()
    })

    test('rollManifestation(lookup) stows the looked-up value with no table available', async () => {
      const item = makeSpell()
      item.actor = actor
      await item.rollManifestation(7)
      expect(item.update).toHaveBeenCalledWith({
        'system.manifestation.value': 7,
        'system.manifestation.description': ''
      })
    })

    // Issue #773: manifestation must roll the table's own die (1d4 here), never a
    // hardcoded 1d100 — a d100 lands outside the small table's range and never
    // matches a result.
    test('rollManifestation rolls the manifestation table die, not 1d100', async () => {
      const item = makeSpell()
      item.actor = actor

      const drawnRoll = new FakeRoll('1d4', { value: 3 })
      const table = {
        formula: '1d4',
        draw: vi.fn(async () => ({
          roll: drawnRoll,
          results: [{ description: 'caster glows faintly' }]
        }))
      }
      const entry = { _id: 'tbl1', name: 'Probe Spell Manifestation' }
      global.game.packs = {
        get: vi.fn(() => ({
          index: { find: vi.fn((fn) => (fn(entry) ? entry : undefined)) },
          getDocument: vi.fn(async () => table)
        }))
      }
      const createRoll = vi.fn(async (terms) => new FakeRoll(terms[0].formula, { value: 3 }))
      global.game.dcc = { DCCRoll: { createRoll } }

      await item.rollManifestation()

      expect(createRoll).toHaveBeenCalledTimes(1)
      expect(createRoll.mock.calls[0][0][0].formula).toBe('1d4')
      expect(table.draw).toHaveBeenCalledOnce()
      expect(item.update).toHaveBeenCalledWith(expect.objectContaining({
        'system.manifestation.value': 3,
        'system.manifestation.description': '<p>Caster glows faintly</p>'
      }))
    })

    test('rollMercurialMagic no-ops for a non-spell item', async () => {
      const item = makeSpell()
      Object.defineProperty(item, 'type', { value: 'armor', configurable: true })
      item.actor = actor
      await item.rollMercurialMagic(50)
      expect(item.update).not.toHaveBeenCalled()
    })

    test('rollMercurialMagic(lookup) stows the looked-up value with no table available', async () => {
      const item = makeSpell()
      item.actor = actor
      await item.rollMercurialMagic(55)
      expect(item.update).toHaveBeenCalledWith({
        'system.mercurialEffect.value': 55,
        'system.mercurialEffect.summary': '',
        'system.mercurialEffect.description': ''
      })
    })
  })
})
