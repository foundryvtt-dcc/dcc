/* global foundry */
/**
 * Data model for armor items
 */
import { PhysicalItemData } from './base-item.mjs'
import { DiceField } from '../fields/_module.mjs'

const { StringField } = foundry.data.fields

export class ArmorData extends PhysicalItemData {
  /**
   * Migrate source data to handle legacy formats
   * @param {object} source - Raw source data
   * @returns {object} - Migrated data
   */
  static migrateData (source) {
    // Convert "-" fumbleDie to empty string (indicates no fumble die)
    if (source.fumbleDie === '-' || source.fumbleDie === '—') {
      source.fumbleDie = ''
    }

    return super.migrateData(source)
  }

  static defineSchema () {
    return {
      ...super.defineSchema(),
      acBonus: new StringField({ initial: '+1' }),
      checkPenalty: new StringField({ initial: '-0' }),
      speed: new StringField({ initial: '-0' }),
      fumbleDie: new DiceField({ initial: '1d4', blank: true })
    }
  }
}
