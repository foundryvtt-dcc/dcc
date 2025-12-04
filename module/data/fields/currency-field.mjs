/* global foundry */
/**
 * A reusable schema for DCC currency
 * Used for pp, ep, gp, sp, cp
 */
const { SchemaField, NumberField } = foundry.data.fields

export class CurrencyField extends SchemaField {
  /**
   * @param {object} additionalFields - Additional fields to include
   */
  constructor (additionalFields = {}) {
    super({
      pp: new NumberField({ initial: 0, integer: true, min: 0 }),
      ep: new NumberField({ initial: 0, integer: true, min: 0 }),
      gp: new NumberField({ initial: 0, integer: true, min: 0 }),
      sp: new NumberField({ initial: 0, integer: true, min: 0 }),
      cp: new NumberField({ initial: 0, integer: true, min: 0 }),
      ...additionalFields
    })
  }
}
