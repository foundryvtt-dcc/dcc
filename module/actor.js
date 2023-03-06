/* global Actor, ChatMessage, CONFIG, CONST, game, ui, Roll, mergeObject */

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
      abilities[abilityId].mod = CONFIG.DCC.abilities.modifiers[abilities[abilityId].value] || 0
      abilities[abilityId].maxMod = CONFIG.DCC.abilities.modifiers[abilities[abilityId].max] || abilities[abilityId].mod
    }

    // Get configuration data
    const config = this._getConfig()
    const data = this.system

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
    data.attributes.fumble = mergeObject(
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
    const data = this.system

    // Migrate base speed if not present based on current speed
    if (!this.system.attributes.speed.base) {
      this.update({
        'data.speed.base': this.system.attributes.speed.value
      })
      this.system.speed.base = this.system.attributes.speed.value
    }

    // Compute AC if required
    if (config.computeAC || config.computeSpeed) {
      const baseACAbility = data.abilities[config.baseACAbility] || { mod: 0 }
      const baseSpeed = parseInt(data.attributes.speed.base)
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
        data.attributes.ac.baseAbility = abilityMod
        data.attributes.ac.baseAbilityLabel = abilityLabel
        data.attributes.ac.armorBonus = armorBonus
        data.attributes.ac.value = 10 + abilityMod + armorBonus
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
        this.system.config.actionDice = this.system.attributes.actionDice.value
      }
      // Parse the action dice expression from the config and produce a list of available dice
      const actionDieExpression = new Roll(this.system.config.actionDice || '1d20')
      const terms = actionDieExpression.terms || actionDieExpression.parts
      const actionDice = []
      for (const term of terms) {
        if (typeof (term) === 'object' && term.faces) {
          const termDie = `1d${term.faces}`
          const termCount = term.number || 1
          for (let i = 0; i < termCount; ++i) {
            actionDice.push(termDie)
          }
        }
      }
      this.system.attributes.actionDice.options = actionDice
    } catch (err) { }

    // Migrate the old rollAttackBonus option if present
    if (this.system.config.rollAttackBonus) {
      this.update({
        'data.config.attackBonusMode': 'manual',
        'data.config.rollAttackBonus': null
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
      computeSpeed: false,
      baseACAbility: 'agl',
      sortInventory: true,
      removeEmptyItems: true,
      showSpells: false,
      showSkills: false,
      showMaxAttributes: true,
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

    const customData = mergeObject(
      data,
      {
        str: data.abilities.str.mod,
        agi: data.abilities.agl.mod,
        agl: data.abilities.agl.mod,
        sta: data.abilities.sta.mod,
        per: data.abilities.per.mod,
        int: data.abilities.int.mod,
        lck: data.abilities.lck.mod,
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
        this.system.config.actionDice = this.system.attributes.actionDice.value
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
    } catch (err) { }

    if (options.includeUntrained) {
      actionDice.push({
        label: game.i18n.localize('DCC.Untrained'),
        formula: '1d10'
      })
    }
    return actionDice
  }

  /**
   * Roll an Ability Check
   * @param {String} abilityId    The ability ID (e.g. "str")
   * @param {Object} options      Options which configure how ability checks are rolled
   */
  async rollAbilityCheck (abilityId, options = {}) {
    const ability = this.system.abilities[abilityId]
    ability.mod = CONFIG.DCC.abilities.modifiers[ability.value] || 0
    ability.label = CONFIG.DCC.abilities[abilityId]
    const abilityLabel = game.i18n.localize(ability.label)
    const flavor = `${abilityLabel} ${game.i18n.localize('DCC.Check')}`
    options.title = flavor

    let roll
    const flags = {}

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
      await roll.evaluate({ async: true })
      roll.dice[0].options.dcc = {
        rollUnder: true,
        lowerThreshold: ability.value,
        upperThreshold: ability.value + 1
      }

      // Generate flags for the roll
      Object.assign(flags, {
        'dcc.RollType': 'AbilityCheckRollUnder',
        'dcc.Ability': abilityId
      })
    } else {
      const die = this.system.attributes.actionDice.value

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
        },
        {
          type: 'CheckPenalty',
          formula: parseInt(this.system.attributes.ac.checkPenalty || 0),
          apply: false
        }
      ]

      roll = await game.dcc.DCCRoll.createRoll(terms, {}, options)

      await roll.evaluate({ async: true })

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
   * Roll Initiative
   * @param {Object} token    The token to roll initiative for
   */
  async rollInitiative (token, options = {}) {
    // No selected token - bail out
    if (!token) {
      return ui.notifications.warn(game.i18n.localize('DCC.InitiativeNoTokenWarning'))
    }

    // Setup the roll
    let die = this.system.attributes.init.die || '1d20'
    const init = this.system.attributes.init.value
    options.title = game.i18n.localize('DCC.RollModifierTitleInitiative')

    const actorweapons = Object.values(this.items)

    const weaponsTwoHandedEquipped = actorweapons.filter(system => system.twoHanded && system.equipped)

    if (weaponsTwoHandedEquipped && game.settings.get('dcc', 'automateTwoHandedWeaponInit')) { die = '1d16[' + game.i18n.localize('DCC.WeaponPropertiesTwoHanded') + ']' }

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

    // Initiative: A warrior add his class level to his initiative rolls.
    if (this.system.class.className === 'Warrior' && game.settings.get('dcc', 'automateWarriorInitiative')) {
      terms.push({
        type: 'Modifier',
        label: game.i18n.localize('DCC.ClassLevel'),
        formula: this.system.details.level.value
      })
    }

    const roll = await game.dcc.DCCRoll.createRoll(terms, this.getRollData(), options)

    // evaluate roll, otherwise roll.total is undefined
    await roll.evaluate({ async: true })

    // Convert the roll to a chat message
    roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.localize('DCC.Initiative'),
      flags: {
        'dcc.RollType': 'Initiative'
      }
    })

    // No combat active
    if (!game.combat) {
      return ui.notifications.warn(game.i18n.localize('DCC.InitiativeNoCombatWarning'))
    }

    // Set initiative value in the combat tracker if appropriate
    const tokenId = token.id
    const combatant = game.combat.getCombatantByToken(tokenId)
    if (!combatant) {
      return ui.notifications.warn(game.i18n.format('DCC.InitiativeNoCombatantWarning', {
        name: token.name
      }))
    }

    await game.combat.setInitiative(combatant.id, roll.total)
  }

  /**
   * Roll Hit Dice
   */
  async rollHitDice (options = {}) {
    const die = this.system.attributes.hitDice.value || '1d4'
    options.title = game.i18n.localize('DCC.RollModifierTitleHitDice')

    // Collate terms for the roll
    const terms = [
      {
        type: 'Compound',
        formula: die
      }
    ]

    // Players have a stamina modifier they can add
    if (this.type === 'Player') {
      const sta = this.system.abilities.sta || {}
      const modifier = sta.mod = sta.value ? CONFIG.DCC.abilities.modifiers[sta.value] : '+0'
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

    await roll.evaluate({ async: true })

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
    const die = skill.die || this.system.attributes.actionDice.value
    const ability = skill.ability || null
    let abilityLabel = ''
    if (ability) {
      abilityLabel = ` (${game.i18n.localize(CONFIG.DCC.abilities[ability])})`
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
      terms.push({
        type: 'Compound',
        dieLabel: game.i18n.localize('DCC.RollModifierDieTerm'),
        modifierLabel: game.i18n.localize(skill.label) + abilityLabel,
        formula: skill.value.toString()
      })
    }

    if (skill.useDeed && this.system.details.lastRolledAttackBonus) {
      terms.push({
        type: 'Modifier',
        label: game.i18n.localize('DCC.DeedRoll'),
        formula: parseInt(this.system.details.lastRolledAttackBonus)
      })
    }

    terms.push({
      type: 'CheckPenalty',
      formula: parseInt(this.system.attributes.ac.checkPenalty || 0),
      apply: false // Always optional for skill checks
    })

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
      game.dcc.processSpellCheck(this, {
        rollTable: skillTable,
        roll,
        item: skillItem,
        flavor: `${game.i18n.localize(skill.label)}${abilityLabel}`
      })
    } else {
      await roll.evaluate({ async: true })

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
      skillItem.update({ 'data.lastResult': roll.total })
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
      'data.abilities.lck.value': (parseInt(this.system.abilities.lck.value) - luckSpend)
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
   * @param {String} abilityId       The ability used for the check (e.g. "per")
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
          // Roll through the item and return so we don't also roll a basic spell check
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
    const die = this.system.attributes.actionDice.value
    const bonus = this.system.class.spellCheck ? this.system.class.spellCheck.toString() : '+0'
    const checkPenalty = parseInt(this.system.attributes.ac.checkPenalty || 0)
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
            'data.abilities.str.value': term.str,
            'data.abilities.agl.value': term.agl,
            'data.abilities.sta.value': term.sta
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
    game.dcc.processSpellCheck(this, {
      rollTable: null,
      roll,
      item: null,
      flavor: flavor
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
    const attackBonusExpression = this.system.details.attackBonus || '0'
    if (attackBonusExpression) {
      const flavor = game.i18n.localize('DCC.DeedRoll')
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
      const lastRoll = this.system.details.lastRolledAttackBonus = (await abRoll.evaluate({ async: true })).total
      await this.update({
        'data.details.lastRolledAttackBonus': lastRoll
      })

      // Apply custom roll options
      if (abRoll.dice.length > 0) {
        abRoll.dice[0].options.dcc = {
          lowerThreshold: 2,
          upperThreshold: 3
        }
      }

      // Convert the roll to a chat message
      if (options.displayStandardCards || !options.rollWeaponAttack) {
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
      'data.attributes.actionDice.value': die
    })
  }

  /**
   * Roll a weapon's attack, damage, and handle any crits
   * @param {string} weaponId    The weapon name or slot id (e.g. "m1", "r1")
   * @param {Object} options     Options which configure how attacks are rolled E.g. Backstab
   */
  async rollWeaponAttack (weaponId, options = {}) {
    if (options.displayStandardCards === undefined) {
      try {
        options.displayStandardCards = game.settings.get('dcc', 'useStandardDiceRoller')
      } catch (e) { }
    }

    // First try and find the item by name or id
    let weapon = this.items.find(i => i.name === weaponId || i.id === weaponId)

    // If not found try finding it by slot
    if (!weapon) {
      try {
        // Verify this is a valid slot name
        const result = weaponId.match(/^([mr])(\d+)$/)
        if (!result) {
          throw new Error('Invalid slot name')
        }
        const isMelee = weaponId[0] === 'm' // 'm' or 'r'
        const weaponIndex = parseInt(weaponId.slice(1)) - 1 // 1 based indexing
        let weapons = this.itemTypes.weapon
        if (this.system.config.sortInventory) {
          // ToDo: Move inventory classification and sorting into the actor so this isn't duplicating code in the sheet
          weapons = [...weapons].sort((a, b) => a.name.localeCompare(b.name))
        }
        weapon = weapons.filter(i => !!i.system.melee === isMelee)[weaponIndex]
      } catch (err) { }
    }

    // If all lookups fail, give up and show a warning
    if (!weapon) {
      return ui.notifications.warn(game.i18n.format('DCC.WeaponNotFound', { id: weaponId }))
    }

    if (options.weaponId === undefined) {
      options.weaponId = weapon.id
    }

    let attackBonusRollResult = 0
    if (this.rollAttackBonusWithAttack) {
      options.rollWeaponAttack = true
      attackBonusRollResult = await this.rollAttackBonus(Object.assign(
        {
          rollWeaponAttack: true
        },
        options
      ))
    }

    if (!weapon.system.equipped && game.settings.get('dcc', 'checkWeaponEquipment')) return ui.notifications.warn(game.i18n.localize('DCC.WeaponWarningUnequipped'))

    // Attack roll
    const attackRollResult = await this.rollToHit(weapon, options)

    // Damage roll
    const damageRollResult = await this.rollDamage(weapon, options)

    // Speaker object for the chat cards
    const speaker = ChatMessage.getSpeaker({ actor: this })

    // Output the results
    if (options.displayStandardCards) {
      // Attack roll card
      if (attackRollResult.rolled) {
        attackRollResult.roll.toMessage({
          user: game.user.id,
          speaker: speaker,
          flavor: game.i18n.format(options.backstab ? 'DCC.BackstabRoll' : 'DCC.AttackRoll', { weapon: weapon.name }),
          flags: {
            'dcc.RollType': 'ToHit',
            'dcc.ItemId': options.weaponId
          }
        })
      } else {
        const messageData = {
          user: game.user.id,
          speaker: speaker,
          type: CONST.CHAT_MESSAGE_TYPES.EMOTE,
          content: game.i18n.format('DCC.AttackRollInvalidFormula', {
            formula: attackRollResult.formula,
            weapon: weapon.name
          }),
          flags: {
            'dcc.RollType': 'ToHit',
            'dcc.ItemId': options.weaponId
          }
        }
        ChatMessage.applyRollMode(messageData, game.settings.get('core', 'rollMode'))
        await CONFIG.ChatMessage.documentClass.create(messageData)
      }

      // Damage roll card
      if (damageRollResult.rolled) {
        damageRollResult.roll.toMessage({
          user: game.user.id,
          speaker: speaker,
          flavor: game.i18n.format('DCC.DamageRoll', { weapon: weapon.name }),
          flags: {
            'dcc.RollType': 'Damage',
            'dcc.ItemId': options.weaponId
          }
        })
      } else {
        const messageData = {
          user: game.user.id,
          speaker: speaker,
          type: CONST.CHAT_MESSAGE_TYPES.EMOTE,
          content: game.i18n.format('DCC.DamageRollInvalidFormula', {
            formula: damageRollResult.formula,
            weapon: weapon.name
          }),
          flags: {
            'dcc.RollType': 'Damage',
            'dcc.ItemId': options.weaponId
          }
        }
        ChatMessage.applyRollMode(messageData, game.settings.get('core', 'rollMode'))
        await CONFIG.ChatMessage.documentClass.create(messageData)
      }

      // Roll crits or fumbles
      if (attackRollResult.crit) {
        this.rollCritical(options)
      } else if (attackRollResult.fumble) {
        this.rollFumble(options)
      }
    } else {
      const attackRollHTML = this._formatAttackRoll(attackRollResult)
      const damageRollHTML = this._formatDamageRoll(damageRollResult)
      const deedRollHTML = this.rollAttackBonusWithAttack ? this._formatAttackBonusRoll(attackBonusRollResult) : ''

      // Check for crits or fumbles
      let critResult = ''
      let fumbleResult = ''

      // Generate flags for the roll
      const flags = {
        'dcc.RollType': 'CombinedAttack',
        'dcc.ItemId': options.weaponId
      }

      if (attackRollResult.crit) {
        critResult = await this.rollCritical(options)
        game.dcc.FleetingLuck.updateFlagsForCrit(flags)
      } else if (attackRollResult.fumble) {
        fumbleResult = await this.rollFumble(options)
        game.dcc.FleetingLuck.updateFlagsForFumble(flags)
      }

      const emote = options.backstab ? 'DCC.BackstabEmote' : 'DCC.AttackRollEmote'
      const messageData = {
        user: game.user.id,
        itemId: weapon.id,
        speaker: speaker,
        type: CONST.CHAT_MESSAGE_TYPES.EMOTE,
        content: game.i18n.format(emote, {
          weaponName: weapon.name,
          rollHTML: attackRollHTML,
          damageRollHTML: damageRollHTML,
          deedRollHTML: deedRollHTML,
          crit: critResult,
          fumble: fumbleResult
        }),
        sound: CONFIG.sounds.dice,
        flags
      }
      ChatMessage.applyRollMode(messageData, game.settings.get('core', 'rollMode'))
      await CONFIG.ChatMessage.documentClass.create(messageData)
    }
  }

  /**
   * Roll a weapon's attack roll
   * @param {Object} weapon      The weapon object being used for the roll
   * @param {Object} options     Options which configure how attacks are rolled E.g. Backstab
   * @return {Object}            Object representing the results of the attack roll
   */
  async rollToHit (weapon, options = {}) {
    /* Grab the To Hit modifier */
    const toHit = weapon.system.toHit

    /* Determine crit range */
    let die = weapon.system.actionDie || this.getActionDice()[0].formula

    /* Determine using untrained weapon */
    const automateUntrainedAttack = game.settings.get('dcc', 'automateUntrainedAttack')
    if (!weapon.system.trained && automateUntrainedAttack) { die = game.dcc.DiceChain.bumpDie(die, '-1') }

    let critRange = parseInt(weapon.system.critRange || this.system.details.critRange || 20)

    /* If we don't have a valid formula, bail out here */
    if (!await Roll.validate(toHit)) {
      return {
        rolled: false,
        formula: weapon.system.toHit
      }
    }

    // Collate terms for the roll
    const terms = [
      {
        type: 'Die',
        label: game.i18n.localize('DCC.ActionDie'),
        formula: die,
        presets: this.getActionDice({ includeUntrained: !automateUntrainedAttack })
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
        formula: parseInt(this.system.class.backstab)
      })
    }

    // Add Strength or Agility modifier to attack rolls
    let modifier
    let modifierLabel
    if (game.settings.get('dcc', 'automateCombatModifier')) {
      if (weapon.system.melee) {
        modifier = this.system.abilities.str.mod
        modifierLabel = 'DCC.AbilityStr'
      } else {
        modifier = this.system.abilities.agl.mod
        modifierLabel = 'DCC.AbilityAgl'
      }
      terms.push({
        type: 'Modifier',
        label: game.i18n.localize(modifierLabel) + ' ' + game.i18n.localize('DCC.Modifier'),
        formula: modifier
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
    await attackRoll.evaluate({ async: true })

    // Adjust crit range if the die size was adjusted
    critRange += parseInt(game.dcc.DiceChain.calculateCritAdjustment(die, attackRoll.formula))

    const d20RollResult = attackRoll.dice[0].total
    attackRoll.dice[0].options.dcc = {
      upperThreshold: critRange
    }

    /* Check for crit or fumble */
    const crit = (d20RollResult > 1 && (d20RollResult >= critRange || options.backstab))
    const fumble = (d20RollResult === 1)

    return {
      rolled: true,
      roll: attackRoll,
      formula: game.dcc.DCCRoll.cleanFormula(attackRoll.terms),
      hitsAc: attackRoll.total,
      d20Roll: d20RollResult,
      crit,
      fumble
    }
  }

  /**
   * Roll a weapon's damage
   * @param {Object} weapon      The weapon object being used for the roll
   * @param {Object} options     Options which configure how attacks are rolled E.g. Backstab
   * @return {Object}            Object representing the results of the attack roll
   */
  async rollDamage (weapon, options = {}) {
    /* Grab the the formula */
    let formula = weapon.system.damage

    /* Are we backstabbing and the weapon has special backstab damage? */
    if (options.backstab && weapon.system.backstab) {
      formula = weapon.system.backstabDamage || weapon.system.damage
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

    // Add Strength modifier to damage rolls
    let modifier
    let modifierLabel
    if ((this.system.class.className) && (game.settings.get('dcc', 'automateCombatModifier'))) {
      if (weapon.system.melee) {
        modifier = ' + ' + this.system.abilities.str.mod
        modifierLabel = 'DCC.AbilityStr'
        terms.push({
          type: 'Modifier',
          label: game.i18n.localize(modifierLabel) + ' ' + game.i18n.localize('DCC.Modifier'),
          formula: modifier
        })
      }
    }

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
    await damageRoll.evaluate({ async: true })

    return {
      rolled: true,
      roll: damageRoll,
      formula: game.dcc.DCCRoll.cleanFormula(damageRoll.terms),
      damage: damageRoll.total
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
        formula: this.system.attributes.critical.die
      },
      {
        type: 'Modifier',
        label: game.i18n.localize('DCC.AbilityLck'),
        formula: parseInt(this.system.abilities.lck.mod || '0')
      }
    ]

    // Roll object for the crit die
    let roll = await game.dcc.DCCRoll.createRoll(
      terms,
      this.getRollData(),
      {} // Ignore options for crits
    )

    // Lookup the crit table if available
    let critResult = null
    for (const criticalHitPackName of CONFIG.DCC.criticalHitPacks.packs) {
      if (criticalHitPackName) {
        const pack = game.packs.get(criticalHitPackName)
        if (pack) {
          await pack.getIndex() // Load the compendium index
          const critTableFilter = `Crit Table ${this.system.attributes.critical.table}`
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
      await roll.evaluate({ async: true })
    } else {
      roll = critResult.roll
    }

    if (!options.displayStandardCards) {
      // Create the roll emote
      const rollData = escape(JSON.stringify(roll))
      const rollTotal = roll.total
      const rollHTML = `<a class="inline-roll inline-result" data-roll="${rollData}" data-damage="${rollTotal}" title="${game.dcc.DCCRoll.cleanFormula(roll.terms)}"><i class="fas fa-dice-d20"></i> ${rollTotal}</a>`

      // Display crit result or just a notification of the crit
      if (critResult) {
        return ` <br/><br/><span style='color:#ff0000; font-weight: bolder'>${game.i18n.localize('DCC.CriticalHit')}!</span> ${rollHTML}<br/>${critResult.results[0].getChatText()}`
      } else {
        return ` <br/><br/><span style='color:#ff0000; font-weight: bolder'>${game.i18n.localize('DCC.CriticalHit')}!</span> ${rollHTML}`
      }
    } else if (!critResult) {
      // Generate flags for the roll
      const flags = {
        'dcc.RollType': 'CriticalHit',
        'dcc.ItemId': options.weaponId
      }
      game.dcc.FleetingLuck.updateFlagsForCrit(flags)

      // Display the raw crit roll
      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this }),
        flavor: `${game.i18n.localize('DCC.CriticalHit')}!`,
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
      await roll.evaluate({ async: true })
    } else {
      roll = fumbleResult.roll
    }

    if (!options.displayStandardCards) {
      // Create the roll emote
      const rollData = escape(JSON.stringify(roll))
      const rollTotal = roll.total
      const rollHTML = `<a class="inline-roll inline-result" data-roll="${rollData}" data-damage="${rollTotal}" title="${game.dcc.DCCRoll.cleanFormula(roll.terms)}"><i class="fas fa-dice-d20"></i> ${rollTotal}</a>`

      // Display fumble result or just a notification of the fumble
      if (fumbleResult) {
        return ` <br/><br/><span style='color:red; font-weight: bolder'>${game.i18n.localize('DCC.Fumble')}!</span> ${rollHTML}<br/>${fumbleResult.results[0].getChatText()}`
      } else {
        return ` <br/><br/><span style='color:red; font-weight: bolder'>${game.i18n.localize('DCC.Fumble')}!</span> ${rollHTML}`
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
      const rollData = escape(JSON.stringify(rollResult.roll))

      // Check for Crit/Fumble
      let critFailClass = ''
      if (Number(rollResult.roll.dice[0].results[0]) === 20) { critFailClass = 'critical ' } else if (Number(rollResult.roll.dice[0].results[0]) === 1) { critFailClass = 'fumble ' }

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
      const rollData = escape(JSON.stringify(rollResult.roll))
      if (rollResult.damage > 0) {
        return `<a class="inline-roll inline-result damage-applyable" data-roll="${rollData}" data-damage="${rollResult.damage}" title="${rollResult.formula}"><i class="fas fa-dice-d20"></i> ${rollResult.damage}</a>`
      } else {
        return `<a class="inline-roll inline-result damage-applyable" data-roll="${rollData}" data-damage="1" title="${rollResult.formula}"><i class="fas fa-dice-d20"></i> 1 (${rollResult.damage})</a>`
      }
    } else {
      return game.i18n.format('DCC.DamageRollInvalidFormulaInline', { formula: rollResult.formula })
    }
  }

  /**
   * Format a Attack Bonus Roll roll for display in-line
   * @param {Object} rollResult   The roll result object for the roll
   * @return {string}             Formatted HTML containing roll
   */
  _formatAttackBonusRoll (rollResult) {
    if (rollResult.rolled) {
      const rollData = escape(JSON.stringify(rollResult.roll))
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
      const locstring = (deltaHp > 0) ? 'DCC.HealDamage' : 'DCC.TakeDamage'
      const messageData = {
        user: game.user.id,
        speaker,
        type: CONST.CHAT_MESSAGE_TYPES.EMOTE,
        content: game.i18n.format(locstring, { target: this.name, damage: Math.abs(deltaHp) }),
        sound: CONFIG.sounds.notification
      }
      ChatMessage.applyRollMode(messageData, game.settings.get('core', 'rollMode'))
      await CONFIG.ChatMessage.documentClass.create(messageData)
    }

    // Apply new HP
    return this.update({
      'data.attributes.hp.value': newHp
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
        'data.lost': true
      })
    }

    // Announce that the spell (or a spell) was lost
    const locString = item ? game.i18n.format('DCC.SpellLostMessageFormat', { spell: item.name }) : game.i18n.localize('DCC.SpellLostMessage')
    const messageData = {
      user: game.user.id,
      speaker,
      type: CONST.CHAT_MESSAGE_TYPES.EMOTE,
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
      'data.class.disapproval': newRange
    })

    // Announce that disapproval was increased
    const messageData = {
      user: game.user.id,
      speaker,
      type: CONST.CHAT_MESSAGE_TYPES.EMOTE,
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
    this._onRollDisapproval(terms, options)
  }

  /**
   * Roll disapproval
   * @param {Array} terms  Disapproval roll terms
   * @private
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
