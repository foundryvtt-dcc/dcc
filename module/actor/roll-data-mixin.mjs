/* global game, ui, foundry */

import { actionMatchesUse } from '../vendor/dcc-core-lib/index.js'
import { parseDeedAttackBonus } from '../adapter/attack-input.mjs'
import { ensurePlus, substituteDeedDieResult } from '../utilities.js'

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

    // Get the relevant attack bonus: the flat values, or with a rolled attack
    // bonus the same values with the deed die replaced by its last roll (#1041)
    const attackValue = (this.getAttackBonusMode() !== 'flat')
      ? (value) => this.withLastDeedDie(value, data.details)
      : (value) => value
    customData.ab = attackValue(data.details.attackBonus)
    customData.mab = attackValue(data.details.attackHitBonus.melee.value)
    customData.mad = attackValue(data.details.attackDamageBonus.melee.value)
    customData.rab = attackValue(data.details.attackHitBonus.missile.value)
    customData.rad = attackValue(data.details.attackDamageBonus.missile.value)

    // Player only data
    if (this.type === 'Player') {
      customData.xp = data.details.xp.value || 0
    }

    return customData
  }

  /**
   * The last rolled deed die, or 0 when none counts (#1041). A deed rolled
   * during combat counts only for the round it was rolled in, and not after
   * that combat ends. One rolled outside combat counts until the next deed,
   * but not while the actor is fighting in a started combat.
   * @param {Object} [details]  The actor's system.details
   * @return {Number}
   */
  getLastDeedDie (details = this.system.details) {
    const die = parseInt(details?.lastRolledAttackBonus) || 0
    if (!die) return 0
    const combatId = details?.lastRolledAttackBonusCombat
    if (!combatId) return this._deedCombat() ? 0 : die
    const combat = game.combats?.get(combatId)
    return combat?.round === details.lastRolledAttackBonusRound ? die : 0
  }

  /**
   * The started combat this actor is fighting in, if any (#1041)
   * @return {Combat|undefined}
   */
  _deedCombat () {
    return game.combats?.find(c => c.started && c.getCombatantsByActor(this).length > 0)
  }

  /**
   * An attack bonus value with its deed die replaced by the last deed roll,
   * e.g. '+d4+3' with a 2 rolled gives 5. With no deed counting the die is 0.
   * @param {String|Number} value  An attack bonus value, e.g. attackHitBonus.melee.value
   * @param {Object} [details]     The actor's system.details
   * @return {Number|String}  The total, or the substituted formula if other dice remain
   */
  withLastDeedDie (value, details = this.system.details) {
    const deed = parseDeedAttackBonus(String(details?.attackBonus ?? ''))
    if (!deed) return value
    const formula = substituteDeedDieResult(ensurePlus(String(value ?? '+0')), deed.deedDie, this.getLastDeedDie(details)).replace(/\s/g, '')
    if (!/^[\d+-]+$/.test(formula)) return formula
    return (formula.match(/[+-]?\d+/g) || []).reduce((total, term) => total + parseInt(term), 0)
  }

  /**
   * The deed bonus for skills that use the deed die: the last deed roll plus
   * the attack bonus's flat part, or 0 when no deed counts (#1041)
   * @return {Number}
   */
  getLastDeedBonus () {
    const die = this.getLastDeedDie()
    if (!die) return 0
    return die + (parseDeedAttackBonus(String(this.system.details.attackBonus))?.attackBonus || 0)
  }

  /**
   * Remember a deed die roll, with the combat round it was rolled in if the
   * actor is fighting in a started combat (#1041). Skipped for a compendium
   * actor or one the user can't update, so the roll itself still goes ahead.
   * @param {Number} die  The deed die result
   */
  async rememberDeedDie (die) {
    if (this.pack || !this.isOwner) return
    const combat = this._deedCombat()
    await this.update({
      'system.details.lastRolledAttackBonus': die,
      'system.details.lastRolledAttackBonusCombat': combat?.id ?? '',
      'system.details.lastRolledAttackBonusRound': combat?.round ?? 0
    })
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
