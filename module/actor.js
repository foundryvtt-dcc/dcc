/* global Actor, ChatMessage, CONFIG, CONST, game, Roll */

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

    let roll = new Roll('1d20+@abilMod', { abilMod: ability.mod, critical: 20 })

    // Override the Roll for Luck Checks unless they explicitly click on the modifier
    if ((abilityId === 'lck') && (options.event.currentTarget.className !== 'ability-modifiers')) {
      roll = new Roll('1d20')
    }

    // Convert the roll to a chat message
    roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: `${game.i18n.localize(ability.label)} Check`
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
      let combatant = game.combat.getCombatantByToken(tokenId)
      if (!combatant) {
        await game.combat.createCombatant({ tokenId, hasRolled: true, initiative: roll.total })
      } else {
        await game.combat.setInitiative(combatant._id, roll.total)
      }
    }
  }

  /**
   * Roll a Saving Throw
   * @param {String} saveId       The save ID (e.g. "str")
   */
  rollSavingThrow (saveId) {
    const save = this.data.data.saves[saveId]
    save.label = CONFIG.DCC.saves[saveId]
    const roll = new Roll('1d20+@saveMod', { saveMod: save.value })

    // Convert the roll to a chat message
    roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: `${game.i18n.localize(save.label)} Save`
    })
  }

  /**
   * Roll a Weapon Attack
   * @param {string} weaponId     The weapon id (e.g. "m1", "r1")
   * @param {Object} options      Options which configure how ability tests are rolled
   */
  async rollWeaponAttack (weaponId, options = {}) {
    const weapon = this.data.data.items.weapons[weaponId]
    const speaker = { alias: this.name, _id: this._id }
    const formula = `1d20 + ${weapon.toHit}`

    /* Roll the Attack */
    const roll = new Roll(formula, { critical: 20 })
    roll.roll()
    const rollHTML = this._formatRoll(roll, formula)

    const d20RollResult = roll.dice[0].total

    /* Handle Critical Hits */
    let crit = ''
    if (d20RollResult === 20) {
      const critTableFilter = `Crit Table ${this.data.data.attributes.critical.table}`
      const pack = game.packs.get('dcc.criticalhits')
      await pack.getIndex() // Load the compendium index
      const entry = pack.index.find((entity) => entity.name.startsWith(critTableFilter))
      const table = await pack.getEntity(entry._id)
      const roll = new Roll(`${this.data.data.attributes.critical.die} + ${this.data.data.abilities.lck.mod}`)
      const critResult = await table.draw({ roll, displayChat: false })
      crit = ` <br><br><span style="color:red; font-weight: bolder">Critical Hit!</span> ${critResult.results[0].text}</span>`
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
      const table = await pack.getEntity(entry._id)
      const roll = new Roll(`${fumbleDie} - ${this.data.data.abilities.lck.mod}`)
      const fumbleResult = await table.draw({ roll, displayChat: false })
      fumble = ` <br><br><span style="color:red; font-weight: bolder">Fumble!</span> ${fumbleResult.results[0].text}</span>`
    }

    /* Roll the Damage */
    const damageRoll = new Roll(weapon.damage)
    damageRoll.roll()
    const damageRollData = escape(JSON.stringify(damageRoll))
    const damageRollTotal = damageRoll.total
    const damageRollHTML = `<a class="inline-roll inline-result damage-applyable" data-roll="${damageRollData}" data-damage="${damageRollTotal}" title="${weapon.damage}"><i class="fas fa-dice-d20"></i> ${damageRollTotal}</a>`

    /* Emote attack results */
    const messageData = {
      user: game.user._id,
      speaker: speaker,
      type: CONST.CHAT_MESSAGE_TYPES.EMOTE,
      content: game.i18n.format("DCC.AttackRollEmote", {
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
    if (Number(roll.dice[0].results[0]) === 20) critFailClass = 'critical '
    else if (Number(roll.dice[0].results[0]) === 1) critFailClass = 'fumble '

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
