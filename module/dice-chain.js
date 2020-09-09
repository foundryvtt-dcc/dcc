/* global CONFIG, Roll */

/*
 * Model the dice chain
 */
class DiceChain {
  /*
   * Return the rank in the dice chain of the largest die in an expression
   *
   * @param {String}    Roll expression
   * @returns {Number}   Rank of the largest die
   */
  static rankDiceExpression (expression) {
    const roll = new Roll(expression)
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
