/* global Actor, ChatMessage, CONFIG, CONST, game, ui, Roll */

/**
 * Extend the base Actor entity by defining a custom roll data structure.
 * @extends {Actor}
 */
class DCCActor extends Actor {
  /** @override */
  prepareData () {
    super.prepareData()

    // Ability modifiers
    const abilities = this.data.data.abilities
    for (const abilityId in abilities) {
      abilities[abilityId].mod = CONFIG.DCC.abilities.modifiers[abilities[abilityId].value] || 0
    }

    // Get configuration data
    const config = this._getConfig()
    const data = this.data.data

    // Cap level if required
    if (config.capLevel) {
      data.details.level.value = Math.max(0, Math.min(data.details.level.value, parseInt(config.maxLevel)))
    }

    // Compute AC if required
    if (config.computeAC) {
      const baseACAbility = data.abilities[config.baseACAbility] || { mod: 0 }
      const abilityMod = baseACAbility.mod
      let armorBonus = 0
      for (const armorItem of this.itemTypes.armor) {
        armorBonus += parseInt(armorItem.data.data.acBonus) || 0
      }
      data.attributes.ac.value = 10 + abilityMod + armorBonus
    }
  }

  /**
   * Get per actor configuration
   *
   * @return {Object}       Configuration data
   */
  _getConfig () {
    let defaultConfig = {
      capLevel: false,
      maxLevel: 0,
      rollAttackBonus: false,
      computeAC: false,
      baseACAbility: 'agl',
      sortInventory: true,
      removeEmptyItems: true
    }

    // Merge any existing data with defaults to implicitly migrate missing config fields
    defaultConfig = Object.assign(defaultConfig, this.data.data.config)
    this.data.data.config = defaultConfig

    return defaultConfig
  }

  /**
   * Roll an Ability Check
   * @param {String} abilityId    The ability ID (e.g. "str")
   * @param {Object} options      Options which configure how ability checks are rolled
   */
  rollAbilityCheck (abilityId, options = {}) {
    const ability = this.data.data.abilities[abilityId]
    ability.mod = CONFIG.DCC.abilities.modifiers[ability.value] || 0
    ability.label = CONFIG.DCC.abilities[abilityId]

    let roll

    // Allow requesting roll under (for Luck Checks)
    if (options.rollUnder) {
      roll = new Roll('1d20')
    } else {
      roll = new Roll('1d20+@abilMod', { abilMod: ability.mod, critical: 20 })
    }

    // Convert the roll to a chat message
    roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: `${game.i18n.localize(ability.label)} ${game.i18n.localize('DCC.Check')}`
    })
  }

  /**
   * Roll Initiative
   */
  async rollInitiative () {
    const init = this.data.data.attributes.init.value
    const roll = new Roll('1d20+@init', { init })

    // Convert the roll to a chat message
    roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.localize('DCC.Initiative')
    })

    // Set initiative value in the combat tracker if there is an active combat
    if (this.token && game.combat) {
      const tokenId = this.token.id

      // Create or update combatant
      const combatant = game.combat.getCombatantByToken(tokenId)
      if (!combatant) {
        await game.combat.createCombatant({ tokenId, hasRolled: true, initiative: roll.total })
      } else {
        await game.combat.setInitiative(combatant._id, roll.total)
      }
    }
  }

  /**
   * Roll a Saving Throw
   * @param {String} saveId       The save ID (e.g. "ref")
   */
  rollSavingThrow (saveId) {
    const save = this.data.data.saves[saveId]
    save.label = CONFIG.DCC.saves[saveId]
    const roll = new Roll('1d20+@saveMod', { saveMod: save.value })

    // Convert the roll to a chat message
    roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: `${game.i18n.localize(save.label)} ${game.i18n.localize('DCC.Save')}`
    })
  }

  /**
   * Roll a Skill Check
   * @param {String}  skillId       The skill ID (e.g. "sneakSilently")
   */
  rollSkillCheck (skillId) {
    const skill = this.data.data.skills[skillId]
    const die = skill.die || this.data.data.attributes.actionDice.value
    const ability = skill.ability || null
    var abilityLabel = ''
    if (ability) {
      abilityLabel = ` (${game.i18n.localize(CONFIG.DCC.abilities[ability])})`
    }

    var roll = null
    if (skill.value) {
      roll = new Roll(die + '+@bonus', { bonus: skill.value })
    } else {
      roll = new Roll(die)
    }

    // Convert the roll to a chat message
    roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: `${game.i18n.localize(skill.label)}${abilityLabel}`
    })
  }

  /**
   * Roll the Luck Die
   */
  rollLuckDie () {
    const roll = new Roll(this.data.data.class.luckDie)

    // Convert the roll to a chat message
    roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: `${game.i18n.localize('DCC.LuckDie')}`
    })
  }

  /**
   * Roll a Spell Check
   * @param {String} abilityId       The ability used for the check (e.g. "per")
   */
  rollSpellCheck (options = {}) {
    if (!options.abilityId) {
      options.abilityId = this.data.data.class.spellCheckAbility || 'int'
    }

    // If a spell name is provided attempt to look up an item with that name for the roll
    if (options.spell) {
      const item = this.items.find(i => i.name === options.spell)
      if (item) {
        if (item.data.type === 'spell') {
          // Roll through the item and return so we don't also roll a basic spell check
          item.rollSpellCheck(options.abilityId)
          return
        } else {
          return ui.notifications.warn(game.i18n.localize('DCC.SpellCheckNonSpellWarning'))
        }
      } else {
        return ui.notifications.warn(game.i18n.localize('DCC.SpellCheckNoOwnedItemWarning'))
      }
    }

    // Otherwise fall back to a raw dice roll with appropriate flavor
    const ability = this.data.data.abilities[options.abilityId]
    ability.label = CONFIG.DCC.abilities[options.abilityId]
    const spell = options.spell ? options.spell : game.i18n.localize('DCC.SpellCheck')
    const die = '1d20'
    const bonus = this.data.data.class.spellCheck || '+0'
    const roll = new Roll('@die+@bonus', { die: die, bonus: bonus })

    // Convert the roll to a chat message
    roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: `${spell} (${game.i18n.localize(ability.label)})`
    })
  }

  /**
   * Roll Attack Bonus
   */
  async rollAttackBonus (options) {
    /* Determine attack bonus */
    const attackBonusExpression = this.data.data.details.attackBonus || '0'

    if (attackBonusExpression) {
      const abRoll = new Roll(attackBonusExpression, { critical: 3 })

      // Store the result for use in attack and damage rolls
      const lastRoll = this.data.data.details.lastRolledAttackBonus = abRoll.roll().total
      this.update({
        'data.details.lastRolledAttackBonus': lastRoll
      })

      // Convert the roll to a chat message
      abRoll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this }),
        flavor: game.i18n.localize('DCC.DeedRoll')
      })
    }
  }

  /**
   * Roll a Weapon Attack
   * @param {string} weaponId     The weapon name or slot id (e.g. "m1", "r1")
   * @param {Object} options      Options which configure how ability tests are rolled
   */
  async rollWeaponAttack (weaponId, options = {}) {
    // First try and find the item by name or id
    let weapon = this.items.find(i => i.name === weaponId || i._id === weaponId)
    const backstab = options.backstab

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
        if (this.data.data.config.sortInventory) {
          // ToDo: Move inventory classification and sorting into the actor so this isn't duplicating code in the sheet
          weapons = [...weapons].sort((a, b) => a.data.name.localeCompare(b.data.name))
        }
        weapon = weapons.filter(i => !!i.data.data.melee === isMelee)[weaponIndex]
      } catch (err) { }
    }

    // If all lookups fail, give up and show a warning
    if (!weapon) {
      return ui.notifications.warn(game.i18n.format('DCC.WeaponNotFound', { id: weaponId }))
    }

    /* Determine backstab bonus if used */
    let toHit = weapon.data.data.toHit
    if (backstab) {
      toHit = toHit + ' + ' + parseInt(this.data.data.class.backstab)
    }

    const speaker = { alias: this.name, _id: this._id }
    const formula = `${weapon.data.data.actionDie} + ${toHit}`
    const config = this._getConfig()

    /* Determine attack bonus */
    let attackBonus = 0
    if (config.rollAttackBonus) {
      attackBonus = this.data.data.details.lastRolledAttackBonus || 0
    }

    /* Determine crit range */
    const critRange = this.data.data.details.critRange || 20

    /* Roll the Attack */
    const roll = new Roll(formula, { ab: attackBonus, critical: critRange })
    roll.roll()
    const rollHTML = this._formatRoll(roll, formula)

    const d20RollResult = roll.dice[0].total

    /* Handle Critical Hits */
    let crit = ''
    if (d20RollResult >= critRange) {
      const critTableFilter = `Crit Table ${this.data.data.attributes.critical.table}`
      const pack = game.packs.get('dcc.criticalhits')
      await pack.getIndex() // Load the compendium index
      const entry = pack.index.find((entity) => entity.name.startsWith(critTableFilter))
      if (entry) {
        const table = await pack.getEntity(entry._id)
        const roll = new Roll(
          `${this.data.data.attributes.critical.die} + ${this.data.data.abilities.lck.mod}`
        )
        const critResult = await table.draw({ roll, displayChat: false })
        crit =
          ` <br><br><span style='color:#ff0000; font-weight: bolder'>${game.i18n.localize('DCC.CriticalHit')}!</span> ${critResult.results[0].text}`
      } else {
        crit =
          ` <br><br><span style='color:#ff0000; font-weight: bolder'>${game.i18n.localize('DCC.CriticalHit')}!</span>`
      }
    }

    /* Handle Fumbles */
    let fumble = ''
    let fumbleDie
    try {
      fumbleDie = this.data.data.items.armor.a0.fumbleDie
    } catch (e) {
      fumbleDie = '1d4'
    }
    if (d20RollResult === 1) {
      const pack = game.packs.get('dcc.fumbles')
      await pack.getIndex() // Load the compendium index
      const entry = pack.index.find((entity) => entity.name.startsWith('Fumble'))
      if (entry) {
        const table = await pack.getEntity(entry._id)
        const roll = new Roll(
          `${fumbleDie} - ${this.data.data.abilities.lck.mod}`
        )
        const fumbleResult = await table.draw({ roll, displayChat: false })
        fumble =
            ` <br><br><span style='color:red; font-weight: bolder'>Fumble!</span> ${fumbleResult.results[0].text}`
      } else {
        fumble =
          ' <br><br><span style=\'color:red; font-weight: bolder\'>Fumble!</span>'
      }
    }

    /* Roll the Damage */
    const damageRoll = new Roll(weapon.data.data.damage, { ab: attackBonus })
    damageRoll.roll()
    const damageRollData = escape(JSON.stringify(damageRoll))
    const damageRollTotal = damageRoll.total
    const damageRollHTML = `<a class="inline-roll inline-result damage-applyable" data-roll="${damageRollData}" data-damage="${damageRollTotal}" title="${weapon.data.data.damage}"><i class="fas fa-dice-d20"></i> ${damageRollTotal}</a>`

    /* Emote attack results */
    const emote = backstab ? 'DCC.BackstabEmote' : 'DCC.AttackRollEmote'
    const messageData = {
      user: game.user._id,
      speaker: speaker,
      type: CONST.CHAT_MESSAGE_TYPES.EMOTE,
      content: game.i18n.format(emote, {
        weaponName: weapon.name,
        rollHTML: rollHTML,
        damageRollHTML: damageRollHTML,
        crit: crit,
        fumble: fumble
      }),
      sound: CONFIG.sounds.dice
    }
    await CONFIG.ChatMessage.entityClass.create(messageData)
  }

  /**
   * Format a roll for display in-line
   * @param {Object<Roll>} roll   The roll to format
   * @param {string} formula      Formula to show when hovering
   * @return {string}             Formatted HTML containing roll
   */
  _formatRoll (roll, formula) {
    const rollData = escape(JSON.stringify(roll))

    // Check for Crit/Fumble
    let critFailClass = ''
    if (Number(roll.dice[0].results[0]) === 20) { critFailClass = 'critical ' } else if (Number(roll.dice[0].results[0]) === 1) { critFailClass = 'fumble ' }
    return `<a class="${critFailClass}inline-roll inline-result" data-roll="${rollData}" title="${formula}"><i class="fas fa-dice-d20"></i> ${roll.total}</a>`
  }

  /**
   * Apply damage to this actor
   * @param {Number} damageAmount   Damage amount to apply
   * @param {Number} multiplier     Damage multiplier
   */
  async applyDamage (damageAmount, multiplier) {
    const speaker = { alias: this.name, _id: this._id }

    // Calculate damage amount and current hit points
    const amount = damageAmount * multiplier
    const hp = this.data.data.attributes.hp.value

    let newHp = hp
    if (amount > 0) {
      // Taking damage - just subtract and allow damage to go below zero
      newHp = newHp - amount
    } else {
      // Healing - don't allow HP to be brought above MaxHP, but if it's already there assume it's intentional
      const maxHp = this.data.data.attributes.hp.max
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
        user: game.user._id,
        speaker: speaker,
        type: CONST.CHAT_MESSAGE_TYPES.EMOTE,
        content: game.i18n.format(locstring, { target: this.name, damage: Math.abs(deltaHp) }),
        sound: CONFIG.sounds.notification
      }
      await CONFIG.ChatMessage.entityClass.create(messageData)
    }

    // Apply new HP
    return this.update({
      'data.attributes.hp.value': newHp
    })
  }
}

export default DCCActor
