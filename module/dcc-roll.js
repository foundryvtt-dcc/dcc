/* global Roll */

import showRollModifier from './roll-modifier.js'

/**
 * DCC Roll
 * Dungeon Crawl Classics specific Roll helpers applying modifiers and custom behaviours cleanly
 */
class DCCRoll {
  /**
   * Build a simplified roll expression from a die and set of modifiers
   * @param {String} die        Base die for the roll
   * @param {Array} modifiers   An array of static modifiers
   * @return {string}
   */
  static async createSimpleRoll (die, modifiers, options = {}) {
    const isNumeric = /^([+-]?)(\d)+$/
    const showModifierDialog = options.showModifierDialog || false

    let rollExpression = die
    for (const modifier in modifiers) {
      const value = modifiers[modifier]
      if (value) {
        const match = String(value).match(isNumeric)
        if (match === null) {
          // Non-numeric - add it to the roll
          rollExpression += `+@${modifier}`
        } else if (match[1] === '-') {
          // Explicitly a negative number, no need for an addition operator
          rollExpression += String(value)
        } else {
          // Positive number - strip sign and add if non-zero
          if (parseInt(value)) {
            rollExpression += `+${parseInt(value)}`
          }
        }
      }
    }

    let roll = new Roll(rollExpression, modifiers)
    if (showModifierDialog) {
      roll = await showRollModifier(roll)
    }
    return roll
  }

  /**
   * Create a formula string from an array of Dice terms.
   * @return {string}
   */
  static cleanFormula (terms) {
    if (!terms) return ''
    terms = this.cleanTerms(terms).map(t => {
      if (t instanceof Roll) return `(${t.formula})`
      return t.formula || String(t)
    }).join('')
    const formula = terms.replace(/ /g, '')
    return formula.replace(new RegExp(this.ARITHMETIC.map(o => '\\' + o).join('|'), 'g'), ' $& ')
  }

  /* -------------------------------------------- */

  /**
   * Clean the terms of a Roll equation, removing empty space and de-duping arithmetic operators
   * @param {Array<DiceTerm|string|number>} terms  The input array of terms
   * @return {Array<DiceTerm|string|number>}       The cleaned array of terms
   */
  static cleanTerms (terms) {
    return terms.reduce((cleaned, t, i, terms) => {
      const prior = terms[i - 1]

      if (prior) {
        // De-dupe addition and multiplication
        if (['+', '*'].includes(t.operator) && prior.operator === t.operator) return cleaned

        // Negate double subtraction
        if ((t.operator === '-') && (prior.operator === '-')) {
          cleaned[i - 1] = '+'
          return cleaned
        }

        // Negate double division
        if (prior && (t.operator === '/') && (prior.operator === '/')) {
          cleaned[i - 1] = '*'
          return cleaned
        }

        // Subtraction and negative values
        if (['-+', '+-'].includes(t.operator + prior.operator)) {
          cleaned[i - 1] = '-'
          return cleaned
        }
      }

      // Return the clean array
      cleaned.push(t.formula)
      return cleaned
    }, [])
  }
}

DCCRoll.ARITHMETIC = ['+', '-', '*', '/']

export default DCCRoll
