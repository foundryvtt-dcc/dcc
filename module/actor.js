/* global Actor, ChatMessage, CONFIG, CONST, Hooks, Roll, game, ui, foundry */
// noinspection JSUnresolvedReference

import { ensurePlus, getCritTableResult, getCritTableLink, getFumbleTableResult, getNPCFumbleTableResult, getFumbleTableNameFromCritTableName, addDamageFlavorToRolls } from './utilities.js'
import DCCActiveEffect from './active-effect.js'
import DCCActorLevelChange from './actor-level-change.js'
import DiceChain from './dice-chain.js'
import {
  rollAbilityCheck as libRollAbilityCheck,
  rollCheck as libRollCheck,
  rollSavingThrow as libRollSavingThrow,
  castSpell as libCastSpell,
  calculateSpellCheck as libCalculateSpellCheck,
  rollMercurialMagic as libRollMercurialMagic,
  makeAttackRoll as libMakeAttackRoll,
  rollDamage as libRollDamage,
  rollCritical as libRollCritical,
  rollFumble as libRollFumble
} from './vendor/dcc-core-lib/index.js'
import { actorToCharacter, foundrySaveIdToLib } from './adapter/character-accessors.mjs'
import { renderAbilityCheck, renderSavingThrow, renderSkillCheck, renderSpellCheck, renderDisapprovalRoll, renderMercurialEffect } from './adapter/chat-renderer.mjs'
import { buildSpellCastInput, buildSpellCheckArgs, loadDisapprovalTable, loadMercurialMagicTable } from './adapter/spell-input.mjs'
import { createSpellEvents } from './adapter/spell-events.mjs'
import { promptSpellburnCommitment } from './adapter/roll-dialog.mjs'
import { buildAttackInput, hookTermsToBonuses, normalizeLibDie } from './adapter/attack-input.mjs'
import { buildDamageInput, extractWeaponMagicBonus, parseDamageFormula } from './adapter/damage-input.mjs'
import { buildCriticalInput, buildFumbleInput } from './adapter/crit-fumble-input.mjs'
import { logDispatch, warnIfDivergent } from './adapter/debug.mjs'

const { TextEditor } = foundry.applications.ux

// noinspection JSUnusedGlobalSymbols
/**
 * Extend the base Actor entity by defining a custom roll data structure.
 * @extends {Actor}
 */
class DCCActor extends Actor {
  /** @override */
  prepareBaseData () {
    super.prepareBaseData()

    this.isNPC = (this.type === 'NPC')
    this.isPC = (this.type === 'Player')

    // Ensure HP values are numbers
    if (this.system.attributes?.hp) {
      if (this.system.attributes.hp.max !== undefined) {
        this.system.attributes.hp.max = Number(this.system.attributes.hp.max) || 0
      }
      if (this.system.attributes.hp.value !== undefined) {
        this.system.attributes.hp.value = Number(this.system.attributes.hp.value) || 0
      }
    }

    // Ability modifiers
    const abilities = this.system.abilities
    for (const abilityId in abilities) {
      abilities[abilityId].mod = CONFIG.DCC.abilityModifiers[abilities[abilityId].value] || 0
      abilities[abilityId].maxMod = CONFIG.DCC.abilityModifiers[abilities[abilityId].max] || abilities[abilityId].mod
    }

    // Get configuration data
    const config = this._getConfig()
    const data = this.system

    // Set NPC computations to manual
    if (this.isNPC) {
      this.system.config.computeAC = false
      this.system.config.computeSpeed = false
      this.system.config.computeCheckPenalty = false
      this.system.config.computeMeleeAndMissileAttackAndDamage = false
    }

    // Cap level if required
    if (config.maxLevel) {
      data.details.level.value = Math.max(0, Math.min(data.details.level.value, parseInt(config.maxLevel)))
    }

    // Determine the correct fumble die and check penalty to use based on armor
    let fumbleDieRank = 0
    let fumbleDie = '1d4'
    let checkPenalty = 0
    if (this.itemTypes?.armor) {
      for (const armorItem of this.itemTypes.armor) {
        if (armorItem.system.equipped) {
          try {
            checkPenalty += parseInt(armorItem.system.checkPenalty || 0)
            const expression = armorItem.system.fumbleDie
            const rank = game.dcc.DiceChain.rankDiceExpression(expression)
            if (rank > fumbleDieRank) {
              fumbleDieRank = rank
              fumbleDie = expression
            }
          } catch (err) {
            // Ignore bad fumble die expressions
          }
        }
      }
    }
    data.attributes.fumble = foundry.utils.mergeObject(
      data.attributes.fumble || {},
      { die: fumbleDie }
    )
    if (data.config.computeCheckPenalty) {
      data.attributes.ac.checkPenalty = checkPenalty
    }

    // Compute derived values in prepareBaseData so items can access them during their preparation.
    // These will be called again in prepareDerivedData to update with any active effect
    // modifications to ability modifiers.
    if (config.computeMeleeAndMissileAttackAndDamage) {
      this.computeMeleeAndMissileAttackAndDamage()
    }

    // Compute spell check for PCs so spell items can inherit it
    if (this.isPC) {
      this.computeSpellCheck()
    }

    // Compute initiative for PCs so weapon items can access it
    if (this.isPC && config.computeInitiative) {
      this.computeInitiative(config)
    }
  }

  /** @override */
  prepareDerivedData () {
    super.prepareDerivedData()
    if (!this.overrides) this.overrides = {}

    // Recalculate ability modifiers after Active Effects have been applied
    // This ensures effects that modify ability values (e.g. +2 to str.value) are reflected in the modifiers
    const abilities = this.system.abilities
    for (const abilityId in abilities) {
      abilities[abilityId].mod = CONFIG.DCC.abilityModifiers[abilities[abilityId].value] || 0
      abilities[abilityId].maxMod = CONFIG.DCC.abilityModifiers[abilities[abilityId].max] || abilities[abilityId].mod
    }

    // Get configuration data
    const config = this._getConfig()

    // Compute melee/missile attack and damage bonuses (after effects have modified ability modifiers)
    if (config.computeMeleeAndMissileAttackAndDamage) {
      this.computeMeleeAndMissileAttackAndDamage()
    }

    // Compute spell check and saving throws for PCs (after effects have modified ability modifiers)
    if (this.isPC) {
      this.computeSpellCheck()
      if (config.computeSavingThrows) {
        this.computeSavingThrows()
      }
    }

    if (this.system.details.sheetClass === 'Elf') {
      this.system.skills.detectSecretDoors.value = '+4'
    }

    // For NPCs, add otherBonus to displayed save values (tracked as overrides for #714)
    if (this.isNPC) {
      const saves = this.system.saves
      for (const saveId of ['ref', 'frt', 'wil']) {
        const otherBonus = parseInt(saves[saveId].otherBonus || 0)
        if (otherBonus !== 0) {
          const baseValue = parseInt(saves[saveId].value || 0)
          saves[saveId].value = baseValue + otherBonus
          this.overrides[`system.saves.${saveId}.value`] = saves[saveId].value
        }
      }
    }

    // For NPCs, add init.otherMod to init.value (after effects are applied)
    if (this.isNPC) {
      const initOtherMod = parseInt(this.system.attributes.init.otherMod || 0)
      if (initOtherMod !== 0) {
        const baseInit = parseInt(this.system.attributes.init.value || 0)
        this.system.attributes.init.value = baseInit + initOtherMod
        this.overrides['system.attributes.init.value'] = this.system.attributes.init.value
      }
    }

    // For NPCs with computeAC disabled, add ac.otherMod to ac.value (after effects are applied)
    if (this.isNPC && !config.computeAC) {
      const acOtherMod = parseInt(this.system.attributes.ac.otherMod || 0)
      if (acOtherMod !== 0) {
        const baseAC = parseInt(this.system.attributes.ac.value || 10)
        this.system.attributes.ac.value = baseAC + acOtherMod
        this.overrides['system.attributes.ac.value'] = this.system.attributes.ac.value
      }
    }

    // Set base speed from current speed if not present (for display purposes only)
    if (!this.system.attributes.speed.base) {
      this.system.attributes.speed.base = this.system.attributes.speed.value
    }

    // Compute AC if required
    if (config.computeAC || config.computeSpeed) {
      const baseACAbility = this.system.abilities[config.baseACAbility] || { mod: 0 }
      const baseSpeed = parseInt(this.system.attributes.speed.base)
      const abilityMod = baseACAbility.mod
      const acOtherMod = parseInt(this.system.attributes.ac.otherMod) || 0
      const abilityLabel = baseACAbility.label
      let armorBonus = 0
      let speedPenalty = 0
      for (const armorItem of this.itemTypes.armor) {
        if (armorItem.system.equipped) {
          armorBonus += parseInt(armorItem.system.acBonus || '0')
          speedPenalty += parseInt(armorItem.system.speed || '0')
        }
      }
      if (config.computeAC) {
        this.system.attributes.ac.baseAbility = abilityMod
        this.system.attributes.ac.baseAbilityLabel = abilityLabel
        this.system.attributes.ac.armorBonus = armorBonus
        this.system.attributes.ac.value = 10 + abilityMod + armorBonus + acOtherMod
      }
      if (config.computeSpeed) {
        this.system.attributes.ac.speedPenalty = speedPenalty
        // Preserve any modifier already applied to value (e.g. by an active
        // effect targeting system.attributes.speed.value) — without this,
        // recomputing from base would clobber speed-modifying effects.
        const currentValue = parseInt(this.system.attributes.speed.value)
        const valueModifier = isNaN(currentValue) ? 0 : currentValue - baseSpeed
        this.system.attributes.speed.value = baseSpeed + speedPenalty + valueModifier
      }
    }

    // Compute Initiative if required
    if (this.isPC && config.computeInitiative) {
      this.computeInitiative(config)
    }

    // Re-prepare embedded items so they can see active effect modifications
    // Items initially prepare before applyActiveEffects runs, so they need
    // to re-read actor values that may have been modified by effects
    for (const item of this.items) {
      item.prepareData()
    }
  }

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
        const type = change.type || 'add'

        // Handle different change types
        try {
          const value = this._resolveEffectValue(change.value)
          switch (type) {
            case 'custom':
              // Custom mode - let modules handle this
              this._applyCustomEffect(key, value)
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
   * Apply a custom active effect (extensibility hook for DCC-specific mechanics)
   * @private
   */
  _applyCustomEffect (key, value) {
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

  /**
   * Get per actor configuration
   *
   * @return {Object}       Configuration data
   */
  _getConfig () {
    let defaultConfig = {
      attackBonusMode: 'flat',
      actionDice: '1d20',
      maxLevel: '',
      computeAC: false,
      computeMeleeAndMissileAttackAndDamage: true,
      computeSpeed: false,
      baseACAbility: 'agl',
      sortInventory: true,
      removeEmptyItems: true,
      showSpells: false,
      showSkills: false,
      showBackstab: false
    }

    // Merge any existing data with defaults to implicitly migrate missing config fields
    defaultConfig = Object.assign(defaultConfig, this.system.config)
    this.system.config = defaultConfig

    return defaultConfig
  }

  /**
   * Build a damage breakdown string showing damage by type
   * Only returns a string if there are multiple damage types
   * @param {Roll} roll - The evaluated damage roll
   * @returns {string|null} - Breakdown string like "3 + 5 fire" or null if single type
   */
  _buildDamageBreakdown (roll) {
    // Collect damage totals by flavor
    const damageByFlavor = new Map()

    for (const term of roll.terms) {
      // Skip operator terms
      if (term.operator) continue

      // Get the term's total and flavor
      const total = term.total ?? 0
      const flavor = term.flavor || ''

      // Accumulate damage by flavor
      damageByFlavor.set(flavor, (damageByFlavor.get(flavor) || 0) + total)
    }

    // Only show breakdown if there are multiple distinct damage types
    if (damageByFlavor.size <= 1) return null

    // Build the breakdown string
    const parts = []
    for (const [flavor, total] of damageByFlavor) {
      if (flavor) {
        parts.push(`${total} ${flavor}`)
      } else {
        parts.push(`${total}`)
      }
    }

    return parts.join(' + ')
  }

  /* -------------------------------------------- */

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
      console.log(err)
    }

    if (options.includeUntrained) {
      actionDice.push({
        label: game.i18n.localize('DCC.Untrained'),
        formula: '1d10'
      })
    }
    return actionDice
  }

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
    // DCCActor. Closes ARCHITECTURE_REIMAGINED.md §2.5 "Actor document
    // class customization" for XCC's blaster-die / elf-trickster
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

  /**
   * Level Change
   */
  levelChange () {
    new DCCActorLevelChange({ document: this }).render(true)
  }

  /**
   * Roll an Ability Check.
   *
   * Phase 1 of the adapter refactor: the simple path (no dialog,
   * no rollUnder) flows through the lib via character-accessors →
   * two-pass `libRollAbilityCheck` (mode: 'formula' / 'evaluate') →
   * chat-renderer. The dialog / rollUnder / CheckPenalty-display
   * paths fall through to the legacy implementation below, which
   * remains the source of truth for those UX flows until later
   * phases migrate them.
   *
   * Signature and emitted chat-message flags are preserved — dcc-qol
   * and token-action-hud-dcc depend on the public shape of this
   * method.
   *
   * @param {String} abilityId  The ability ID (e.g. "str")
   * @param {Object} options    Options which configure how ability checks are rolled
   */
  async rollAbilityCheck (abilityId, options = {}) {
    const checkPenaltyValue = parseInt(this.system.attributes?.ac?.checkPenalty ?? 0)
    const hasNonZeroCheckPenalty =
      this.system.config?.computeCheckPenalty &&
      (abilityId === 'str' || abilityId === 'agl') &&
      checkPenaltyValue !== 0

    // Truthy checks — the sheet's fillRollOptions uses bitwise XOR,
    // which returns 0 or 1, not true/false. Strict === would miss those.
    const needsLegacyPath =
      !!options.rollUnder ||
      !!options.showModifierDialog ||
      hasNonZeroCheckPenalty

    if (needsLegacyPath) {
      return this._rollAbilityCheckLegacy(abilityId, options)
    }

    return this._rollAbilityCheckViaAdapter(abilityId, options)
  }

  /**
   * Adapter path for ability checks. Two-pass sync flow:
   * pass 1 asks the lib for the formula (no evaluation), Foundry
   * rolls it, pass 2 classifies against the same natural for crit
   * / fumble and emits the chat message via the renderer.
   * @private
   */
  async _rollAbilityCheckViaAdapter (abilityId, options) {
    logDispatch('rollAbilityCheck', 'adapter', { abilityId })
    const abilityLabel = game.i18n.localize(CONFIG.DCC.abilities[abilityId])

    const character = actorToCharacter(this)

    // Pass 1: ask the lib for the formula it wants rolled (no evaluation).
    const plan = libRollAbilityCheck(abilityId, character, {
      mode: 'formula',
      luckBurn: options.luckBurn
    })

    // Foundry rolls the FULL formula so the Roll object has the correct
    // display-total (dice + modifiers), not just the naked dice total.
    // Keep the Roll reference; .evaluate() returns `this` in real Foundry
    // but returns a plain object in some test mocks.
    const foundryRoll = new Roll(plan.formula)
    await foundryRoll.evaluate()

    // Extract the natural die value from the Foundry Roll so the lib's
    // second pass classifies against the same dice outcome we'll display.
    const primaryDie = foundryRoll.dice?.[0]
    const natural = primaryDie?.total ?? foundryRoll.total

    // Pass 2: lib classifies the rolled result (crit / fumble / resources /
    // applied flags on modifiers). The sync roller returns the pre-rolled
    // natural so the lib doesn't re-roll.
    const result = libRollAbilityCheck(abilityId, character, {
      mode: 'evaluate',
      roller: () => natural,
      luckBurn: options.luckBurn
    })

    return renderAbilityCheck({
      actor: this,
      abilityId,
      abilityLabel,
      result,
      foundryRoll
    })
  }

  /**
   * Legacy ability-check path. Used when the options flags require
   * structured terms (modifier dialog, rollUnder, check-penalty
   * display). Preserved verbatim until later phases migrate these.
   * @private
   */
  async _rollAbilityCheckLegacy (abilityId, options = {}) {
    logDispatch('rollAbilityCheck', 'legacy', { abilityId })
    const ability = this.system.abilities[abilityId]
    ability.mod = CONFIG.DCC.abilityModifiers[ability.value] || 0
    ability.label = CONFIG.DCC.abilities[abilityId]
    const abilityLabel = game.i18n.localize(ability.label)
    let flavor = `${abilityLabel} ${game.i18n.localize('DCC.Check')}`

    options.title = flavor

    let roll
    const flags = {}

    if (abilityId === 'str' || abilityId === 'agl') {
      flags.checkPenaltyCouldApply = true
    }

    // Allow requesting roll under (for Luck Checks)
    if (options.rollUnder) {
      const terms = [
        {
          type: 'Die',
          formula: '1d20'
        }
      ]

      roll = await game.dcc.DCCRoll.createRoll(terms, {}, options)

      // Apply custom roll options
      roll.terms[0].options.dcc = {
        rollUnder: true,
        lowerThreshold: ability.value,
        upperThreshold: ability.value + 1
      }

      // Generate flags for the roll
      Object.assign(flags, {
        'dcc.RollType': 'AbilityCheckRollUnder',
        'dcc.Ability': abilityId,
        'dcc.isAbilityCheck': true
      })

      flavor = `${abilityLabel} ${game.i18n.localize('DCC.CheckRollUnder')}`
    } else {
      const die = this.system.attributes.actionDice.value || '1d20'

      // Collate terms for the roll
      const terms = [
        {
          type: 'Die',
          label: game.i18n.localize('DCC.ActionDie'),
          formula: die,
          presets: this.getActionDice({ includeUntrained: true })
        },
        {
          type: 'Modifier',
          label: abilityLabel,
          formula: ensurePlus(ability.mod)
        }
      ]

      if (this.system.config.computeCheckPenalty && flags.checkPenaltyCouldApply) {
        terms.push({
          type: 'CheckPenalty',
          formula: ensurePlus(this.system.attributes.ac.checkPenalty || '0'),
          apply: false
        })
      }

      roll = await game.dcc.DCCRoll.createRoll(terms, {}, options)

      // Evaluate the roll so we have a total
      await roll.evaluate()

      // Generate flags for the roll
      Object.assign(flags, {
        'dcc.RollType': 'AbilityCheck',
        'dcc.Ability': abilityId,
        'dcc.isAbilityCheck': true
      })
      game.dcc.FleetingLuck.updateFlags(flags, roll)
    }

    // Calculate what the total would be if check penalty applies
    // Only show this if the check penalty was NOT already applied to the roll
    let checkPenaltyRoll = null
    if (flags.checkPenaltyCouldApply && this.system.config.computeCheckPenalty) {
      const checkPenalty = parseInt(this.system.attributes.ac.checkPenalty || 0)
      if (checkPenalty !== 0) {
        // Check if the check penalty was already applied by examining the roll formula
        // If it was applied, the formula will include the check penalty value
        // If it wasn't applied, it will show as +0 or -0
        const checkPenaltyApplied = roll.formula.includes(ensurePlus(checkPenalty))

        if (!checkPenaltyApplied) {
          const checkPenaltyTotal = roll.total + checkPenalty
          // Create a Roll object for the check penalty total
          checkPenaltyRoll = new Roll(checkPenaltyTotal.toString())
          await checkPenaltyRoll.evaluate()
        }
      }
    }

    // Convert the roll to a chat message
    const messageData = await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor,
      flags,
      system: {
        checkPenaltyRollIndex: checkPenaltyRoll ? 1 : null
      }
    }, { create: false })

    // Add the check penalty roll to the rolls array
    if (checkPenaltyRoll) {
      messageData.rolls.push(checkPenaltyRoll)
    }

    ChatMessage.create(messageData)
  }

  // noinspection JSUnusedGlobalSymbols
  /**
   * Generate Initiative Roll formula. Invoked by Foundry's core init
   * flow via `DCCCombatant.getInitiativeRoll`, and by `rollInit` when
   * a modifier dialog is requested.
   *
   * Phase 1 adapter dispatcher. The default (no-dialog) path flows
   * through the lib via `rollCheck(mode: 'formula')` — the lib builds
   * the formula string, Foundry evaluates it. Init has no gameplay
   * crit/fumble semantics, so there's no pass-2 classification; the
   * chat message is emitted by Foundry's core `Combat#rollInitiative`
   * (with the `core.initiativeRoll` flag that `emoteInitiativeRoll`
   * gates on). The dialog path falls through to the legacy body below,
   * which preserves the structured-term shape the modifier dialog
   * relies on.
   *
   * Return shape is unchanged: a Foundry `Roll` the combat tracker
   * evaluates.
   */
  getInitiativeRoll (formula, options = {}) {
    // Handle coming back from a modifier dialog with a pre-built Roll.
    if (formula instanceof Roll) {
      return formula
    }

    if (options.showModifierDialog) {
      return this._getInitiativeRollLegacy(options)
    }

    return this._getInitiativeRollViaAdapter(options)
  }

  /**
   * Adapter path for initiative. Builds a lib `SkillDefinition` with
   * no ability (init.value already bakes in agl mod + otherMod + class
   * level from `computeInitiative`), emits init.value as a single
   * aggregate `add` modifier, and asks the lib for the formula string.
   * Weapon-die overrides (two-handed / custom init die) are applied
   * Foundry-side because the `[Two-Handed]` / `[Weapon]` die label is
   * a Foundry display idiom the lib doesn't model.
   * @private
   */
  _getInitiativeRollViaAdapter (options = {}) {
    let dieFormula = this.system.attributes.init.die || '1d20'
    let weaponLabel = null

    const twoHandedWeapon = this.items.find(t => t.system.twoHanded && t.system.equipped)
    if (twoHandedWeapon) {
      dieFormula = twoHandedWeapon.system.initiativeDie
      weaponLabel = game.i18n.localize('DCC.WeaponPropertiesTwoHanded')
    }
    const customInitDieWeapon = this.items.find(t => (t.system.config?.initiativeDieOverride || '') && t.system.equipped)
    if (customInitDieWeapon) {
      dieFormula = customInitDieWeapon.system.initiativeDie
      weaponLabel = game.i18n.localize('DCC.Weapon')
    }

    logDispatch('rollInit', 'adapter', { die: dieFormula })

    const libDie = this._stripDieCount(dieFormula) || 'd20'
    const initValue = parseInt(this.system.attributes.init.value) || 0

    const definition = {
      id: 'initiative',
      name: game.i18n.localize('DCC.Initiative'),
      type: 'check',
      roll: {
        die: libDie,
        levelModifier: 'none'
      }
    }

    const modifiers = initValue !== 0
      ? [{
          kind: 'add',
          value: initValue,
          origin: {
            category: 'other',
            id: 'initiative-total',
            label: game.i18n.localize('DCC.Initiative')
          }
        }]
      : []

    const character = actorToCharacter(this)
    const plan = libRollCheck(definition, character, {
      mode: 'formula',
      modifiers
    })

    // Re-inject the Foundry `[Two-Handed]` / `[Weapon]` die label so the
    // Roll Breakdown surfaces where the die came from.
    const finalFormula = weaponLabel
      ? plan.formula.replace(/^(1d\d+)/i, `$1[${weaponLabel}]`)
      : plan.formula

    return new Roll(finalFormula, this.getRollData())
  }

  /**
   * Legacy initiative path. Builds structured `DCCRoll.createRoll`
   * terms — required by the roll-modifier dialog's preset handling,
   * which the adapter path doesn't support.
   * @private
   */
  _getInitiativeRollLegacy (options = {}) {
    let die = this.system.attributes.init.die || '1d20'
    const init = ensurePlus(this.system.attributes.init.value)
    options.title = game.i18n.localize('DCC.RollModifierTitleInitiative')

    const twoHandedWeapon = this.items.find(t => t.system.twoHanded && t.system.equipped)
    if (twoHandedWeapon) {
      die = `${twoHandedWeapon.system.initiativeDie}[${game.i18n.localize('DCC.WeaponPropertiesTwoHanded')}]`
    }
    const customInitDieWeapon = this.items.find(t => (t.system.config?.initiativeDieOverride || '') && t.system.equipped)
    if (customInitDieWeapon) {
      die = `${customInitDieWeapon.system.initiativeDie}[${game.i18n.localize('DCC.Weapon')}]`
    }

    logDispatch('rollInit', 'legacy', { die })

    const terms = [
      {
        type: 'Die',
        formula: die
      },
      {
        type: 'Modifier',
        label: game.i18n.localize('DCC.Initiative'),
        formula: init
      }
    ]

    return game.dcc.DCCRoll.createRoll(terms, this.getRollData(), options)
  }

  /**
   * Optionally show modifier dialog, then pass off to Foundry's actor rollInitiative
   * @param event
   * @param options
   * @param token
   * @returns {Promise<void>}
   */
  async rollInit (event, options, token) {
    if (token?.combatant?.initiative || this.inCombat) {
      ui.notifications.warn(game.i18n.localize('DCC.AlreadyHasInitiative'))
      return
    }

    let formula = null
    if (options?.showModifierDialog) {
      formula = await this.getInitiativeRoll(formula, { showModifierDialog: true })
    }

    const initOptions = {
      createCombatants: true,
      initiativeOptions: {
        formula
      }
    }

    if (token) {
      token.actor.rollInitiative(initOptions)
    } else {
      await this.rollInitiative(initOptions)
    }
  }

  // noinspection JSUnusedGlobalSymbols
  /**
   * Roll Hit Dice
   * Used by the core Foundry methods
   */
  async rollHitDice (options = {}) {
    let die = this.system.attributes.hitDice.value || '1d4'
    options.title = game.i18n.localize('DCC.RollModifierHitDice')

    // Handle fractional HD
    let fraction = ''
    if (die.startsWith('1⁄2') || die.startsWith('½')) {
      die = die.replace('1/2', '1').replace('½', '1')
      fraction = `ceil(${die}/2)`
    }
    if (die.startsWith('1⁄4') || die.startsWith('¼')) {
      die = die.replace('1/4', '1').replace('¼', '1')
      fraction = `ceil(${die}/4)`
    }

    // Collate terms for the roll
    const terms = [
      {
        type: 'Compound',
        formula: fraction || die
      }
    ]

    // Players have a stamina modifier they can add
    if (this.type === 'Player') {
      const staminaMod = ensurePlus(this.system.abilities.sta.mod) || '+0'
      terms.push({
        type: 'Modifier',
        label: game.i18n.localize('DCC.AbilitySta'),
        formula: staminaMod
      })
    }

    const roll = await game.dcc.DCCRoll.createRoll(terms, this.getRollData(), options)

    if (this.type !== 'Player') {
      await roll.evaluate()

      await this.update({
        'system.attributes.hp.max': Number(roll.total),
        'system.attributes.hp.value': Number(roll.total)
      })
    }

    // Convert the roll to a chat message
    roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.localize('DCC.HitDice'),
      flags: {
        'dcc.RollType': 'HitDice'
      }
    })
  }

  /**
   * Roll a Saving Throw.
   *
   * Phase 1 of the adapter refactor: the simple path (no dialog) flows
   * through the lib via character-accessors → two-pass formula/evaluate
   * → chat-renderer. The dialog path falls through to the legacy
   * implementation below, preserved verbatim until later phases.
   *
   * Signature and emitted chat-message flags are preserved — downstream
   * modules depend on the public shape of this method.
   *
   * @param {String} saveId       The save ID (e.g. "ref"/"frt"/"wil")
   * @param {Object} options      Roll options
   */
  async rollSavingThrow (saveId, options = {}) {
    // Truthy checks — the sheet's fillRollOptions uses bitwise XOR,
    // which returns 0 or 1, not true/false. Strict === would miss those.
    const needsLegacyPath =
      !!options.showModifierDialog ||
      !!options.rollUnder

    if (needsLegacyPath) {
      return this._rollSavingThrowLegacy(saveId, options)
    }

    return this._rollSavingThrowViaAdapter(saveId, options)
  }

  /**
   * Adapter path for saving throws. Two-pass sync flow:
   * Pass 1 asks the lib for the formula, Foundry evaluates the full
   * formula so its Roll.total includes modifiers, Pass 2 classifies
   * against the same natural for crit/fumble/resources.
   * @private
   */
  async _rollSavingThrowViaAdapter (saveId, options) {
    logDispatch('rollSavingThrow', 'adapter', { saveId })
    const saveLabel = game.i18n.localize(CONFIG.DCC.saves[saveId])
    const character = actorToCharacter(this)
    const libSaveId = foundrySaveIdToLib(saveId)

    // Pass 1: ask the lib for the formula (no evaluation).
    const plan = libRollSavingThrow(libSaveId, character, {
      mode: 'formula'
    })

    const foundryRoll = new Roll(plan.formula)
    await foundryRoll.evaluate()

    const primaryDie = foundryRoll.dice?.[0]
    const natural = primaryDie?.total ?? foundryRoll.total

    // Pass 2: lib classifies the rolled result.
    const result = libRollSavingThrow(libSaveId, character, {
      mode: 'evaluate',
      roller: () => natural
    })

    await renderSavingThrow({
      actor: this,
      saveId,
      saveLabel,
      result,
      foundryRoll,
      options
    })

    // Legacy rollSavingThrow returned the evaluated Roll; preserve
    // that contract for downstream macros / tests.
    return foundryRoll
  }

  /**
   * Legacy saving-throw path. Used when the options flags require
   * structured terms (modifier dialog, rollUnder). Preserved verbatim
   * until later phases migrate those flows.
   * @private
   */
  async _rollSavingThrowLegacy (saveId, options = {}) {
    logDispatch('rollSavingThrow', 'legacy', { saveId })
    const save = this.system.saves[saveId]
    const die = '1d20'
    save.label = CONFIG.DCC.saves[saveId]
    const modifierLabel = game.i18n.localize(save.label)
    let flavor = `${modifierLabel} ${game.i18n.localize('DCC.Save')}`
    options.title = flavor

    // Collate terms for the roll
    const terms = [
      {
        type: 'Die',
        formula: die
      },
      {
        type: 'Modifier',
        label: modifierLabel,
        formula: ensurePlus(save.value)
      }
    ]

    const roll = await game.dcc.DCCRoll.createRoll(terms, this.getRollData(), options)

    await roll.evaluate()

    // Check against DC if provided
    if (options.dc !== undefined) {
      const dc = parseInt(options.dc)
      if (Number.isFinite(dc)) {
        const success = roll.total >= dc
        const resultLabel = success
          ? game.i18n.localize('DCC.SaveSuccess')
          : game.i18n.localize('DCC.SaveFailure')
        if (options.showDc) {
          flavor += ` (${game.i18n.format('DCC.SaveDC', { dc })}) — ${resultLabel}`
        } else {
          flavor += ` — ${resultLabel}`
        }
      }
    }

    // Generate flags for the roll
    const flags = {
      'dcc.RollType': 'SavingThrow',
      'dcc.isSave': true,
      'dcc.Save': saveId
    }
    game.dcc.FleetingLuck.updateFlags(flags, roll)

    // Convert the roll to a chat message
    roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor,
      flags
    })

    return roll
  }

  /**
   * Roll a Skill Check.
   *
   * Phase 1 adapter dispatcher. Ordinary skill rolls (built-in skills
   * and skill items with a die, no dialog / no disapproval / no skill
   * table) flow through the lib via the two-pass formula/evaluate
   * pattern. Dialog, cleric disapproval, skill-table routing, and
   * description-only fallbacks stay on the legacy path.
   *
   * Signature and emitted chat-message flags are preserved —
   * downstream modules depend on this public surface.
   *
   * @param {String} skillId  The skill ID (e.g. "sneakSilently")
   * @param {Object} options  Roll options
   */
  async rollSkillCheck (skillId, options = {}) {
    const resolved = this._resolveSkill(skillId)

    // Title for the roll modifier dialog — legacy mutates options,
    // keep the behavior so the dialog path still sees it.
    if (resolved.skill) {
      options.title = game.i18n.localize(resolved.skill.label) ||
        (game.i18n.localize('DCC.AbilityCheck') + resolved.abilityLabel)
    }

    const hasSkillTable = !!CONFIG.DCC?.skillTables?.[skillId]
    const needsLegacyPath =
      !!options.showModifierDialog ||
      !!resolved.skill?.useDisapprovalRange ||
      hasSkillTable ||
      !resolved.hasDie

    if (needsLegacyPath) {
      return this._rollSkillCheckLegacy(skillId, options, resolved)
    }

    return this._rollSkillCheckViaAdapter(skillId, options, resolved)
  }

  /**
   * Normalize a skill reference (built-in slot or skill item) to the
   * shared bundle both dispatch paths consume. Extracted from the
   * legacy dispatcher so the adapter can reuse the same resolution.
   * @private
   */
  _resolveSkill (skillId) {
    let skill = this.system.skills ? this.system.skills[skillId] : null
    let skillItem = null
    if (!skill) {
      skillItem = this.itemTypes.skill.find(i => i.name === skillId)
      if (skillItem) {
        skill = {
          label: skillItem.name
        }
        if (skillItem.system.config.useAbility) {
          skill.ability = skillItem.system.ability || null
        }
        if (skillItem.system.config.useDie) {
          skill.die = skillItem.system.die || null
        }
        if (skillItem.system.config.useValue) {
          skill.value = skillItem.system.value ?? undefined
        }
        if (skillItem.system.config.useLevel) {
          skill.level = `+${this.system.details.level.value ?? 0}`
        }
      }
    }

    if (skill?.config?.useLevel) {
      skill.level = `+${this.system.details.level.value ?? 0}`
    }

    let die = (skill?.die && skill.die.trim()) ? skill.die : null
    let hasDie = !!die

    if (skill?.useDisapprovalRange && this.system.class.spellCheckOverrideDie) {
      die = this.system.class.spellCheckOverrideDie
      hasDie = true
    }

    if (!hasDie && !skillItem && skill) {
      die = this.getActionDice()[0].formula || '1d20'
      hasDie = true
    }

    const abilityId = skill?.ability && skill.ability.trim() ? skill.ability : null
    const abilityLabel = abilityId
      ? ` (${game.i18n.localize(CONFIG.DCC.abilities[abilityId])})`
      : ''
    const abilityMod = abilityId
      ? parseInt(this.system.abilities[abilityId]?.mod || '0')
      : 0

    return {
      skill,
      skillItem,
      abilityId,
      abilityLabel,
      abilityMod,
      die,
      hasDie
    }
  }

  /**
   * Adapter path for skill checks. Two-pass sync flow mirroring
   * `_rollSavingThrowViaAdapter`: pass 1 asks the lib for the formula,
   * Foundry evaluates it (so Roll.total includes every modifier),
   * pass 2 classifies against the same natural for crit/fumble.
   * @private
   */
  async _rollSkillCheckViaAdapter (skillId, options, resolved) {
    logDispatch('rollSkillCheck', 'adapter', { skillId })
    const { skill, skillItem, abilityId, abilityLabel } = resolved

    const character = actorToCharacter(this)
    const definition = this._buildSkillDefinition(skillId, resolved)
    const modifiers = this._buildSkillCheckModifiers(skillId, resolved)

    // Pass 1: lib builds the formula (no evaluation).
    const plan = libRollCheck(definition, character, {
      mode: 'formula',
      modifiers
    })

    const foundryRoll = new Roll(plan.formula)
    await foundryRoll.evaluate()

    const natural = foundryRoll.dice?.[0]?.total ?? foundryRoll.total

    // Pass 2: lib classifies against the rolled natural.
    const result = libRollCheck(definition, character, {
      mode: 'evaluate',
      roller: () => natural,
      modifiers
    })

    const skillLabel = game.i18n.localize(skill.label)

    await renderSkillCheck({
      actor: this,
      skillId,
      skillLabel,
      abilityId,
      abilityLabel,
      skillItem,
      result,
      foundryRoll
    })

    if (skillItem && skillItem.system.config.showLastResult) {
      skillItem.update({ 'system.lastResult': foundryRoll.total })
    }

    return foundryRoll
  }

  /**
   * Build a lib `SkillDefinition` for a resolved skill. Ability
   * modifier and level are added by the lib from the character
   * (see `roll.ability` / `roll.levelModifier`). Other Foundry-side
   * modifiers (skill value, deed, check penalty) are emitted as
   * situational modifiers in `_buildSkillCheckModifiers`.
   * @private
   */
  _buildSkillDefinition (skillId, { skill, die, abilityId }) {
    // Foundry stores `1d14`; lib's DieType is just `d14`.
    const libDie = this._stripDieCount(die) || 'd20'

    const definition = {
      id: `skill:${skillId}`,
      name: game.i18n.localize(skill.label),
      type: 'check',
      roll: {
        die: libDie,
        levelModifier: 'none'
      }
    }

    if (abilityId) {
      definition.roll.ability = abilityId
    }

    return definition
  }

  /**
   * Emit the situational modifiers the lib needs to produce the same
   * total the legacy term list would have: skill value, level (when
   * useLevel is true), Mighty Deed's last attack bonus, and the
   * armor check penalty for skills that honor it.
   * @private
   */
  _buildSkillCheckModifiers (skillId, { skill, abilityMod }) {
    const modifiers = []
    const skillLabel = game.i18n.localize(skill.label)

    if (skill.value !== undefined) {
      const valueNum = parseInt(String(skill.value), 10) || 0
      // Legacy folded ability mod into the same Compound term as skill
      // value. The lib adds ability mod on its own from roll.ability,
      // so we emit just skill.value here — total arithmetic matches.
      if (valueNum !== 0 || abilityMod === 0) {
        modifiers.push({
          kind: 'add',
          value: valueNum,
          origin: {
            category: 'other',
            id: 'skill-value',
            label: skillLabel
          }
        })
      }
    }

    if (skill.level !== undefined && skill.level !== 0) {
      const levelNum = parseInt(String(skill.level), 10) || 0
      if (levelNum !== 0) {
        modifiers.push({
          kind: 'add',
          value: levelNum,
          origin: {
            category: 'level',
            id: 'level',
            label: game.i18n.localize('DCC.Level')
          }
        })
      }
    }

    if (skill.useDeed && this.system.details.lastRolledAttackBonus) {
      const deedNum = parseInt(String(this.system.details.lastRolledAttackBonus), 10)
      if (Number.isFinite(deedNum) && deedNum !== 0) {
        modifiers.push({
          kind: 'add',
          value: deedNum,
          origin: {
            category: 'class-feature',
            id: 'mighty-deed',
            label: game.i18n.localize('DCC.DeedRoll')
          }
        })
      }
    }

    const checkPenaltyCouldApply =
      ['sneakSilently', 'climbSheerSurfaces'].includes(skillId) ||
      !!skill.config?.applyCheckPenalty
    if (checkPenaltyCouldApply) {
      const penaltyNum = parseInt(String(this.system.attributes.ac.checkPenalty || '0'), 10)
      if (Number.isFinite(penaltyNum) && penaltyNum !== 0) {
        modifiers.push({
          kind: 'add',
          value: penaltyNum,
          origin: {
            category: 'penalty',
            id: 'armor-check-penalty',
            label: game.i18n.localize('DCC.CheckPenalty')
          }
        })
      }
    }

    return modifiers
  }

  /**
   * Turn a Foundry die formula like `'1d14'` into the bare die type
   * `'d14'` the lib's SkillDefinition wants. Returns null when the
   * input can't be parsed.
   * @private
   */
  _stripDieCount (formula) {
    if (!formula) return null
    const match = /^(?:\d+)?(d\d+)$/i.exec(formula.trim())
    return match ? match[1].toLowerCase() : null
  }

  /**
   * Legacy skill-check path. Used when the dispatcher detects a
   * modifier dialog, cleric disapproval, a skill-table lookup, or
   * a no-die / description-only case — all paths the adapter does
   * not yet cover. Preserved verbatim from the pre-migration logic.
   * @private
   */
  async _rollSkillCheckLegacy (skillId, options, resolved) {
    logDispatch('rollSkillCheck', 'legacy', { skillId })
    const { skill, skillItem, abilityLabel, abilityMod, die, hasDie } = resolved

    const terms = []

    if (hasDie) {
      terms.push({
        type: 'Die',
        label: skill.die ? null : game.i18n.localize('DCC.ActionDie'),
        formula: die,
        presets: this.getActionDice({ includeUntrained: true })
      })
    }

    if (skill.value !== undefined) {
      let formula = skill.value.toString()
      if (abilityMod !== 0) {
        formula = `${skill.value} + ${abilityMod}`
      }
      terms.push({
        type: 'Compound',
        dieLabel: game.i18n.localize('DCC.RollModifierDieTerm'),
        modifierLabel: game.i18n.localize(skill.label) + abilityLabel,
        formula
      })
    }

    if (skill.level && skill.level !== 0) {
      const formula = `${skill.level}`
      terms.push({
        type: 'Compound',
        dieLabel: game.i18n.localize('DCC.RollModifierDieTerm'),
        modifierLabel: game.i18n.localize('DCC.Level'),
        formula
      })
    }

    if (skill.useDeed && this.system.details.lastRolledAttackBonus) {
      terms.push({
        type: 'Modifier',
        label: game.i18n.localize('DCC.DeedRoll'),
        formula: parseInt(this.system.details.lastRolledAttackBonus)
      })
    }

    let checkPenaltyCouldApply = false
    if (['sneakSilently', 'climbSheerSurfaces'].includes(skillId)) {
      checkPenaltyCouldApply = true
    }
    if (skill.config?.applyCheckPenalty) {
      checkPenaltyCouldApply = true
    }
    const checkPenalty = ensurePlus(this.system.attributes.ac.checkPenalty || '0')
    if (checkPenaltyCouldApply && checkPenalty !== '+0') {
      terms.push({
        type: 'CheckPenalty',
        formula: checkPenalty,
        apply: checkPenaltyCouldApply
      })
    }

    const hasMeaningfulTerms = terms.some(term => term.formula && term.formula.trim() !== '')
    if (terms.length === 0 || !hasMeaningfulTerms) {
      if (skillItem && skillItem.system.description.value) {
        ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor: this }),
          content: `<div class="skill-description">${skillItem.system.description.value}</div>`,
          flavor: `${game.i18n.localize(skill.label)}${abilityLabel}`,

          flags: {
            'dcc.RollType': 'SkillCheck',
            'dcc.ItemId': skillId,
            'dcc.SkillId': skillId,
            'dcc.isSkillCheck': true
          },
          system: { skillId, skillDescription: skillItem.system.description.value }
        })
      }
      return
    }

    const roll = await game.dcc.DCCRoll.createRoll(terms, this.getRollData(), options)

    if (skill.useDisapprovalRange) {
      if (roll.dice.length > 0) {
        roll.dice[0].options.dcc = {
          lowerThreshold: this.system.class.disapproval
        }
      }
    }

    const skillTable = await game.dcc.getSkillTable(skillId)
    if (skillTable || skill.useDisapprovalRange) {
      await game.dcc.processSpellCheck(this, {
        rollTable: skillTable,
        roll,
        item: skillItem,
        flavor: `${game.i18n.localize(skill.label)}${abilityLabel}`
      })

      if (skill.drainDisapproval && game.settings.get('dcc', 'automateClericDisapproval')) {
        await this.applyDisapproval(skill.drainDisapproval)
      }
    } else {
      await roll.evaluate()

      const flags = {
        'dcc.RollType': 'SkillCheck',
        'dcc.ItemId': skillId,
        'dcc.SkillId': skillId,
        'dcc.isSkillCheck': true
      }
      game.dcc.FleetingLuck.updateFlags(flags, roll)

      const systemData = { skillId }
      const messageData = {
        speaker: ChatMessage.getSpeaker({ actor: this }),
        flavor: `${game.i18n.localize(skill.label)}${abilityLabel}`,
        flags,
        system: systemData
      }

      if (skillItem && skillItem.system.description.value) {
        systemData.skillDescription = skillItem.system.description.value
        const rollHTML = await roll.render()
        messageData.content = `${rollHTML}<div class="skill-description">${skillItem.system.description.value}</div>`
      }

      roll.toMessage(messageData)
    }

    if (skillItem && skillItem.system.config.showLastResult) {
      skillItem.update({ 'system.lastResult': roll.total })
    }
  }

  /**
   * Roll the Luck Die
   */
  async rollLuckDie (options = {}) {
    const die = this.system.class.luckDie
    options.title = game.i18n.localize('DCC.LuckDie')
    let luckSpend = 1

    // Collate terms for the roll
    const terms = [
      {
        type: 'LuckDie',
        formula: die,
        lck: this.system.abilities.lck.value,
        callback: (formula) => {
          // Record the amount of luck spent when the term is resolved
          luckSpend = game.dcc.DiceChain.countDice(formula)
        }
      }
    ]

    const roll = await game.dcc.DCCRoll.createRoll(terms, this.getRollData(), options)
    const flavor = game.i18n.format('DCC.LuckSpend', { luckSpend })

    // Spend the luck
    await this.update({
      'system.abilities.lck.value': (parseInt(this.system.abilities.lck.value) - luckSpend)
    })

    // Convert the roll to a chat message
    roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor,
      flags: {
        'dcc.RollType': 'LuckDie'
      }
    })
  }

  /**
   * Roll a Spell Check.
   *
   * Dispatcher. Phase 2 scope — as sessions land, more casting modes
   * peel off onto the adapter:
   *   - Session 1: generic-castingMode items on non-cleric, non-patron-bound
   *     actors (no side effects).
   *   - Session 2: wizard-castingMode items on non-cleric, non-patron-bound
   *     actors; wizard spell loss via the lib's `onSpellLost` event.
   *     Pre-check for already-lost spells (mirrors
   *     `DCCItem.rollSpellCheck:260`) fires adapter-side.
   *   - Session 3: cleric-castingMode items on cleric actors without
   *     patrons; cleric disapproval via the lib's
   *     `onDisapprovalIncreased` event (replaces
   *     `actor.applyDisapproval()` + `actor.rollDisapproval()`).
   *   - Session 4 (current): wizard-castingMode items on patron-bound
   *     wizard / elf actors flow through the adapter. The patron field
   *     populates `character.state.classState.<type>.patron` so the lib
   *     records `castInput.patron`; the RAW lib taint pipeline stays
   *     dormant (no fumbleTable plumbed in), and the adapter calls
   *     `_runLegacyPatronTaint` after the cast to preserve the legacy
   *     d100-vs-chance creeping mechanic verbatim.
   *   - Session 5: spellburn + mercurial magic on wizard / elf
   *     casts. `input.spellburn` is forwarded from `options.spellburn`
   *     when the caller provides a `SpellburnCommitment`; the
   *     `onSpellburnApplied` bridge subtracts the burn from
   *     `system.abilities.<str|agl|sta>.value`. Mercurial magic
   *     pre-rolls via `_rollMercurialIfNeeded` when the spell item
   *     has no stored effect — updates the item and attaches the
   *     effect to the in-flight spellbook entry so the lib's
   *     `onMercurialEffect` fires with the fresh result.
   *
   * Everything else (wizard on cleric, cleric on non-cleric,
   * patron-bound clerics, naked spell checks, unknown casting modes)
   * stays on the legacy path. The item lookup is hoisted here so the
   * existing actor.test.js `collectionFindMock` call-count assertions
   * still match.
   *
   * @param options
   */
  async rollSpellCheck (options = {}) {
    if (!options.abilityId) {
      options.abilityId = this.system.class.spellCheckAbility || ''
    }

    let spellItem = null
    if (options.spell) {
      const item = this.items.find(i => i.name === options.spell)
      if (item) {
        if (item.type === 'spell') {
          spellItem = item
        } else {
          return ui.notifications.warn(game.i18n.localize('DCC.SpellCheckNonSpellWarning'))
        }
      } else {
        return ui.notifications.warn(game.i18n.localize('DCC.SpellCheckNoOwnedItemWarning'))
      }
    }

    const castingMode = spellItem?.system?.config?.castingMode
    const hasPatron = !!this.system.class?.patron
    const isCleric = this.system.details?.sheetClass === 'Cleric'

    if (spellItem) {
      if (castingMode === 'generic' && !isCleric && !hasPatron) {
        return this._rollSpellCheckViaAdapter(spellItem, options)
      }
      if (castingMode === 'wizard' && !isCleric) {
        // Adapter-side spell-loss pre-check — mirrors the legacy
        // `DCCItem.rollSpellCheck:260` gate that would otherwise warn
        // and abort. Once the cast reaches the adapter the item has
        // already been looked up, so this is the natural place.
        if (spellItem.system.lost && game.settings.get('dcc', 'automateWizardSpellLoss')) {
          return ui.notifications.warn(game.i18n.format('DCC.SpellLostWarning', {
            actor: this.name,
            spell: spellItem.name
          }))
        }
        // Spellburn dialog bridge (open question #6, resolved Phase 3
        // session 1). The adapter path bypasses `DCCRoll.createRoll`,
        // so the legacy `RollModifierDialog`'s Spellburn term never
        // surfaces. When the caller asks for the modifier dialog and
        // hasn't already committed a burn programmatically, prompt
        // for it adapter-side and forward as `options.spellburn` —
        // the lib then adds the Spellburn modifier to the roll and
        // fires `onSpellburnApplied` so the adapter can deduct the
        // ability points (see `spell-events.mjs`). NPCs don't burn
        // (the legacy dialog never offered it to them either).
        if (options.showModifierDialog && !options.spellburn && !this.isNPC) {
          const commitment = await promptSpellburnCommitment(this, spellItem)
          if (commitment === null) return
          options.spellburn = commitment
        }
        return this._rollSpellCheckViaAdapter(spellItem, options)
      }
      if (castingMode === 'cleric' && isCleric && !hasPatron) {
        return this._rollSpellCheckViaAdapter(spellItem, options)
      }
    }

    return this._rollSpellCheckLegacy(options, spellItem)
  }

  /**
   * Adapter path for spell checks. Dispatches to the lib entry point
   * appropriate for the item's casting mode:
   *   - Generic: `castSpell` with a synthetic side-effect-free profile.
   *     No spellbook lookup, no events wired.
   *   - Wizard: `calculateSpellCheck` with the real wizard caster
   *     profile + a single-entry spellbook built from the item's
   *     `system.lost` / `system.timesPreparedOrCast`. `onSpellLost`
   *     fires when the lib marks the spell lost; the event bridge in
   *     `spell-events.mjs` mirrors that to the Foundry item via
   *     `item.update({ 'system.lost': true })`, replacing the
   *     `actor.loseSpell(item)` side effect `processSpellCheck`
   *     performs on the legacy path.
   *
   * Two-pass formula/evaluate pattern established by the Phase 1
   * adapter methods: pass 1 yields a formula, Foundry rolls it, pass
   * 2 classifies against the pre-rolled natural.
   * @private
   */
  async _rollSpellCheckViaAdapter (spellItem, options) {
    const castingMode = spellItem?.system?.config?.castingMode || 'generic'
    logDispatch('rollSpellCheck', 'adapter', {
      spell: spellItem?.name ?? '',
      mode: castingMode
    })

    if (castingMode === 'wizard' || castingMode === 'cleric') {
      const args = buildSpellCheckArgs(this, spellItem, options)
      // No lib-side profile for this actor's class — drop back to legacy
      // so spinoff classes with wizard/cleric-castingMode spells still work.
      if (!args) {
        return this._rollSpellCheckLegacy(options, spellItem)
      }
      return this._castViaCalculateSpellCheck(args, spellItem, options)
    }

    return this._castViaCastSpell(spellItem, options)
  }

  /**
   * Generic-castingMode adapter branch. Side-effect-free cast via the
   * lib's `castSpell`.
   * @private
   */
  async _castViaCastSpell (spellItem, options) {
    const input = buildSpellCastInput(this, spellItem, options)

    const plan = libCastSpell(input, { mode: 'formula' })

    const foundryRoll = new Roll(plan.formula)
    await foundryRoll.evaluate()

    const natural = foundryRoll.dice?.[0]?.total ?? foundryRoll.total

    const result = libCastSpell(input, {
      mode: 'evaluate',
      roller: () => natural
    })

    const flavor = this._buildSpellCheckFlavor(spellItem, options)
    await renderSpellCheck({
      actor: this,
      spellItem,
      flavor,
      result,
      foundryRoll
    })

    return foundryRoll
  }

  /**
   * Wizard / cleric-castingMode adapter branch. Routes through
   * `calculateSpellCheck` so the lib's spell-loss bookkeeping (wizard)
   * and disapproval handling (cleric) drive the cast. Event callbacks
   * in `spell-events.mjs` bridge lib events to Foundry side effects:
   * `onSpellLost` → `item.update({system.lost: true})`,
   * `onDisapprovalIncreased` → `actor.update({system.class.disapproval:
   * newRange})` + gain chat. The disapproval sub-roll chat is posted
   * here (the lib doesn't pass `disapprovalResult` to the callback).
   *
   * Two-pass formula/evaluate pattern. The pass-2 roller is
   * formula-dispatching: returns the pre-rolled spell-check natural
   * for the action-die formula, and a pre-rolled 1d4 for the
   * disapproval sub-roll (only when cleric + natural is inside the
   * range — the lib's `handleClericDisapproval` is the only sub-roll
   * path today).
   * @private
   */
  async _castViaCalculateSpellCheck (args, spellItem, options) {
    const { character, input, profile } = args
    const events = createSpellEvents({ actor: this, spellItem })

    // Cleric path needs a disapproval table so the lib's
    // `handleClericDisapproval` runs the full table draw (lib skips
    // the draw if the table is missing — matching legacy behavior
    // when no table is configured).
    if (profile?.type === 'cleric') {
      const disapprovalTable = await loadDisapprovalTable(this)
      if (disapprovalTable) {
        input.disapprovalTable = disapprovalTable
      }
    }

    // Wizard / elf path — if the spell item doesn't yet carry a
    // rolled mercurial effect, pre-roll one via the lib's
    // `rollMercurialMagic`, persist it to the Foundry item, and
    // attach it to the lib's spellbook entry so the cast's
    // `onMercurialEffect` event fires with the freshly rolled
    // effect. When a table isn't configured (setting unset, unit-test
    // env), skip the pre-roll — matches legacy `DCCItem.rollSpellCheck`
    // behavior (the legacy path only displays an existing mercurial
    // effect and leaves first-cast rolling to the user-triggered
    // `DCCItem.rollMercurialMagic` item-sheet button).
    if (profile && profile.usesMercurial && spellItem) {
      const spellbookEntry = character.state?.classState?.[profile.type]?.spellbook?.spells?.[0]
      if (spellbookEntry && !spellbookEntry.mercurialEffect) {
        await this._rollMercurialIfNeeded(spellItem, spellbookEntry)
      }
    }

    // Pass 1: build the formula without rolling. Events are omitted
    // here — the lib fires `onSpellburnApplied` + `onMercurialEffect`
    // unconditionally when their inputs are set (see `cast.js:339-343`),
    // so passing `events` to pass 1 would double-apply the burn / emit
    // duplicate mercurial chat. Pass 2 is the authoritative side-effect
    // pass. `onSpellLost` / `onDisapprovalIncreased` are gated on
    // pass-2-only conditions (spell lost / natural roll), so earlier
    // sessions could pass events to both passes without issue; the
    // unconditional events introduced by session 5 force the split.
    const plan = libCalculateSpellCheck(character, input, { mode: 'formula' }, {})
    if (plan.error) {
      ui.notifications.warn(plan.error)
      return
    }

    const foundryRoll = new Roll(plan.formula)
    await foundryRoll.evaluate()

    const natural = foundryRoll.dice?.[0]?.total ?? foundryRoll.total

    // Pre-roll the disapproval 1d4 via Foundry so the pass-2 roller
    // has a value to hand back when the lib calls `options.roller('1d4')`
    // inside `rollDisapproval`. Only needed when cleric + natural is
    // in the disapproval range; avoids a spurious d4 roll otherwise.
    let disapprovalD4 = null
    if (
      profile?.type === 'cleric' &&
      input.disapprovalTable &&
      natural <= (character.state.classState?.cleric?.disapprovalRange ?? 0)
    ) {
      const d4Roll = new Roll('1d4')
      await d4Roll.evaluate()
      disapprovalD4 = d4Roll.total
    }

    // Pass 2: classify against the pre-rolled natural. Fires
    // `onSpellLost` when the total lands in a lost tier and
    // `onDisapprovalIncreased` when the cleric roll triggers
    // disapproval; the event bridges update the Foundry item / actor.
    const result = libCalculateSpellCheck(
      character,
      input,
      {
        mode: 'evaluate',
        roller: (formula) => {
          if (formula === '1d4' && disapprovalD4 !== null) return disapprovalD4
          return natural
        }
      },
      events
    )
    if (result.error) {
      console.error('[DCC adapter] calculateSpellCheck pass-2 error', { actor: this.name, spell: spellItem?.name, error: result.error })
      ui.notifications.warn(result.error)
      return
    }

    warnIfDivergent('rollSpellCheck', foundryRoll.total, result.total, { actor: this.name, spell: spellItem?.name })

    const flavor = this._buildSpellCheckFlavor(spellItem, options, profile)
    await renderSpellCheck({
      actor: this,
      spellItem,
      flavor,
      result,
      foundryRoll
    })

    // Post the disapproval roll chat after the main spell-check chat,
    // mirroring the legacy two-message ordering (spell check, then
    // disapproval roll, then gained-range emote from the callback).
    if (result.disapprovalResult) {
      await renderDisapprovalRoll({
        actor: this,
        disapprovalResult: result.disapprovalResult
      })
    }

    // Session 5 — mercurial display chat. Rendered directly from
    // `result.mercurialEffect` rather than via the lib's
    // `onMercurialEffect` event because that event fires on both
    // formula + evaluate passes (unconditional when the spellbook
    // entry carries an effect) and its Promise return isn't
    // awaitable through the lib. Legacy parity: the effect's
    // `displayOnCast` gate mirrors the item's `displayInChat` flag
    // (`DCCItem.rollSpellCheck:382`).
    if (spellItem && result.mercurialEffect && result.mercurialEffect.displayOnCast !== false) {
      await renderMercurialEffect({
        actor: this,
        spellItem,
        effect: result.mercurialEffect
      })
    }

    // Session 4 — patron taint. Adapter-side preservation of the
    // legacy `processSpellCheck:623-660` mechanic for wizard / elf
    // patron casters. The lib's RAW patron-taint pipeline is dormant
    // (no `input.fumbleTable` plumbed in), so this runs the d100-vs-
    // chance creeping mechanic verbatim instead. See
    // `_runLegacyPatronTaint` for the rationale and the migration
    // hand-off plan.
    if ((profile?.type === 'wizard' || profile?.type === 'elf') && this.system.class?.patron) {
      await this._runLegacyPatronTaint(spellItem)
    }

    return foundryRoll
  }

  /**
   * Adapter-side preservation of the legacy patron-taint mechanic from
   * `processSpellCheck` (`module/dcc.js:623-660`). DCC-system-as-shipped
   * has a creeping-chance model: every patron-related cast on a patron-
   * bound actor rolls 1d100 vs `system.class.patronTaintChance` and then
   * bumps that chance by 1%, regardless of outcome. The chat indication
   * only renders when the spell has a result table (the chat-card path);
   * for table-less spells (the adapter's current scope) the chance bump
   * is silent — exactly mirroring the legacy no-table fallback.
   *
   * **Permanent adapter infrastructure** (Phase 2 close decision,
   * 2026-04-18). The lib's RAW model (`spells/spell-check.js:241`
   * `handleWizardFumble`) is gated on a fumble (natural 1) AND a
   * fumble-table entry tagged with `effect.type === 'patron-taint'` —
   * Foundry-side fumble tables don't carry those tags, so the lib's
   * pipeline stays dormant for this system. RAW alignment would
   * require fumble-table effect-tag migration across sibling content
   * modules (`dcc-core-book`, `xcc-core-book`) plus per-patron taint-
   * table resolution; tracked as backlog, not a phase gate. This
   * method is the authoritative patron-taint implementation for
   * wizard / elf adapter casts indefinitely. See `00-progress.md`
   * Phase 2 close-out (Gate 2) for the full rationale.
   *
   * @private
   */
  async _runLegacyPatronTaint (spellItem) {
    if (!spellItem) return
    const patronField = this.system.class?.patron
    if (!patronField) return

    const spellName = spellItem.name || ''
    const associatedPatron = spellItem.system?.associatedPatron || ''
    if (!spellName.includes('Patron') && !associatedPatron) return

    const currentChance = parseInt(this.system.class?.patronTaintChance) || 1
    const newChance = currentChance + 1

    await this.update({ 'system.class.patronTaintChance': `${newChance}%` })
  }

  /**
   * Pre-roll a mercurial magic effect for a wizard / elf spell whose
   * Foundry item doesn't yet carry one. Mirrors the lib-spec flow in
   * `dcc-core-lib/spells/mercurial.js`: d100 + (luckMod × 10) lookup
   * on a mercurial table. The rolled effect is persisted to the
   * Foundry item so later casts display it without re-rolling, and
   * attached to the supplied `spellbookEntry` so the same cast's
   * `onMercurialEffect` event fires with the fresh effect. Silent
   * no-op when no mercurial magic table is configured — matches the
   * legacy `DCCItem.rollMercurialMagic:564` fall-back.
   *
   * @private
   */
  async _rollMercurialIfNeeded (spellItem, spellbookEntry) {
    const mercurialTable = await loadMercurialMagicTable()
    if (!mercurialTable) return

    // Foundry-side d100 so Dice So Nice + chat breakdown show a real
    // roll. The lib's roller receives '1d100' and we hand back the
    // Foundry total; the luck modifier is applied inside the lib.
    const d100Roll = new Roll('1d100')
    await d100Roll.evaluate()
    const luckMod = Number(this.system?.abilities?.lck?.mod) || 0

    const effect = libRollMercurialMagic(luckMod, mercurialTable, {
      roller: () => d100Roll.total
    })

    await spellItem.update({
      'system.mercurialEffect.value': effect.rollValue,
      'system.mercurialEffect.summary': effect.summary || '',
      'system.mercurialEffect.description': effect.description || '',
      'system.mercurialEffect.displayInChat': effect.displayOnCast !== false
    })

    // Attach to the in-flight spellbookEntry so the lib's pass-2
    // `castSpell` surfaces the mercurial effect on the result, and
    // `_castViaCalculateSpellCheck`'s post-cast render sees it.
    spellbookEntry.mercurialEffect = effect
  }

  /**
   * Build the chat flavor line shared by both adapter branches.
   * @private
   */
  _buildSpellCheckFlavor (spellItem, options, profile) {
    const abilityId = options.abilityId || profile?.spellCheckAbility
    const abilityLabel = abilityId ? CONFIG.DCC.abilities[abilityId] : undefined
    let flavor = spellItem?.name ?? game.i18n.localize('DCC.SpellCheck')
    if (abilityLabel) {
      flavor += ` (${game.i18n.localize(abilityLabel)})`
    }
    return flavor
  }

  /**
   * Legacy spell-check path. Preserves the pre-adapter behavior for
   * every dispatch that doesn't meet the session-1 adapter gate —
   * spell items delegate to `DCCItem.rollSpellCheck`, naked checks
   * build DCCRoll terms and hand off to `game.dcc.processSpellCheck`
   * (still the source of truth for wizard spell loss, cleric
   * disapproval, patron taint, spellburn, and mercurial magic).
   * @private
   */
  async _rollSpellCheckLegacy (options, spellItem) {
    logDispatch('rollSpellCheck', 'legacy', { spell: options.spell ?? '' })

    if (spellItem) {
      // Fire-and-forget — matches the pre-dispatcher contract. The
      // item's rollSpellCheck performs its own chat + processSpellCheck
      // orchestration; awaiting here would change the public return
      // shape and surface errors the original path swallowed.
      spellItem.rollSpellCheck(options.abilityId, options)
      return
    }

    // Naked spell-check path (no item): retained verbatim from the
    // pre-dispatcher rollSpellCheck body.
    const ability = this.system.abilities[options.abilityId] || {}
    ability.label = CONFIG.DCC.abilities[options.abilityId]
    const spell = options.spell ? options.spell : game.i18n.localize('DCC.SpellCheck')
    let die = this.system.attributes.actionDice.value || '1d20'
    if (this.system.class.spellCheckOverrideDie) {
      die = this.system.class.spellCheckOverrideDie
    }
    const level = ensurePlus(this.system.details.level.value)
    const abilityMod = ensurePlus(ability?.mod || 0) || +0
    let otherMod = ''
    if (this.system.class.spellCheckOtherMod) {
      otherMod = ensurePlus(this.system.class.spellCheckOtherMod)
    }
    let bonus = ''
    if (this.system.class.spellCheckOverride) {
      bonus = this.system.class.spellCheckOverride
    }
    const checkPenalty = ensurePlus(this.system?.attributes?.ac?.checkPenalty || '0')
    const isIdolMagic = this.system.details.sheetClass === 'Cleric'
    const applyCheckPenalty = !isIdolMagic
    options.title = game.i18n.localize('DCC.SpellCheck')

    // Collate terms for the roll
    const terms = [
      {
        type: 'Die',
        label: game.i18n.localize('DCC.ActionDie'),
        formula: die,
        presets: this.getActionDice({ includeUntrained: true })
      }
    ]

    if (bonus) {
      terms.push({
        type: 'Compound',
        dieLabel: game.i18n.localize('DCC.RollModifierDieTerm'),
        modifierLabel: game.i18n.localize('DCC.SpellCheck'),
        formula: bonus
      })
    } else {
      terms.push({
        type: 'Compound',
        dieLabel: game.i18n.localize('DCC.RollModifierDieTerm'),
        modifierLabel: game.i18n.localize('DCC.Level'),
        formula: level
      })
      terms.push({
        type: 'Compound',
        dieLabel: game.i18n.localize('DCC.RollModifierDieTerm'),
        modifierLabel: game.i18n.localize('DCC.AbilityMod'),
        formula: abilityMod
      })
      terms.push({
        type: 'Compound',
        dieLabel: game.i18n.localize('DCC.RollModifierDieTerm'),
        modifierLabel: game.i18n.localize('DCC.SpellCheckOtherMod'),
        formula: otherMod
      })
    }

    terms.push({
      type: 'CheckPenalty',
      formula: checkPenalty,
      label: game.i18n.localize('DCC.CheckPenalty'),
      apply: applyCheckPenalty
    })

    // If we're a non-cleric show the spellburn UI
    if (!isIdolMagic) {
      terms.push({
        type: 'Spellburn',
        formula: '+0',
        str: this.system.abilities.str.value,
        agl: this.system.abilities.agl.value,
        sta: this.system.abilities.sta.value,
        callback: (formula, term) => {
          // Apply the spellburn
          this.update({
            'system.abilities.str.value': term.str,
            'system.abilities.agl.value': term.agl,
            'system.abilities.sta.value': term.sta
          })
        }
      })
    }

    const roll = await game.dcc.DCCRoll.createRoll(terms, this.getRollData(), options)

    if (roll.dice.length > 0) {
      roll.dice[0].options.dcc = {
        lowerThreshold: this.system.class.disapproval
      }
    }

    let flavor = spell
    if (ability.label) {
      flavor += ` (${game.i18n.localize(ability.label)})`
    }

    // Tell the system to handle the spell check result
    await game.dcc.processSpellCheck(this, {
      rollTable: null,
      roll,
      item: null,
      flavor,
      forceCrit: options.forceCrit
    })
  }

  /**
   * Roll a weapon's attack, damage, and handle any crits
   * @param {string} weaponId    The weapon name or slot id (e.g. "m1", "r1")
   * @param {Object} options     Options which configure how attacks are rolled E.g. Backstab
   */
  async rollWeaponAttack (weaponId, options = {}) {
    const automateDamageFumblesCrits = game.settings.get('dcc', 'automateDamageFumblesCrits')
    const messageMode = game.settings.get('core', 'messageMode')

    // First try and find the item by id
    const weapon = this.items.find(i => i.id === weaponId)

    // If weapon is not found, give up and show a warning
    if (!weapon) {
      return ui.notifications.warn(game.i18n.format('DCC.WeaponNotFound', { id: weaponId }))
    }

    // Warn if weapon is not equipped
    if (!weapon.system?.equipped && game.settings.get('dcc', 'checkWeaponEquipment') && this.isPC) return ui.notifications.warn(game.i18n.localize('DCC.WeaponWarningUnequipped'))

    // Accumulate all rolls for sending to the chat message
    const rolls = []

    // Attack roll
    options.targets = game.user.targets // Add targets set to options
    const attackRollResult = await this.rollToHit(weapon, options)
    if (!attackRollResult) return // <-- if the attack roll is cancelled, return

    if (attackRollResult.naturalCrit) {
      options.naturalCrit = true
    }
    foundry.utils.mergeObject(attackRollResult.roll.options, { 'dcc.isAttackRoll': true })
    const attackRollHTML = await attackRollResult.roll.render()
    rolls.push(attackRollResult.roll)

    // Damage roll - use modified formula from roll modifier dialog if available
    let damageRollFormula = attackRollResult.weaponDamageFormula || weapon.system.damage
    if (attackRollResult.deedDieRollResult) {
      const rawDeedFormula = attackRollResult.deedDieFormula // e.g. "d4"
      const deedBonusStringComponent = ensurePlus(rawDeedFormula) // e.g. "+d4", this is what's in the damage formula from warrior bonus
      const deedNumericResult = attackRollResult.deedDieRollResult.toString() // e.g. "4"
      // Determine sign from how deed was added to formula, then append numeric result
      const replacementDeedValueString = (deedBonusStringComponent.startsWith('-') ? '-' : '+') + deedNumericResult // e.g. "+4"
      damageRollFormula = damageRollFormula.replace(deedBonusStringComponent, replacementDeedValueString)

      if (damageRollFormula.includes('@ab')) {
        // This does not handle very high level characters that might have a deed die and a deed die modifier
        // But since @ab really should only be for NPCs, we don't have a way of splitting out such a mod from a strength mod
        // So when building NPCs, ensure that @ab really only accounts for the deed die, not a deed die mod, you can add that to the damage formula
        damageRollFormula = damageRollFormula.replaceAll('@ab', attackRollResult.deedDieRollResult)
      }
    }
    if (options.backstab && weapon.system?.backstabDamage) {
      if (!weapon.system?.damageWeapon || weapon.system.damageWeapon.trim() === '') {
        // No weapon damage component to replace, use backstab damage directly
        damageRollFormula = weapon.system.backstabDamage
      } else {
        // Replace the weapon damage component with backstab damage
        damageRollFormula = damageRollFormula.replace(weapon.system.damageWeapon, weapon.system.backstabDamage)
      }
    }

    // Add damage bonus adjustment for NPCs (from Active Effects)
    // For PCs, this is already incorporated via computeMeleeAndMissileAttackAndDamage()
    let npcDamageAdjustment = 0
    if (this.isNPC && damageRollFormula) {
      const isMeleeWeapon = weapon.system?.melee !== false
      npcDamageAdjustment = isMeleeWeapon
        ? parseInt(this.system.details.attackDamageBonus?.melee?.adjustment) || 0
        : parseInt(this.system.details.attackDamageBonus?.missile?.adjustment) || 0
      if (npcDamageAdjustment !== 0) {
        damageRollFormula = `${damageRollFormula}${npcDamageAdjustment >= 0 ? '+' : ''}${npcDamageAdjustment}`
      }
    }

    let damageRoll, damageInlineRoll, damagePrompt, libDamageResult
    let libCritResult, libFumbleResult
    if (automateDamageFumblesCrits && damageRollFormula) {
      const damageDispatch = await this._rollDamage(weapon, damageRollFormula, attackRollResult, { ...options, npcDamageAdjustment })
      damageRoll = damageDispatch.damageRoll
      damageInlineRoll = damageDispatch.damageInlineRoll
      damagePrompt = damageDispatch.damagePrompt
      libDamageResult = damageDispatch.libDamageResult
      rolls.push(damageRoll)
    } else if (damageRollFormula) {
      damageInlineRoll = await TextEditor.enrichHTML(`[[/r ${damageRollFormula} # Damage]]`)
      damagePrompt = game.i18n.localize('DCC.RollDamage')
    }

    // Deed roll
    const deedDieRoll = attackRollResult.deedDieRoll
    const deedDieFormula = attackRollResult.deedDieFormula
    const deedDieRollResult = attackRollResult.deedDieRollResult
    const deedRollSuccess = attackRollResult.deedDieRollResult > 2

    // Crit roll
    let critRollFormula = ''
    let critInlineRoll = ''
    let critPrompt = game.i18n.localize('DCC.RollCritical')
    let critRoll
    const critTableName = weapon.system?.critTable || this.system.attributes.critical?.table || ''
    let critResult = '' // Separate storage for navigable result
    let critRollTotal = null
    const luckMod = ensurePlus(this.system.abilities.lck.mod)
    if (attackRollResult.crit) {
      const critDispatch = await this._rollCritical(weapon, attackRollResult, {
        automate: automateDamageFumblesCrits,
        luckMod,
        critTableName
      })
      critRollFormula = critDispatch.critRollFormula
      critInlineRoll = critDispatch.critInlineRoll
      critPrompt = critDispatch.critPrompt
      critRoll = critDispatch.critRoll
      critResult = critDispatch.critResult
      critRollTotal = critDispatch.critRollTotal
      libCritResult = critDispatch.libCritResult
      if (critRoll) rolls.push(critRoll)
    }

    // Fumble roll
    let fumbleRollFormula = ''
    let fumbleInlineRoll = ''
    let fumblePrompt = ''
    let useNPCFumbles = true // even if core compendium isn't installed, still show correct fumble table in flavor text
    try {
      useNPCFumbles = game.settings.get('dcc-core-book', 'registerNPCFumbleTables') || true
    } catch {
      // Module not installed, use default (true)
    }
    let fumbleTableName = (this.isPC || !useNPCFumbles) ? 'Table 4-2: Fumbles' : getFumbleTableNameFromCritTableName(critTableName)
    const originalFumbleTableName = fumbleTableName // Preserve for navigation

    let fumbleRoll
    let fumbleResult = '' // Separate storage for navigable result
    let fumbleRollTotal = null
    let isNPCFumble = false
    const inverseLuckMod = ensurePlus((parseInt(this.system.abilities.lck.mod) * -1).toString())
    if (attackRollResult.fumble) {
      const fumbleDispatch = await this._rollFumble(weapon, attackRollResult, {
        automate: automateDamageFumblesCrits,
        luckMod,
        inverseLuckMod,
        useNPCFumbles,
        fumbleTableName,
        originalFumbleTableName
      })
      fumbleRollFormula = fumbleDispatch.fumbleRollFormula
      fumbleInlineRoll = fumbleDispatch.fumbleInlineRoll
      fumblePrompt = fumbleDispatch.fumblePrompt
      fumbleRoll = fumbleDispatch.fumbleRoll
      fumbleResult = fumbleDispatch.fumbleResult
      fumbleRollTotal = fumbleDispatch.fumbleRollTotal
      fumbleTableName = fumbleDispatch.fumbleTableName
      isNPCFumble = fumbleDispatch.isNPCFumble
      libFumbleResult = fumbleDispatch.libFumbleResult
      if (fumbleRoll) rolls.push(fumbleRoll)
    }

    const flags = {
      'dcc.isToHit': true,
      'dcc.isBackstab': options.backstab,
      'dcc.isFumble': attackRollResult.fumble,
      'dcc.isCrit': attackRollResult.crit,
      'dcc.isNaturalCrit': attackRollResult.naturalCrit,
      'dcc.isMelee': weapon.system?.melee
    }
    if (attackRollResult.libResult) {
      flags['dcc.libResult'] = attackRollResult.libResult
    }
    if (libDamageResult) {
      flags['dcc.libDamageResult'] = libDamageResult
    }
    if (libCritResult) {
      flags['dcc.libCritResult'] = libCritResult
    }
    if (libFumbleResult) {
      flags['dcc.libFumbleResult'] = libFumbleResult
    }
    game.dcc.FleetingLuck.updateFlags(flags, attackRollResult.roll)

    // Speaker object for the chat cards
    const speaker = ChatMessage.getSpeaker({ actor: this })

    // Check for halfling two-weapon fighting special note
    let twoWeaponNote = ''
    if (attackRollResult.fumble &&
      (weapon.system?.twoWeaponPrimary || weapon.system?.twoWeaponSecondary) &&
      this.system?.details?.sheetClass === 'Halfling') {
      twoWeaponNote = game.i18n.localize('DCC.HalflingTwoWeaponFumbleNote')
    }

    const messageData = {
      user: game.user.id,
      speaker,
      flavor: game.i18n.format(options.backstab ? 'DCC.BackstabRoll' : 'DCC.AttackRoll', { weapon: weapon.name }),
      flags,
      rolls,
      system: {
        actorId: this.id,
        attackRollHTML,
        damageInlineRoll,
        damagePrompt,
        damageRoll,
        damageRollFormula,
        critInlineRoll,
        critPrompt,
        critRoll,
        critRollFormula,
        critResult,
        critText: critResult, // Legacy name for dcc-qol compatibility
        critRollTotal,
        ...(attackRollResult.crit ? { critTableName } : {}),
        critDieOverride: weapon.system?.config?.critDieOverride,
        critTableOverride: weapon.system?.config?.critTableOverride,
        deedDieFormula,
        deedDieRoll,
        deedDieRollResult,
        deedRollSuccess,
        fumbleInlineRoll,
        fumblePrompt,
        fumbleRoll,
        fumbleRollFormula,
        fumbleResult,
        fumbleText: fumbleResult, // Legacy name for dcc-qol compatibility
        fumbleRollTotal,
        fumbleTableName,
        originalFumbleTableName,
        isNPCFumble,
        hitsAc: attackRollResult.hitsAc,
        targets: game.user.targets,
        weaponId,
        weaponName: weapon.name,
        twoWeaponNote
      }
    }

    // noinspection JSValidateJSDoc
    /**
     * A hook event that fires after an attack has been rolled but before chat message is sent
     * @function dcc.rollWeaponAttack
     * @memberof hookEvents
     * @param {object} messageData                     Data to send to the chat card
     * @param {object} data
     */
    await Hooks.callAll('dcc.rollWeaponAttack', rolls, messageData)

    // Remove non-serializable objects before creating the ChatMessage
    // In Foundry v14, system data goes through TypeDataModel validation which can't handle
    // Roll objects or Sets with circular references. This is safe for v13 as well.
    delete messageData.system.targets
    delete messageData.system.damageRoll
    delete messageData.system.critRoll
    delete messageData.system.fumbleRoll
    delete messageData.system.deedDieRoll

    messageData.content = await foundry.applications.handlebars.renderTemplate('systems/dcc/templates/chat-card-attack-result.html', { message: messageData })

    // Output the results
    ChatMessage.applyMode(messageData, messageMode)
    ChatMessage.create(messageData)
  }

  /**
   * Dispatcher: route the simplest-weapon happy-path through the lib
   * adapter (Phase 3 session 2), everything else through the legacy
   * body verbatim. See `_canRouteAttackViaAdapter` for the gate.
   *
   * Both branches return the same result shape (see `_rollToHitLegacy`).
   * The adapter path adds an optional `libResult` field consumed by
   * `rollWeaponAttack` to populate `dcc.libResult` on the chat flags.
   *
   * @param {Object} weapon      The weapon object being used for the roll
   * @param {Object} options     Options which configure how attacks are rolled E.g. Backstab
   * @return {Object}            Object representing the results of the attack roll
   */
  async rollToHit (weapon, options = {}) {
    if (this._canRouteAttackViaAdapter(weapon, options)) {
      return this._rollToHitViaAdapter(weapon, options)
    }
    return this._rollToHitLegacy(weapon, options)
  }

  /**
   * Gate for the Phase 3 adapter. Routes the simplest weapon attack —
   * no roll-modifier dialog, no non-deed-die dice-bearing to-hit /
   * attack-bonus. Session 9 broadened the gate to accept
   * `options.backstab`: the lib's `isBackstab: true` drives the
   * auto-crit (matches DCC RAW + the legacy Foundry behavior), and the
   * Table 1-9 attack bonus flows through as a `RollBonus`. Session 10
   * (A3) broadened the gate to accept warrior / dwarf deed dice: a
   * toHit / attackBonus matching `parseDeedAttackBonus` (e.g. `+1d3+2`)
   * routes through with `AttackInput.deedDie` set, exercising the
   * lib's `onDeedAttempt`. Session 11 (A4) broadened the gate to
   * accept `twoWeaponPrimary` / `twoWeaponSecondary` weapons —
   * `item.js:prepareBaseData` already bakes DCC's dice-chain
   * reduction into `weapon.system.actionDie` (e.g. `1d16[2w-off-hand]`)
   * and adjusts `weapon.system.critRange` per the agility-tier
   * matrix; `normalizeLibDie` strips the tag and the lib computes
   * the attack on the bumped die. (`dcc-core-lib@0.5.0` adopted the
   * dice-chain model — `AttackInput.twoWeaponPenalty` and
   * `getTwoWeaponPenalty` were removed; DCC's prior integration
   * choice is now the lib's canonical shape.)
   *
   * Session 12 (A5) dropped the `automateDamageFumblesCrits`
   * requirement: that setting gates whether `rollWeaponAttack`
   * dispatches downstream damage / crit / fumble rolls, not the
   * attack-side adapter's correctness. The downstream gates
   * (`_canRouteDamageViaAdapter`, `_canRouteCritViaAdapter`,
   * `_canRouteFumbleViaAdapter`) already check `ctx.automate`
   * defensively, so with automate off the attack routes via adapter
   * while downstream stays on the inline-roll-text fallback.
   *
   * Session 13 (A6) dropped the `options.showModifierDialog`
   * exclusion. The adapter now threads `damageTerms` into
   * `DCCRoll.createRoll` when the dialog is requested (mirroring
   * legacy), and `modifiedDamageFormula` flows through identically.
   * Dialog-modified attack-term values (e.g. user bumps a Modifier
   * from `+0` to `+2`) affect `attackRoll.total` but are not
   * reflected in `libResult.bonuses` — `warnIfDivergent` surfaces
   * the mismatch; Foundry's total remains authoritative for chat.
   *
   * Session 14 (A7) dropped the non-deed dice-bearing
   * `attackBonus` / `toHit` exclusion. Foundry's Roll evaluates
   * dice portions natively; `buildAttackInput` falls back to
   * `parseToHitBonus` which takes the leading integer, dropping
   * trailing dice — consistent with `hookTermsToBonuses`'s
   * documented drop of dice-bearing hook terms. `warnIfDivergent`
   * surfaces the mismatch; chat total comes from the Foundry Roll.
   *
   * @param {Object} weapon
   * @param {Object} options
   * @returns {boolean}
   * @private
   */
  _canRouteAttackViaAdapter (weapon, options = {}) {
    return true
  }

  /**
   * Adapter path for `rollToHit`. Structurally mirrors the legacy body
   * (same terms / hook / Roll construction) so the Foundry chat render
   * and the `dcc.modifyAttackRollTerms` contract are preserved verbatim.
   * After the Foundry `Roll` evaluates, feeds the natural d20 into the
   * lib's `makeAttackRoll` so the lib owns the classification +
   * `appliedModifiers` list that downstream chat flags surface as
   * `dcc.libResult`.
   *
   * @param {Object} weapon
   * @param {Object} options
   * @returns {Object}
   * @private
   */
  async _rollToHitViaAdapter (weapon, options = {}) {
    logDispatch('rollWeaponAttack', 'adapter', { weapon: weapon?.name || 'unknown' })

    const toHit = (weapon.system?.toHit ?? '').replaceAll('@ab', this.system.details.attackBonus)
    const actorActionDice = this.getActionDice({ includeUntrained: true })[0].formula
    const die = weapon.system?.actionDie || actorActionDice
    let critRange = parseInt(weapon.system?.critRange || this.system.details.critRange || 20)

    if (!Roll.validate(toHit)) {
      return { rolled: false, formula: toHit }
    }

    const terms = [
      {
        type: 'Die',
        label: game.i18n.localize('DCC.ActionDie'),
        formula: die,
        presets: this.getActionDice({ includeUntrained: true })
      },
      {
        type: 'Compound',
        dieLabel: game.i18n.localize('DCC.DeedDie'),
        modifierLabel: game.i18n.localize('DCC.ToHit'),
        formula: toHit
      }
    ]

    // Session 9: thief backstab — push the Table 1-9 bonus term
    // identically to the legacy path, then surface the bonus to the
    // lib via `attackInput.bonuses` below so `libResult.total` matches
    // the Foundry Roll total.
    const backstabBonus = options.backstab
      ? (parseInt(this.system?.class?.backstab || '0') || 0)
      : 0
    if (options.backstab) {
      terms.push({
        type: 'Modifier',
        label: game.i18n.localize('DCC.Backstab'),
        presets: [],
        formula: backstabBonus
      })
    }

    if (this.isNPC) {
      const isMelee = weapon.system?.melee !== false
      const attackAdjustment = isMelee
        ? parseInt(this.system.details.attackHitBonus?.melee?.adjustment) || 0
        : parseInt(this.system.details.attackHitBonus?.missile?.adjustment) || 0
      if (attackAdjustment !== 0) {
        terms.push({
          type: 'Modifier',
          label: game.i18n.localize(isMelee ? 'DCC.MeleeAttackAdjustment' : 'DCC.MissileAttackAdjustment'),
          formula: attackAdjustment
        })
      }
    }

    const termsLengthBefore = terms.length
    const proceed = Hooks.call('dcc.modifyAttackRollTerms', terms, this, weapon, options)
    if (!proceed) return
    const hookAddedTerms = terms.slice(termsLengthBefore)

    const rollOptions = Object.assign({ title: game.i18n.localize('DCC.ToHit') }, options)

    // Session 13 (A6): when the modifier dialog is shown, pass the
    // damage terms through so the user can modify both attack and
    // damage in one dialog. Legacy parity — same shape, same fields.
    // `modifiedDamageFormula` lands on `attackRoll.options` after the
    // dialog resolves; the `modifiedDamageFormula` read below picks it
    // up identically to legacy.
    if (options.showModifierDialog && weapon.system?.damage) {
      rollOptions.damageTerms = [
        {
          type: 'Compound',
          dieLabel: game.i18n.localize('DCC.DamageDie'),
          modifierLabel: game.i18n.localize('DCC.DamageModifier'),
          formula: weapon.system.damage
        }
      ]
    }

    const attackRoll = await game.dcc.DCCRoll.createRoll(terms, Object.assign({ critical: critRange }, this.getRollData()), rollOptions)
    await attackRoll.evaluate()

    const strictCrits = game.settings.get('dcc', 'strictCriticalHits')
    if (strictCrits) {
      const originalDieMatch = die.match(/(\d+)d(\d+)/)
      const adjustedDieMatch = attackRoll.formula.match(/(\d+)d(\d+)/)
      if (originalDieMatch && adjustedDieMatch) {
        const originalDieSize = parseInt(originalDieMatch[2])
        const adjustedDieSize = parseInt(adjustedDieMatch[2])
        if (originalDieSize !== adjustedDieSize) {
          critRange = game.dcc.DiceChain.calculateProportionalCritRange(critRange, originalDieSize, adjustedDieSize)
        }
      }
    } else {
      critRange += parseInt(game.dcc.DiceChain.calculateCritAdjustment(die, attackRoll.formula))
    }

    const d20RollResult = attackRoll.dice[0].total
    attackRoll.dice[0].options.dcc = { upperThreshold: critRange }

    const attackInput = buildAttackInput(this, weapon)
    attackInput.threatRange = critRange
    // Reflect in-place mutations of the action-die term (e.g. dcc-qol's
    // long-range `DiceChain.bumpDie` rewriting `terms[0].formula` from
    // 1d20 to 1d16). Without this the lib's `actionDie` stays on the
    // pre-hook die while the Foundry Roll evaluates on the bumped one.
    const dieAfterHook = terms[0]?.formula
    if (dieAfterHook && dieAfterHook !== die) {
      attackInput.actionDie = normalizeLibDie(dieAfterHook)
    }
    const bonuses = []
    if (options.backstab) {
      attackInput.isBackstab = true
      if (backstabBonus !== 0) {
        bonuses.push({
          id: 'class:backstab',
          label: game.i18n.localize('DCC.Backstab'),
          source: { type: 'class', id: 'thief' },
          category: 'inherent',
          effect: { type: 'modifier', value: backstabBonus }
        })
      }
    }
    const hookBonuses = hookTermsToBonuses(hookAddedTerms)
    if (hookBonuses.length > 0) bonuses.push(...hookBonuses)
    if (bonuses.length > 0) attackInput.bonuses = bonuses

    // Session 10 (A3): warrior / dwarf deed die. Foundry's Roll already
    // evaluated both the action die (`dice[0]`) and the deed die
    // (`dice[1]`); build a roller closure that hands those naturals to
    // the lib in order — `evaluateRoll` consumes the first call (action
    // die), `rollDeedDie` consumes the second.
    let deedDieRoll
    let deedDieFormula = ''
    let deedDieRollResult = ''
    let deedSucceed = false
    const naturals = [d20RollResult]
    if (attackInput.deedDie) {
      // Gate said deedDie applies; the Foundry Roll's Compound term
      // must have produced a second dice entry. If it didn't (parser
      // regression, hook removed the deed term, lib formula change),
      // failing loud beats silently failing every deed forever.
      if (attackRoll.dice.length <= 1) {
        throw new Error(`[DCC adapter] deed-die expected on attackRoll.dice[1] but only ${attackRoll.dice.length} dice term(s) present (weapon=${weapon?.name})`)
      }
      const deedTotal = attackRoll.dice[1].total
      naturals.push(deedTotal)
      attackRoll.dice[1].options.dcc = { lowerThreshold: 2, upperThreshold: 3 }
      deedDieRollResult = deedTotal
      deedDieFormula = attackRoll.dice[1].formula
      if (!String(this.system.details.attackBonus).startsWith('+1')) {
        deedDieFormula = deedDieFormula.replace(/^1/, '')
      }
      deedDieRoll = Roll.fromTerms([attackRoll.dice[1]])
      deedDieRoll._total = deedTotal
      deedDieRoll._evaluated = true
      deedSucceed = deedTotal > 2
    }
    let rollerIdx = 0
    // Throw on over-consumption rather than silently feeding 0 — a future
    // lib that adds a third internal roll would otherwise silently get a
    // nat-1 (deterministic fumble) and `warnIfDivergent` might miss it
    // if the totals coincidentally agree.
    const sequencedRoller = () => {
      if (rollerIdx >= naturals.length) {
        throw new Error(`[DCC adapter] sequencedRoller exhausted: lib requested ${rollerIdx + 1} rolls, ${naturals.length} natural(s) available (weapon=${weapon?.name})`)
      }
      return naturals[rollerIdx++]
    }
    const libResult = libMakeAttackRoll(attackInput, sequencedRoller)

    // `hookTermsToBonuses` silently drops dice-bearing hook terms
    // (documented in `attack-input.mjs`), so divergence here is
    // expected when a hook injects a bonus die (e.g. dcc-qol's
    // stressful-range `-1d2`). Warn so the case is visible rather
    // than hidden in chat flags — and so a genuine lib-version
    // regression shows up immediately.
    warnIfDivergent('rollToHit', attackRoll.total, libResult.total, { weapon: weapon?.name })

    const fumble = libResult.isFumble
    const naturalCrit = libResult.isCriticalThreat
    const crit = !fumble && naturalCrit

    const modifiedDamageFormula = attackRoll.options?.modifiedDamageFormula

    return {
      d20RollResult,
      deedDieFormula,
      deedDieRollResult,
      deedDieRoll,
      deedSucceed,
      crit,
      formula: game.dcc.DCCRoll.cleanFormula(attackRoll.terms),
      fumble,
      hitsAc: attackRoll.total,
      naturalCrit,
      roll: attackRoll,
      rolled: true,
      weaponDamageFormula: modifiedDamageFormula || weapon.system?.damage || weapon.damage,
      libResult: {
        die: attackInput.actionDie,
        natural: d20RollResult,
        total: libResult.total,
        totalBonus: libResult.totalBonus,
        isHit: libResult.isHit,
        isCriticalThreat: libResult.isCriticalThreat,
        critSource: libResult.critSource,
        isFumble: libResult.isFumble,
        modifiers: libResult.appliedModifiers,
        bonuses: attackInput.bonuses || [],
        deedDie: attackInput.deedDie,
        deedNatural: libResult.deedRoll?.natural,
        deedSuccess: libResult.deedSuccess,
        isTwoWeaponPrimary: !!weapon.system?.twoWeaponPrimary,
        isTwoWeaponSecondary: !!weapon.system?.twoWeaponSecondary
      }
    }
  }

  /**
   * Legacy rollToHit body. Preserved verbatim; any change here should
   * be mirrored in `_rollToHitViaAdapter` where applicable. Non-happy-
   * path cases (deed die, backstab, two-weapon, modifier dialog,
   * automate off) continue to execute this path.
   *
   * @param {Object} weapon      The weapon object being used for the roll
   * @param {Object} options     Options which configure how attacks are rolled E.g. Backstab
   * @return {Object}            Object representing the results of the attack roll
   * @private
   */
  async _rollToHitLegacy (weapon, options = {}) {
    logDispatch('rollWeaponAttack', 'legacy', { weapon: weapon?.name || 'unknown' })
    /* Grab the To Hit modifier */
    const toHit = (weapon.system?.toHit ?? '').replaceAll('@ab', this.system.details.attackBonus)

    const actorActionDice = this.getActionDice({ includeUntrained: true })[0].formula

    const die = weapon.system?.actionDie || actorActionDice

    let critRange = parseInt(weapon.system?.critRange || this.system.details.critRange || 20)

    /* If we don't have a valid formula, bail out here */
    if (!Roll.validate(toHit)) {
      return {
        rolled: false,
        formula: toHit
      }
    }

    // Collate terms for the roll
    const terms = [
      {
        type: 'Die',
        label: game.i18n.localize('DCC.ActionDie'),
        formula: die,
        presets: this.getActionDice({ includeUntrained: true })
      },
      {
        type: 'Compound',
        dieLabel: game.i18n.localize('DCC.DeedDie'),
        modifierLabel: game.i18n.localize('DCC.ToHit'),
        formula: toHit
      }
    ]

    // Add backstab bonus if required
    if (options.backstab) {
      terms.push({
        type: 'Modifier',
        label: game.i18n.localize('DCC.Backstab'),
        presets: [],
        formula: parseInt(this.system?.class?.backstab || '0')
      })
    }

    // Add attack hit bonus adjustment for NPCs (from Active Effects)
    // For PCs, this is already incorporated via computeMeleeAndMissileAttackAndDamage()
    if (this.isNPC) {
      const isMelee = weapon.system?.melee !== false
      const attackAdjustment = isMelee
        ? parseInt(this.system.details.attackHitBonus?.melee?.adjustment) || 0
        : parseInt(this.system.details.attackHitBonus?.missile?.adjustment) || 0
      if (attackAdjustment !== 0) {
        terms.push({
          type: 'Modifier',
          label: game.i18n.localize(isMelee ? 'DCC.MeleeAttackAdjustment' : 'DCC.MissileAttackAdjustment'),
          formula: attackAdjustment
        })
      }
    }

    // Allow modules to modify the terms before the roll is created
    const proceed = Hooks.call('dcc.modifyAttackRollTerms', terms, this, weapon, options)
    if (!proceed) return // Cancel the attack roll if any listener returns false

    /* Roll the Attack */
    const rollOptions = Object.assign(
      {
        title: game.i18n.localize('DCC.ToHit')
      },
      options
    )

    // Add damage terms if showing the modifier dialog
    if (options.showModifierDialog && weapon.system?.damage) {
      rollOptions.damageTerms = [
        {
          type: 'Compound',
          dieLabel: game.i18n.localize('DCC.DamageDie'),
          modifierLabel: game.i18n.localize('DCC.DamageModifier'),
          formula: weapon.system.damage
        }
      ]
    }

    const attackRoll = await game.dcc.DCCRoll.createRoll(terms, Object.assign({ critical: critRange }, this.getRollData()), rollOptions)
    await attackRoll.evaluate()

    // Adjust crit range if the die size was adjusted
    const strictCrits = game.settings.get('dcc', 'strictCriticalHits')
    if (strictCrits) {
      // Extract die sizes from the original and adjusted formulas
      const originalDieMatch = die.match(/(\d+)d(\d+)/)
      const adjustedDieMatch = attackRoll.formula.match(/(\d+)d(\d+)/)
      if (originalDieMatch && adjustedDieMatch) {
        const originalDieSize = parseInt(originalDieMatch[2])
        const adjustedDieSize = parseInt(adjustedDieMatch[2])
        if (originalDieSize !== adjustedDieSize) {
          // Use proportional crit range calculation
          critRange = game.dcc.DiceChain.calculateProportionalCritRange(critRange, originalDieSize, adjustedDieSize)
        }
      }
    } else {
      // Use the original logic (expand crit range)
      critRange += parseInt(game.dcc.DiceChain.calculateCritAdjustment(die, attackRoll.formula))
    }

    const d20RollResult = attackRoll.dice[0].total
    attackRoll.dice[0].options.dcc = {
      upperThreshold: critRange
    }
    let deedDieRoll
    let deedDieRollResult = ''
    let deedDieFormula = ''
    let deedSucceed = false
    if (attackRoll.dice.length > 1) {
      attackRoll.dice[1].options.dcc = {
        lowerThreshold: 2,
        upperThreshold: 3
      }
      deedDieFormula = attackRoll.dice[1].formula
      if (!this.system.details.attackBonus.startsWith('+1')) {
        deedDieFormula = deedDieFormula.replace(/^1/, '')
      }
      // Create a proper Roll object for the deed die
      deedDieRoll = Roll.fromTerms([attackRoll.dice[1]])
      deedDieRoll._total = attackRoll.dice[1].total
      deedDieRoll._evaluated = true
      deedDieRollResult = attackRoll.dice[1].total
      deedSucceed = deedDieRollResult > 2
    }

    /* Check for crit or fumble */
    const fumble = (d20RollResult === 1)
    const naturalCrit = d20RollResult >= critRange
    const crit = !fumble && (naturalCrit || options.backstab)

    // Use modified damage formula from roll modifier dialog if available
    const modifiedDamageFormula = attackRoll.options?.modifiedDamageFormula

    return {
      d20RollResult,
      deedDieFormula,
      deedDieRollResult,
      deedDieRoll,
      deedSucceed,
      crit,
      formula: game.dcc.DCCRoll.cleanFormula(attackRoll.terms),
      fumble,
      hitsAc: attackRoll.total,
      naturalCrit,
      roll: attackRoll,
      rolled: true,
      weaponDamageFormula: modifiedDamageFormula || weapon.system?.damage || weapon.damage
    }
  }

  /**
   * Dispatcher: route the simplest-damage happy-path through the lib
   * adapter (Phase 3 session 5), everything else through the legacy
   * body verbatim. See `_canRouteDamageViaAdapter` for the gate.
   *
   * Both branches return `{ damageRoll, damageInlineRoll, damagePrompt }`
   * for `rollWeaponAttack` to stitch into the chat message. The adapter
   * path additionally returns `libDamageResult`, which `rollWeaponAttack`
   * surfaces as `dcc.libDamageResult` on the chat flags.
   *
   * @param {Object} weapon
   * @param {string} damageRollFormula
   * @param {Object} attackRollResult
   * @param {Object} options
   * @private
   */
  async _rollDamage (weapon, damageRollFormula, attackRollResult, options = {}) {
    if (this._canRouteDamageViaAdapter(weapon, damageRollFormula, attackRollResult, options)) {
      return this._rollDamageViaAdapter(weapon, damageRollFormula, attackRollResult, options)
    }
    return this._rollDamageLegacy(weapon, damageRollFormula, options)
  }

  /**
   * Gate for the Phase 3 session 5 happy-path damage adapter. Routes
   * only the simplest damage — a single-die + flat-modifier(s)
   * formula, no per-term flavors, no backstab damage swap, and only
   * when the attack itself was routed via the adapter. Anything else
   * (multi-type damage like `1d6[fire]+1d6[cold]`, backstab damage,
   * deed-die-injected formulas) stays on legacy. Session 8 broadened
   * the gate to accept magic weapon bonuses — a positive integer
   * `damageWeaponBonus` flows through `DamageInput.magicBonus` for
   * correct breakdown attribution; dice-bearing or cursed (negative)
   * magic bonuses still fall to legacy.
   *
   * @param {Object} weapon
   * @param {string} damageRollFormula
   * @param {Object} attackRollResult
   * @param {Object} options
   * @returns {boolean}
   * @private
   */
  _canRouteDamageViaAdapter (weapon, damageRollFormula, attackRollResult, options = {}) {
    if (!attackRollResult?.libResult) return false
    if (typeof damageRollFormula !== 'string') return false
    if (damageRollFormula.includes('[')) return false
    if (parseDamageFormula(damageRollFormula) === null) return false
    if (extractWeaponMagicBonus(weapon) === null) return false
    return true
  }

  /**
   * Adapter path for the damage roll. Evaluates the Foundry `Roll`
   * (same shape as legacy — `DCCRoll.createRoll` Compound term, chat
   * anchor + breakdown) so chat rendering and the existing
   * `damage-applyable` hooks keep working verbatim. After evaluation,
   * feeds the natural die result into the lib's `rollDamage` so the
   * lib owns the breakdown + totals that surface on chat flags as
   * `dcc.libDamageResult`.
   *
   * @param {Object} weapon
   * @param {string} damageRollFormula
   * @param {Object} attackRollResult
   * @param {Object} options
   * @private
   */
  async _rollDamageViaAdapter (weapon, damageRollFormula, attackRollResult, options = {}) {
    logDispatch('rollDamage', 'adapter', { weapon: weapon?.name || 'unknown' })

    const damageRoll = game.dcc.DCCRoll.createRoll([
      {
        type: 'Compound',
        dieLabel: game.i18n.localize('DCC.Damage'),
        flavor: '',
        formula: damageRollFormula
      }
    ])
    await damageRoll.evaluate()
    foundry.utils.mergeObject(damageRoll.options, { 'dcc.isDamageRoll': true })
    if (damageRoll.total < 1) {
      damageRoll._total = 1
    }

    const parsed = parseDamageFormula(damageRollFormula)
    const magicBonus = extractWeaponMagicBonus(weapon) ?? 0
    const damageInput = buildDamageInput(parsed, {
      npcDamageAdjustment: options.npcDamageAdjustment,
      magicBonus
    })
    const naturalDamage = damageRoll.dice[0]?.total ?? damageRoll.total
    const libResult = libRollDamage(damageInput, () => naturalDamage)

    // Foundry clamps `damageRoll.total` at 1 (line above); lib doesn't,
    // so compare post-clamp on both sides to avoid a spurious warn on
    // negative-modifier damage that's just riding the floor.
    warnIfDivergent('rollDamage', damageRoll.total, Math.max(1, libResult.total), { weapon: weapon?.name })

    let damageInlineRoll = damageRoll.toAnchor({
      classes: ['damage-applyable', 'inline-dsn-hidden'],
      dataset: { damage: damageRoll.total }
    }).outerHTML

    const damageBreakdown = this._buildDamageBreakdown(damageRoll)
    if (damageBreakdown) {
      damageInlineRoll += ` <span class="damage-breakdown">(${damageBreakdown})</span>`
    }

    return {
      damageRoll,
      damageInlineRoll,
      damagePrompt: game.i18n.localize('DCC.Damage'),
      libDamageResult: {
        damageDie: libResult.roll.formula,
        natural: naturalDamage,
        baseDamage: libResult.baseDamage,
        modifierDamage: libResult.modifierDamage,
        total: libResult.total,
        breakdown: libResult.breakdown
      }
    }
  }

  /**
   * Legacy damage path. Preserved verbatim from the original inline body
   * in `rollWeaponAttack`; any change here should be mirrored in
   * `_rollDamageViaAdapter` where applicable. Multi-damage-type formulas
   * (per-term flavors), backstab damage, and non-adapter-routed attacks
   * continue to execute this path.
   *
   * @param {Object} weapon
   * @param {string} damageRollFormula
   * @param {Object} options
   * @private
   */
  async _rollDamageLegacy (weapon, damageRollFormula, options = {}) {
    logDispatch('rollDamage', 'legacy', { weapon: weapon?.name || 'unknown' })

    const hasPerTermFlavors = /\d+d\d+\[/.test(damageRollFormula)

    let damageRoll
    if (hasPerTermFlavors) {
      damageRoll = new Roll(damageRollFormula, this.getRollData())
      await damageRoll.evaluate()
    } else {
      const flavorMatch = damageRollFormula.match(/\[(.*)]/)
      let flavor = ''
      let formula = damageRollFormula
      if (flavorMatch) {
        flavor = flavorMatch[1]
        formula = formula.replace(/\[.*]/, '')
      }
      damageRoll = game.dcc.DCCRoll.createRoll([
        {
          type: 'Compound',
          dieLabel: game.i18n.localize('DCC.Damage'),
          flavor,
          formula
        }
      ])
      await damageRoll.evaluate()
    }
    foundry.utils.mergeObject(damageRoll.options, { 'dcc.isDamageRoll': true })
    if (damageRoll.total < 1) {
      damageRoll._total = 1
    }

    let damageInlineRoll = damageRoll.toAnchor({
      classes: ['damage-applyable', 'inline-dsn-hidden'],
      dataset: { damage: damageRoll.total }
    }).outerHTML

    const damageBreakdown = this._buildDamageBreakdown(damageRoll)
    if (damageBreakdown) {
      damageInlineRoll += ` <span class="damage-breakdown">(${damageBreakdown})</span>`
    }

    return {
      damageRoll,
      damageInlineRoll,
      damagePrompt: game.i18n.localize('DCC.Damage')
    }
  }

  /**
   * Dispatcher: route the simplest-weapon crit-finisher through the lib
   * adapter (Phase 3 session 6), everything else through the legacy body
   * verbatim. See `_canRouteCritViaAdapter` for the gate.
   *
   * Both branches return the same shape for `rollWeaponAttack` to stitch
   * into the chat message (`critRollFormula` / `critInlineRoll` /
   * `critPrompt` / `critRoll` / `critResult` / `critRollTotal`). The
   * adapter path additionally returns `libCritResult`, which
   * `rollWeaponAttack` surfaces as `dcc.libCritResult` on the chat flags.
   *
   * @param {Object} weapon
   * @param {Object} attackRollResult
   * @param {{automate: boolean, luckMod: string, critTableName: string}} ctx
   * @private
   */
  async _rollCritical (weapon, attackRollResult, ctx) {
    if (this._canRouteCritViaAdapter(weapon, attackRollResult, ctx)) {
      return this._rollCriticalViaAdapter(weapon, attackRollResult, ctx)
    }
    return this._rollCriticalLegacy(weapon, attackRollResult, ctx)
  }

  /**
   * Gate for the Phase 3 session 6 happy-path crit adapter. Routes only
   * when the attack itself was routed via the adapter AND
   * `automateDamageFumblesCrits` is on (so the Foundry Roll actually
   * evaluates — the lib call is a two-pass replay of the natural die).
   *
   * @param {Object} weapon
   * @param {Object} attackRollResult
   * @param {{automate: boolean}} ctx
   * @returns {boolean}
   * @private
   */
  _canRouteCritViaAdapter (weapon, attackRollResult, ctx) {
    if (!attackRollResult?.libResult) return false
    if (!ctx?.automate) return false
    return true
  }

  /**
   * Adapter path for the crit roll. Structurally mirrors legacy for
   * Foundry compatibility: builds a `Compound` DCC term, evaluates via
   * `game.dcc.DCCRoll.createRoll`, looks up the crit-table entry, builds
   * the anchor. After evaluation, feeds the natural die into the lib's
   * `rollCritical` so the lib owns classification + the result that
   * surfaces on chat flags as `dcc.libCritResult`.
   *
   * @param {Object} weapon
   * @param {Object} attackRollResult
   * @param {{automate: boolean, luckMod: string, critTableName: string}} ctx
   * @private
   */
  async _rollCriticalViaAdapter (weapon, attackRollResult, ctx) {
    logDispatch('rollCritical', 'adapter', { weapon: weapon?.name || 'unknown' })

    const { luckMod, critTableName } = ctx
    const critDie = weapon.system?.critDie || this.system.attributes.critical?.die || '1d10'
    const critRollFormula = `${critDie}${luckMod}`
    const critTableText = game.i18n.localize('DCC.CritTable')
    const critTableDisplayText = `${critTableText} ${critTableName}`
    const critTableLink = await getCritTableLink(critTableName, critTableDisplayText)

    const critPrompt = game.i18n.localize('DCC.Critical')
    const critRoll = game.dcc.DCCRoll.createRoll([
      {
        type: 'Compound',
        dieLabel: game.i18n.localize('DCC.Critical'),
        formula: critRollFormula
      }
    ])
    await critRoll.evaluate()
    foundry.utils.mergeObject(critRoll.options, { 'dcc.isCritRoll': true })
    const critRollTotal = critRoll.total

    const naturalCrit = critRoll.dice[0]?.total ?? critRoll.total
    const critInput = buildCriticalInput({
      critDie,
      luckModifier: parseInt(this.system.abilities.lck.mod) || 0,
      critTableName
    })
    const libResult = libRollCritical(critInput, () => naturalCrit)

    warnIfDivergent('rollCritical', critRoll.total, libResult.total, { weapon: weapon?.name })

    let critResult = ''
    const critResultObj = await getCritTableResult(critRoll, `Crit Table ${critTableName}`)
    if (critResultObj) {
      critResult = await TextEditor.enrichHTML(addDamageFlavorToRolls(critResultObj.description))
    }
    const critResultPrompt = game.i18n.localize('DCC.CritResult')
    const critRollAnchor = critRoll.toAnchor({ classes: ['inline-dsn-hidden'], dataset: { damage: critRoll.total } }).outerHTML
    const critInlineRoll = await TextEditor.enrichHTML(`${critResultPrompt} ${critRollAnchor} (${critTableLink})`)

    return {
      critRollFormula,
      critInlineRoll,
      critPrompt,
      critRoll,
      critResult,
      critRollTotal,
      libCritResult: {
        critDie: libResult.roll.formula,
        natural: naturalCrit,
        total: libResult.total,
        critTable: libResult.critTable,
        modifiers: libResult.roll.modifiers
      }
    }
  }

  /**
   * Legacy crit path. Preserved verbatim from the original inline body in
   * `rollWeaponAttack`; any change here should be mirrored in
   * `_rollCriticalViaAdapter` where applicable. Legacy-routed attacks
   * and `automateDamageFumblesCrits=false` continue to execute this
   * path.
   *
   * @param {Object} weapon
   * @param {Object} attackRollResult
   * @param {{automate: boolean, luckMod: string, critTableName: string}} ctx
   * @private
   */
  async _rollCriticalLegacy (weapon, attackRollResult, ctx) {
    logDispatch('rollCritical', 'legacy', { weapon: weapon?.name || 'unknown' })

    const { automate, luckMod, critTableName } = ctx
    const critRollFormula = `${weapon.system?.critDie || this.system.attributes.critical?.die || '1d10'}${luckMod}`
    const criticalText = game.i18n.localize('DCC.Critical')
    const critTableText = game.i18n.localize('DCC.CritTable')
    const critTableDisplayText = `${critTableText} ${critTableName}`
    const critTableLink = await getCritTableLink(critTableName, critTableDisplayText)
    let critInlineRoll = await TextEditor.enrichHTML(`[[/r ${critRollFormula} # ${criticalText} (${critTableDisplayText})]] (${critTableLink})`)
    let critPrompt = game.i18n.localize('DCC.RollCritical')
    let critRoll
    let critResult = ''
    let critRollTotal = null

    if (automate) {
      critPrompt = game.i18n.localize('DCC.Critical')
      critRoll = game.dcc.DCCRoll.createRoll([
        {
          type: 'Compound',
          dieLabel: game.i18n.localize('DCC.Critical'),
          formula: critRollFormula
        }
      ])
      await critRoll.evaluate()
      foundry.utils.mergeObject(critRoll.options, { 'dcc.isCritRoll': true })
      critRollTotal = critRoll.total
      const critResultObj = await getCritTableResult(critRoll, `Crit Table ${critTableName}`)
      if (critResultObj) {
        critResult = await TextEditor.enrichHTML(addDamageFlavorToRolls(critResultObj.description))
      }
      const critResultPrompt = game.i18n.localize('DCC.CritResult')
      const critRollAnchor = critRoll.toAnchor({ classes: ['inline-dsn-hidden'], dataset: { damage: critRoll.total } }).outerHTML
      critInlineRoll = await TextEditor.enrichHTML(`${critResultPrompt} ${critRollAnchor} (${critTableLink})`)
    }

    return {
      critRollFormula,
      critInlineRoll,
      critPrompt,
      critRoll,
      critResult,
      critRollTotal
    }
  }

  /**
   * Dispatcher: route the simplest-weapon fumble-finisher through the lib
   * adapter (Phase 3 session 6), everything else through the legacy body
   * verbatim. See `_canRouteFumbleViaAdapter` for the gate.
   *
   * Both branches return the same shape for `rollWeaponAttack` to stitch
   * into the chat message. The adapter path additionally returns
   * `libFumbleResult`, which `rollWeaponAttack` surfaces as
   * `dcc.libFumbleResult` on the chat flags.
   *
   * @param {Object} weapon
   * @param {Object} attackRollResult
   * @param {Object} ctx
   * @private
   */
  async _rollFumble (weapon, attackRollResult, ctx) {
    if (this._canRouteFumbleViaAdapter(weapon, attackRollResult, ctx)) {
      return this._rollFumbleViaAdapter(weapon, attackRollResult, ctx)
    }
    return this._rollFumbleLegacy(weapon, attackRollResult, ctx)
  }

  /**
   * Gate for the Phase 3 session 6 happy-path fumble adapter. Routes only
   * when the attack itself was routed via the adapter AND
   * `automateDamageFumblesCrits` is on (so the Foundry Roll actually
   * evaluates).
   *
   * @param {Object} weapon
   * @param {Object} attackRollResult
   * @param {{automate: boolean}} ctx
   * @returns {boolean}
   * @private
   */
  _canRouteFumbleViaAdapter (weapon, attackRollResult, ctx) {
    if (!attackRollResult?.libResult) return false
    if (!ctx?.automate) return false
    return true
  }

  /**
   * Adapter path for the fumble roll. Structurally mirrors legacy for
   * Foundry compatibility: builds a `Compound` DCC term, evaluates via
   * `game.dcc.DCCRoll.createRoll`, looks up the fumble-table entry. After
   * evaluation, feeds the natural die into the lib's `rollFumble` so the
   * lib owns the result that surfaces on chat flags as
   * `dcc.libFumbleResult`.
   *
   * @param {Object} weapon
   * @param {Object} attackRollResult
   * @param {Object} ctx
   * @private
   */
  async _rollFumbleViaAdapter (weapon, attackRollResult, ctx) {
    logDispatch('rollFumble', 'adapter', { weapon: weapon?.name || 'unknown' })

    const { inverseLuckMod, useNPCFumbles, originalFumbleTableName } = ctx
    let fumbleTableName = ctx.fumbleTableName
    let fumbleRollFormula = `${this.system.attributes.fumble.die}${inverseLuckMod}`
    if (this.isNPC && useNPCFumbles) {
      fumbleRollFormula = '1d10'
    }

    const fumblePrompt = game.i18n.localize('DCC.Fumble')
    const fumbleRoll = game.dcc.DCCRoll.createRoll([
      {
        type: 'Compound',
        dieLabel: game.i18n.localize('DCC.Fumble'),
        formula: fumbleRollFormula
      }
    ])
    await fumbleRoll.evaluate()
    foundry.utils.mergeObject(fumbleRoll.options, { 'dcc.isFumbleRoll': true })
    const fumbleRollTotal = fumbleRoll.total

    const naturalFumble = fumbleRoll.dice[0]?.total ?? fumbleRoll.total
    const fumbleDie = this.isNPC && useNPCFumbles ? '1d10' : this.system.attributes.fumble.die
    const fumbleInput = buildFumbleInput({
      fumbleDie,
      luckModifier: parseInt(this.system.abilities.lck.mod) || 0
    })
    const libResult = libRollFumble(fumbleInput, () => naturalFumble)

    warnIfDivergent('rollFumble', fumbleRoll.total, libResult.total, { weapon: weapon?.name })

    let isNPCFumble = false
    let fumbleResultObj
    if (this.isPC || !useNPCFumbles) {
      fumbleResultObj = await getFumbleTableResult(fumbleRoll)
    } else {
      isNPCFumble = true
      fumbleResultObj = await getNPCFumbleTableResult(fumbleRoll, originalFumbleTableName)
    }
    let fumbleResult = ''
    if (fumbleResultObj) {
      fumbleTableName = `${fumbleResultObj?.parent?.link}:<br>`.replace('Fumble Table ', '').replace('Crit/', '')
      fumbleResult = await TextEditor.enrichHTML(addDamageFlavorToRolls(fumbleResultObj.description))
    }
    const onPrep = game.i18n.localize('DCC.on')
    const fumbleRollAnchor = fumbleRoll.toAnchor({ classes: ['inline-dsn-hidden'], dataset: { damage: fumbleRoll.total } }).outerHTML
    const fumbleInlineRoll = await TextEditor.enrichHTML(`${fumbleRollAnchor} ${onPrep} ${fumbleTableName}`)

    return {
      fumbleRollFormula,
      fumbleInlineRoll,
      fumblePrompt,
      fumbleRoll,
      fumbleResult,
      fumbleRollTotal,
      fumbleTableName,
      isNPCFumble,
      libFumbleResult: {
        fumbleDie: libResult.fumbleDie,
        natural: naturalFumble,
        total: libResult.total,
        modifiers: libResult.roll.modifiers
      }
    }
  }

  /**
   * Legacy fumble path. Preserved verbatim from the original inline body in
   * `rollWeaponAttack`; any change here should be mirrored in
   * `_rollFumbleViaAdapter` where applicable.
   *
   * @param {Object} weapon
   * @param {Object} attackRollResult
   * @param {Object} ctx
   * @private
   */
  async _rollFumbleLegacy (weapon, attackRollResult, ctx) {
    logDispatch('rollFumble', 'legacy', { weapon: weapon?.name || 'unknown' })

    const { automate, inverseLuckMod, useNPCFumbles, originalFumbleTableName } = ctx
    let fumbleTableName = ctx.fumbleTableName
    let fumbleRollFormula = `${this.system.attributes.fumble.die}${inverseLuckMod}`
    if (this.isNPC && useNPCFumbles) {
      fumbleRollFormula = '1d10'
    }
    let fumbleInlineRoll = await TextEditor.enrichHTML(`[[/r ${fumbleRollFormula} # Fumble (${fumbleTableName})]] (${fumbleTableName})`)
    let fumblePrompt = game.i18n.localize('DCC.RollFumble')
    let fumbleRoll
    let fumbleResult = ''
    let fumbleRollTotal = null
    let isNPCFumble = false

    if (automate) {
      fumblePrompt = game.i18n.localize('DCC.Fumble')
      fumbleRoll = game.dcc.DCCRoll.createRoll([
        {
          type: 'Compound',
          dieLabel: game.i18n.localize('DCC.Fumble'),
          formula: fumbleRollFormula
        }
      ])
      await fumbleRoll.evaluate()
      foundry.utils.mergeObject(fumbleRoll.options, { 'dcc.isFumbleRoll': true })
      fumbleRollTotal = fumbleRoll.total
      let fumbleResultObj
      if (this.isPC || !useNPCFumbles) {
        fumbleResultObj = await getFumbleTableResult(fumbleRoll)
      } else {
        isNPCFumble = true
        fumbleResultObj = await getNPCFumbleTableResult(fumbleRoll, originalFumbleTableName)
      }
      if (fumbleResultObj) {
        fumbleTableName = `${fumbleResultObj?.parent?.link}:<br>`.replace('Fumble Table ', '').replace('Crit/', '')
        fumbleResult = await TextEditor.enrichHTML(addDamageFlavorToRolls(fumbleResultObj.description))
      }
      const onPrep = game.i18n.localize('DCC.on')
      const fumbleRollAnchor = fumbleRoll.toAnchor({ classes: ['inline-dsn-hidden'], dataset: { damage: fumbleRoll.total } }).outerHTML
      fumbleInlineRoll = await TextEditor.enrichHTML(`${fumbleRollAnchor} ${onPrep} ${fumbleTableName}`)
    }

    return {
      fumbleRollFormula,
      fumbleInlineRoll,
      fumblePrompt,
      fumbleRoll,
      fumbleResult,
      fumbleRollTotal,
      fumbleTableName,
      isNPCFumble
    }
  }

  /**
   * Roll a Critical Hit
   * Called from sheet and macros
   * @param {Object} options     Options which configure how attacks are rolled E.g. Backstab
   */
  async rollCritical (options = {}) {
    // Construct the terms
    const terms = [
      {
        type: 'Die',
        formula: options.critDieOverride || this.system.attributes.critical?.die || '1d10'
      },
      {
        type: 'Modifier',
        label: game.i18n.localize('DCC.AbilityLck'),
        formula: ensurePlus(this.system.abilities.lck.mod)
      }
    ]

    const critRoll = await game.dcc.DCCRoll.createRoll(terms, this.getRollData(), options)
    await critRoll.evaluate()
    const critRollFormula = critRoll.formula
    const critPrompt = game.i18n.localize('DCC.Critical')

    const critTableName = this.system.attributes.critical?.table
    const critResultObj = await getCritTableResult(critRoll, `Crit Table ${critTableName}`)
    let critResult = ''
    if (critResultObj) {
      critResult = await TextEditor.enrichHTML(addDamageFlavorToRolls(critResultObj.description))
    }

    foundry.utils.mergeObject(critRoll.options, { 'dcc.isCritRoll': true })

    // Speaker object for the chat cards
    const speaker = ChatMessage.getSpeaker({ actor: this })

    const messageData = {
      user: game.user.id,
      speaker,
      flavor: game.i18n.format('DCC.CritDie'),
      flags: {
        'dcc.isCrit': true,
        'dcc.isNaturalCrit': true
      },
      rolls: [critRoll],
      system: {
        actorId: this.id,
        critPrompt,
        critResult,
        critText: critResult, // Legacy name for dcc-qol compatibility
        critRollFormula,
        critRollTotal: critRoll.total,
        critTableName,
        critInlineRoll: critResult
      }
    }

    // Note: critRoll is already in rolls array, no need to include in system data
    // Roll objects in system data can cause issues with Foundry v14's TypeDataModel
    ChatMessage.create(messageData)
  }

  /**
   * Apply damage to this actor
   * @param {Number} damageAmount   Damage amount to apply
   * @param {Number} multiplier     Damage multiplier
   */
  async applyDamage (damageAmount, multiplier) {
    const speaker = ChatMessage.getSpeaker({ actor: this })

    // Calculate damage amount and current hit points
    const amount = damageAmount * multiplier
    const hp = this.system.attributes.hp.value

    let newHp = hp
    if (amount > 0) {
      // Taking damage - just subtract and allow damage to go below zero
      newHp = newHp - amount
    } else {
      // Healing - don't allow HP to be brought above MaxHP, but if it's already there assume it's intentional
      const maxHp = this.system.attributes.hp.max
      if (hp >= maxHp) {
        newHp = hp
      } else {
        newHp = Math.min(newHp - amount, maxHp)
      }
    }

    const deltaHp = newHp - hp

    // Announce damage or healing results
    if (Math.abs(deltaHp) > 0) {
      const locString = (deltaHp > 0) ? 'DCC.HealDamage' : 'DCC.TakeDamage'
      const messageData = {
        user: game.user.id,
        speaker,
        flags: {
          'dcc.isApplyDamage': true
        },
        content: game.i18n.format(locString, { damage: Math.abs(deltaHp) }),
        style: CONST.CHAT_MESSAGE_STYLES.EMOTE,
        sound: CONFIG.sounds.notification
      }
      ChatMessage.applyMode(messageData, game.settings.get('core', 'messageMode'))
      await CONFIG.ChatMessage.documentClass.create(messageData)
    }

    // Apply new HP
    return this.update({
      'system.attributes.hp.value': newHp
    })
  }

  /**
   * Lose a wizard spell through a casting failure
   */
  async loseSpell (item) {
    const speaker = ChatMessage.getSpeaker({ actor: this })

    // Mark the spell as lost - if the item is known
    if (item) {
      item.update({
        'system.lost': true
      })
    }

    // Announce that the spell (or a spell) was lost
    const locString = item ? game.i18n.format('DCC.SpellLostMessageFormat', { spell: item.name }) : game.i18n.localize('DCC.SpellLostMessage')
    const messageData = {
      user: game.user.id,
      speaker,
      style: CONST.CHAT_MESSAGE_STYLES.EMOTE,
      content: locString,
      sound: CONFIG.sounds.notification
    }
    ChatMessage.applyMode(messageData, game.settings.get('core', 'messageMode'))
    await CONFIG.ChatMessage.documentClass.create(messageData)
  }

  /**
   * Apply a point of disapproval
   */
  async applyDisapproval (amount = 1) {
    if (this.isNPC) {
      return
    }

    const speaker = ChatMessage.getSpeaker({ actor: this })
    // Calculate new disapproval
    const newRange = Math.min(this.system.class.disapproval + amount, 20)

    // Apply the new disapproval range
    this.update({
      'system.class.disapproval': newRange
    })

    // Announce that disapproval was increased
    const messageData = {
      user: game.user.id,
      speaker,
      flags: {
        'dcc.isDisapproval': true
      },
      style: CONST.CHAT_MESSAGE_STYLES.EMOTE,
      content: game.i18n.format('DCC.DisapprovalGained', { range: newRange }),
      sound: CONFIG.sounds.notification
    }
    ChatMessage.applyMode(messageData, game.settings.get('core', 'messageMode'))
    await CONFIG.ChatMessage.documentClass.create(messageData)
  }

  /**
   * Prompt and roll for disapproval
   * @param {Number} naturalRoll   Optional - the natural roll for the last spell check
   */
  async rollDisapproval (naturalRoll) {
    // Generate a formula, placeholder if the natural roll is not known
    const terms = [
      {
        type: 'DisapprovalDie',
        formula: `${naturalRoll || 1}d4`
      },
      {
        type: 'Modifier',
        label: 'Luck Modifier',
        formula: -this.system.abilities.lck.mod
      }
    ]
    const options = {}

    // Force the Roll Modifier dialog on if we don't know the formula
    if (naturalRoll === undefined) {
      options.showModifierDialog = true
    }

    // If we know the formula just roll it
    await this._onRollDisapproval(terms, options)
  }

  /**
   * Roll disapproval
   * @private
   * @param terms
   * @param options
   */
  async _onRollDisapproval (terms, options = {}) {
    try {
      const roll = await game.dcc.DCCRoll.createRoll(terms, this.getRollData(), options)

      if (!roll) { return }

      // Lookup the disapproval table if available
      let disapprovalTable = null
      for (const disapprovalPackName of CONFIG.DCC.disapprovalPacks.packs) {
        const disapprovalTableName = this.system.class.disapprovalTable
        if (disapprovalPackName && disapprovalTableName) {
          const pack = game.packs.get(disapprovalPackName)
          if (pack) {
            const entry = pack.index.find((entity) => `${disapprovalPackName}.${entity.name}` === disapprovalTableName)
            if (entry) {
              disapprovalTable = await pack.getDocument(entry._id)
            }
          }
        }
      }

      // If not found in compendium packs, try the local world tables
      if (!disapprovalTable) {
        const disapprovalTableName = this.system.class.disapprovalTable
        if (disapprovalTableName) {
          // Extract just the table name from the full path if needed
          // e.g., "dcc-core-book.dcc-core-disapproval.Disapproval" -> "Disapproval"
          const tableName = disapprovalTableName.includes('.')
            ? disapprovalTableName.split('.').pop()
            : disapprovalTableName

          // Search for a table in the world with a matching name
          disapprovalTable = game.tables.find((entity) => entity.name === tableName)
        }
      }

      // Draw from the table if found, otherwise display the roll
      if (disapprovalTable) {
        disapprovalTable.draw({ roll, displayChat: true })
      } else {
        // Fall back to displaying just the roll
        roll.toMessage({
          speaker: ChatMessage.getSpeaker({ actor: this }),
          flavor: game.i18n.localize('DCC.DisapprovalRoll'),
          flags: {
            'dcc.RollType': 'Disapproval'
          }
        })
      }
    } catch (err) {
      if (err) {
        ui.notifications.warn(game.i18n.format('DCC.DisapprovalFormulaWarning'))
      }
    }
  }

  /**
   * Override fromImport to fix legacy item IDs that are not 16 characters
   * Foundry v13 requires exactly 16-character alphanumeric IDs
   * @param {object} json - The JSON data to import
   * @returns {Promise<Document>} The created document
   */
  static async fromImport (json) {
    // Fix any item IDs that are not exactly 16 characters
    if (json.items && Array.isArray(json.items)) {
      for (const item of json.items) {
        if (item._id && (item._id.length !== 16 || !/^[a-zA-Z0-9]+$/.test(item._id))) {
          // Truncate or pad the ID to 16 characters while keeping it alphanumeric
          if (item._id.length > 16) {
            item._id = item._id.substring(0, 16)
          } else {
            // Pad with random alphanumeric characters
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
            while (item._id.length < 16) {
              item._id += chars.charAt(Math.floor(Math.random() * chars.length))
            }
          }
        }
      }
    }
    return super.fromImport(json)
  }
}

export default DCCActor
