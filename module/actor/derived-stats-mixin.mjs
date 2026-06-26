/* global Hooks */

import { ensurePlus } from '../utilities.js'

/**
 * Derived-stat computation mixin for {@link DCCActor}.
 *
 * Phase 7 (Appendix-A actor.js shrinkage): the four cohesive derived-stat
 * computation helpers — `computeMeleeAndMissileAttackAndDamage`,
 * `computeSavingThrows`, `computeSpellCheck`, `computeInitiative` — were lifted
 * out of `module/actor.js` into this mixin. They are called from
 * `prepareBaseData` / `prepareDerivedData` and write derived values back onto
 * `this.system`; `DCCActor` now declares
 * `extends DerivedStatsMixin(ActiveEffectsMixin(Actor))`, so each remains an
 * instance method with byte-identical behavior and `this` semantics, and the
 * prepare-data pipeline calls them unchanged.
 *
 * Self-contained: reads/writes only `this.system`, uses `ensurePlus`
 * (`../utilities.js`), and `computeSpellCheck` fires the **stable
 * `dcc.afterComputeSpellCheck` extension hook** (XCC's blaster-die /
 * elf-trickster computation — see `EXTENSION_API.md`), preserved verbatim. No
 * lib/adapter/dispatch entanglement; the static `computeSpeedValue` stays in
 * `actor.js` (used inline in `prepareDerivedData` against the abilities table).
 *
 * @param {typeof import('foundry').Actor} Base - the class to extend.
 * @returns {typeof Base} a subclass carrying the derived-stat computation surface.
 */
export const DerivedStatsMixin = (Base) => class extends Base {
  /** Compute Melee/Missile Base Attack and Damage Modifiers
   */
  computeMeleeAndMissileAttackAndDamage () {
    const attackBonus = this.system.details.attackBonus || '0'
    const strengthBonus = parseInt(this.system.abilities.str.mod) || 0
    const agilityBonus = parseInt(this.system.abilities.agl.mod) || 0
    const meleeAttackBonusAdjustment = parseInt(this.system.details.attackHitBonus?.melee?.adjustment) || 0
    const meleeDamageBonusAdjustment = parseInt(this.system.details.attackDamageBonus?.melee?.adjustment) || 0
    const missileAttackBonusAdjustment = parseInt(this.system.details.attackHitBonus?.missile?.adjustment) || 0
    const missileDamageBonusAdjustment = parseInt(this.system.details.attackDamageBonus?.missile?.adjustment) || 0
    let meleeAttackBonus
    let missileAttackBonus
    let meleeAttackDamage
    let missileAttackDamage
    if (attackBonus.toString().includes('d')) {
      const deedDie = attackBonus.match(/[+-]?((\d+)?d\d+)/) ? attackBonus.match(/[+-]?((\d+)?d\d+)/)[1] : attackBonus
      const attackBonusBonus = attackBonus.match(/([+-]\d+)$/) ? parseInt(attackBonus.match(/([+-]\d+)$/)[0]) : 0
      meleeAttackBonus = `${ensurePlus(deedDie)}${ensurePlus(strengthBonus + meleeAttackBonusAdjustment + attackBonusBonus, false)}`
      missileAttackBonus = `${ensurePlus(deedDie)}${ensurePlus(agilityBonus + missileAttackBonusAdjustment + attackBonusBonus, false)}`
      meleeAttackDamage = `${ensurePlus(deedDie)}${ensurePlus(strengthBonus + meleeDamageBonusAdjustment + attackBonusBonus, false)}`
      missileAttackDamage = `${ensurePlus(deedDie)}${ensurePlus(missileDamageBonusAdjustment + attackBonusBonus, false)}`
    } else {
      const meleeAttackBonusSum = parseInt(attackBonus) + strengthBonus + meleeAttackBonusAdjustment
      const missileAttackBonusSum = parseInt(attackBonus) + agilityBonus + missileAttackBonusAdjustment
      meleeAttackBonus = `${ensurePlus(meleeAttackBonusSum)}`
      missileAttackBonus = `${ensurePlus(missileAttackBonusSum)}`
      meleeAttackDamage = `${ensurePlus(strengthBonus + meleeDamageBonusAdjustment)}`
      missileAttackDamage = `${ensurePlus(missileDamageBonusAdjustment.toString())}`
    }
    this.system.details.attackHitBonus.melee.value = meleeAttackBonus
    this.system.details.attackHitBonus.missile.value = missileAttackBonus
    this.system.details.attackDamageBonus.melee.value = meleeAttackDamage
    this.system.details.attackDamageBonus.missile.value = missileAttackDamage
    this.system.details.attackBonus = ensurePlus(attackBonus, false) || '+0'
  }

  /** Compute Saving Throws
   */
  computeSavingThrows () {
    const perMod = parseInt(this.system.abilities.per.mod)
    const aglMod = parseInt(this.system.abilities.agl.mod)
    const staMod = parseInt(this.system.abilities.sta.mod)
    const refSaveClassBonus = parseInt(this.system.saves.ref.classBonus || 0)
    const refSaveOtherBonus = parseInt(this.system.saves.ref.otherBonus || 0)
    const refSaveOverride = this.system.saves.ref.override
    const frtSaveClassBonus = parseInt(this.system.saves.frt.classBonus || 0)
    const frtSaveOtherBonus = parseInt(this.system.saves.frt.otherBonus || 0)
    const frtSaveOverride = this.system.saves.frt.override
    const wilSaveClassBonus = parseInt(this.system.saves.wil.classBonus || 0)
    const wilSaveOtherBonus = parseInt(this.system.saves.wil.otherBonus || 0)
    const wilSaveOverride = this.system.saves.wil.override

    this.system.saves.ref.value = ensurePlus(`${aglMod + refSaveClassBonus + refSaveOtherBonus}`)
    if (refSaveOverride !== null && refSaveOverride !== undefined && refSaveOverride !== '') {
      this.system.saves.ref.value = ensurePlus(parseInt(refSaveOverride))
    }
    this.system.saves.frt.value = ensurePlus(`${staMod + frtSaveClassBonus + frtSaveOtherBonus}`)
    if (frtSaveOverride !== null && frtSaveOverride !== undefined && frtSaveOverride !== '') {
      this.system.saves.frt.value = ensurePlus(parseInt(frtSaveOverride))
    }
    this.system.saves.wil.value = ensurePlus(`${perMod + wilSaveClassBonus + wilSaveOtherBonus}`)
    if (wilSaveOverride !== null && wilSaveOverride !== undefined && wilSaveOverride !== '') {
      this.system.saves.wil.value = ensurePlus(parseInt(wilSaveOverride))
    }
  }

  /**
   * Compute Spell Check
   */
  computeSpellCheck () {
    if (!this.system.class) {
      return
    }

    let abilityMod = ensurePlus(this.system.abilities.int.mod)
    const spellCheckAbility = this.system.class.spellCheckAbility
    if (spellCheckAbility === 'per') {
      abilityMod = ensurePlus(this.system.abilities.per.mod)
    } else if (spellCheckAbility === 'sta') {
      abilityMod = ensurePlus(this.system.abilities.sta.mod)
    } else if (spellCheckAbility === '') {
      abilityMod = ''
    }
    let otherMod = ''
    if (this.system.class.spellCheckOtherMod) {
      otherMod = ensurePlus(this.system.class.spellCheckOtherMod)
    }
    this.system.class.spellCheck = ensurePlus(this.system.details.level.value + abilityMod + otherMod)
    if (this.system.class.spellCheckOverride) {
      this.system.class.spellCheck = this.system.class.spellCheckOverride
    }
    if (this.system?.skills?.divineAid) {
      this.system.skills.divineAid.value = this.system.class.spellCheck
      this.system.skills.divineAid.ability = ''
      this.system.skills.turnUnholy.value = `${this.system.class.spellCheck}+${this.system.abilities.lck.mod}`
      this.system.skills.turnUnholy.ability = ''
      this.system.skills.layOnHands.value = this.system.class.spellCheck
      this.system.skills.layOnHands.ability = ''
    }

    // Stable extension hook — modules can adjust `system.class.spellCheck`
    // (and any related skill mirror fields) here without subclassing
    // DCCActor. Closes the "Actor document class customization" pain
    // point for XCC's blaster-die / elf-trickster
    // computation. See docs/dev/EXTENSION_API.md.
    Hooks.callAll('dcc.afterComputeSpellCheck', this)
  }

  /**
   * Compute Initiative
   * @param {Object} config - Actor configuration
   */
  computeInitiative (config) {
    this.system.attributes.init.value = parseInt(this.system.abilities.agl.mod) + parseInt(this.system.attributes.init.otherMod || 0)
    if (config.addClassLevelToInitiative) {
      this.system.attributes.init.value += this.system.details.level.value
    }
  }
}
