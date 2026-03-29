/* global ActiveEffect, foundry, CONFIG */

import DiceChain from './dice-chain.js'

/**
 * Custom ActiveEffect class for DCC system
 * Handles signed string values ("+5", "-2", "0"), equipped status for item effects,
 * and custom DCC effect types like dice chain adjustments
 */
export default class DCCActiveEffect extends ActiveEffect {
  /**
   * Resolve @-variable references in an effect value string
   * Replaces @path.to.property with the actual value from the actor's data
   * Uses @-path syntax similar to Foundry roll formulas, but resolves against
   * the actor object directly (not roll data), so paths must include the system. prefix
   * @param {Actor} actor - The actor to resolve values from
   * @param {*} value - The raw effect value (may contain @references if string)
   * @returns {*} - Strings get references replaced by numbers; non-strings pass through unchanged
   */
  static resolveValue (actor, value) {
    if (!actor || typeof value !== 'string' || !value.includes('@')) return value
    return value.replace(/@([a-zA-Z0-9_.]+)/g, (match, path) => {
      try {
        const resolved = foundry.utils.getProperty(actor, path)
        if (resolved === undefined || resolved === null) {
          console.warn(`DCC | Active Effect @-reference '${match}' resolved to undefined on actor '${actor.name ?? 'unknown'}'`)
          return '0'
        }
        const num = Number(resolved)
        if (isNaN(num)) {
          console.warn(`DCC | Active Effect @-reference '${match}' resolved to non-numeric value '${resolved}' on actor '${actor.name ?? 'unknown'}'`)
          return '0'
        }
        return String(num)
      } catch {
        console.warn(`DCC | Active Effect @-reference '${match}' failed to resolve on actor '${actor.name ?? 'unknown'}'`)
        return '0'
      }
    })
  }

  /**
   * Override apply to handle equipped status for item effects
   * Effects from unequipped items should not be applied
   * @param {Actor} actor - The Actor to whom this effect should be applied
   * @param {EffectChangeData} change - The change data being applied
   * @returns {object} - The changes to apply
   */
  apply (actor, change) {
    // Skip effects from unequipped items (default to equipped if no property)
    const parentItem = this.parent
    if (parentItem?.documentName === 'Item' && !(parentItem.system?.equipped ?? true)) {
      return {}
    }

    change = { ...change, value: DCCActiveEffect.resolveValue(actor, change.value) }

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
