import { describe, test, expect, vi, beforeEach } from 'vitest'
import '../__mocks__/foundry.js'
import SpellItemMixin, { SpellItemMixin as NamedMixin } from '../item/spell-mixin.mjs'
import DCCItem from '../item.js'

vi.mock('../dice-chain.js', () => ({
  default: { bumpDie: vi.fn((die) => die) }
}))
vi.mock('../utilities.js', async (importOriginal) => ({
  ensurePlus: vi.fn((value) => (String(value).startsWith('-') ? String(value) : `+${value}`)),
  getFirstDie: vi.fn(() => null),
  // Real implementation — the special (roll-again) expansion tests below
  // exercise its flag/text detection through rollMercurialMagic (#339)
  getMercurialSpecial: (await importOriginal()).getMercurialSpecial
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

    // Issue #773 follow-up (Invisibility): many DCC spells have no manifestation
    // at all, so no `<name> Manifestation` table ships. Rolling one must warn and
    // stow nothing — never fall through to a meaningless 1d100 that stores a bogus
    // value (e.g. 79) with an empty description.
    test('rollManifestation with no table warns and stows nothing (does not roll 1d100)', async () => {
      const item = makeSpell()
      item.actor = actor
      // No pack, no world table → no manifestation table for this spell.
      const createRoll = vi.fn()
      global.game.dcc = { DCCRoll: { createRoll } }

      await item.rollManifestation()

      expect(global.ui.notifications.warn).toHaveBeenCalledWith('DCC.NoManifestationTableWarning')
      expect(createRoll).not.toHaveBeenCalled()
      expect(item.update).not.toHaveBeenCalled()
    })

    // Issue #773: manifestation must roll the table's own die (1d4 here), never a
    // hardcoded 1d100 — a d100 lands outside the small table's range and never
    // matches a result. This table exposes no result ranges, so the die falls
    // back to the table's own `formula`.
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

    // Issue #773 follow-up (Locotomo, "still doesn't work"): a manifestation
    // table whose `formula` (1d100) can roll far past its actual rows (1..4)
    // must still be rolled on a die sized to its ranges (1d4), otherwise the
    // roll lands outside the table, `table.draw` matches nothing, and the user
    // is back to the original "always rolls d100, no manifestation" symptom.
    // The die must be derived from the result ranges, NOT trusted from `formula`.
    test('rollManifestation sizes the die to the table ranges, ignoring an oversized formula', async () => {
      const item = makeSpell()
      item.actor = actor

      const drawnRoll = new FakeRoll('1d4', { value: 2 })
      const table = {
        // Stray core-book formula that can roll past the manifestation rows.
        formula: '1d100',
        // Rows only cover 1..4 — this is what draws must land within.
        results: {
          contents: [
            { range: [1, 1], description: 'a' },
            { range: [2, 2], description: 'caster glows faintly' },
            { range: [3, 3], description: 'c' },
            { range: [4, 4], description: 'd' }
          ]
        },
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
      const createRoll = vi.fn(async (terms) => new FakeRoll(terms[0].formula, { value: 2 }))
      global.game.dcc = { DCCRoll: { createRoll } }

      await item.rollManifestation()

      // Rolled on 1d4 (derived from ranges), NOT the table's stray 1d100.
      expect(createRoll.mock.calls[0][0][0].formula).toBe('1d4')
      expect(table.draw).toHaveBeenCalledOnce()
      expect(item.update).toHaveBeenCalledWith(expect.objectContaining({
        'system.manifestation.value': 2,
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

  // Issue #339 — special (roll-again) mercurial table entries expand into
  // real sub-rolls instead of storing the literal instruction text.
  describe('rollMercurialMagic — special (roll-again) expansion', () => {
    let actor
    beforeEach(() => {
      global.Roll = FakeRoll
      global.ChatMessage = { getSpeaker: vi.fn(() => ({})) }
      global.game = {
        settings: { get: vi.fn(() => null) },
        i18n: { localize: vi.fn((k) => k), format: vi.fn((k) => k) },
        packs: { get: vi.fn(() => null) },
        tables: { getName: vi.fn(() => null), contents: [] }
      }
      global.CONFIG = { DCC: { abilities: { lck: 'DCC.AbilityLck' }, mercurialMagicTables: {}, mercurialMagicTable: 'Table 5-2: Mercurial Magic' } }
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

    /**
     * Build a world table whose draw() serves the given results in order,
     * echoing back the roll it was handed.
     */
    const makeTable = (resultQueue) => {
      let i = 0
      return {
        name: 'Table 5-2: Mercurial Magic',
        draw: vi.fn(async ({ roll }) => {
          const result = resultQueue[Math.min(i, resultQueue.length - 1)]
          i++
          if (!roll.evaluated) { await roll.evaluate() }
          return { roll, results: [result] }
        })
      }
    }

    /** DCCRoll stub: totals served in sequence, keyed off the Die term. */
    const makeCreateRoll = (totals) => {
      let i = 0
      return vi.fn(async (terms) => {
        const total = totals[Math.min(i, totals.length - 1)]
        i++
        return new FakeRoll(terms[0].formula, { value: total })
      })
    }

    test('a flagged rollAgain entry expands into two labeled sub-effects', async () => {
      const item = makeSpell()
      item.actor = actor

      const table = makeTable([
        { description: 'Roll again twice.', flags: { dcc: { mercurial: { action: 'rollAgain', count: 2 } } } },
        { description: 'Turbulent magic. Winds whip around the caster.' },
        { description: 'Cannibal magic. The spell consumes other magic.' }
      ])
      global.game.tables.getName = vi.fn(() => table)
      // Trigger roll 99, then sub-rolls 45 and 70
      global.game.dcc = { DCCRoll: { createRoll: makeCreateRoll([99, 45, 70]) } }

      await item.rollMercurialMagic()

      // Trigger draw + two sub-draws on the same table
      expect(table.draw).toHaveBeenCalledTimes(3)
      // Sub-rolls used the default d100 die with the luck modifier term
      const subTerms = global.game.dcc.DCCRoll.createRoll.mock.calls[1][0]
      expect(subTerms[0].formula).toBe('1d100')
      expect(subTerms[1].formula).toBe('+10')
      expect(item.update).toHaveBeenCalledWith({
        'system.mercurialEffect.value': 99,
        'system.mercurialEffect.summary': 'Turbulent magic; Cannibal magic',
        'system.mercurialEffect.description':
          '<p><strong>(45)</strong> Turbulent magic. Winds whip around the caster.</p>' +
          '<p><strong>(70)</strong> Cannibal magic. The spell consumes other magic.</p>'
      })
    })

    test('the 4d20 variant rolls sub-rolls on the flagged formula', async () => {
      const item = makeSpell()
      item.actor = actor

      const table = makeTable([
        { description: 'Roll again twice, but with 4d20.', flags: { dcc: { mercurial: { action: 'rollAgain', count: 2, formula: '4d20' } } } },
        { description: 'Blue aura. A shimmering aura.' },
        { description: 'Blue aura. A shimmering aura.' }
      ])
      global.game.tables.getName = vi.fn(() => table)
      global.game.dcc = { DCCRoll: { createRoll: makeCreateRoll([120, 40, 50]) } }

      await item.rollMercurialMagic()

      const calls = global.game.dcc.DCCRoll.createRoll.mock.calls
      expect(calls[1][0][0].formula).toBe('4d20')
      expect(calls[2][0][0].formula).toBe('4d20')
      expect(item.update).toHaveBeenCalledWith(expect.objectContaining({
        'system.mercurialEffect.value': 120,
        'system.mercurialEffect.summary': 'Blue aura; Blue aura'
      }))
    })

    test('the un-flagged core text form expands via the legacy fallback', async () => {
      const item = makeSpell()
      item.actor = actor

      const table = makeTable([
        { description: 'Roll again twice.' },
        { description: 'Turbulent magic. Winds.' },
        { description: 'Cannibal magic. Consumes.' }
      ])
      global.game.tables.getName = vi.fn(() => table)
      global.game.dcc = { DCCRoll: { createRoll: makeCreateRoll([99, 45, 70]) } }

      await item.rollMercurialMagic()

      expect(table.draw).toHaveBeenCalledTimes(3)
      expect(item.update).toHaveBeenCalledWith(expect.objectContaining({
        'system.mercurialEffect.summary': 'Turbulent magic; Cannibal magic'
      }))
    })

    test('an ordinary entry stows the literal text unchanged', async () => {
      const item = makeSpell()
      item.actor = actor

      const table = makeTable([
        { description: 'Turbulent magic. Winds whip around the caster.' }
      ])
      global.game.tables.getName = vi.fn(() => table)
      global.game.dcc = { DCCRoll: { createRoll: makeCreateRoll([45]) } }

      await item.rollMercurialMagic()

      expect(table.draw).toHaveBeenCalledTimes(1)
      expect(item.update).toHaveBeenCalledWith({
        'system.mercurialEffect.value': 45,
        'system.mercurialEffect.summary': 'Turbulent magic',
        'system.mercurialEffect.description': '<p>Turbulent magic. Winds whip around the caster.</p>'
      })
    })

    test('a nested special expands recursively', async () => {
      const item = makeSpell()
      item.actor = actor

      const table = makeTable([
        { description: 'Roll again twice.', flags: { dcc: { mercurial: { action: 'rollAgain', count: 2 } } } },
        // First sub-roll lands on the special again...
        { description: 'Roll again twice.', flags: { dcc: { mercurial: { action: 'rollAgain', count: 2 } } } },
        // ...expanding to two nested effects, then the second sub-roll
        { description: 'Turbulent magic. Winds.' },
        { description: 'Cannibal magic. Consumes.' },
        { description: 'Breath of the fish. Underwater.' }
      ])
      global.game.tables.getName = vi.fn(() => table)
      global.game.dcc = { DCCRoll: { createRoll: makeCreateRoll([99, 99, 45, 70, 20]) } }

      await item.rollMercurialMagic()

      expect(table.draw).toHaveBeenCalledTimes(5)
      expect(item.update).toHaveBeenCalledWith(expect.objectContaining({
        'system.mercurialEffect.summary': 'Turbulent magic; Cannibal magic; Breath of the fish',
        'system.mercurialEffect.description':
          '<p><strong>(45)</strong> Turbulent magic. Winds.</p>' +
          '<p><strong>(70)</strong> Cannibal magic. Consumes.</p>' +
          '<p><strong>(20)</strong> Breath of the fish. Underwater.</p>'
      }))
    })

    test('a table that always rolls the special stops at the depth cap', async () => {
      const item = makeSpell()
      item.actor = actor

      // Every draw returns the special — without the cap this recurses forever
      const specialResult = { description: 'Roll again twice.', flags: { dcc: { mercurial: { action: 'rollAgain', count: 2 } } } }
      const table = makeTable([specialResult])
      global.game.tables.getName = vi.fn(() => table)
      global.game.dcc = { DCCRoll: { createRoll: makeCreateRoll([99]) } }

      await item.rollMercurialMagic()

      // Depth cap 5 with count 2: 2^5 = 32 leaf draws + 31 expansions above
      // them = a bounded call count, and the leaves store the literal text
      expect(table.draw.mock.calls.length).toBeLessThanOrEqual(63)
      const updates = item.update.mock.calls[0][0]
      expect(updates['system.mercurialEffect.summary']).toContain('Roll again twice')
    })

    test('a sub-roll landing outside the table keeps the other sub-effects', async () => {
      const item = makeSpell()
      item.actor = actor

      // Second sub-draw misses the table (empty results) — the first
      // sub-effect and the labeled miss must both survive, not be wiped
      // by a TypeError unwinding into the outer catch.
      let drawCount = 0
      const table = {
        name: 'Table 5-2: Mercurial Magic',
        draw: vi.fn(async ({ roll }) => {
          drawCount++
          if (!roll.evaluated) { await roll.evaluate() }
          if (drawCount === 1) {
            return { roll, results: [{ description: 'Roll again twice.', flags: { dcc: { mercurial: { action: 'rollAgain', count: 2 } } } }] }
          }
          if (drawCount === 2) {
            return { roll, results: [{ description: 'Turbulent magic. Winds.' }] }
          }
          return { roll, results: [] }
        })
      }
      global.game.tables.getName = vi.fn(() => table)
      global.game.i18n.format = vi.fn((k, data) => `${k}:${data.roll}`)
      global.game.dcc = { DCCRoll: { createRoll: makeCreateRoll([99, 45, -30]) } }

      await item.rollMercurialMagic()

      expect(item.update).toHaveBeenCalledWith(expect.objectContaining({
        'system.mercurialEffect.summary': 'Turbulent magic; DCC.MercurialMagicNoResult:-30',
        'system.mercurialEffect.description':
          '<p><strong>(45)</strong> Turbulent magic. Winds.</p>' +
          '<p>DCC.MercurialMagicNoResult:-30</p>'
      }))
    })

    test('lookup of a special value expands with real sub-rolls', async () => {
      const item = makeSpell()
      item.actor = actor

      const table = makeTable([
        { description: 'Roll again twice.', flags: { dcc: { mercurial: { action: 'rollAgain', count: 2 } } } },
        { description: 'Turbulent magic. Winds.' },
        { description: 'Cannibal magic. Consumes.' }
      ])
      global.game.tables.getName = vi.fn(() => table)
      global.game.dcc = { DCCRoll: { createRoll: makeCreateRoll([45, 70]) } }

      await item.rollMercurialMagic(99)

      // The trigger draw used the looked-up value; both sub-draws rolled
      expect(table.draw).toHaveBeenCalledTimes(3)
      expect(global.game.dcc.DCCRoll.createRoll).toHaveBeenCalledTimes(2)
      expect(item.update).toHaveBeenCalledWith(expect.objectContaining({
        'system.mercurialEffect.value': 99,
        'system.mercurialEffect.summary': 'Turbulent magic; Cannibal magic'
      }))
    })
  })
})
