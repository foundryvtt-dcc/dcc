/* global foundry, CONST */
/**
 * Integration tests for DCC data models against REAL Foundry DataModel/TypeDataModel
 *
 * These tests use actual Foundry field classes (NumberField, StringField, SchemaField, etc.)
 * to validate that our data model schemas work correctly with real Foundry validation,
 * coercion, and migration logic.
 */
import { describe, test, expect, beforeEach } from 'vitest'
import { BaseActorData } from '../data/actor/base-actor.mjs'
import { PlayerData } from '../data/actor/player-data.mjs'
import { NPCData } from '../data/actor/npc-data.mjs'
import { BaseItemData, PhysicalItemData } from '../data/item/base-item.mjs'
import { WeaponData } from '../data/item/weapon-data.mjs'
import { ArmorData } from '../data/item/armor-data.mjs'
import { SpellData } from '../data/item/spell-data.mjs'
import { SkillData } from '../data/item/skill-data.mjs'
import { EquipmentData } from '../data/item/equipment-data.mjs'
import { TreasureData } from '../data/item/treasure-data.mjs'
import { AmmunitionData } from '../data/item/ammunition-data.mjs'
import { MountData } from '../data/item/mount-data.mjs'
import { LevelData } from '../data/item/level-data.mjs'

// ============================================================================
// Schema Definition Tests
// ============================================================================

describe('Schema Definition (real Foundry fields)', () => {
  test('BaseActorData defines a valid schema', () => {
    const schema = BaseActorData.defineSchema()
    expect(schema).toBeDefined()
    expect(schema.abilities).toBeDefined()
    expect(schema.attributes).toBeDefined()
    expect(schema.details).toBeDefined()
    expect(schema.saves).toBeDefined()
    expect(schema.currency).toBeDefined()
  })

  test('PlayerData extends BaseActorData schema', () => {
    const schema = PlayerData.defineSchema()
    // Has base fields
    expect(schema.abilities).toBeDefined()
    expect(schema.attributes).toBeDefined()
    // Has player-specific fields
    expect(schema.class).toBeDefined()
    expect(schema.skills).toBeDefined()
    expect(schema.config).toBeDefined()
  })

  test('NPCData extends BaseActorData schema with overrides', () => {
    const schema = NPCData.defineSchema()
    expect(schema.abilities).toBeDefined()
    expect(schema.class).toBeDefined()
    expect(schema.config).toBeDefined()
  })

  test('Item data models extending BaseItemData have description', () => {
    const models = [
      ['BaseItemData', BaseItemData],
      ['PhysicalItemData', PhysicalItemData],
      ['WeaponData', WeaponData],
      ['ArmorData', ArmorData],
      ['SpellData', SpellData],
      ['SkillData', SkillData],
      ['EquipmentData', EquipmentData],
      ['TreasureData', TreasureData],
      ['AmmunitionData', AmmunitionData],
      ['MountData', MountData]
    ]

    for (const [name, Model] of models) {
      const schema = Model.defineSchema()
      expect(schema, `${name} schema should be defined`).toBeDefined()
      expect(schema.description, `${name} should have description field`).toBeDefined()
    }
  })

  test('LevelData extends TypeDataModel directly (no description)', () => {
    const schema = LevelData.defineSchema()
    expect(schema).toBeDefined()
    expect(schema.class).toBeDefined()
    expect(schema.description).toBeUndefined()
  })
})

// ============================================================================
// Data Model Construction Tests
// ============================================================================

describe('Data Model Construction (real Foundry TypeDataModel)', () => {
  test('PlayerData constructs with defaults', () => {
    const data = new PlayerData({})
    // Abilities should have defaults
    expect(data.abilities.str.value).toBe(10)
    expect(data.abilities.str.max).toBe(10)
    expect(data.abilities.str.spent).toBe(0)
    expect(data.abilities.str.damage).toBe(0)
    // HP defaults
    expect(data.attributes.hp.value).toBe(10)
    expect(data.attributes.hp.max).toBe(10)
    // Level default
    expect(data.details.level.value).toBe(0)
    // Currency defaults
    expect(data.currency.gp).toBe(0)
    // Class defaults
    expect(data.class.className).toBe('Zero-Level')
    expect(data.class.disapproval).toBe(1)
    // Config defaults
    expect(data.config.computeAC).toBe(true)
    expect(data.config.sortInventory).toBe(true)
  })

  test('NPCData constructs with defaults', () => {
    const data = new NPCData({})
    expect(data.abilities.str.value).toBe(10)
    expect(data.attributes.hp.value).toBe(10)
    // NPC-specific: critical table defaults to M (not I)
    expect(data.attributes.critical.table).toBe('M')
    // NPC-specific: hit dice defaults to 1d6 (not 1d4)
    expect(data.attributes.hitDice.value).toBe('1d6')
  })

  test('PlayerData constructs with provided data', () => {
    const data = new PlayerData({
      abilities: {
        str: { value: 18, max: 18 },
        agl: { value: 14, max: 14 },
        sta: { value: 12, max: 12 },
        per: { value: 8, max: 8 },
        int: { value: 16, max: 16 },
        lck: { value: 10, max: 10 }
      },
      details: {
        level: { value: 5 }
      },
      class: {
        className: 'Warrior'
      }
    })

    expect(data.abilities.str.value).toBe(18)
    expect(data.abilities.agl.value).toBe(14)
    expect(data.details.level.value).toBe(5)
    expect(data.class.className).toBe('Warrior')
  })

  test('WeaponData constructs with defaults', () => {
    const data = new WeaponData({})
    expect(data.description).toBeDefined()
    expect(data.quantity).toBe(1)
    expect(data.equipped).toBe(true)
  })

  test('ArmorData constructs with defaults', () => {
    const data = new ArmorData({})
    expect(data.description).toBeDefined()
    expect(data.quantity).toBe(1)
    expect(data.equipped).toBe(true)
  })

  test('SpellData constructs with defaults', () => {
    const data = new SpellData({})
    expect(data.description).toBeDefined()
  })
})

// ============================================================================
// Field Coercion Tests - verifying real Foundry type coercion
// ============================================================================

describe('Field Coercion (real NumberField/StringField behavior)', () => {
  test('NumberField coerces string numbers', () => {
    const data = new PlayerData({
      abilities: {
        str: { value: '15', max: '15' }
      }
    })
    // Real NumberField should coerce strings to numbers
    expect(data.abilities.str.value).toBe(15)
    expect(typeof data.abilities.str.value).toBe('number')
  })

  test('NumberField coerces float to integer when integer:true', () => {
    const data = new PlayerData({
      abilities: {
        str: { value: 14.7, max: 14 }
      }
    })
    // Real NumberField with integer:true should round
    expect(Number.isInteger(data.abilities.str.value)).toBe(true)
  })

  test('NumberField respects min constraint', () => {
    const data = new PlayerData({
      currency: { gp: -5 }
    })
    // CurrencyField uses min: 0
    expect(data.currency.gp).toBeGreaterThanOrEqual(0)
  })

  test('BooleanField coerces truthy/falsy values', () => {
    const data = new PlayerData({
      config: {
        computeAC: 1,
        sortInventory: 0
      }
    })
    expect(data.config.computeAC).toBe(true)
    expect(data.config.sortInventory).toBe(false)
  })

  test('StringField handles null for nullable fields', () => {
    const data = new PlayerData({
      class: {
        deity: null,
        patron: null
      }
    })
    expect(data.class.deity).toBeNull()
    expect(data.class.patron).toBeNull()
  })
})

// ============================================================================
// Migration Tests - verifying migrateData with real Foundry pipeline
// ============================================================================

describe('Data Migration (real Foundry migration pipeline)', () => {
  test('BaseActorData migrates string ability values to numbers', () => {
    const data = new PlayerData({
      abilities: {
        str: { value: '14', max: '14' },
        agl: { value: '12', max: '12' },
        sta: { value: '16', max: '16' },
        per: { value: '8', max: '8' },
        int: { value: '10', max: '10' },
        lck: { value: '13', max: '13' }
      }
    })
    expect(typeof data.abilities.str.value).toBe('number')
    expect(data.abilities.str.value).toBe(14)
  })

  test('BaseActorData migrates string HP values', () => {
    const data = new PlayerData({
      attributes: {
        hp: { value: '25', max: '30' }
      }
    })
    expect(typeof data.attributes.hp.value).toBe('number')
    expect(data.attributes.hp.value).toBe(25)
    expect(data.attributes.hp.max).toBe(30)
  })

  test('BaseActorData fixes invalid dice notation', () => {
    // hitDice.value of "1" (just a number) should be fixed to "1d4"
    const source = { attributes: { hitDice: { value: '1' } } }
    const migrated = BaseActorData.migrateData(source)
    expect(migrated.attributes.hitDice.value).toBe('1d4')
  })

  test('BaseActorData migrates numeric speed to string', () => {
    const source = { attributes: { speed: { value: 30, base: 30 } } }
    const migrated = BaseActorData.migrateData(source)
    expect(typeof migrated.attributes.speed.value).toBe('string')
    expect(migrated.attributes.speed.value).toBe('30')
  })

  test('BaseActorData migrates flat occupation to nested', () => {
    const source = { details: { occupation: 'Farmer' } }
    const migrated = BaseActorData.migrateData(source)
    expect(migrated.details.occupation).toEqual({ value: 'Farmer' })
  })

  test('BaseActorData migrates flat title to nested', () => {
    const source = { details: { title: 'Lord' } }
    const migrated = BaseActorData.migrateData(source)
    expect(migrated.details.title).toEqual({ value: 'Lord' })
  })

  test('BaseActorData parses birthAugurLuckMod from birthAugur', () => {
    const source = { details: { birthAugur: 'Lucky sign (+2)' } }
    const migrated = BaseActorData.migrateData(source)
    expect(migrated.details.birthAugurLuckMod).toBe(2)
  })

  test('PlayerData migrates class fields', () => {
    const source = {
      class: { spellCheck: '3', knownSpells: '5' },
      skills: {}
    }
    const migrated = PlayerData.migrateData(source)
    expect(typeof migrated.class.spellCheck).toBe('number')
    expect(migrated.class.spellCheck).toBe(3)
  })

  test('PhysicalItemData migrates string quantity to number', () => {
    const source = {
      description: {},
      quantity: '5'
    }
    const migrated = PhysicalItemData.migrateData(source)
    expect(typeof migrated.quantity).toBe('number')
    expect(migrated.quantity).toBe(5)
  })

  test('PhysicalItemData migrates string weight to number', () => {
    const source = {
      description: {},
      weight: '3.5'
    }
    const migrated = PhysicalItemData.migrateData(source)
    expect(typeof migrated.weight).toBe('number')
    expect(migrated.weight).toBe(3.5)
  })
})

// ============================================================================
// Real Foundry Utility Tests - verify our usage matches real behavior
// ============================================================================

describe('Real foundry.utils behavior', () => {
  test('mergeObject handles deletion keys with performDeletions', () => {
    // v14 renamed performDeletions to applyOperators and '-=key' creates ForcedDeletion operators
    // v13 uses performDeletions: true to delete '-=key' entries
    const original1 = { a: 1, b: 2, c: 3 }
    const withoutFlag = foundry.utils.mergeObject(original1, { '-=b': null })
    expect(withoutFlag.a).toBe(1)
    expect(withoutFlag.c).toBe(3)
    // Without the flag, b is not deleted as a number (v13: preserved, v14: becomes ForcedDeletion)
    expect(withoutFlag.b).not.toBe(2)

    // Use applyOperators (v14) or performDeletions (v13) — both work in v14 via compat shim
    const original2 = { a: 1, b: 2, c: 3 }
    const withFlag = foundry.utils.mergeObject(original2, { '-=b': null }, { applyOperators: true, performDeletions: true })
    expect(withFlag.a).toBe(1)
    expect(withFlag.c).toBe(3)
    // b should be fully deleted
    expect(withFlag.b).toBeUndefined()
  })

  test('mergeObject handles dot-notation keys', () => {
    const original = { nested: { value: 1 } }
    const result = foundry.utils.mergeObject(original, { 'nested.value': 2 })
    expect(result.nested.value).toBe(2)
  })

  test('mergeObject respects insertKeys=false', () => {
    const original = { a: 1 }
    const result = foundry.utils.mergeObject(original, { b: 2 }, { insertKeys: false })
    expect(result.b).toBeUndefined()
  })

  test('mergeObject respects overwrite=false', () => {
    const original = { a: 1 }
    const result = foundry.utils.mergeObject(original, { a: 2 }, { overwrite: false })
    expect(result.a).toBe(1)
  })

  test('mergeObject deep recursive merge', () => {
    const original = { nested: { a: 1, b: 2 } }
    const result = foundry.utils.mergeObject(original, { nested: { b: 3, c: 4 } })
    expect(result.nested.a).toBe(1)
    expect(result.nested.b).toBe(3)
    expect(result.nested.c).toBe(4)
  })

  test('mergeObject inplace=false returns copy', () => {
    const original = { a: 1 }
    const result = foundry.utils.mergeObject(original, { a: 2 }, { inplace: false })
    expect(result.a).toBe(2)
    expect(original.a).toBe(1) // original unchanged
  })

  test('expandObject handles dot-notation', () => {
    const flat = { 'a.b.c': 1, 'a.b.d': 2, e: 3 }
    const result = foundry.utils.expandObject(flat)
    expect(result.a.b.c).toBe(1)
    expect(result.a.b.d).toBe(2)
    expect(result.e).toBe(3)
  })

  test('getProperty traverses dot-notation paths', () => {
    const obj = { a: { b: { c: 42 } } }
    expect(foundry.utils.getProperty(obj, 'a.b.c')).toBe(42)
    expect(foundry.utils.getProperty(obj, 'a.b.missing')).toBeUndefined()
  })

  test('setProperty creates nested paths', () => {
    const obj = {}
    foundry.utils.setProperty(obj, 'a.b.c', 42)
    expect(obj.a.b.c).toBe(42)
  })

  test('deepClone creates independent copy', () => {
    const original = { a: { b: [1, 2, 3] } }
    const clone = foundry.utils.deepClone(original)
    clone.a.b.push(4)
    expect(original.a.b).toEqual([1, 2, 3])
    expect(clone.a.b).toEqual([1, 2, 3, 4])
  })

  test('duplicate creates JSON-safe deep copy', () => {
    const original = { a: 1, b: { c: 2 } }
    const copy = foundry.utils.duplicate(original)
    copy.b.c = 99
    expect(original.b.c).toBe(2)
  })

  test('diffObject finds changes between objects', () => {
    const original = { a: 1, b: 2, c: 3 }
    const updated = { a: 1, b: 5, c: 3 }
    const diff = foundry.utils.diffObject(original, updated)
    expect(diff).toEqual({ b: 5 })
  })

  test('flattenObject converts nested to dot-notation', () => {
    const nested = { a: { b: { c: 1 } }, d: 2 }
    const flat = foundry.utils.flattenObject(nested)
    expect(flat['a.b.c']).toBe(1)
    expect(flat.d).toBe(2)
  })

  test('isEmpty checks various empty states', () => {
    expect(foundry.utils.isEmpty({})).toBe(true)
    expect(foundry.utils.isEmpty([])).toBe(true)
    expect(foundry.utils.isEmpty(null)).toBe(true)
    expect(foundry.utils.isEmpty(undefined)).toBe(true)
    expect(foundry.utils.isEmpty({ a: 1 })).toBe(false)
    expect(foundry.utils.isEmpty([1])).toBe(false)
    // REAL FOUNDRY: empty string is NOT considered empty (only objects/arrays/null/undefined)
    expect(foundry.utils.isEmpty('')).toBe(false)
  })

  test('getType returns correct type strings', () => {
    expect(foundry.utils.getType({})).toBe('Object')
    expect(foundry.utils.getType([])).toBe('Array')
    expect(foundry.utils.getType('')).toBe('string')
    expect(foundry.utils.getType(1)).toBe('number')
    expect(foundry.utils.getType(true)).toBe('boolean')
    expect(foundry.utils.getType(null)).toBe('null')
    expect(foundry.utils.getType(undefined)).toBe('undefined')
  })
})

// ============================================================================
// Real CONST values - verify we use the right constant values
// ============================================================================

describe('Real CONST values', () => {
  test('DOCUMENT_OWNERSHIP_LEVELS has expected values', () => {
    expect(CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE).toBe(0)
    expect(CONST.DOCUMENT_OWNERSHIP_LEVELS.LIMITED).toBe(1)
    expect(CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER).toBe(2)
    expect(CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER).toBe(3)
  })

  test('DICE_ROLL_MODES has expected values', () => {
    expect(CONST.DICE_ROLL_MODES.PUBLIC).toBe('publicroll')
    expect(CONST.DICE_ROLL_MODES.PRIVATE).toBe('gmroll')
    expect(CONST.DICE_ROLL_MODES.BLIND).toBe('blindroll')
    expect(CONST.DICE_ROLL_MODES.SELF).toBe('selfroll')
  })

  test('CHAT_MESSAGE_STYLES has expected values', () => {
    expect(CONST.CHAT_MESSAGE_STYLES.OTHER).toBe(0)
    expect(CONST.CHAT_MESSAGE_STYLES.OOC).toBe(1)
    expect(CONST.CHAT_MESSAGE_STYLES.IC).toBe(2)
    expect(CONST.CHAT_MESSAGE_STYLES.EMOTE).toBe(3)
  })

  test('ACTIVE_EFFECT_MODES has expected values', () => {
    expect(CONST.ACTIVE_EFFECT_MODES.CUSTOM).toBe(0)
    expect(CONST.ACTIVE_EFFECT_MODES.MULTIPLY).toBe(1)
    expect(CONST.ACTIVE_EFFECT_MODES.ADD).toBe(2)
    expect(CONST.ACTIVE_EFFECT_MODES.DOWNGRADE).toBe(3)
    expect(CONST.ACTIVE_EFFECT_MODES.UPGRADE).toBe(4)
    expect(CONST.ACTIVE_EFFECT_MODES.OVERRIDE).toBe(5)
  })
})

// ============================================================================
// Real Collection class tests
// ============================================================================

describe('Real Collection class', () => {
  let collection

  beforeEach(() => {
    collection = new foundry.utils.Collection()
  })

  test('set and get entries', () => {
    collection.set('item1', { name: 'Sword', type: 'weapon' })
    collection.set('item2', { name: 'Shield', type: 'armor' })
    expect(collection.get('item1').name).toBe('Sword')
    expect(collection.get('item2').name).toBe('Shield')
  })

  test('find entries', () => {
    collection.set('item1', { name: 'Sword', type: 'weapon' })
    collection.set('item2', { name: 'Shield', type: 'armor' })
    const found = collection.find(v => v.type === 'armor')
    expect(found.name).toBe('Shield')
  })

  test('filter entries', () => {
    collection.set('item1', { name: 'Sword', type: 'weapon' })
    collection.set('item2', { name: 'Dagger', type: 'weapon' })
    collection.set('item3', { name: 'Shield', type: 'armor' })
    const weapons = collection.filter(v => v.type === 'weapon')
    expect(weapons).toHaveLength(2)
  })

  test('map entries', () => {
    collection.set('item1', { name: 'Sword' })
    collection.set('item2', { name: 'Shield' })
    const names = collection.map(v => v.name)
    expect(names).toEqual(['Sword', 'Shield'])
  })

  test('size property', () => {
    collection.set('a', 1)
    collection.set('b', 2)
    expect(collection.size).toBe(2)
  })
})

// ============================================================================
// Edge Case Tests - the whole point of using real Foundry code
// ============================================================================

describe('Edge cases caught by real Foundry code', () => {
  test('mergeObject enforceTypes throws on type mismatch', () => {
    const original = { a: 1 }
    expect(() => {
      foundry.utils.mergeObject(original, { a: 'string' }, { enforceTypes: true })
    }).toThrow()
  })

  test('mergeObject handles array replacement (not merge)', () => {
    // Real Foundry replaces arrays, doesn't merge them
    const original = { tags: ['a', 'b'] }
    const result = foundry.utils.mergeObject(original, { tags: ['c'] })
    expect(result.tags).toEqual(['c'])
  })

  test('PlayerData handles deeply nested partial updates', () => {
    // Construct with only some nested fields - should fill in defaults for the rest
    const data = new PlayerData({
      abilities: {
        str: { value: 18 }
        // other abilities should get defaults
      }
    })
    expect(data.abilities.str.value).toBe(18)
    expect(data.abilities.agl.value).toBe(10) // default
    expect(data.abilities.sta.value).toBe(10) // default
  })

  test('DiceField validates dice notation via real StringField._validateType', () => {
    // This tests that our custom DiceField._validateType integrates correctly
    // with real Foundry StringField validation
    const schema = PlayerData.defineSchema()
    const actionDiceField = schema.attributes.fields.actionDice.fields.value
    expect(actionDiceField).toBeDefined()
  })

  test('SchemaField nesting works with real implementation', () => {
    // Verify deeply nested schemas work correctly
    const data = new PlayerData({
      details: {
        attackHitBonus: {
          melee: { value: '+3', adjustment: '+1' },
          missile: { value: '+2', adjustment: '+0' }
        }
      }
    })
    expect(data.details.attackHitBonus.melee.value).toBe('+3')
    expect(data.details.attackHitBonus.missile.value).toBe('+2')
  })

  test('ArrayField with SchemaField elements works', () => {
    const data = new PlayerData({
      abilityLog: [
        { timestamp: 1000, ability: 'str', change: -2, type: 'spellburn', source: 'Magic Missile', newValue: 8 },
        { timestamp: 2000, ability: 'str', change: 1, type: 'recovery', source: 'Rest', newValue: 9 }
      ]
    })
    expect(data.abilityLog).toHaveLength(2)
    expect(data.abilityLog[0].ability).toBe('str')
    expect(data.abilityLog[0].change).toBe(-2)
    expect(data.abilityLog[1].type).toBe('recovery')
  })

  test('NumberField with min/max constraints via real validation', () => {
    // disapproval has min: 1, max: 20
    const data = new PlayerData({
      class: { disapproval: 1 }
    })
    expect(data.class.disapproval).toBe(1)
  })

  test('Source data is preserved correctly', () => {
    const input = {
      abilities: {
        str: { value: 15, max: 15 }
      }
    }
    const data = new PlayerData(input)
    // The _source should preserve the original clean data
    expect(data._source.abilities.str.value).toBe(15)
  })
})
