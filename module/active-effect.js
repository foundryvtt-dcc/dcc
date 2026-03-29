/* global ActiveEffect, foundry, CONST */

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
   * Follows the same @ convention used in Foundry roll formulas
   * @param {Actor} actor - The actor to resolve values from
   * @param {string} value - The raw effect value (may contain @references)
   * @returns {string} - The resolved value with references replaced by numbers
   */
  static resolveValue (actor, value) {
    if (typeof value !== 'string' || !value.includes('@')) return value
    return value.replace(/@([a-zA-Z0-9_.]+)/g, (match, path) => {
      const resolved = foundry.utils.getProperty(actor, path)
      if (resolved === undefined || resolved === null) return '0'
      const num = Number(resolved)
      return isNaN(num) ? '0' : String(num)
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

    // Handle dice chain adjustment: custom mode with value like "+1d" or "-2d"
    if (change.mode === CONST.ACTIVE_EFFECT_MODES.CUSTOM) {
      const match = String(change.value).match(/^([+-]?\d+)[dD]$/)
      if (match && ct === 'string' && String(current).includes('d')) {
        const steps = parseInt(match[1])
        if (!isNaN(steps)) {
          const newValue = DiceChain.bumpDie(current, steps)
          if (newValue !== current) {
            foundry.utils.setProperty(actor, change.key, newValue)
            return { [change.key]: newValue }
          }
        }
        return {}
      }
    }

    // Handle signed-number strings (thief skills, save bonuses, etc.)
    // Stored as "+5", "-2", "0" but need numeric operations
    if (ct === 'string' && !String(current).includes('d') && !String(change.value).includes('d')) {
      const currentNum = Number(current)
      const deltaNum = Number(change.value)

      if (!isNaN(currentNum) && !isNaN(deltaNum)) {
        let result
        switch (change.mode) {
          case CONST.ACTIVE_EFFECT_MODES.ADD:
            result = currentNum + deltaNum
            break
          case CONST.ACTIVE_EFFECT_MODES.MULTIPLY:
            result = currentNum * deltaNum
            break
          case CONST.ACTIVE_EFFECT_MODES.UPGRADE:
            result = Math.max(currentNum, deltaNum)
            break
          case CONST.ACTIVE_EFFECT_MODES.DOWNGRADE:
            result = Math.min(currentNum, deltaNum)
            break
          case CONST.ACTIVE_EFFECT_MODES.OVERRIDE:
            result = deltaNum
            break
          default:
            result = null
        }

        if (result !== null) {
          const formatted = result > 0 ? `+${result}` : String(result)
          if (formatted !== current) {
            foundry.utils.setProperty(actor, change.key, formatted)
            return { [change.key]: formatted }
          }
          return {}
        }
      }
    }

    return super.apply(actor, change)
  }
}
