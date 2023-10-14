/* global CONFIG, Roll */

/*
 * Model the dice chain
 */
class DiceChain {
  /*
   * Return the name of the primary dice in an expression
   * @param expression {String}    Roll expression
   * @returns {Number}             Primary dice (e.g. d3, d8, d14)
   */
  static getPrimaryDie (expression) {
    const faces = this.getPrimaryDieFaces(expression)
    if (faces) {
      return 'd' + faces
    }
    return null
  }

  /*
   * Return the number of faces on the primary dice in an expression
   * @param expression {String}    Roll expression
   * @returns {Number}             Number of faces of the largest die
   */
  static getPrimaryDieFaces (expression) {
    const roll = new Roll(expression)
    roll.evaluate({ async: false })
    let maxFaces = 0
    for (const die of roll.dice) {
      if (die.faces > maxFaces) {
        maxFaces = die.faces
      }
    }
    return maxFaces
  }

  /*
   * Return the rank in the dice chain of the largest die in an expression
   * Dice of sizes not in the dice chain are ignored
   *
   * @param expression {String}    Roll expression
   * @returns {Number}             Rank of the largest die
   */
  static rankDiceExpression (expression) {
    const roll = new Roll(expression)
    roll.evaluate({ async: false })
    let rank = 0
    for (const die of roll.dice) {
      const dieRank = CONFIG.DCC.DICE_CHAIN.indexOf(die.faces)
      if (dieRank > rank) {
        rank = dieRank
      }
    }
    return rank
  }

  /* Count the number of dice in an expression
   * @param expression {String}   Die term formula
   * @return {String}             New die term formula
   */
  static countDice (expression) {
    const regex = /(\d+)d(\d+).*/
    const match = expression.match(regex)
    if (match) {
      return parseInt(match[1])
    }
    return 0
  }

  /* Bump a die expression up or down the dice chain
   * @param expression {String}   Die term formula
   * @param modifier {Number}     The amount of steps up or down the chain to adjust
   * @return {String}             New die term formula
   */
  static bumpDie (expression, modifier) {
    const diceChain = CONFIG.DCC.DICE_CHAIN
    const regex = /(\d+)d(\d+)(.*)/
    const match = expression.match(regex)
    if (match) {
      const dieRank = diceChain.indexOf(parseInt(match[2]))
      if (dieRank >= 0) {
        const newIndex = dieRank + parseInt(modifier)
        if (newIndex >= 0 && newIndex < diceChain.length) {
          return `${match[1]}d${diceChain[newIndex]}${match[3]}`
        }
      }
    }
    return expression
  }

  /* Bump a die expression adjusting the number of dice
   * @param expression {String}   Die term formula
   * @param modifier {Number}     The number of dice to add or remove
   * @param maxCount {Number}     Optional maximum number of dice
   * @return {String}             New die term formula
   */
  static bumpDieCount (expression, modifier, maxCount) {
    const regex = /(\d+)d(\d+)(.*)/
    const match = expression.match(regex)
    if (match) {
      const dieCount = parseInt(match[1]) + parseInt(modifier)
      if (maxCount && dieCount > maxCount) {
        return `${maxCount}d${match[2]}${match[3]}`
      }
      if (dieCount > 0) {
        return `${dieCount}d${match[2]}${match[3]}`
      }
    }
    return expression
  }

  /* Calculate the adjustment to make to critRange based on the die sizes in a pair for formulae
   * @param original {String}   Original die term formula
   * @param adjusted {String}   Adjusted die term formula
   */
  static calculateCritAdjustment (original, adjusted) {
    const regex = /(\d+)d(\d+)(.*)/
    const originalMatch = original.match(regex)
    const adjustedMatch = adjusted.match(regex)
    if (originalMatch && adjustedMatch) {
      return parseInt(adjustedMatch[2]) - parseInt(originalMatch[2])
    }

    // Default - no adjustment
    return 0
  }
}

export default DiceChain
