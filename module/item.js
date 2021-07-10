/* global Item, game, ui, ChatMessage, Roll, CONFIG, CONST */

/**
 * Extend the base Item entity for DCC RPG
 * @extends {Item}
 */
class DCCItem extends Item {
  prepareBaseData () {
    super.prepareBaseData()

    // If this item is owned by an actor, check for config settings to apply
    if (this.actor && this.actor.data && this.data.data.config) {
      if (this.data.type === 'weapon') {
        // Weapons can inherit the owner's action die
        if (this.data.data.config.inheritActionDie) {
          this.data.data.actionDie = this.actor.data.data.attributes.actionDice.value
        }

        // Set default inherit crit range for legacy items
        if (this.data.data.config.inheritCritRange === undefined) {
          this.data.data.config.inheritCritRange = true
        }

        // And inherit crit range if set
        if (this.data.data.config.inheritCritRange) {
          this.data.data.critRange = this.actor.data.data.details.critRange
        } else {
          // If not inheriting crit range make sure there is a value (for legacy items)
          if (this.data.data.critRange === null || this.data.data.critRange === undefined) {
            this.data.data.critRange = 20
          }
        }
      } else if (this.data.type === 'spell') {
        // Spells can use the owner's action die for the spell check
        if (this.data.data.config.inheritActionDie) {
          this.data.data.spellCheck.die = this.actor.data.data.attributes.actionDice.value
        }

        // Spells can inherit the owner's spell check
        if (this.data.data.config.inheritSpellCheck) {
          this.data.data.spellCheck.value = this.actor.data.data.class.spellCheck
        }

        // Spells can inherit the owner's check penalty
        if (this.data.data.config.inheritCheckPenalty) {
          this.data.data.spellCheck.penalty = this.actor.data.data.attributes.ac.checkPenalty
        }
      }
    }
  }

  /**
   * Roll a Spell Check using this item
   * @param {String} abilityId    The ability used for this spell
   */
  async rollSpellCheck (abilityId = 'int', options = {}) {
    if (this.data.type !== 'spell') { return }

    const actor = this.actor
    const ability = actor.data.data.abilities[abilityId] || {}
    ability.label = CONFIG.DCC.abilities[abilityId]
    const spell = this.name

    // Generate the spell check expression
    const modifiers = {
      bonus: parseInt(this.data.data.spellCheck.value || 0)
    }
    if (this.data.data.config.inheritCheckPenalty) {
      modifiers.checkPenalty = parseInt(actor.data.data.attributes.ac.checkPenalty || 0)
    } else {
      modifiers.checkPenalty = parseInt(this.data.data.spellCheck.penalty || 0)
    }

    // Roll the spell check
    const roll = game.dcc.DCCRoll.createSimpleRoll(this.data.data.spellCheck.die, modifiers)
    await roll.evaluate({ async: true })

    if (roll.dice.length > 0) {
      roll.dice[0].options.dcc = {
        lowerThreshold: actor.data.data.class.disapproval
      }
    }

    // Lookup the appropriate table
    const resultsRef = this.data.data.results
    const predicate = t => t.name === resultsRef.table || t._id === resultsRef.table
    let resultsTable
    // If a collection is specified then check the appropriate pack for the spell
    if (resultsRef.collection) {
      const pack = game.packs.get(resultsRef.collection)
      if (pack) {
        await pack.getIndex()
        const entry = pack.index.find(predicate)
        resultsTable = await pack.getDocument(entry._id)
      }
    }
    // Otherwise fall back to searching the world
    if (!resultsTable) {
      resultsTable = game.tables.contents.find(predicate)
    }

    let flavor = spell
    if (ability.label) {
      flavor += ` (${game.i18n.localize(ability.label)})`
    }

    // Tell the system to handle the spell check result
    game.dcc.processSpellCheck(actor, {
      rollTable: resultsTable,
      roll,
      item: this,
      flavor
    })
  }

  /**
   * Check for an existing mercurial magic effect
   * @return
   */
  hasExistingMercurialMagic () {
    return this.data.data.mercurialEffect.value || this.data.data.mercurialEffect.summary || this.data.data.mercurialEffect.description
  }

  /**
   * Roll a or lookup new mercurial effect for a spell item
   * @param {Number} lookup   Optional entry number to lookup instead of rolling
   * @return
   */
  async rollMercurialMagic (lookup = undefined) {
    if (this.data.type !== 'spell') { return }

    const actor = this.actor
    if (!actor) { return }

    const abilityId = 'lck'
    const ability = actor.data.data.abilities[abilityId]
    ability.label = CONFIG.DCC.abilities[abilityId]

    // Roll for a mercurial effect
    let roll = new Roll('@die+@bonus', {
      die: '1d100',
      bonus: ability.mod * 10
    })

    // If looking up then replace the roll
    if (lookup) {
      roll = new Roll('@value', {
        value: lookup
      })
    }

    // Lookup the mercurial magic table if available
    let mercurialMagicResult = null
    const mercurialMagicTableName = CONFIG.DCC.mercurialMagicTable
    if (mercurialMagicTableName) {
      const mercurialMagicTablePath = mercurialMagicTableName.split('.')
      let pack
      if (mercurialMagicTablePath.length === 3) {
        pack = game.packs.get(mercurialMagicTablePath[0] + '.' + mercurialMagicTablePath[1])
      }
      if (pack) {
        await pack.getIndex() // Load the compendium index
        const entry = pack.index.find((entity) => entity.name === mercurialMagicTablePath[2])
        if (entry) {
          const table = await pack.getDocument(entry._id)
          mercurialMagicResult = await table.draw({ roll })
        }
      }
    }

    // Grab the result from the table if present
    if (mercurialMagicResult) {
      roll = mercurialMagicResult.roll
    } else {
      // Fall back to displaying just the roll
      await roll.evaluate({ async: true })
      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor }),
        flavor: game.i18n.localize('DCC.MercurialMagicRoll')
      })
    }

    // Stow away the data in the appropriate fields
    const updates = {}
    updates['data.mercurialEffect.value'] = roll.total
    updates['data.mercurialEffect.summary'] = ''
    updates['data.mercurialEffect.description'] = ''

    if (mercurialMagicResult) {
      try {
        const result = mercurialMagicResult.results[0].text
        const split = result.split('.')
        updates['data.mercurialEffect.summary'] = split[0]
        updates['data.mercurialEffect.description'] = `<p>${result}</p>`
      } catch (err) {
        console.error(`Couldn't extract Mercurial Magic result from table:\n${err}`)
      }
    }

    this.update(updates)
  }

  /**
   * Determine if this item needs to have its treasure value rolled
   * @return {Boolean}  True if any value field contains a rollable formula
   */
  needsValueRoll () {
    let needsRoll = false

    for (const currency in CONFIG.DCC.currencies) {
      const formula = this.data.data.value[currency]
      if (!formula) continue
      try {
        const roll = new Roll(formula.toString())
        if (roll.dice.length > 0) {
          needsRoll = true
          break
        }
      } catch (e) {
        ui.notifications.warn(game.i18n.localize('DCC.BadValueFormulaWarning'))
      }
    }

    return needsRoll
  }

  /**
   * Roll to determine the value of this item
   */
  async rollValue () {
    const updates = {}
    const valueRolls = {}

    for (const currency in CONFIG.DCC.currencies) {
      const formula = this.data.data.value[currency] || '0'
      try {
        const roll = new Roll(formula.toString())
        await roll.evaluate({ async: true })
        updates['data.value.' + currency] = roll.total
        valueRolls[currency] = `<a class="inline-roll inline-result" data-roll="${escape(JSON.stringify(roll))}" title="${game.dcc.DCCRoll.cleanFormula(roll.terms)}"><i class="fas fa-dice-d20"></i> ${roll.total}</a>`
      } catch (e) {
        ui.notifications.warn(game.i18n.localize('DCC.BadValueFormulaWarning'))
      }
    }

    const speaker = { alias: this.actor.name, id: this.actor.id }
    const messageData = {
      user: game.user.id,
      speaker: speaker,
      type: CONST.CHAT_MESSAGE_TYPES.EMOTE,
      content: game.i18n.format('DCC.ResolveValueEmote', {
        itemName: this.name,
        pp: valueRolls.pp,
        ep: valueRolls.ep,
        gp: valueRolls.gp,
        sp: valueRolls.sp,
        cp: valueRolls.cp
      }),
      sound: CONFIG.sounds.dice
    }
    await CONFIG.ChatMessage.documentClass.create(messageData)

    this.update(updates)
  }

  /**
   * Shift currency to the next highest denomination
   */
  async convertCurrencyUpward (currency) {
    const currencyRank = CONFIG.DCC.currencyRank
    const currencyValue = CONFIG.DCC.currencyValue
    // Don't do currency conversions if the value isn't resolved
    if (await this.needsValueRoll()) {
      return
    }
    // Find the rank of this currency
    const rank = currencyRank.indexOf(currency)
    // Make sure there's a currency to convert to
    if (rank >= 0 && rank < currencyRank.length - 1) {
      // What are we converting to?
      const toCurrency = currencyRank[rank + 1]
      // Calculate the conversion factor
      const conversionFactor = currencyValue[toCurrency] / currencyValue[currency]
      // Check we have enough currency
      if (this.data.data.value[currency] >= conversionFactor) {
        // Apply the conversion
        const updates = {}
        updates[`data.value.${currency}`] = parseInt(this.data.data.value[currency]) - conversionFactor
        updates[`data.value.${toCurrency}`] = parseInt(this.data.data.value[toCurrency]) + 1
        this.update(updates)
      }
    }
  }

  /**
   * Shift currency to the next lowest denomination
   */
  async convertCurrencyDownward (currency) {
    const currencyRank = CONFIG.DCC.currencyRank
    const currencyValue = CONFIG.DCC.currencyValue
    // Don't do currency conversions if the value isn't resolved
    if (this.needsValueRoll()) {
      return
    }
    // Find the rank of this currency
    const rank = currencyRank.indexOf(currency)
    // Make sure there's a currency to convert to
    if (rank >= 1) {
      // What are we converting to?
      const toCurrency = currencyRank[rank - 1]
      // Check we have enough currency
      if (this.data.data.value[currency] >= 1) {
        // Calculate the conversion factor
        const conversionFactor = currencyValue[currency] / currencyValue[toCurrency]
        // Apply the conversion
        const updates = {}
        updates[`data.value.${currency}`] = parseInt(this.data.data.value[currency]) - 1
        updates[`data.value.${toCurrency}`] = parseInt(this.data.data.value[toCurrency]) + conversionFactor
        this.update(updates)
      }
    }
  }
}

export default DCCItem
