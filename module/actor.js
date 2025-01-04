/* global Actor, ChatMessage, CONFIG, CONST, Hooks, Roll, TextEditor, game, ui, foundry */
// noinspection JSUnresolvedReference

import { ensurePlus, getCritTableResult, getFumbleTableResult, getNPCFumbleTableResult } from './utilities.js'
import DCCActorLevelChange from './actor-level-change.js'

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
      this.system.config.computeSpeed = false
      this.system.config.computeCheckPenalty = false
      this.system.config.computeMeleeAndMissileAttackAndDamage = false
    }

    // Compute Melee/Missile Attack/Damage
    // Here as opposed to derived since items depend on these values
    if (config.computeMeleeAndMissileAttackAndDamage) {
      this.computeMeleeAndMissileAttackAndDamage()
    }

    if (this.isPC) {
      this.computeSpellCheck()
      if (config.computeSavingThrows) {
        this.computeSavingThrows()
      }
    }

    // Cap level if required
    if (config.maxLevel) {
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
    const refSaveOverride = parseInt(this.system.saves.ref.override || 0)
    const frtSaveClassBonus = parseInt(this.system.saves.frt.classBonus || 0)
    const frtSaveOtherBonus = parseInt(this.system.saves.frt.otherBonus || 0)
    const frtSaveOverride = parseInt(this.system.saves.frt.override || 0)
    const wilSaveClassBonus = parseInt(this.system.saves.wil.classBonus || 0)
    const wilSaveOtherBonus = parseInt(this.system.saves.wil.otherBonus || 0)
    const wilSaveOverride = parseInt(this.system.saves.wil.override || 0)

    this.system.saves.ref.value = ensurePlus(aglMod + refSaveClassBonus + refSaveOtherBonus)
    if (refSaveOverride) {
      this.system.saves.ref.value = ensurePlus(refSaveOverride)
    }
    this.system.saves.frt.value = ensurePlus(staMod + frtSaveClassBonus + frtSaveOtherBonus)
    if (frtSaveOverride) {
      this.system.saves.frt.value = ensurePlus(frtSaveOverride)
    }
    this.system.saves.wil.value = ensurePlus(perMod + wilSaveClassBonus + wilSaveOtherBonus)
    if (wilSaveOverride) {
      this.system.saves.wil.value = ensurePlus(wilSaveOverride)
    }
  }

  /**
   * Compute Spell Check
   */
  computeSpellCheck () {
    let abilityBonus = ensurePlus(this.system.abilities.int.mod)
    if (this.system.class.spellCheckAbility === 'per') {
      abilityBonus = ensurePlus(this.system.abilities.per.mod)
    }
    if (this.system.class.spellCheckAbility === '') {
      abilityBonus = ''
    }
    this.system.class.spellCheck = ensurePlus(this.system.details.level.value + abilityBonus)
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
  }

  /**
   * Level Change
   */
  levelChange () {
    new DCCActorLevelChange(this).render(true)
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
          formula: ability.mod
        }
      ]

      if (this.system.config.computeCheckPenalty && flags.checkPenaltyCouldApply) {
        terms.push({
          type: 'CheckPenalty',
          formula: ensurePlus(this.system.attributes.ac.checkPenalty || '0'),
          apply: true
        })
      }

      roll = await game.dcc.DCCRoll.createRoll(terms, {}, options)

      // Generate flags for the roll
      Object.assign(flags, {
        'dcc.RollType': 'AbilityCheck',
        'dcc.Ability': abilityId,
        'dcc.isAbilityCheck': true
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

  // noinspection JSUnusedGlobalSymbols
  /**
   * Generate Initiative Roll formula
   * This is used by the core Foundry methods
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

  async rollInit (event, token) {
    if (token?.combatant?.initiative) {
      ui.notifications.warn(game.i18n.localize('DCC.AlreadyHasInitiative'))
      return
    }

    const rollOptions = this.sheet._fillRollOptions(event)
    let formula = null
    if (rollOptions.showModifierDialog) {
      formula = await this.getInitiativeRoll(formula, { showModifierDialog: true })
    }

    const options = {
      createCombatants: true,
      initiativeOptions: {
        formula
      }
    }

    if (token) {
      token.actor.rollInitiative(options)
    } else {
      this.rollInitiative(options)
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
      const sta = this.system.abilities.sta || {}
      const modifier = sta.mod = sta.value ? CONFIG.DCC.abilityModifiers[sta.value] : '+0'
      terms.push({
        type: 'Modifier',
        label: game.i18n.localize('DCC.AbilitySta'),
        formula: modifier
      })
    }

    const roll = await game.dcc.DCCRoll.createRoll(terms, this.getRollData(), options)

    if (this.type !== 'Player') {
      await roll.evaluate()

      await this.update({
        'system.attributes.hp.max': roll.total,
        'system.attributes.hp.value': roll.total
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
    let die = skill.die || this.system.attributes.actionDice.value || '1d20'

    // Handle Override Die for special Cleric Skills
    if (skill.useDisapprovalRange) {
      if (this.system.class.spellCheckOverrideDie) {
        die = this.system.class.spellCheckOverrideDie
      }
    }

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

    const checkPenalty = ensurePlus(this.system.attributes.ac.checkPenalty || '0')
    if (checkPenalty !== '+0') {
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
        'dcc.SkillId': skillId,
        'dcc.isSkillCheck': true
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
      await this.applyDisapproval(skill.drainDisapproval)
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
    let die = this.system.attributes.actionDice.value || '1d20'
    if (this.system.class.spellCheckOverrideDie) {
      die = this.system.class.spellCheckOverrideDie
    }
    const level = ensurePlus(this.system.details.level.value)
    const abilityMod = ensurePlus(ability?.mod || 0) || +0
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
      terms.push(
        {
          type: 'Compound',
          dieLabel: game.i18n.localize('DCC.RollModifierDieTerm'),
          modifierLabel: game.i18n.localize('DCC.Level'),
          formula: level
        }
      )
      terms.push(
        {
          type: 'Compound',
          dieLabel: game.i18n.localize('DCC.RollModifierDieTerm'),
          modifierLabel: game.i18n.localize('DCC.AbilityMod'),
          formula: abilityMod
        }
      )
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
      flavor
    })
  }

  /**
   * Roll a weapon's attack, damage, and handle any crits
   * @param {string} weaponId    The weapon name or slot id (e.g. "m1", "r1")
   * @param {Object} options     Options which configure how attacks are rolled E.g. Backstab
   */
  async rollWeaponAttack (weaponId, options = {}) {
    const automateDamageFumblesCrits = game.settings.get('dcc', 'automateDamageFumblesCrits')

    // First try and find the item by id
    const weapon = this.items.find(i => i.id === weaponId)

    // If weapon is not found, give up and show a warning
    if (!weapon) {
      return ui.notifications.warn(game.i18n.format('DCC.WeaponNotFound', { id: weaponId }))
    }

    // Warn if weapon is not equipped
    if (!weapon.system?.equipped && game.settings.get('dcc', 'checkWeaponEquipment')) return ui.notifications.warn(game.i18n.localize('DCC.WeaponWarningUnequipped'))

    // Accumulate all rolls for sending to the chat message
    const rolls = []

    // Attack roll
    const attackRollResult = await this.rollToHit(weapon, options)
    if (attackRollResult.naturalCrit) {
      options.naturalCrit = true
    }
    foundry.utils.mergeObject(attackRollResult.roll.options, { 'dcc.isAttackRoll': true })
    const attackRollHTML = await attackRollResult.roll.render()
    rolls.push(attackRollResult.roll)

    // Damage roll
    let damageRollFormula = weapon.system.damage
    if (attackRollResult.deedDieRollResult) {
      const deedDie = attackRollResult.deedDieFormula.replace('1d', 'd')
      damageRollFormula = damageRollFormula.replaceAll(deedDie, `+${attackRollResult.deedDieRollResult}`)
      if (damageRollFormula.includes('@ab')) {
        // This does not handle very high level characters that might have a deed die and a deed die modifier
        // But since @ab really should only be for NPCs, we don't have a way of splitting out such a mod from a strength mod
        // So when building NPCs, ensure that @ab really only accounts for the deed die, not a deed die mod, you can add that to the damage formula
        damageRollFormula = damageRollFormula.replaceAll('@ab', attackRollResult.deedDieRollResult)
      }
    }
    if (options.backstab && weapon.system?.backstabDamage) {
      damageRollFormula = damageRollFormula.replace(weapon.system?.damageWeapon, weapon.system?.backstabDamage)
    }
    let damageRoll, damageInlineRoll, damagePrompt
    if (automateDamageFumblesCrits) {
      damageRoll = game.dcc.DCCRoll.createRoll([
        {
          type: 'Compound',
          dieLabel: game.i18n.localize('DCC.Damage'),
          formula: damageRollFormula
        }
      ])
      await damageRoll.evaluate()
      foundry.utils.mergeObject(damageRoll.options, { 'dcc.isDamageRoll': true })
      damageRoll.flavor = game.i18n.localize('DCC.Damage')
      if (damageRoll.total < 1) {
        damageRoll._total = 1
      }
      rolls.push(damageRoll)
      const damageRollAnchor = await damageRoll.toAnchor({ classes: ['damage-applyable'], dataset: { damage: damageRoll.total } })
      damageInlineRoll = damageRollAnchor.outerHTML
      damagePrompt = game.i18n.localize('DCC.Damage')
    } else {
      if (damageRollFormula.includes('-')) {
        damageRollFormula = `max(${damageRollFormula}, 1)`
      }
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
    let critTableName = ''
    let critText = ''
    const luckMod = ensurePlus(this.system.abilities.lck.mod)
    if (attackRollResult.crit) {
      critRollFormula = `${weapon.system?.critDie || this.system.attributes.critical.die}${luckMod}`
      critTableName = weapon.system?.critTable || this.system.attributes.critical.table
      const criticalText = game.i18n.localize('DCC.Critical')
      const critTableText = game.i18n.localize('DCC.CritTable')
      critInlineRoll = await TextEditor.enrichHTML(`[[/r ${critRollFormula} # ${criticalText} (${critTableText} ${critTableName})]] (${critTableText} ${critTableName})`)
      if (automateDamageFumblesCrits) {
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
        rolls.push(critRoll)
        const critResult = await getCritTableResult(critRoll, `Crit Table ${critTableName}`)
        if (critResult) {
          critTableName = critResult?.parent?.link.replace(/\{.*}/, `{${critTableName}}`)
          critText = await TextEditor.enrichHTML(critResult.text)
          critText = `: <br>${critText}`
        }
        const critResultPrompt = game.i18n.localize('DCC.CritResult')
        const critRollAnchor = critRoll.toAnchor().outerHTML
        critInlineRoll = await TextEditor.enrichHTML(`${critResultPrompt} ${critRollAnchor} (${critTableText} ${critTableName})${critText}`)
      }
    }

    // Fumble roll
    let fumbleRollFormula = ''
    let fumbleInlineRoll = ''
    let fumblePrompt = ''
    let fumbleTableName = '(Table 4-2: Fumbles).'
    let fumbleText = ''
    let fumbleRoll
    let useNPCFumbles = false
    try {
      useNPCFumbles = game.settings.get('dcc-core-book', 'registerNPCFumbleTables') || false
    } catch {
      // Do nothing; already false by default
    }
    const inverseLuckMod = ensurePlus((parseInt(this.system.abilities.lck.mod) * -1).toString())
    if (attackRollResult.fumble) {
      fumbleRollFormula = `${this.system.attributes.fumble.die}${inverseLuckMod}`
      if (this.isNPC && useNPCFumbles) {
        fumbleRollFormula = '1d10'
      }
      fumbleInlineRoll = await TextEditor.enrichHTML(`[[/r ${fumbleRollFormula} # Fumble]]`)
      fumblePrompt = game.i18n.localize('DCC.RollFumble')
      if (automateDamageFumblesCrits) {
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
        rolls.push(fumbleRoll)
        let fumbleResult
        if (this.isPC || !useNPCFumbles) {
          fumbleResult = await getFumbleTableResult(fumbleRoll)
        } else {
          fumbleTableName = weapon.system?.critTable || this.system.attributes.critical.table
          fumbleResult = await getNPCFumbleTableResult(fumbleRoll, fumbleTableName)
        }
        if (fumbleResult) {
          fumbleTableName = `(${fumbleResult?.parent?.link}):<br>`.replace('Fumble Table ', '').replace('Crit/', '')
          fumbleText = await TextEditor.enrichHTML(fumbleResult.text)
        }
        const fumbleResultPrompt = game.i18n.localize('DCC.FumblePrompt')
        const fumbleRollAnchor = fumbleRoll.toAnchor().outerHTML
        fumbleInlineRoll = await TextEditor.enrichHTML(`${fumbleResultPrompt} ${fumbleRollAnchor} ${fumbleTableName} ${fumbleText}`)
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
        critTableName,
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
        hitsAc: attackRollResult.hitsAc,
        weaponId,
        weaponName: weapon.name
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
    Hooks.callAll('dcc.rollWeaponAttack', rolls, messageData)

    // Output the results
    ChatMessage.create(messageData)
  }

  /**
   * Roll a weapon's attack roll
   * @param {Object} weapon      The weapon object being used for the roll
   * @param {Object} options     Options which configure how attacks are rolled E.g. Backstab
   * @return {Object}            Object representing the results of the attack roll
   */
  async rollToHit (weapon, options = {}) {
    /* Grab the To Hit modifier */
    const toHit = weapon.system?.toHit.replaceAll('@ab', this.system.details.attackBonus)

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
      deedDieRoll = attackRoll.dice[1]
      deedDieRollResult = attackRoll.dice[1].total
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
      deedDieRoll,
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
   * Roll a Critical Hit
   * Called from sheet and macros
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

    const critRoll = await game.dcc.DCCRoll.createRoll(terms, this.getRollData(), options)
    await critRoll.evaluate()
    const critRollFormula = critRoll.formula
    const critPrompt = game.i18n.localize('DCC.Critical')

    let critTableName = this.system.attributes.critical.table
    const critResult = await getCritTableResult(critRoll, `Crit Table ${critTableName}`)
    let critText = ''
    if (critResult) {
      critText = await TextEditor.enrichHTML(critResult.text)
      critTableName = await TextEditor.enrichHTML(critResult?.parent?.link.replace(/\{.*}/, `{${critTableName}}`))
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
        critRoll,
        critRollFormula,
        critTableName,
        critInlineRoll: critText
      }
    }

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
        flavor: game.i18n.format(locString),
        isRoll: true,
        rolls: [await new Roll(deltaHp.toString()).evaluate()],
        flags: {
          'dcc.isApplyDamage': true
        },
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
      flags: {
        'dcc.isDisapproval': true
      },
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
