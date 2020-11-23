/* global Item, game, ui, ChatMessage, Roll, CONFIG, CONST */

/**
 * Extend the base Item entity for DCC RPG
 * @extends {Item}
 */
class DCCItem extends Item {
  prepareData () {
    super.prepareData()

    // If this is a weapon owned by an actor, check for config settings to apply
    if (this.actor && this.data.data.config) {
      // Weapons can inherit the owner's action die
      if (this.data.data.config.inheritActionDie) {
        this.data.data.actionDie = this.actor.data.data.attributes.actionDice.value
      }

      // Spells can inherit the owner's spell check
      if (this.data.data.config.inheritSpellCheck) {
        this.data.data.spellCheck.value = this.actor.data.data.class.spellCheck
      }
    }
  }

  /**
   * Roll a Spell Check using this item
   * @param {String} abilityId    The ability used for this spell
   */
  async rollSpellCheck (abilityId = 'int', options = {}) {
    if (this.data.type !== 'spell') { return }

    const actor = this.options.actor
    const ability = actor.data.data.abilities[abilityId]
    ability.label = CONFIG.DCC.abilities[abilityId]
    const spell = this.name

    // Roll the spell check
    const roll = new Roll('@die+@bonus', {
      die: this.data.data.spellCheck.die,
      bonus: this.data.data.spellCheck.value
    })
    roll.roll()

    if (roll.dice.length > 0) {
      roll.dice[0].options.dcc = {
        lowerThreshold: actor.data.data.class.disapproval
      }
    }

    // Lookup the appropriate table
    const resultsRef = this.data.data.results
    const predicate = t => t.name === resultsRef.table || t._id === resultsRef.table
    let resultsTable = game.tables.entities.find(predicate)
    if (!resultsTable) {
      const pack = game.packs.get(resultsRef.collection)
      if (pack) {
        await pack.getIndex()
        const entry = pack.index.find(predicate)
        resultsTable = await pack.getEntity(entry._id)
      }
    }

    // Draw from the table if found, otherwise display the roll
    if (resultsTable) {
      const results = resultsTable.roll({ roll })
      resultsTable.draw(results)
    } else {
      // Fall back to displaying just the roll
      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor }),
        flavor: `${spell} (${game.i18n.localize(ability.label)})`
      })
    }
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
        roll.roll()
        const terms = roll.terms || roll.parts
        if (terms.length > 1 || roll.dice.length > 0) {
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
      const formula = this.data.data.value[currency]
      if (!formula) continue
      try {
        const roll = new Roll(formula.toString())
        roll.roll()
        updates['data.value.' + currency] = roll.total
        valueRolls[currency] = `<a class="inline-roll inline-result" data-roll="${escape(JSON.stringify(roll))}" title="${Roll.cleanFormula(roll.terms || roll.formula)}"><i class="fas fa-dice-d20"></i> ${roll.total}</a>`
      } catch (e) {
        ui.notifications.warn(game.i18n.localize('DCC.BadValueFormulaWarning'))
      }
    }

    const speaker = { alias: this.actor.name, _id: this.actor._id }
    const messageData = {
      user: game.user._id,
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
    await CONFIG.ChatMessage.entityClass.create(messageData)

    this.update(updates)
  }

  /**
   * Shift currency to the next highest denomination
   */
  convertCurrencyUpward (currency) {
    const currencyRank = CONFIG.DCC.currencyRank
    const currencyValue = CONFIG.DCC.currencyValue
    // Don't do currency conversions if the value isn't resolved
    if (this.needsValueRoll()) {
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
  convertCurrencyDownward (currency) {
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
