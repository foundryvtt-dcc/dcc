/* global foundry */
/**
 * A field for DCC dice chain values
 * Valid dice: d3, d4, d5, d6, d7, d8, d10, d12, d14, d16, d20, d24, d30
 */
const { StringField } = foundry.data.fields

/**
 * Validate dice notation without exponential backtracking
 * Supports: 1d20, d20, 2d6+2, 1d4-1, 1d20+1d4
 * @param {string} value - The dice notation to validate
 * @returns {boolean} - True if valid dice notation
 */
export function isValidDiceNotation (value) {
  if (!value || typeof value !== 'string') return false
  // Simple regex for single dice term: optional count, 'd', die size, optional modifier
  const singleDice = /^\d*d\d+([+-]\d+)?$/i
  // For compound dice (1d20+1d4), split on +/- that precede 'd' and validate each part
  const parts = value.split(/(?=[+-]\d*d)/i)
  return parts.every((part, i) => {
    // First part shouldn't have leading +/-
    if (i === 0) return singleDice.test(part)
    // Subsequent parts should have leading +/-
    return /^[+-]\d*d\d+([+-]\d+)?$/i.test(part)
  })
}

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
