/* global foundry */
/**
 * Data model for treasure items
 * Treasure uses itemDescription and currency templates but NOT physicalItem
 */
import { BaseItemData } from './base-item.mjs'
import { CurrencyField } from '../fields/_module.mjs'

const { BooleanField } = foundry.data.fields

export class TreasureData extends BaseItemData {
  /**
   * Migrate source data to handle legacy formats
   * @param {object} source - Raw source data
   * @returns {object} - Migrated data
   */
  static migrateData (source) {
    // Ensure value currency structure exists
    if (!source.value) {
      source.value = {}
    }

    // Convert currency values to integers if needed
    if (source.value) {
      for (const key of ['pp', 'ep', 'gp', 'sp', 'cp']) {
        if (source.value[key] !== undefined) {
          if (typeof source.value[key] === 'string') {
            source.value[key] = parseInt(source.value[key]) || 0
          } else if (typeof source.value[key] === 'number' && !Number.isInteger(source.value[key])) {
            source.value[key] = Math.floor(source.value[key])
          }
        }
      }
    }

    return super.migrateData(source)
  }

  static defineSchema () {
    return {
      ...super.defineSchema(),
      value: new CurrencyField(),
      isCoins: new BooleanField({ initial: false })
    }
  }
}
