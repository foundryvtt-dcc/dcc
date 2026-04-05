/* global foundry */
/**
 * Data model for container items (backpacks, sacks, saddlebags, etc.)
 * Containers hold other physical items via reverse-reference pattern
 */
import { PhysicalItemData } from './base-item.mjs'

const { SchemaField, NumberField } = foundry.data.fields

export class ContainerData extends PhysicalItemData {
  static defineSchema () {
    return {
      ...super.defineSchema(),
      capacity: new SchemaField({
        weight: new NumberField({ initial: 0, min: 0 }),
        items: new NumberField({ initial: 0, integer: true, min: 0 })
      }),
      weightReduction: new NumberField({ initial: 0, min: 0, max: 100 })
    }
  }
}
