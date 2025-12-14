/* global foundry */
/**
 * Data model for weapon items
 */
import { PhysicalItemData } from './base-item.mjs'
import { DiceField } from '../fields/_module.mjs'

const { SchemaField, StringField, NumberField, BooleanField } = foundry.data.fields

export class WeaponData extends PhysicalItemData {
  /**
   * Migrate source data to handle legacy formats
   * @param {object} source - Raw source data
   * @returns {object} - Migrated data
   */
  static migrateData (source) {
    // Convert string critRange to number if needed
    if (typeof source.critRange === 'string') {
      source.critRange = parseInt(source.critRange) || 20
    }

    // Ensure config exists
    if (!source.config) {
      source.config = {}
    }

    // Convert critRangeOverride from string to number/null
    const critRangeOverride = source.config.critRangeOverride
    if (typeof critRangeOverride === 'string') {
      source.config.critRangeOverride = critRangeOverride === '' ? null : (parseInt(critRangeOverride) || null)
    }

    return super.migrateData(source)
  }

  static defineSchema () {
    return {
      ...super.defineSchema(),

      // Configuration overrides
      config: new SchemaField({
        actionDieOverride: new StringField({ initial: '' }),
        critDieOverride: new StringField({ initial: '' }),
        critRangeOverride: new NumberField({ nullable: true, initial: null, integer: true, min: 1, max: 20 }),
        critTableOverride: new StringField({ initial: '' }),
        damageOverride: new StringField({ initial: '' }),
        attackBonusOverride: new StringField({ initial: '' }),
        initiativeBonusOverride: new StringField({ initial: '' }),
        initiativeDieOverride: new StringField({ initial: '' })
      }),

      // Combat stats
      actionDie: new DiceField({ initial: '1d20' }),
      attackBonus: new StringField({ initial: '' }),
      attackBonusWeapon: new StringField({ initial: '' }),
      attackBonusLucky: new StringField({ initial: '' }),
      backstabDamage: new StringField({ initial: '' }),
      critDie: new StringField({ initial: '' }),
      critRange: new NumberField({ initial: 20, integer: true, min: 1, max: 20 }),
      critTable: new StringField({ initial: '' }),
      damage: new StringField({ initial: '' }),
      damageWeapon: new StringField({ initial: '' }),
      damageBonus: new StringField({ initial: '' }),
      damageWeaponBonus: new StringField({ initial: '' }),

      // Weapon properties
      doubleIfMounted: new BooleanField({ initial: false }),
      initiativeBonus: new StringField({ initial: '' }),
      initiativeDie: new DiceField({ initial: '1d20' }),
      initiativeWeaponBonus: new StringField({ initial: '' }),
      melee: new BooleanField({ initial: false }),
      range: new StringField({ initial: '' }),
      shortRangeStrength: new BooleanField({ initial: false }),
      subdual: new BooleanField({ initial: false }),
      toHit: new StringField({ initial: '+0' }),
      trained: new BooleanField({ initial: true }),
      twoHanded: new BooleanField({ initial: false }),
      twoWeaponPrimary: new BooleanField({ initial: false }),
      twoWeaponSecondary: new BooleanField({ initial: false })
    }
  }
}
