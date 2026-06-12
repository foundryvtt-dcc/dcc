/* global foundry */
/**
 * Data model for equipment items
 */
import { PhysicalItemData } from './base-item.mjs'

const { SchemaField, StringField, NumberField, ObjectField } = foundry.data.fields

export class EquipmentData extends PhysicalItemData {
  static defineSchema () {
    return {
      ...super.defineSchema(),

      // Charged magic item support (issue #500): a wand of magic missiles
      // is an equipment item with an attached spell and charges

      // Snapshot of the attached spell's item data (set by DCCItem.attachSpell,
      // null when no spell is attached)
      spell: new ObjectField({ initial: null, nullable: true }),

      // Charges remaining / maximum. A max of 0 means charges are not
      // tracked and the item casts without consuming anything
      charges: new SchemaField({
        value: new NumberField({ initial: 0, integer: true, min: 0 }),
        max: new NumberField({ initial: 0, integer: true, min: 0 })
      }),

      // Optional fixed spell check modifier for the item (e.g. '+5').
      // When set, casting ignores the attached spell's own spell check
      // configuration and uses this flat bonus instead
      spellCheckOverride: new StringField({ initial: '' })
    }
  }
}
