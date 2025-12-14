/* global ActiveEffect, foundry, CONFIG */

import DiceChain from './dice-chain.js'

/**
 * Custom ActiveEffect class for DCC system
 * Handles special cases like thief skills and save bonuses which are stored as signed strings ("+5", "-2", "0")
 * Also handles equipped status for item effects
 * Also handles custom DCC effect types like dice chain adjustments
 */
export default class DCCActiveEffect extends ActiveEffect {
  /**
   * Override apply to handle equipped status for item effects
   * Effects from unequipped items should not be applied
   * @param {Actor} actor - The Actor to whom this effect should be applied
   * @param {EffectChangeData} change - The change data being applied
   * @returns {object} - The changes to apply
   */
  apply (actor, change) {
    // Check if this effect comes from an item
    const parentItem = this.parent
    if (parentItem?.documentName === 'Item') {
      // Check if the item is equipped (default to true if no equipped property)
      const isEquipped = parentItem.system?.equipped ?? true
      if (!isEquipped) {
        // Skip applying effects from unequipped items
        return {}
      }
    }

    // Get the current value for this key
    const current = foundry.utils.getProperty(actor, change.key)
    const ct = foundry.utils.getType(current)

    // Handle dice chain adjustment type
    // The value should be a number representing steps to move on the dice chain (e.g., 1, -2)
    if (change.type === CONFIG.DCC.effectChangeTypes.DICE_CHAIN) {
      // Only process if the current value looks like a dice expression
      if (ct === 'string' && String(current).includes('d')) {
        const steps = parseInt(change.value)
        if (!isNaN(steps)) {
          const newValue = DiceChain.bumpDie(current, steps)
          if (newValue !== current) {
            foundry.utils.setProperty(actor, change.key, newValue)
            return { [change.key]: newValue }
          }
        }
      }
      return {}
    }

    // Handle string values that look like signed numbers (thief skills, save bonuses, etc.)
    // These are stored as strings like "+5", "-2", "0" but need numeric operations
    // V14 uses DataModel fields which don't call _applyAdd etc. for schema-defined fields
    // We need to intercept here for numeric operations on string fields

    // Check if it's a string that looks like a signed number (not a dice expression)
    if (ct === 'string' && !String(current).includes('d') && !String(change.value).includes('d')) {
      const currentNum = Number(current)
      const deltaNum = Number(change.value)

      // If both can be parsed as numbers, handle numeric operations
      if (!isNaN(currentNum) && !isNaN(deltaNum)) {
        let result
        switch (change.type) {
          case 'add':
            result = currentNum + deltaNum
            break
          case 'multiply':
            result = currentNum * deltaNum
            break
          case 'upgrade':
            result = Math.max(currentNum, deltaNum)
            break
          case 'downgrade':
            result = Math.min(currentNum, deltaNum)
            break
          case 'override':
            // For override, just use the delta value directly
            result = deltaNum
            break
          default:
            // For custom or unknown types, fall through to default behavior
            result = null
        }

        if (result !== null) {
          // Format as signed string: positive gets "+", zero and negative are plain
          const formatted = result > 0 ? `+${result}` : String(result)
          if (formatted !== current) {
            foundry.utils.setProperty(actor, change.key, formatted)
            return { [change.key]: formatted }
          }
          return {}
        }
      }
    }

    // Call parent apply method for all other cases
    return super.apply(actor, change)
  }
}
