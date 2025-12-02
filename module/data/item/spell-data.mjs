/* global foundry */
/**
 * Data model for spell items
 */
import { BaseItemData } from './base-item.mjs'
import { DiceField } from '../fields/_module.mjs'

const { SchemaField, StringField, NumberField, BooleanField, ObjectField } = foundry.data.fields

export class SpellData extends BaseItemData {
  /**
   * Migrate source data to handle legacy formats
   * @param {object} source - Raw source data
   * @returns {object} - Migrated data
   */
  static migrateData (source) {
    // Convert string level to number if needed
    if (typeof source.level === 'string') {
      source.level = parseInt(source.level) || 1
    }

    // Ensure config exists
    if (!source.config) {
      source.config = {}
    }

    // Ensure spellCheck structure exists
    if (!source.spellCheck) {
      source.spellCheck = {}
    }

    // Ensure manifestation structure exists
    if (!source.manifestation) {
      source.manifestation = {}
    }

    // Ensure mercurialEffect structure exists
    if (!source.mercurialEffect) {
      source.mercurialEffect = {}
    }

    // Ensure results is an object
    if (!source.results || typeof source.results !== 'object') {
      source.results = {}
    }

    return super.migrateData(source)
  }

  static defineSchema () {
    return {
      ...super.defineSchema(),

      // Configuration
      config: new SchemaField({
        inheritActionDie: new BooleanField({ initial: true }),
        inheritSpellCheck: new BooleanField({ initial: true }),
        inheritCheckPenalty: new BooleanField({ initial: true }),
        castingMode: new StringField({ initial: 'wizard' }),
        showMercurialTab: new BooleanField({ initial: false })
      }),

      // Spell properties
      level: new NumberField({ initial: 1, integer: true, min: 0 }),
      associatedPatron: new StringField({ initial: '' }),
      lost: new BooleanField({ initial: false }),
      range: new StringField({ initial: '' }),
      duration: new StringField({ initial: '' }),
      page: new StringField({ initial: '' }),
      castingTime: new StringField({ initial: '' }),
      save: new StringField({ initial: '' }),

      // Spell check
      spellCheck: new SchemaField({
        die: new DiceField({ initial: '1d20' }),
        value: new StringField({ initial: '+0' }),
        penalty: new StringField({ initial: '-0' }),
        otherBonus: new StringField({ initial: '' })
      }),

      // Results table - stores spell check results by roll value
      results: new ObjectField({ initial: {} }),

      // Manifestation
      manifestation: new SchemaField({
        value: new StringField({ initial: '' }),
        description: new StringField({ initial: '' }),
        displayInChat: new BooleanField({ initial: true })
      }),

      // Mercurial effect
      mercurialEffect: new SchemaField({
        value: new StringField({ initial: '' }),
        summary: new StringField({ initial: '' }),
        description: new StringField({ initial: '' }),
        displayInChat: new BooleanField({ initial: true })
      }),

      // Last result for display
      lastResult: new StringField({ initial: '' })
    }
  }
}
