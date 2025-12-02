/**
 * Data model for equipment items
 * Equipment has no additional fields beyond physical item
 */
import { PhysicalItemData } from './base-item.mjs'

export class EquipmentData extends PhysicalItemData {
  static defineSchema () {
    return {
      ...super.defineSchema()
      // Equipment has no additional fields
    }
  }
}
