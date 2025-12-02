/* global foundry */
/**
 * Data model for armor items
 */
import { PhysicalItemData } from './base-item.mjs'
import { DiceField } from '../fields/_module.mjs'

const { StringField } = foundry.data.fields

export class ArmorData extends PhysicalItemData {
  static defineSchema () {
    return {
      ...super.defineSchema(),
      acBonus: new StringField({ initial: '+1' }),
      checkPenalty: new StringField({ initial: '-0' }),
      speed: new StringField({ initial: '-0' }),
      fumbleDie: new DiceField({ initial: '1d4' })
    }
  }
}
