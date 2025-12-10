/**
 * Utility functions for migrating legacy data to new schema types
 */

/**
 * Convert a value to an integer, handling strings and floats
 * Used for migrating legacy data to NumberField({ integer: true })
 * @param {*} value - The value to convert
 * @param {number} defaultValue - Default if parsing fails
 * @returns {number} - Integer value
 */
export function toInteger (value, defaultValue = 0) {
  if (typeof value === 'string') {
    return parseInt(value) || defaultValue
  }
  if (typeof value === 'number' && !Number.isInteger(value)) {
    return Math.floor(value)
  }
  return value
}

/**
 * Migrate multiple fields on an object to integers
 * @param {object} obj - Object containing the fields
 * @param {string[]} fields - Field names to migrate
 * @param {number|object} defaults - Default value, or object mapping field names to defaults
 */
export function migrateFieldsToInteger (obj, fields, defaults = 0) {
  if (!obj) return
  for (const field of fields) {
    if (obj[field] !== undefined) {
      const defaultValue = typeof defaults === 'object' ? (defaults[field] ?? 0) : defaults
      obj[field] = toInteger(obj[field], defaultValue)
    }
  }
}
