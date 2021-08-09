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

  /* Bump a dice expression up or down the dice chain
   * @param expression {String}   Die term formula
   * @param modifier {Number}     The amount of steps up or down the chain to adjust
   * @return {String}             New die term formula
   */
  static bumpDie (expression, modifier) {
    const diceChain = CONFIG.DCC.DICE_CHAIN
    const regex = /(\d+)d(\d+)/
    const match = expression.match(regex)
    if (match) {
      const dieRank = diceChain.indexOf(parseInt(match[2]))
      if (dieRank >= 0) {
        const newIndex = dieRank + parseInt(modifier)
        if (newIndex >= 0 && newIndex < diceChain.length) {
          return `${match[1]}d${diceChain[newIndex]}`
        }
      }
    }
    return expression
  }

  /* Bump a dice expression adjusting the number of dice
   * @param expression {String}   Die term formula
   * @param modifier {Number}     The number of dice to add or remove
   * @return {String}             New die term formula
   */
  static bumpDieCount (expression, modifier) {
    const regex = /(\d+)d(\d+)/
    const match = expression.match(regex)
    if (match) {
      const dieCount = parseInt(match[1]) + parseInt(modifier)
      if (dieCount > 0) {
        return `${dieCount}d${match[2]}`
      }
    }
    return expression
  }
}

export default DiceChain
