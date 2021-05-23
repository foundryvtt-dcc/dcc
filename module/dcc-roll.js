/* global Roll */

/**
 * DCC Roll
 * Dungeon Crawl Classics specific Roll class for applying modifiers and custom behaviours cleanly
 */
class DCCRoll extends Roll {
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
