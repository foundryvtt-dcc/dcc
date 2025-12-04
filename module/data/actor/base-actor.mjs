/* global foundry, Hooks */
/**
 * Base data model for all DCC actors
 * Contains the common template fields shared by all actor types
 */
import { AbilityField, CurrencyField, DiceField, SaveField, isValidDiceNotation } from '../fields/_module.mjs'

const { SchemaField, StringField, NumberField, ArrayField, HTMLField } = foundry.data.fields

/**
 * Base actor data with common fields
 * Maps to template.json "common" template
 */
export class BaseActorData extends foundry.abstract.TypeDataModel {
  /**
   * Migrate source data to handle legacy formats
   * @param {object} source - Raw source data
   * @returns {object} - Migrated data
   */
  static migrateData (source) {
    // Convert string ability values to numbers if needed
    if (source.abilities) {
      for (const key of ['str', 'agl', 'sta', 'per', 'int', 'lck']) {
        if (source.abilities[key]) {
          if (typeof source.abilities[key].value === 'string') {
            source.abilities[key].value = parseInt(source.abilities[key].value) || 10
          }
          if (typeof source.abilities[key].max === 'string') {
            source.abilities[key].max = parseInt(source.abilities[key].max) || 10
          }
        }
      }
    }

    // Convert string HP values to numbers if needed
    if (source.attributes?.hp) {
      for (const key of ['value', 'min', 'max', 'temp', 'tempmax']) {
        if (typeof source.attributes.hp[key] === 'string') {
          source.attributes.hp[key] = parseInt(source.attributes.hp[key]) || 0
        }
      }
    }

    // Fix invalid dice notation in attributes
    // hitDice.value might be just a number like "1" for zero-level
    if (source.attributes?.hitDice?.value) {
      if (!isValidDiceNotation(source.attributes.hitDice.value)) {
        // If it's just a number, convert to 1d4 (zero-level default)
        source.attributes.hitDice.value = '1d4'
      }
    }

    // Fix invalid critical die notation
    if (source.attributes?.critical?.die) {
      if (!isValidDiceNotation(source.attributes.critical.die)) {
        source.attributes.critical.die = '1d4'
      }
    }

    // Fix invalid fumble die notation
    if (source.attributes?.fumble?.die) {
      if (!isValidDiceNotation(source.attributes.fumble.die)) {
        source.attributes.fumble.die = '1d4'
      }
    }

    // Fix invalid init die notation
    if (source.attributes?.init?.die) {
      if (!isValidDiceNotation(source.attributes.init.die)) {
        source.attributes.init.die = '1d20'
      }
    }

    // Convert numeric speed values to strings if needed (speed can include units like "30'")
    if (source.attributes?.speed) {
      for (const key of ['value', 'base', 'swim', 'fly']) {
        if (source.attributes.speed[key] !== undefined && typeof source.attributes.speed[key] === 'number') {
          source.attributes.speed[key] = String(source.attributes.speed[key])
        }
      }
    }

    // Convert string level value to number if needed
    if (source.details?.level && typeof source.details.level.value === 'string') {
      source.details.level.value = parseInt(source.details.level.value) || 0
    }

    // Migrate flat occupation string to nested { value } structure
    if (source.details && typeof source.details.occupation === 'string') {
      source.details.occupation = { value: source.details.occupation }
    }

    // Migrate flat title string to nested { value } structure
    if (source.details && typeof source.details.title === 'string') {
      source.details.title = { value: source.details.title }
    }

    // Parse birthAugurLuckMod from birthAugur string if not already set
    if (source.details?.birthAugur && !source.details.birthAugurLuckMod) {
      // Match patterns like "(+2)", "(-1)", "(+0)" at the end of the string
      const match = source.details.birthAugur.match(/\(([+-]?\d+)\)\s*$/)
      if (match) {
        source.details.birthAugurLuckMod = parseInt(match[1]) || 0
      }
    }

    return super.migrateData(source)
  }

  static defineSchema () {
    const schema = {
      // Abilities
      abilities: new SchemaField({
        str: new AbilityField({ label: 'DCC.AbilityStr' }),
        agl: new AbilityField({ label: 'DCC.AbilityAgl' }),
        sta: new AbilityField({ label: 'DCC.AbilitySta' }),
        per: new AbilityField({ label: 'DCC.AbilityPer' }),
        int: new AbilityField({ label: 'DCC.AbilityInt' }),
        lck: new AbilityField({ label: 'DCC.AbilityLck' })
      }),

      // Ability change log - tracks spellburn, luck spend, damage, recovery, etc.
      abilityLog: new ArrayField(new SchemaField({
        timestamp: new NumberField({ integer: true }), // Unix timestamp
        ability: new StringField(), // str, agl, sta, per, int, lck
        change: new NumberField({ integer: true }), // positive = gain, negative = loss
        type: new StringField(), // spellburn, damage, recovery, heal, award, spend
        source: new StringField(), // spell name, monster, etc.
        newValue: new NumberField({ integer: true }) // value after change
      }), { initial: [] }),

      // Attributes
      attributes: new SchemaField({
        ac: new SchemaField({
          value: new NumberField({ initial: 10, integer: true }),
          checkPenalty: new NumberField({ initial: 0, integer: true }),
          otherMod: new NumberField({ initial: 0, integer: true }),
          speedPenalty: new NumberField({ initial: 0, integer: true })
        }),
        actionDice: new SchemaField({
          value: new DiceField({ initial: '1d20' }),
          options: new ArrayField(new SchemaField({
            value: new StringField({ initial: '1d20' }),
            label: new StringField({ initial: '1d20' })
          }), {
            initial: [{ value: '1d20', label: '1d20' }]
          })
        }),
        critical: new SchemaField({
          die: new DiceField({ initial: '1d4' }),
          table: new StringField({ initial: 'I' })
        }),
        fumble: new SchemaField({
          die: new DiceField({ initial: '1d4' })
        }),
        hitDice: new SchemaField({
          value: new DiceField({ initial: '1d4' })
        }),
        hp: new SchemaField({
          value: new NumberField({ initial: 10, integer: true }),
          min: new NumberField({ initial: 0, integer: true }),
          max: new NumberField({ initial: 10, integer: true }),
          temp: new NumberField({ initial: 0, integer: true }),
          tempmax: new NumberField({ initial: 0, integer: true })
        }),
        init: new SchemaField({
          die: new DiceField({ initial: '1d20' }),
          otherMod: new NumberField({ initial: 0, integer: true }),
          value: new StringField({ initial: '+0' })
        }),
        initDice: new SchemaField({
          value: new DiceField({ initial: '1d20' }),
          options: new ArrayField(new SchemaField({
            value: new StringField({ initial: '1d20' }),
            label: new StringField({ initial: '1d20' })
          }), {
            initial: [
              { value: '1d20', label: '1d20' },
              { value: '1d16', label: '1d16' }
            ]
          })
        }),
        speed: new SchemaField({
          value: new StringField({ initial: '30' }), // Can include units like "30'" or "25/50/100"
          base: new StringField({ initial: '30' }), // Can include units
          special: new StringField({ initial: '' }),
          swim: new StringField({ initial: '' }), // Can include units
          fly: new StringField({ initial: '' }) // Can include units
        })
      }),

      // Details
      details: new SchemaField({
        alignment: new StringField({ initial: 'l' }),
        attackBonus: new StringField({ initial: '+0' }),
        attackHitBonus: new SchemaField({
          melee: new SchemaField({
            value: new StringField({ initial: '+0' }),
            adjustment: new StringField({ initial: '+0' })
          }),
          missile: new SchemaField({
            value: new StringField({ initial: '+0' }),
            adjustment: new StringField({ initial: '+0' })
          })
        }),
        attackDamageBonus: new SchemaField({
          melee: new SchemaField({
            value: new StringField({ initial: '+0' }),
            adjustment: new StringField({ initial: '+0' })
          }),
          missile: new SchemaField({
            value: new StringField({ initial: '+0' }),
            adjustment: new StringField({ initial: '+0' })
          })
        }),
        birthAugur: new StringField({ initial: '' }),
        birthAugurLuckMod: new NumberField({ initial: 0, integer: true }),
        critRange: new StringField({ initial: '20' }),
        languages: new StringField({ initial: '' }),
        level: new SchemaField({
          value: new NumberField({ initial: 0, integer: true, min: 0 })
        }),
        occupation: new SchemaField({
          value: new StringField({ initial: '' })
        }),
        notes: new SchemaField({
          value: new HTMLField({ initial: '' })
        }),
        title: new SchemaField({
          value: new StringField({ initial: '' })
        }),
        xp: new SchemaField({
          value: new NumberField({ initial: 0, integer: true, min: 0 }),
          min: new NumberField({ initial: 0, integer: true }),
          max: new NumberField({ initial: 10, integer: true })
        })
      }),

      // Saves
      saves: new SchemaField({
        frt: new SaveField({
          label: 'DCC.SavesFortitude',
          abbreviation: 'DCC.SavesFortitudeAbbr'
        }),
        ref: new SaveField({
          label: 'DCC.SavesReflex',
          abbreviation: 'DCC.SavesReflexAbbr'
        }),
        wil: new SaveField({
          label: 'DCC.SavesWill',
          abbreviation: 'DCC.SavesWillAbbr'
        })
      }),

      // Currency
      currency: new CurrencyField()
    }

    /**
     * Allow modules to extend the base actor schema by adding fields to existing SchemaFields
     * or adding entirely new top-level fields. This hook runs for all actor types.
     *
     * @example
     * // In your module's init hook:
     * Hooks.on('dcc.defineBaseActorSchema', (schema) => {
     *   // Add a new field to details
     *   schema.details.fields.sheetClass = new foundry.data.fields.StringField({ initial: '' })
     * })
     */
    Hooks.callAll('dcc.defineBaseActorSchema', schema)

    return schema
  }
}
