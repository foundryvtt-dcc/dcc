/* global CONFIG, Roll */

/*
 * Model the dice chain
 */
class DiceChain {
  /*
   * Return the name of the primary dice in an expression
   * @param {String}    Roll expression
   * @returns {Number}  Primary dice (e.g. d3, d8, d14)
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
   * @param {String}    Roll expression
   * @returns {Number}  Number of faces of the largest die
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
   * @param {String}    Roll expression
   * @returns {Number}   Rank of the largest die
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
}

export default DiceChain
