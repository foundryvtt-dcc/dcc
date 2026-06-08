/* global Hooks, foundry */

import DCCActiveEffect from '../active-effect.js'
import DiceChain from '../dice-chain.js'

/**
 * Active-Effects application mixin for {@link DCCActor}.
 *
 * Phase 7 (Appendix-A actor.js shrinkage): the self-contained Active-Effects
 * application engine — `applyActiveEffects` (which fully replaces core Foundry's
 * implementation to handle equipped-item transfers + DCC change types), the
 * `_resolveEffectValue` shim, and the seven per-mode `_applyXxxEffect` handlers
 * (custom / add / subtract / multiply / override / upgrade / downgrade) — was
 * lifted out of `module/actor.js` into this mixin. `DCCActor` now declares
 * `extends ActiveEffectsMixin(Actor)`, so every member below remains an instance
 * method on `DCCActor` with byte-identical behavior and `this` semantics; core
 * Foundry calls `applyActiveEffects` during data prep exactly as before, and no
 * caller changes.
 *
 * The block is self-contained: it reads only `this` / `this.effects` /
 * `this.items` / `this.overrides` / `this.tokenActiveEffectChanges`, the
 * `foundry.utils` get/setProperty helpers, the `applyActiveEffect` hook, and the
 * two imports moved here with it (`DCCActiveEffect.resolveValue` for
 * @-reference substitution, `DiceChain.bumpDie` for dice-chain add/subtract).
 * No adapter/dispatch entanglement — this is pure data-model mutation. `_getConfig`
 * stays in `actor.js` (it is also read by `prepareBaseData` / `prepareDerivedData`).
 *
 * @param {typeof Actor} Base - the Foundry document class to extend (always
 *   `Actor` in production; a stub in unit tests).
 * @returns {typeof Actor} a subclass of `Base` carrying the AE-application surface.
 */
export const ActiveEffectsMixin = (Base) => class extends Base {
  /**
   * Apply active effects to the actor
   * Collects effects from the actor and equipped items, then applies them
   * Called automatically by core Foundry prepareData
   * @param {string} phase - The application phase ("initial" or "final") - v14 requirement
   */
  applyActiveEffects (phase = 'initial') {
    // V14 calls this method twice - once for each phase
    // Only apply effects in the "initial" phase to prevent double application
    if (phase !== 'initial') return

    // Note: Do NOT call super.applyActiveEffects() here
    // This custom implementation replaces the core behavior to handle equipped item effects
    // and DCC-specific change types (diceChain, subtract). Calling super would cause effects
    // to be applied twice. DCCActiveEffect.apply() exists as a fallback for non-actor contexts
    // (e.g. if core Foundry applies effects outside this method) but is not called here.

    // Track which fields are modified by effects so form submission can exclude them (#714)
    this.overrides = {}
    const overrides = this.overrides
    const effects = []

    // Native V14 token overrides (#736): changes keyed `token.*` (e.g. token.light.dim)
    // target the TokenDocument, not the actor. Core's Actor#applyActiveEffects strips
    // the `token.` prefix and stashes them on tokenActiveEffectChanges[phase] so
    // TokenDocument#applyActiveEffects can apply them to each token. Because our
    // implementation replaces core's, we must reproduce that routing — otherwise these
    // changes fall through to the actor and crash writing a non-existent `token` field.
    this.tokenActiveEffectChanges = {}
    const tokenChanges = []

    // Collect active effects from the actor
    for (const effect of this.effects) {
      if (!effect.disabled && !effect.isSuppressed) {
        effects.push(effect)
      }
    }

    // Collect transferring effects from equipped items
    for (const item of this.items) {
      const isEquipped = item.system?.equipped ?? true
      if (isEquipped) {
        for (const effect of item.effects) {
          if (!effect.disabled && !effect.isSuppressed && effect.transfer) {
            effects.push(effect)
          }
        }
      }
    }

    // Sort effects by type to apply them in the correct order
    // Order: custom, multiply, add, subtract, downgrade, upgrade, override
    const typeOrder = { custom: 0, multiply: 1, add: 2, subtract: 3, diceChain: 3, downgrade: 4, upgrade: 5, override: 6 }
    effects.sort((a, b) => {
      const aChanges = Array.from(a.changes || [])
      const bChanges = Array.from(b.changes || [])
      const aOrder = Math.min(...aChanges.map(c => typeOrder[c.type] ?? 6), 6)
      const bOrder = Math.min(...bChanges.map(c => typeOrder[c.type] ?? 6), 6)
      return aOrder - bOrder
    })

    for (const effect of effects) {
      if (!effect.changes) continue

      for (const change of effect.changes) {
        const key = change.key

        // Route native token-override changes to the token (core Foundry v14 path).
        // Strip the `token.` prefix and stash for TokenDocument#applyActiveEffects;
        // never apply them to the actor data model (#736).
        if (typeof key === 'string' && key.startsWith('token.')) {
          tokenChanges.push({ ...change, key: key.slice(6), effect })
          continue
        }

        const type = change.type || 'add'

        // Handle different change types
        try {
          const value = this._resolveEffectValue(change.value)
          switch (type) {
            case 'custom':
              // Custom mode - let modules handle this
              this._applyCustomEffect(change, value, overrides)
              break

            case 'add':
              // Add numeric value
              this._applyAddEffect(key, value, overrides)
              break

            case 'subtract':
              // Subtract numeric value
              this._applySubtractEffect(key, value, overrides)
              break

            case 'multiply':
              // Multiply by value
              this._applyMultiplyEffect(key, value, overrides)
              break

            case 'override':
              // Override the value completely
              this._applyOverrideEffect(key, value, overrides)
              break

            case 'upgrade':
              // Use the higher value
              this._applyUpgradeEffect(key, value, overrides)
              break

            case 'downgrade':
              // Use the lower value
              this._applyDowngradeEffect(key, value, overrides)
              break

            case 'diceChain':
              // DCC dice chain type - moves dice up/down the chain (e.g. d20 → d24)
              this._applyAddEffect(key, value, overrides)
              break
          }
        } catch (err) {
          console.warn(`DCC | Failed to apply active effect change to ${key}:`, err)
        }
      }
    }

    // Hand the routed token-override changes off to core's TokenDocument pipeline.
    // We only run the "initial" phase (see the early return above), so the "final"
    // batch stays empty — matching how we apply every actor change in one pass.
    this.tokenActiveEffectChanges[phase] = tokenChanges
  }

  /**
   * Resolve @-variable references in an effect value string
   * Delegates to DCCActiveEffect.resolveValue for shared implementation
   * @param {*} value - The raw effect value (may contain @references if string)
   * @returns {*} - Strings get references replaced by numbers; non-strings pass through unchanged
   * @private
   */
  _resolveEffectValue (value) {
    return DCCActiveEffect.resolveValue(this, value)
  }

  /**
   * Apply a custom active effect.
   *
   * Our applyActiveEffects() fully replaces core Foundry's implementation, so we
   * must re-fire the `applyActiveEffect` hook that core fires for custom-mode
   * changes. Modules that drive targets the actor data model doesn't own — most
   * notably Active Token Effects (ATL), which applies token light/vision overrides
   * for torches etc. via `ATL.*` keys — listen on that hook. Without re-firing it
   * those token overrides silently no-op (#736).
   *
   * Mirrors core's pre/post comparison: any actor-owned property the hook mutates
   * is recorded in `overrides` so form submission can exclude it.
   * @param {EffectChangeData} change - The change being applied
   * @param {*} value - The resolved change value (@-references already substituted)
   * @param {Object} overrides - Accumulator of effect-modified fields
   * @private
   */
  _applyCustomEffect (change, value, overrides) {
    const key = change.key
    const current = foundry.utils.getProperty(this, key)
    Hooks.callAll('applyActiveEffect', this, { ...change, value }, current, value, overrides)
    const post = foundry.utils.getProperty(this, key)
    if (post !== current) overrides[key] = post
  }

  /**
   * Apply an additive active effect
   * Automatically detects dice expressions and uses dice chain logic
   * @private
   */
  _applyAddEffect (key, value, overrides) {
    // Treat null/undefined as 0 for ADD operations (e.g. cleric spellCheckOtherMod starts as null)
    const current = foundry.utils.getProperty(this, key) ?? 0

    const currentStr = String(current)

    // Check if the current value is a dice expression (contains 'd')
    // If so, use dice chain logic instead of numeric addition
    if (currentStr.includes('d')) {
      const steps = parseInt(value)
      if (isNaN(steps)) return

      const newValue = DiceChain.bumpDie(currentStr, steps)
      if (newValue !== currentStr) {
        foundry.utils.setProperty(this, key, newValue)
        overrides[key] = newValue
      }
      return
    }

    // Standard numeric addition
    const delta = Number(value)
    if (isNaN(delta)) return

    const currentNumber = Number(current)
    if (isNaN(currentNumber)) return

    const newValue = currentNumber + delta
    foundry.utils.setProperty(this, key, newValue)
    overrides[key] = newValue
  }

  /**
   * Apply a subtractive active effect
   * Automatically detects dice expressions and uses dice chain logic
   * @private
   */
  _applySubtractEffect (key, value, overrides) {
    const current = foundry.utils.getProperty(this, key) ?? 0

    const currentStr = String(current)

    // Check if the current value is a dice expression (contains 'd')
    // If so, use dice chain logic (negative steps = move down the chain)
    if (currentStr.includes('d')) {
      const steps = parseInt(value)
      if (isNaN(steps)) return

      // Subtract = move down the chain (negative steps)
      const newValue = DiceChain.bumpDie(currentStr, -steps)
      if (newValue !== currentStr) {
        foundry.utils.setProperty(this, key, newValue)
        overrides[key] = newValue
      }
      return
    }

    // Standard numeric subtraction
    const delta = Number(value)
    if (isNaN(delta)) return

    const currentNumber = Number(current)
    if (isNaN(currentNumber)) return

    const newValue = currentNumber - delta
    foundry.utils.setProperty(this, key, newValue)
    overrides[key] = newValue
  }

  /**
   * Apply a multiplicative active effect
   * @private
   */
  _applyMultiplyEffect (key, value, overrides) {
    const current = foundry.utils.getProperty(this, key)
    if (current == null) return

    const multiplier = Number(value)
    if (isNaN(multiplier)) return

    const currentNumber = Number(current)
    if (isNaN(currentNumber)) return

    const newValue = currentNumber * multiplier
    foundry.utils.setProperty(this, key, newValue)
    overrides[key] = newValue
  }

  /**
   * Apply an override active effect
   * @private
   */
  _applyOverrideEffect (key, value, overrides) {
    const parsedValue = (!isNaN(Number(value)) && value !== '') ? Number(value) : value
    foundry.utils.setProperty(this, key, parsedValue)
    overrides[key] = parsedValue
  }

  /**
   * Apply an upgrade active effect
   * @private
   */
  _applyUpgradeEffect (key, value, overrides) {
    const current = foundry.utils.getProperty(this, key)
    if (current == null) return

    const compareValue = Number(value)
    if (isNaN(compareValue)) return

    const currentNumber = Number(current)
    if (isNaN(currentNumber)) return

    const newValue = Math.max(currentNumber, compareValue)
    foundry.utils.setProperty(this, key, newValue)
    overrides[key] = newValue
  }

  /**
   * Apply a downgrade active effect
   * @private
   */
  _applyDowngradeEffect (key, value, overrides) {
    const current = foundry.utils.getProperty(this, key)
    if (current == null) return

    const compareValue = Number(value)
    if (isNaN(compareValue)) return

    const currentNumber = Number(current)
    if (isNaN(currentNumber)) return

    const newValue = Math.min(currentNumber, compareValue)
    foundry.utils.setProperty(this, key, newValue)
    overrides[key] = newValue
  }
}
