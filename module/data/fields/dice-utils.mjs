/**
 * Utility functions for dice notation validation
 * No Foundry dependencies - can be imported anywhere
 */

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
