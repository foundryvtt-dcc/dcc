/* global foundry */
/**
 * A reusable schema for DCC saving throws
 * Used for frt (Fortitude), ref (Reflex), wil (Will)
 */
const { SchemaField, NumberField, StringField } = foundry.data.fields

export class SaveField extends SchemaField {
  /**
   * @param {object} options - Field options
   * @param {string} options.label - The i18n label key for this save
   * @param {string} options.abbreviation - The i18n abbreviation key for this save
   */
  constructor (options = {}) {
    super({
      abbreviation: new StringField({ initial: options.abbreviation || '' }),
      label: new StringField({ initial: options.label || '' }),
      classBonus: new StringField({ initial: '' }),
      otherBonus: new StringField({ initial: '' }),
      override: new StringField({ initial: '' }),
      value: new NumberField({ initial: 0, integer: true })
    })
  }
}
