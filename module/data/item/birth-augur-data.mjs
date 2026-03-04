/* global foundry */
/**
 * Data model for birth augur items
 */
import { BaseItemData } from './base-item.mjs'

const { StringField } = foundry.data.fields

export class BirthAugurData extends BaseItemData {
  static defineSchema () {
    return {
      ...super.defineSchema(),
      effect: new StringField({ initial: 'none' })
    }
  }
}
