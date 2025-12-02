/* global foundry */
/**
 * Data model for treasure items
 * Treasure uses itemDescription and currency templates but NOT physicalItem
 */
import { BaseItemData } from './base-item.mjs'
import { CurrencyField } from '../fields/_module.mjs'

const { BooleanField } = foundry.data.fields

export class TreasureData extends BaseItemData {
  static defineSchema () {
    return {
      ...super.defineSchema(),
      value: new CurrencyField(),
      isCoins: new BooleanField({ initial: false })
    }
  }
}
