/* global foundry */
/**
 * Data model for treasure items
 * Treasure extends PhysicalItemData to support weight tracking for B/X-style encumbrance
 */
import { PhysicalItemData } from './base-item.mjs'

const { BooleanField } = foundry.data.fields

export class TreasureData extends PhysicalItemData {
  static defineSchema () {
    return {
      ...super.defineSchema(),
      isCoins: new BooleanField({ initial: false })
    }
  }
}
