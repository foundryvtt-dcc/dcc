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
    // Non-nullable: DocumentSheetV2's submit pipeline cleans an emptied
    // text input to `null` on a nullable NumberField, which then renders
    // as "NaN" via {{numberFormat}} (#871). Non-nullable cleans '' / null
    // to 0 instead, so clearing a currency field zeroes it.
    const coin = () => new NumberField({ initial: 0, integer: true, min: 0, nullable: false, required: true })
    super({
      pp: coin(),
      ep: coin(),
      gp: coin(),
      sp: coin(),
      cp: coin(),
      ...additionalFields
    })
  }
}
