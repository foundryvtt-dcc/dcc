/* global game, ui, foundry */

import { actionMatchesUse } from '../vendor/dcc-core-lib/index.js'

/**
 * Roll-input accessor mixin for {@link DCCActor}.
 *
 * Phase 7 (Appendix-A actor.js shrinkage): the three cohesive roll-input
 * accessors — `getRollData` (the `@override` that augments Foundry's roll data
 * with DCC ability/save/attack shorthands), `getAttackBonusMode` (normalizes
 * `system.config.attackBonusMode`, read only by `getRollData`), and
 * `getActionDice` (parses `system.config.actionDice` into the sheet/adapter
 * preset list, with the implicit legacy-actor migration) — were lifted out of
 * `module/actor.js` into this mixin. `DCCActor` now declares
 * `extends RollDataMixin(DerivedStatsMixin(ActiveEffectsMixin(Actor)))`, so each
 * remains an instance method with byte-identical behavior and `this` semantics.
 *
 * Transparent composition keeps the public surface unchanged: `actor.getRollData()`
 * is consumed by `item/spell-mixin.mjs`, `actor.getActionDice()` by
 * `actor-sheet/items.mjs` + `adapter/attack-input.mjs` + XCC's sheets, and
 * `super.getRollData()` still resolves up the chain to `Actor.prototype` (no
 * intervening mixin defines it). Self-contained: reads only `this.system` /
 * `this.type` / the Foundry globals (`foundry.utils.mergeObject`, `ui`, `game`).
 *
 * @param {typeof import('foundry').Actor} Base - the class to extend.
 * @returns {typeof Base} a subclass carrying the roll-input accessor surface.
 */
export const RollDataMixin = (Base) => class extends Base {
  /** @override */
  getRollData () {
    const data = super.getRollData()

    const customData = foundry.utils.mergeObject(
      data,
      {
        str: data.abilities.str.mod,
        agi: data.abilities.agl.mod,
        agl: data.abilities.agl.mod,
        sta: data.abilities.sta.mod,
        per: data.abilities.per.mod,
        int: data.abilities.int.mod,
        lck: data.abilities.lck.mod,
        initiative: data.attributes.init.value,
        maxStr: data.abilities.str.maxMod,
        maxAgi: data.abilities.agl.maxMod,
        maxAgl: data.abilities.agl.maxMod,
        maxSta: data.abilities.sta.maxMod,
        maxPer: data.abilities.per.maxMod,
        maxInt: data.abilities.int.maxMod,
        maxLck: data.abilities.lck.maxMod,
        ref: data.saves.ref.value,
        frt: data.saves.frt.value,
        wil: data.saves.wil.value,
        ac: data.attributes.ac.value,
        check: data.attributes.ac.checkPenalty,
        speed: data.attributes.speed.value,
        hp: data.attributes.hp.value,
        maxhp: data.attributes.hp.max,
        level: data.details.level.value,
        cl: data.details.level.value
      }
    )

    // Get the relevant attack bonus (direct or rolled)
    customData.ab = (this.getAttackBonusMode() !== 'flat') ? (data.details.lastRolledAttackBonus || 0) : data.details.attackBonus
    customData.mab = (this.getAttackBonusMode() !== 'flat') ? (data.details.lastRolledAttackBonus || 0) : data.details.attackHitBonus.melee.value
    customData.mad = (this.getAttackBonusMode() !== 'flat') ? (data.details.lastRolledAttackBonus || 0) : data.details.attackDamageBonus.melee.value
    customData.rab = (this.getAttackBonusMode() !== 'flat') ? (data.details.lastRolledAttackBonus || 0) : data.details.attackHitBonus.missile.value
    customData.rad = (this.getAttackBonusMode() !== 'flat') ? (data.details.lastRolledAttackBonus || 0) : data.details.attackDamageBonus.missile.value

    // Player only data
    if (this.type === 'Player') {
      customData.xp = data.details.xp.value || 0
    }

    return customData
  }

  /**
   * Get Attack Bonus Mode
   * Translate the Attack Bonus Mode into a valid value
   * Invalid values default to 'flat'
   * @return {String}  A valid Attack Bonus Mode name
   */
  getAttackBonusMode () {
    switch (this.system.config.attackBonusMode) {
      case 'flat':
        return 'flat'
      case 'manual':
        return 'manual'
      case 'autoPerAttack':
        return 'autoPerAttack'
      default:
        return 'flat'
    }
  }

  /**
   * Get Action Dice
   * @param {Object} [options]
   * @param {boolean} [options.includeUntrained]  Append the 1d10 untrained die.
   * @param {string} [options.forAction]  Multiple-action-dice soft filter
   *   (Phase 4 / D1a): `'attack'` / `'spell'` / `'check'`. When the derived
   *   `system.attributes.actionDice.list` exists (i.e. the master setting is on),
   *   presets whose corresponding slot's `use` tag bars this action — a wizard's
   *   spells-only die for a weapon attack — are dropped, so the roll dialog never
   *   offers an ineligible die (Sim 3). Best-effort by index: a preset with no
   *   matching slot is kept (the soft filter never hides more than it's sure of,
   *   and the roll path still warns). Absent `forAction`, or with no derived list
   *   (master off), the preset list is byte-identical to before.
   * @return {Array}  Array of formulae for the action dice
   */
  getActionDice (options = {}) {
    const actionDice = []
    // Gather available action dice
    try {
      // Implicit migration for legacy actors
      if (!this.system.config.actionDice) {
        this.system.config.actionDice = this.system.attributes.actionDice.value || '1d20'
      }
      if (this.system.config.actionDice.includes('+')) {
        this.system.config.actionDice = this.system.config.actionDice.replaceAll('+', ',')
      }

      if (!this.system.config.actionDice.match(/\dd/)) {
        ui.notifications.warn(game.i18n.localize('DCC.ActionDiceInvalid'))
      }
      const dieList = this.system.config.actionDice.split(',')
      dieList.forEach(termDie => {
        actionDice.push({
          label: termDie,
          formula: termDie
        })
      })
    } catch (err) {
      console.error('DCC | Failed to build action dice from config', err)
    }

    // Soft spells-only preset filter (Phase 4 / D1a). Gated on the derived list
    // existing — it is only built when the master setting is on — so the off-path
    // is untouched. Correlate each preset with its slot by index and drop the
    // ones whose `use` can't take `forAction`. The untrained die (appended below)
    // is always available, so a fully-filtered list still leaves the override.
    if (options.forAction) {
      const list = this.system.attributes?.actionDice?.list
      if (Array.isArray(list) && list.length) {
        const eligible = actionDice.filter((_preset, i) => {
          const slot = list[i]
          return !slot || actionMatchesUse(slot.use, options.forAction)
        })
        actionDice.length = 0
        actionDice.push(...eligible)
      }
    }

    if (options.includeUntrained) {
      actionDice.push({
        label: game.i18n.localize('DCC.Untrained'),
        formula: '1d10'
      })
    }
    return actionDice
  }
}
