/**
 * Data model for ammunition items
 * Ammunition has no additional fields beyond physical item
 */
import { PhysicalItemData } from './base-item.mjs'

export class AmmunitionData extends PhysicalItemData {
  static defineSchema () {
    return {
      ...super.defineSchema()
      // Ammunition has no additional fields
    }
  }
}
