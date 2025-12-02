/**
 * Data model for mount items
 * Mounts have no additional fields beyond physical item
 */
import { PhysicalItemData } from './base-item.mjs'

export class MountData extends PhysicalItemData {
  static defineSchema () {
    return {
      ...super.defineSchema()
      // Mounts have no additional fields
    }
  }
}
