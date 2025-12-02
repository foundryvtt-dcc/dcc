/* global foundry */
/**
 * Base data model for all DCC items
 * Provides description fields used by itemDescription template
 */
import { CurrencyField } from '../fields/_module.mjs'

const { SchemaField, StringField, HTMLField, NumberField, BooleanField } = foundry.data.fields

/**
 * Base item data with description fields
 * Maps to template.json "itemDescription" template
 */
export class BaseItemData extends foundry.abstract.TypeDataModel {
  /**
   * Migrate source data to handle legacy formats
   * @param {object} source - Raw source data
   * @returns {object} - Migrated data
   */
  static migrateData (source) {
    // Ensure description structure exists
    if (!source.description) {
      source.description = {}
    }

    // Ensure judge sub-object exists
    if (!source.description.judge) {
      source.description.judge = { value: '' }
    }

    return super.migrateData(source)
  }

  static defineSchema () {
    return {
      description: new SchemaField({
        value: new HTMLField({ initial: '' }),
        chat: new HTMLField({ initial: '' }),
        unidentified: new HTMLField({ initial: '' }),
        summary: new StringField({ initial: '' }),
        judge: new SchemaField({
          value: new HTMLField({ initial: '' })
        })
      }),
      source: new StringField({ initial: '' })
    }
  }
}

/**
 * Physical item data with quantity, weight, equipped status
 * Maps to template.json "physicalItem" and "currency" templates
 * Used by: weapon, ammunition, armor, equipment, mount
 */
export class PhysicalItemData extends BaseItemData {
  /**
   * Migrate source data to handle legacy formats
   * @param {object} source - Raw source data
   * @returns {object} - Migrated data
   */
  static migrateData (source) {
    // Convert string quantity to number if needed
    if (typeof source.quantity === 'string') {
      source.quantity = parseInt(source.quantity) || 1
    }

    // Convert string weight to number if needed
    if (typeof source.weight === 'string') {
      source.weight = parseFloat(source.weight) || 0
    }

    // Ensure value currency structure exists
    if (!source.value) {
      source.value = {}
    }

    return super.migrateData(source)
  }

  static defineSchema () {
    return {
      ...super.defineSchema(),
      quantity: new NumberField({ initial: 1, integer: true, min: 0 }),
      weight: new NumberField({ initial: 0, min: 0 }),
      equipped: new BooleanField({ initial: true }),
      identified: new BooleanField({ initial: true }),
      value: new CurrencyField()
    }
  }
}
