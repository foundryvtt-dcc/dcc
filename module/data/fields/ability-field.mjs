/* global foundry */
/**
 * A reusable schema for DCC ability scores
 * Used for str, agl, sta, per, int, lck
 */
const { SchemaField, NumberField, StringField } = foundry.data.fields

export class AbilityField extends SchemaField {
  /**
   * @param {object} options - Field options
   * @param {string} options.label - The i18n label key for this ability
   */
  constructor (options = {}) {
    super({
      label: new StringField({ initial: options.label || '' }),
      // min: 0, not 1 — per DCC RAW a physical ability may be burned (or
      // drained) all the way to 0 (burning Stamina to 0 is lethal, an
      // intentional rules feature). A schema floor of 1 would silently clamp
      // the adapter's floor-0 spellburn write back up to 1. `max` keeps min: 1
      // (a ceiling of 0 is nonsensical).
      value: new NumberField({ initial: 10, integer: true, min: 0 }),
      max: new NumberField({ initial: 10, integer: true, min: 1 }),
      // Tracking fields for ability score changes
      // spent: voluntary loss (spellburn, luck spend) - typically recovers
      spent: new NumberField({ initial: 0, integer: true, min: 0 }),
      // damage: involuntary loss (monster damage, corruption) - may need healing
      damage: new NumberField({ initial: 0, integer: true, min: 0 })
    })
  }
}
