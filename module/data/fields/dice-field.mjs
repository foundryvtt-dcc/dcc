/* global foundry */
/**
 * A field for DCC dice chain values
 * Valid dice: d3, d4, d5, d6, d7, d8, d10, d12, d14, d16, d20, d24, d30
 */
import { isValidDiceNotation } from './dice-utils.mjs'

const { StringField } = foundry.data.fields

// Re-export for backwards compatibility
export { isValidDiceNotation }

export class DiceField extends StringField {
  /**
   * @param {object} options - Field options
   * @param {string} options.initial - Default dice value
   */
  constructor (options = {}) {
    super({
      initial: options.initial || '1d20',
      blank: options.blank ?? false,
      nullable: options.nullable ?? false,
      ...options
    })
  }

  /** @override */
  _validateType (value) {
    super._validateType(value)
    // Allow standard dice notation with optional modifiers
    // Examples: 1d20, 2d6+2, 1d14-1, d20, 1d20+1d4
    if (value && !isValidDiceNotation(value)) {
      throw new Error(`Invalid dice notation: ${value}`)
    }
  }
}
