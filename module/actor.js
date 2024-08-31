/* global Actor, ChatMessage, CONFIG, CONST, game, ui, Roll, foundry, TextEditor */

import { ensurePlus, getCritTableResult, getFumbleTableResult } from './utilities.js'
import { lookupCriticalRoll, lookupFumbleRoll } from './chat.js'

/**
 * Extend the base Actor entity by defining a custom roll data structure.
 * @extends {Actor}
 */
class DCCActor extends Actor {
  /** @override */
  prepareBaseData () {
    super.prepareBaseData()

    // Ability modifiers
    const abilities = this.system.abilities
    for (const abilityId in abilities) {
      abilities[abilityId].mod = CONFIG.DCC.abilityModifiers[abilities[abilityId].value] || 0
      abilities[abilityId].maxMod = CONFIG.DCC.abilityModifiers[abilities[abilityId].max] || abilities[abilityId].mod
    }

    // Get configuration data
    const config = this._getConfig()
    const data = this.system

    // Compute Melee/Missile Attack/Damage
    // Here as opposed to derived since items depend on these values
    if (config.computeMeleeAndMissileAttackAndDamage) {
      this.calculateMeleeAndMissileAttackAndDamage()
    }

    // Cap level if required
    if (config.capLevel) {
      data.details.level.value = Math.max(0, Math.min(data.details.level.value, parseInt(config.maxLevel)))
    }

    // Determine the correct fumble die and check penalty to use based on armor
    let fumbleDieRank = 0
    let fumbleDie = '1d4'
    let checkPenalty = 0
    if (this.itemTypes) {
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
  }

  /** @override */
  prepareDerivedData () {
    super.prepareDerivedData()

    // Get configuration data
    const config = this._getConfig()

    if (this.system.details.sheetClass === 'Elf') {
      this.system.skills.detectSecretDoors.value = '+4'
    }

    // Migrate base speed if not present based on current speed
    if (!this.system.attributes.speed.base) {
      this.update({
        'system.speed.base': this.system.attributes.speed.value
      })
      this.system.speed.base = this.system.attributes.speed.value
    }

    // Compute AC if required
    if (config.computeAC || config.computeSpeed) {
      const baseACAbility = this.system.abilities[config.baseACAbility] || { mod: 0 }
      const baseSpeed = parseInt(this.system.attributes.speed.base)
      const abilityMod = baseACAbility.mod
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
        this.system.attributes.ac.value = 10 + abilityMod + armorBonus
      }
      if (config.computeSpeed) {
        this.system.attributes.ac.speedPenalty = speedPenalty
        this.system.attributes.speed.value = baseSpeed + speedPenalty
      }
    }

    // Gather available action dice
    try {
      // Implicit migration for legacy actors
      if (!this.system.config.actionDice) {
        this.system.config.actionDice = this.system.attributes.actionDice.value || '1d20'
      }
      // Parse the action dice expression from the config and produce a list of available dice
      const actionDieExpression = new Roll(this.system.config.actionDice || '1d20')
      const terms = actionDieExpression.terms
      const actionDice = []
      for (const term of terms) {
        if (term instanceof foundry.dice.terms.Die) {
          const termDie = `1d${term.faces}`

          const termCount = term.number || 1
          for (let i = 0; i < termCount; ++i) {
            actionDice.push({ value: termDie, label: termDie })
          }
        }
      }
      this.system.attributes.actionDice.options = actionDice
    } catch (err) { }

    // Gather available initiative dice
    try {
      // Implicit migration for legacy actors
      if (!this.system.config.initDice) {
        this.system.config.initDice = this.system.attributes.initDice.value || '1d20'
      }
      // Parse the init dice expression from the config and produce a list of available dice
      const initDieExpression = new Roll(this.system.config.initDice || '1d20')
      const terms = initDieExpression.terms
      const initDice = []

      for (const term of terms) {
        if (term instanceof foundry.dice.terms.Die) {
          const termDie =
            `1d${term.faces}`

          const termCount = term.number || 1
          for (let i = 0; i < termCount; ++i) {
            initDice.push({ value: termDie, label: termDie })
          }
        }
      }
      this.system.attributes.initDice.options = initDice
    } catch (err) { }

    // Migrate the old rollAttackBonus option if present
    if (this.system.config.rollAttackBonus) {
      this.update({
        'system.config.attackBonusMode': 'manual',
        'system.config.rollAttackBonus': null
      })
    }
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
      capLevel: false,
      maxLevel: 10,
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
   * Invalid values default to 'flat''
   * @return {String}  A valid Attack Bonus Mode name
   */
  getAttackBonusMode (options = {}) {
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
      if (!this.system.config.actionDice.match(/\dd/)) {
        ui.notifications.warn(game.i18n.localize('DCC.ActionDiceInvalid'))
      }
      // Parse the action dice expression from the config and produce a list of available dice
      const actionDieExpression = new Roll(this.system.config.actionDice || '1d20')
      const terms = actionDieExpression.terms || actionDieExpression.parts
      for (const term of terms) {
        if (typeof (term) === 'object' && term.faces) {
          const termDie = `1d${term.faces}`
          const termCount = term.number || 1
          for (let i = 0; i < termCount; ++i) {
            actionDice.push({
              label: termDie,
              formula: termDie
            })
          }
        }
      }
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

  /** Calculate Melee/Missile Base Attack and Damage Modifiers
   * @Param {Object} options     Options which configure how bonuses are generated
   */
  calculateMeleeAndMissileAttackAndDamage (options = {}) {
    const attackBonus = this.system.details.attackBonus || '0'
    const strengthBonus = parseInt(this.system.abilities.str.mod) || 0
    const agilityBonus = parseInt(this.system.abilities.agl.mod) || 0
    const meleeAttackBonusAdjustment = parseInt(this.system.details.attackHitBonus?.melee?.adjustment) || 0
    const meleeDamageBonusAdjustment = parseInt(this.system.details.attackDamageBonus?.melee?.adjustment) || 0
    const missileAttackBonusAdjustment = parseInt(this.system.details.attackHitBonus?.missile?.adjustment) || 0
    const missileDamageBonusAdjustment = parseInt(this.system.details.attackDamageBonus?.missile?.adjustment) || 0
    let meleeAttackBonus = ''
    let missileAttackBonus = ''
    let meleeAttackDamage = ''
    let missileAttackDamage = ''
    if (attackBonus.includes('d')) {
      const deedDie = attackBonus.match(/[+-]?(\d+d\d+)/) ? attackBonus.match(/[+-]?(\d+d\d+)/)[1] : attackBonus
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
      missileAttackDamage = `${ensurePlus(missileDamageBonusAdjustment)}`
    }
    this.system.details.attackHitBonus.melee.value = meleeAttackBonus
    this.system.details.attackHitBonus.missile.value = missileAttackBonus
    this.system.details.attackDamageBonus.melee.value = meleeAttackDamage
    this.system.details.attackDamageBonus.missile.value = missileAttackDamage
    this.system.details.attackBonus = ensurePlus(attackBonus, false) || '+0'
  }

  /**
   * Roll an Ability Check
   * @param {String} abilityId    The ability ID (e.g. "str")
   * @param {Object} options      Options which configure how ability checks are rolled
   */
  async rollAbilityCheck (abilityId, options = {}) {
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
        'dcc.Ability': abilityId
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
          formula: ability.mod
        }
      ]

      if (this.system.config.computeCheckPenalty && flags.checkPenaltyCouldApply) {
        terms.push({
          type: 'CheckPenalty',
          formula: parseInt(this.system.attributes.ac.checkPenalty || '0'),
          apply: true
        })
      }

      roll = await game.dcc.DCCRoll.createRoll(terms, {}, options)

      // Generate flags for the roll
      Object.assign(flags, {
        'dcc.RollType': 'AbilityCheck',
        'dcc.Ability': abilityId
      })
      game.dcc.FleetingLuck.updateFlags(flags, roll)
    }

    // Convert the roll to a chat message
    roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor,
      flags
    })
  }

  /**
   * Generate Initiative Roll formula
   */
  getInitiativeRoll (formula, options = {}) {
    // Handle coming back from a modifier dialog with a roll
    if (formula instanceof Roll) {
      return formula
    }

    // Set up the roll
    let die = this.system.attributes.init.die || '1d20'
    const init = this.system.attributes.init.value
    options.title = game.i18n.localize('DCC.RollModifierTitleInitiative')

    const twoHandedWeapon = this.items.find(t => t.system.twoHanded && t.system.equipped)
    if (twoHandedWeapon) {
      die = `${twoHandedWeapon.system.initiativeDie}[${game.i18n.localize('DCC.WeaponPropertiesTwoHanded')}]`
    }
    const customInitDieWeapon = this.items.find(t => (t.system.config?.initiativeDieOverride || '') && t.system.equipped)
    if (customInitDieWeapon) {
      die = `${customInitDieWeapon.system.initiativeDie}[${game.i18n.localize('DCC.Weapon')}]`
    }

    // Collate terms for the roll
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
   * Roll Hit Dice
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
      const sta = this.system.abilities.sta || {}
      const modifier = sta.mod = sta.value ? CONFIG.DCC.abilityModifiers[sta.value] : '+0'
      terms.push({
        type: 'Modifier',
        label: game.i18n.localize('DCC.AbilitySta'),
        formula: modifier
      })
    }

    const roll = await game.dcc.DCCRoll.createRoll(terms, this.getRollData(), options)

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
   * Roll a Saving Throw
   * @param {String} saveId       The save ID (e.g. "ref")
   * @param options
   */
  async rollSavingThrow (saveId, options = {}) {
    const save = this.system.saves[saveId]
    const die = '1d20'
    save.label = CONFIG.DCC.saves[saveId]
    const modifierLabel = game.i18n.localize(save.label)
    const flavor = `${modifierLabel} ${game.i18n.localize('DCC.Save')}`
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
        formula: save.value
      }
    ]

    const roll = await game.dcc.DCCRoll.createRoll(terms, this.getRollData(), options)

    await roll.evaluate()

    // Generate flags for the roll
    const flags = {
      'dcc.RollType': 'SavingThrow',
      'dcc.Save': saveId
    }
    game.dcc.FleetingLuck.updateFlags(flags, roll)

    // Convert the roll to a chat message
    roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor,
      flags
    })
  }

  /**
   * Roll a Skill Check
   * @param {String}  skillId       The skill ID (e.g. "sneakSilently")
   * @param {Object}  options       Roll options
   */
  async rollSkillCheck (skillId, options = {}) {
    let skill = this.system.skills ? this.system.skills[skillId] : null
    let skillItem = null
    if (!skill) {
      skillItem = this.itemTypes.skill.find(i => i.name === skillId)
      if (skillItem) {
        skill = {
          label: skillItem.name
        }
        if (skillItem.system.config.useAbility) {
          skill.ability = skillItem.system.ability
        }
        if (skillItem.system.config.useDie) {
          skill.die = skillItem.system.die
        }
        if (skillItem.system.config.useValue) {
          skill.value = skillItem.system.value ?? undefined
        }
      }
    }
    const die = skill.die || this.system.attributes.actionDice.value || '1d20'
    const ability = skill.ability || null
    let abilityLabel = ''
    let abilityMod = 0
    if (ability) {
      abilityLabel = ` (${game.i18n.localize(CONFIG.DCC.abilities[ability])})`
      abilityMod = parseInt(this.system.abilities[ability]?.mod || '0')
    }

    // Title for the roll modifier dialog
    options.title = game.i18n.localize(skill.label) || (game.i18n.localize('DCC.AbilityCheck') + abilityLabel)
    // Collate terms for the roll
    const terms = []

    terms.push({
      type: 'Die',
      label: skill.die ? null : game.i18n.localize('DCC.ActionDie'),
      formula: die,
      presets: this.getActionDice({ includeUntrained: true })
    })

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

    if (skill.useDeed && this.system.details.lastRolledAttackBonus) {
      terms.push({
        type: 'Modifier',
        label: game.i18n.localize('DCC.DeedRoll'),
        formula: parseInt(this.system.details.lastRolledAttackBonus)
      })
    }

    const checkPenalty = parseInt(this.system.attributes.ac.checkPenalty || '0')
    if (checkPenalty !== 0) {
      let checkPenaltyCouldApply = false
      if (['sneakSilently', 'climbSheerSurfaces'].includes(skillId)) {
        checkPenaltyCouldApply = true
      }
      terms.push({
        type: 'CheckPenalty',
        formula: checkPenalty,
        apply: checkPenaltyCouldApply
      })
    }

    const roll = await game.dcc.DCCRoll.createRoll(terms, this.getRollData(), options)

    // Handle special cleric spellchecks that are treated as skills
    if (skill.useDisapprovalRange) {
      if (roll.dice.length > 0) {
        roll.dice[0].options.dcc = {
          lowerThreshold: this.system.class.disapproval
        }
      }
    }

    // Check if there's a special RollTable for this skill
    const skillTable = await game.dcc.getSkillTable(skillId)
    if (skillTable) {
      await game.dcc.processSpellCheck(this, {
        rollTable: skillTable,
        roll,
        item: skillItem,
        flavor: `${game.i18n.localize(skill.label)}${abilityLabel}`
      })
    } else {
      await roll.evaluate()

      // Generate flags for the roll
      const flags = {
        'dcc.RollType': 'SkillCheck',
        'dcc.SkillId': skillId
      }
      game.dcc.FleetingLuck.updateFlags(flags, roll)

      // Convert the roll to a chat message
      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this }),
        flavor: `${game.i18n.localize(skill.label)}${abilityLabel}`,
        flags
      })
    }

    // Store last result if required
    if (skillItem && skillItem.system.config.showLastResult) {
      skillItem.update({ 'system.lastResult': roll.total })
    }

    // Need to drain disapproval
    if (skill && skill.drainDisapproval && game.settings.get('dcc', 'automateClericDisapproval')) {
      this.applyDisapproval(skill.drainDisapproval)
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
        callback: (formula, term) => {
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
   * Roll a Spell Check
   * @param options
   */
  async rollSpellCheck (options = {}) {
    if (!options.abilityId) {
      options.abilityId = this.system.class.spellCheckAbility || ''
    }

    // If a spell name is provided attempt to look up an item with that name for the roll
    if (options.spell) {
      const item = this.items.find(i => i.name === options.spell)
      if (item) {
        if (item.type === 'spell') {
          // Roll through the item and return, so we don't also roll a basic spell check
          item.rollSpellCheck(options.abilityId, options)
          return
        } else {
          return ui.notifications.warn(game.i18n.localize('DCC.SpellCheckNonSpellWarning'))
        }
      } else {
        return ui.notifications.warn(game.i18n.localize('DCC.SpellCheckNoOwnedItemWarning'))
      }
    }

    // Otherwise fall back to a raw dice roll with appropriate flavor
    const ability = this.system.abilities[options.abilityId] || {}
    ability.label = CONFIG.DCC.abilities[options.abilityId]
    const spell = options.spell ? options.spell : game.i18n.localize('DCC.SpellCheck')
    const die = this.system.attributes.actionDice.value || '1d20'
    const bonus = this.system.class.spellCheck ? this.system.class.spellCheck.toString() : '+0'
    const checkPenalty = parseInt(this.system.attributes.ac.checkPenalty || '0')
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
      },
      {
        type: 'Compound',
        dieLabel: game.i18n.localize('DCC.RollModifierDieTerm'),
        modifierLabel: game.i18n.localize('DCC.SpellCheck'),
        formula: bonus
      },
      {
        type: 'CheckPenalty',
        formula: checkPenalty,
        apply: applyCheckPenalty
      }
    ]

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
      flavor
    })
  }

  /**
   * Getter to determine whether to roll an attack bonus with each attack
   */
  get rollAttackBonusWithAttack () {
    return this.getAttackBonusMode() === 'autoPerAttack'
  }

  /**
   * Roll Attack Bonus
   */
  async rollAttackBonus (options = {}) {
    /* Determine attack bonus */
    const attackBonusExpression = this.system.details.attackHitBonus.melee.value || this.system.details.attackBonus || '0'

    if (attackBonusExpression) {
      const flavor = game.i18n.localize('DCC.AttackBonus')
      options.title = flavor

      // Collate terms for the roll
      const terms = [
        {
          type: 'Die',
          label: flavor,
          formula: attackBonusExpression
        }
      ]

      const abRoll = await game.dcc.DCCRoll.createRoll(terms, Object.assign({ critical: 3 }, this.getRollData()), options)

      // Store the result for use in attack and damage rolls
      const lastRoll = this.system.details.lastRolledAttackBonus = (await abRoll.evaluate()).total
      await this.update({
        'system.details.lastRolledAttackBonus': lastRoll
      })

      // Apply custom roll options
      if (abRoll.dice.length > 0) {
        abRoll.dice[0].options.dcc = {
          lowerThreshold: 2,
          upperThreshold: 3
        }
      }

      // Convert the roll to a chat message
      if (options.displayStandardCards || !options.a) {
        abRoll.toMessage({
          speaker: ChatMessage.getSpeaker({ actor: this }),
          flavor,
          flags: {
            'dcc.RollType': 'AttackBonus'
          }
        })
      }
      return {
        rolled: true,
        roll: abRoll,
        formula: game.dcc.DCCRoll.cleanFormula(abRoll.terms),
        attackBonus: lastRoll
      }
    }
  }

  /*
   * Set Action Dice
   */
  async setActionDice (die) {
    this.update({
      'system.attributes.actionDice.value': die
    })
  }

  /**
   * Roll a weapon's attack, damage, and handle any crits
   * @param {string} weaponId    The weapon name or slot id (e.g. "m1", "r1")
   * @param {Object} options     Options which configure how attacks are rolled E.g. Backstab
   */
  async rollWeaponAttack (weaponId, options = {}) {
    const automateDamageFumblesCrits = game.settings.get('dcc', 'automateDamageFumblesCrits')

    // First try and find the item by name or id
    const weapon = this.items.find(i => i.name === weaponId || i.id === weaponId)

    // If weapon is not found, give up and show a warning
    if (!weapon) {
      return ui.notifications.warn(game.i18n.format('DCC.WeaponNotFound', { id: weaponId }))
    }

    // Warn if weapon is not equipped
    if (!weapon.system?.equipped && game.settings.get('dcc', 'checkWeaponEquipment')) return ui.notifications.warn(game.i18n.localize('DCC.WeaponWarningUnequipped'))

    // Attack roll
    const attackRollResult = await this.rollToHit(weapon, options)
    if (attackRollResult.naturalCrit) {
      options.naturalCrit = true
    }

    // Damage roll
    // Todo backstab
    let damageRollFormula = weapon.system.damage
    if (attackRollResult.deedDieRollResult) {
      damageRollFormula = damageRollFormula.replace(this.system.details.attackBonus, `+${attackRollResult.deedRollTotalResult}`)
    }
    if (damageRollFormula.includes('-')) {
      damageRollFormula = `max(${damageRollFormula}, 1)`
    }
    let damageInlineRoll = await TextEditor.enrichHTML(`[[/r ${damageRollFormula} # Damage]]`)
    let damagePrompt = game.i18n.localize('DCC.RollDamage')
    let damageRoll = null
    if (automateDamageFumblesCrits) {
      damageRoll = game.dcc.DCCRoll.createRoll([
        {
          type: 'Compound',
          dieLabel: game.i18n.localize('DCC.Damage'),
          formula: damageRollFormula
        },
      ])
      await damageRoll.evaluate()
      const damageRollAnchor = await damageRoll.toAnchor()
      damageInlineRoll = damageRollAnchor.outerHTML
      damagePrompt = game.i18n.localize('DCC.Damage')
    }

    // Deed roll
    const deedDieFormula = attackRollResult.deedDieFormula
    const deedDieRollResult = attackRollResult.deedDieRollResult
    const deedRollTotalResult = attackRollResult.deedRollTotalResult
    const deedRollSuccess = attackRollResult.deedDieRollResult > 2

    // Crit roll
    let critRollFormula = ''
    let critInlineRoll = ''
    let critPrompt = game.i18n.localize('DCC.RollCritical')
    let critTableName = ''
    let luckMod = ensurePlus(this.system.abilities.lck.mod)
    if (attackRollResult.crit) {
      // critRollResult = await this.rollCritical(options)
      critRollFormula = `${weapon.system?.critDie || this.system.attributes.critical.die}${luckMod}`
      critTableName = weapon.system?.critTable || this.system.attributes.critical.table
      const criticalText = game.i18n.localize('DCC.Critical')
      const critTableText = game.i18n.localize('DCC.CritTable')
      critInlineRoll = await TextEditor.enrichHTML(`[[/r ${critRollFormula} # ${criticalText} (${critTableText} ${critTableName})]] (${critTableText} ${critTableName})`)
      if (automateDamageFumblesCrits) {
        critPrompt = game.i18n.localize('DCC.Critical')
        const critRoll = game.dcc.DCCRoll.createRoll([
          {
            type: 'Compound',
            dieLabel: game.i18n.localize('DCC.Critical'),
            formula: critRollFormula
          },
        ])
        await critRoll.evaluate()
        const critResult = await getCritTableResult(critRoll.total, `Crit Table ${critTableName}`)
        const critText = await TextEditor.enrichHTML(critResult.results[0].text)
        critInlineRoll = await TextEditor.enrichHTML(`[[${critRollFormula}]] (${critTableText} ${critTableName})<br>${critText}`)
      }
    }

    // Fumble roll
    let fumbleRollFormula = ''
    let fumbleInlineRoll = ''
    let fumblePrompt = ''
    if (attackRollResult.fumble) {
      // fumbleRollResult = await this.rollFumble(options)
      fumbleRollFormula = weapon.system?.fumbleDie || this.system.attributes.fumble.die
      fumbleInlineRoll = await TextEditor.enrichHTML(`[[/r ${fumbleRollFormula} # Fumble]]`)
      fumblePrompt = game.i18n.localize('DCC.RollFumble')
      if (automateDamageFumblesCrits) {
        fumblePrompt = game.i18n.localize('DCC.Fumble')
        const fumbleRoll = game.dcc.DCCRoll.createRoll([
          {
            type: 'Compound',
            dieLabel: game.i18n.localize('DCC.Fumble'),
            formula: fumbleRollFormula
          },
        ])
        await fumbleRoll.evaluate()
        const fumbleResult = await getFumbleTableResult(fumbleRoll.total)
        const fumbleText = await TextEditor.enrichHTML(fumbleResult.results[0].text)
        fumbleInlineRoll = await TextEditor.enrichHTML(`[[${fumbleRollFormula} # Fumble]]`)
      }
    }

    // Speaker object for the chat cards
    const speaker = ChatMessage.getSpeaker({ actor: this })

    const messageData = {
      user: game.user.id,
      speaker,
      flavor: game.i18n.format(options.backstab ? 'DCC.BackstabRoll' : 'DCC.AttackRoll', { weapon: weapon.name }),
      flags: {
        'dcc.isToHit': true,
        'dcc.isBackstab': options.backstab,
        'dcc.isFumble': attackRollResult.fumble,
        'dcc.isCrit': attackRollResult.crit,
        'dcc.isNaturalCrit': attackRollResult.naturalCrit,
        'dcc.isMelee': weapon.system?.melee
      },
      system: {
        actorId: this.id,
        damageInlineRoll,
        damagePrompt,
        damageRollFormula,
        critInlineRoll,
        critPrompt,
        critRollFormula,
        critTableName,
        critDieOverride: weapon.system?.config?.critDieOverride,
        critTableOverride: weapon.system?.config?.critTableOverride,
        deedDieFormula,
        deedDieRollResult,
        deedRollTotalResult,
        deedRollSuccess,
        fumbleInlineRoll,
        fumblePrompt,
        fumbleRollFormula,
        hitsAc: attackRollResult.hitsAc,
        weaponId,
        weaponName: weapon.name
      }
    }

    // Output the results
    attackRollResult.roll.toMessage(messageData)
  }

  /**
   * Roll a weapon's attack roll
   * @param {Object} weapon      The weapon object being used for the roll
   * @param {Object} options     Options which configure how attacks are rolled E.g. Backstab
   * @return {Object}            Object representing the results of the attack roll
   */
  async rollToHit (weapon, options = {}) {
    /* Grab the To Hit modifier */
    const toHit = weapon.system?.toHit

    const actorActionDice = this.getActionDice({ includeUntrained: true })[0].formula

    const die = weapon.system?.actionDie || actorActionDice

    let critRange = parseInt(weapon.system?.critRange || this.system.details.critRange || 20)

    /* If we don't have a valid formula, bail out here */
    if (!await Roll.validate(toHit)) {
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
        formula: parseInt(this.system.class.backstab)
      })
    }

    /* Roll the Attack */
    const rollOptions = Object.assign(
      {
        title: game.i18n.localize('DCC.ToHit')
      },
      options
    )
    const attackRoll = await game.dcc.DCCRoll.createRoll(terms, Object.assign({ critical: critRange }, this.getRollData()), rollOptions)
    await attackRoll.evaluate()

    // Adjust crit range if the die size was adjusted
    critRange += parseInt(game.dcc.DiceChain.calculateCritAdjustment(die, attackRoll.formula))

    const d20RollResult = attackRoll.dice[0].total
    attackRoll.dice[0].options.dcc = {
      upperThreshold: critRange
    }
    let deedDieRollResult = ''
    let deedDieFormula = ''
    let deedRollTotalResult = ''
    let deedSucceed = false
    if (attackRoll.dice.length > 1) {
      attackRoll.dice[1].options.dcc = {
        lowerThreshold: 2,
        upperThreshold: 3
      }
      deedDieFormula = attackRoll.dice[1].formula
      deedDieRollResult = attackRoll.dice[1].total
      deedRollTotalResult = attackRoll.terms[2].total
      deedSucceed = deedDieRollResult > 2
    }

    /* Check for crit or fumble */
    const fumble = (d20RollResult === 1)
    const naturalCrit = d20RollResult >= critRange
    const crit = !fumble && (naturalCrit || options.backstab)

    return {
      d20RollResult,
      deedDieFormula,
      deedDieRollResult,
      deedRollTotalResult,
      deedSucceed,
      crit,
      formula: game.dcc.DCCRoll.cleanFormula(attackRoll.terms),
      fumble,
      hitsAc: attackRoll.total,
      naturalCrit,
      roll: attackRoll,
      rolled: true,
      weaponDamageFormula: weapon.damage
    }
  }

  /**
   * Roll a weapon's damage
   * @param {Object} weapon      The weapon object being used for the roll
   * @param {Object} options     Options which configure how attacks are rolled E.g. Backstab
   * @return {Object}            Object representing the results of the attack roll
   */
  async rollDamage (weapon, options = {}) {
    /* Grab the formula */
    let formula = weapon.system?.damage

    /* Are we backstabbing and the weapon has special backstab damage? */
    if (options.backstab && weapon.system.backstabDamage) {
      formula = `${weapon.system.damage}${weapon.system.backstabDamage}`
    }

    /* If we don't have a valid formula, bail out here */
    if (Roll.validate !== undefined && !Roll.validate(formula)) {
      return {
        rolled: false,
        formula
      }
    }

    /* Collate the terms */
    const terms = [
      {
        type: 'Compound',
        dieLabel: game.i18n.localize('DCC.DamageDie'),
        modifierLabel: game.i18n.localize('DCC.DamageModifier'),
        formula
      }
    ]

    /* Roll the damage */
    const rollOptions = Object.assign(
      {
        title: game.i18n.localize('DCC.Damage')
      },
      options
    )
    const damageRoll = await game.dcc.DCCRoll.createRoll(
      terms,
      this.getRollData(),
      rollOptions
    )
    await damageRoll.evaluate()

    // A successful attack always inflicts a minimum of 1 point of damage (already handled with the custom card)
    if (options.displayStandardCards && damageRoll._total < 1) {
      damageRoll._total = 1
    }

    return {
      rolled: true,
      roll: damageRoll,
      formula: game.dcc.DCCRoll.cleanFormula(damageRoll.terms),
      damage: damageRoll.total,
      subdual: weapon.system?.subdual
    }
  }

  /**
   * Roll a Critical Hit
   * @param {Object} options     Options which configure how attacks are rolled E.g. Backstab
   */
  async rollCritical (options = {}) {
    // Construct the terms
    const terms = [
      {
        type: 'Die',
        formula: options.critDieOverride || this.system.attributes.critical.die
      },
      {
        type: 'Modifier',
        label: game.i18n.localize('DCC.AbilityLck'),
        formula: parseInt(this.system.abilities.lck.mod || '0')
      }
    ]

    // Roll object for the crit die
    let roll = await game.dcc.DCCRoll.createRoll(terms, this.getRollData(), options)

    // Lookup the crit table if available
    let critResult = null
    for (const criticalHitPackName of CONFIG.DCC.criticalHitPacks.packs) {
      if (criticalHitPackName) {
        const pack = game.packs.get(criticalHitPackName)
        if (pack) {
          await pack.getIndex() // Load the compendium index
          const critTableFilter =
            `Crit Table ${options.critTableOverride || this.system.attributes.critical.table}`

          const entry = pack.index.find((entity) => entity.name.startsWith(critTableFilter))
          if (entry) {
            const table = await pack.getDocument(entry._id)
            critResult = await table.draw({ roll, displayChat: options.displayStandardCards })
          }
        }
      }
    }

    // Either roll the die or grab the roll from the table lookup
    if (!critResult) {
      await roll.evaluate()
    } else {
      roll = critResult.roll
    }

    // If fancy cards aren't disabled, return HTML for chat message
    if (!options.displayStandardCards) {
      // Create the roll emote
      const rollData = encodeURIComponent(JSON.stringify(roll))
      const rollTotal = roll.total
      const rollHTML = `<a class="inline-roll inline-result" data-roll="${rollData}" data-damage="${rollTotal}"
            title="${game.dcc.DCCRoll.cleanFormula(roll.terms)}">
            <i class="fas fa-dice-d20"></i> ${rollTotal}</a>`

      // Display crit result or just a notification of the crit
      if (critResult) {
        return ` <br/><br/><span style='color:#ff0000; font-weight: bolder'>
                ${game.i18n.localize('DCC.CriticalHit')}!</span> ${rollHTML}<br/>
                ${critResult.results[0].getChatText()}`
      } else {
        return ` <br/><br/><span style='color:#ff0000; font-weight: bolder'>
                    ${game.i18n.localize('DCC.CriticalHit')}!</span> ${rollHTML}`
      }
    }

    // Display basic chat card - only reachable if displayStandardCards is enabled
    if (!critResult) {
      // Generate flags for the roll
      const flags = {
        'dcc.RollType': 'CriticalHit',
        'dcc.ItemId': options.weaponId
      }

      // Fleeting luck if's a real crit (e.g. not forced by a backstab)
      if (options.naturalCrit) {
        game.dcc.FleetingLuck.updateFlagsForCrit(flags)
      }

      // Display the raw crit roll
      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this }),
        flavor: `${game.i18n.localize('DCC.CriticalHit')} !`,
        flags
      })
    }
  }

  /**
   * Roll a Fumble
   * @param {Object} options     Options which configure how attacks are rolled E.g. Backstab
   */
  async rollFumble (options = {}) {
    let fumbleDie
    try {
      fumbleDie = this.system.attributes.fumble.die
    } catch (err) {
      fumbleDie = '1d4'
    }

    // Construct the terms
    const terms = [
      {
        type: 'Die',
        formula: fumbleDie
      },
      {
        type: 'Modifier',
        label: game.i18n.localize('DCC.AbilityLck'),
        formula: -parseInt(this.system.abilities.lck.mod || '0')
      }
    ]

    // Roll object for the fumble die
    let roll = await game.dcc.DCCRoll.createRoll(
      terms,
      this.getRollData(),
      {} // Ignore options for crits
    )

    // Lookup the fumble table if available
    let fumbleResult = null
    const fumbleTableName = CONFIG.DCC.fumbleTable
    if (fumbleTableName) {
      const fumbleTablePath = fumbleTableName.split('.')
      let pack
      if (fumbleTablePath.length === 3) {
        pack = game.packs.get(fumbleTablePath[0] + '.' + fumbleTablePath[1])
      }
      if (pack) {
        await pack.getIndex() // Load the compendium index
        const entry = pack.index.find((entity) => entity.name === fumbleTablePath[2])
        if (entry) {
          const table = await pack.getDocument(entry._id)
          fumbleResult = await table.draw({ roll, displayChat: options.displayStandardCards })
        }
      }
    }

    // Either roll the die or grab the roll from the table lookup
    if (!fumbleResult) {
      await roll.evaluate()
    } else {
      roll = fumbleResult.roll
    }

    if (!options.displayStandardCards) {
      // Create the roll emote
      const rollData = encodeURIComponent(JSON.stringify(roll))
      const rollTotal = roll.total
      const rollHTML = `<a class='inline-roll inline-result'
            data-roll ='${rollData}' data-damage= '${rollTotal}' 
            title='${game.dcc.DCCRoll.cleanFormula(roll.terms)}'>
                <i class='fas fa-dice-d20'></i>${rollTotal}</a>`

      // Display fumble result or just a notification of the fumble
      if (fumbleResult) {
        return `<br/><br/><span style='color:red; font-weight: bolder' >
                ${game.i18n.localize('DCC.Fumble')} !</span>
                ${rollHTML}<br/>
                ${fumbleResult.results[0].getChatText()}`
      } else {
        return `<br/><br/><span style='color:red; font-weight: bolder' >
                ${game.i18n.localize('DCC.Fumble')} !</span>
                ${rollHTML}`
      }
    } else if (!fumbleResult) {
      // Generate flags for the roll
      const flags = {
        'dcc.RollType': 'Fumble',
        'dcc.ItemId': options.weaponId
      }
      game.dcc.FleetingLuck.updateFlagsForFumble(flags)

      // Display the raw fumble roll
      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this }),
        flavor: `${game.i18n.localize('DCC.Fumble')}!`,
        flags
      })
    }
  }

  /**
   * Format an attack roll for display in-line
   * @param {Object} rollResult   The roll result object for the roll
   * @return {string}             Formatted HTML containing roll
   */
  _formatAttackRoll (rollResult) {
    if (rollResult.rolled) {
      const rollData = encodeURIComponent(JSON.stringify(rollResult.roll))

      // Check for Crit/Fumble
      let critFailClass = ''
      if (Number(rollResult.roll.dice[0].total) === 20) { critFailClass = 'critical ' } else if (Number(rollResult.roll.dice[0].total) === 1) { critFailClass = 'fumble ' }

      return `<a class="${critFailClass}inline-roll inline-result" data-roll="${rollData}" title="${rollResult.formula}"><i class="fas fa-dice-d20"></i> ${rollResult.hitsAc}</a>`
    } else {
      return game.i18n.format('DCC.AttackRollInvalidFormulaInline', { formula: rollResult.formula })
    }
  }

  /**
   * Format a damage roll for display in-line
   * @param {Object} rollResult   The roll result object for the roll
   * @return {string}             Formatted HTML containing roll
   */
  _formatDamageRoll (rollResult) {
    if (rollResult.rolled) {
      const rollData = encodeURIComponent(JSON.stringify(rollResult.roll))
      const subdual = rollResult.subdual ? game.i18n.format('DCC.subdual') : ''
      if (rollResult.damage > 0) {
        return `<a class="inline-roll inline-result damage-applyable" data-roll="${rollData}" data-damage="${rollResult.damage}" title="${rollResult.formula}"><i class="fas fa-dice-d20"></i> ${rollResult.damage}</a>${subdual}`
      } else {
        return `<a class="inline-roll inline-result damage-applyable" data-roll="${rollData}" data-damage="1" title="${rollResult.formula}"><i class="fas fa-dice-d20"></i> 1 (${rollResult.damage})</a>`
      }
    } else {
      return game.i18n.format('DCC.DamageRollInvalidFormulaInline', { formula: rollResult.formula })
    }
  }

  /**
   * Format an Attack Bonus Roll for display in-line
   * @param {Object} rollResult   The roll result object for the roll
   * @return {string}             Formatted HTML containing roll
   */
  _formatAttackBonusRoll (rollResult) {
    if (rollResult.rolled) {
      const rollData = encodeURIComponent(JSON.stringify(rollResult.roll))
      // Check for Crit/Fumble
      let critFailClass = ''
      if (Number(rollResult.attackBonus) >= 3) {
        critFailClass = 'critical '
      }
      return game.i18n.format('DCC.AttackRollDeedEmoteSegment', {
        deed: `<a class="${critFailClass} inline-roll inline-result" data-roll="${rollData}" title="${rollResult.formula}"><i class="fas fa-dice-d20"></i> ${rollResult.attackBonus}</a>`
      })
    } else {
      return game.i18n.format('DCC.AttackBonusRollInvalidFormulaInline', { formula: rollResult.formula })
    }
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
        type: CONST.CHAT_MESSAGE_STYLES.EMOTE,
        content: game.i18n.format(locString, { target: this.name, damage: Math.abs(deltaHp) }),
        sound: CONFIG.sounds.notification
      }
      ChatMessage.applyRollMode(messageData, game.settings.get('core', 'rollMode'))
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
      type: CONST.CHAT_MESSAGE_STYLES.EMOTE,
      content: locString,
      sound: CONFIG.sounds.notification
    }
    ChatMessage.applyRollMode(messageData, game.settings.get('core', 'rollMode'))
    await CONFIG.ChatMessage.documentClass.create(messageData)
  }

  /**
   * Apply a point of disapproval
   */
  async applyDisapproval (amount = 1) {
    const speaker = ChatMessage.getSpeaker({ actor: this })

    // Calculate new disapproval
    const newRange = Math.min(parseInt(this.system.class.disapproval) + amount, 20)

    // Apply the new disapproval range
    this.update({
      'system.class.disapproval': newRange
    })

    // Announce that disapproval was increased
    const messageData = {
      user: game.user.id,
      speaker,
      type: CONST.CHAT_MESSAGE_STYLES.EMOTE,
      content: game.i18n.format('DCC.DisapprovalGained', { range: newRange }),
      sound: CONFIG.sounds.notification
    }
    ChatMessage.applyRollMode(messageData, game.settings.get('core', 'rollMode'))
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
   * @param formula
   * @param options
   */
  async _onRollDisapproval (formula, options = {}) {
    try {
      const roll = await game.dcc.DCCRoll.createRoll(formula, this.getRollData(), options)

      if (!roll) { return }

      // Lookup the disapproval table if available
      let disapprovalTable = null
      for (const disapprovalPackName of CONFIG.DCC.disapprovalPacks.packs) {
        const disapprovalTableName = this.system.class.disapprovalTable
        if (disapprovalPackName && disapprovalTableName) {
          const pack = game.packs.get(disapprovalPackName)
          if (pack) {
            await pack.getIndex() // Load the compendium index
            const entry = pack.index.find((entity) => `${disapprovalPackName}.${entity.name}` === disapprovalTableName)
            if (entry) {
              disapprovalTable = await pack.getDocument(entry._id)
            }
          }
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
        ui.notifications.warn(game.i18n.format('DCC.DisapprovalFormulaWarning', { formula }))
      }
    }
  }
}

export default DCCActor
