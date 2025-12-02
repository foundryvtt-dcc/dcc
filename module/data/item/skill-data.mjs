/* global foundry */
/**
 * Data model for skill items
 */
import { BaseItemData } from './base-item.mjs'
import { DiceField } from '../fields/_module.mjs'

const { SchemaField, StringField, BooleanField } = foundry.data.fields

export class SkillData extends BaseItemData {
  /**
   * Migrate source data to handle legacy formats
   * @param {object} source - Raw source data
   * @returns {object} - Migrated data
   */
  static migrateData (source) {
    // Ensure config exists
    if (!source.config) {
      source.config = {}
    }

    return super.migrateData(source)
  }

  static defineSchema () {
    return {
      ...super.defineSchema(),
      config: new SchemaField({
        useSummary: new BooleanField({ initial: true }),
        useAbility: new BooleanField({ initial: true }),
        useDie: new BooleanField({ initial: true }),
        useLevel: new BooleanField({ initial: false }),
        useValue: new BooleanField({ initial: true }),
        showLastResult: new BooleanField({ initial: true })
      }),
      ability: new StringField({ initial: '' }),
      die: new DiceField({ initial: '1d20' }),
      value: new StringField({ initial: '' }),
      lastResult: new StringField({ initial: '0' })
    }
  }
}
