/* global game, ui, Roll, CONFIG, CONST */

/**
 * Currency / treasure-value mixin for {@link DCCItem}.
 *
 * Phase 7 (Appendix-A item.js shrinkage): the self-contained treasure-value
 * block — rolling a treasure item's value from its formulae and shifting
 * currency between denominations — was lifted out of `module/item.js` into this
 * mixin. `DCCItem` composes it as `extends CurrencyItemMixin(ContainerItemMixin(
 * Item))`, so every member below remains an instance method on `DCCItem` with
 * byte-identical behavior and `this` semantics — the consumers
 * (`item-sheet.js` action handlers + `actor-sheet.js`'s value-resolved check)
 * call these straight off a live item and need no change.
 *
 * The block reads only `this` (`this.system.value` / `this.name` / `this.actor`
 * / `this.update`) and the currency config off `CONFIG.DCC`
 * (`currencies` / `currencyRank` / `currencyValue`). It posts a treasure-value
 * chat card (`rollValue`) but has no spell/roll-adapter/lib entanglement and no
 * dispatch logging. `convertCurrency{Upward,Downward}` self-guard on
 * `needsValueRoll()` so an unresolved (still-rollable) value is never converted.
 *
 * @param {typeof Item} Base - the document class to extend (production: a
 *   `ContainerItemMixin(Item)`; unit tests: a stub).
 * @returns {typeof Item} a subclass of `Base` carrying the currency surface.
 */
export const CurrencyItemMixin = (Base) => class extends Base {
  /* -------------------------------------------- */
  /*  Treasure value / currency                    */
  /* -------------------------------------------- */

  /**
   * Determine if this item needs to have its treasure value rolled
   * @return {Boolean}  True if any value field contains a rollable formula
   */
  needsValueRoll () {
    for (const currency in CONFIG.DCC.currencies) {
      const formula = this.system.value[currency]
      if (!formula) continue
      try {
        const roll = new Roll(formula.toString())
        if (!roll.isDeterministic) {
          return true
        }
      } catch (e) {
        ui.notifications.warn(game.i18n.localize('DCC.BadValueFormulaWarning'))
      }
    }

    return false
  }

  /**
   * Roll to determine the value of this item
   */
  async rollValue () {
    const updates = {}
    const valueRolls = {}

    for (const currency in CONFIG.DCC.currencies) {
      const formula = this.system.value[currency] || '0'
      try {
        const roll = new Roll(formula.toString())
        await roll.evaluate()
        updates['system.value.' + currency] = roll.total
        valueRolls[currency] = `<a class="inline-roll inline-result" data-roll="${encodeURIComponent(JSON.stringify(roll))}" title="${game.dcc.DCCRoll.cleanFormula(roll.terms)}"><i class="fas fa-dice-d20"></i> ${roll.total}</a>`
      } catch (e) {
        ui.notifications.warn(game.i18n.localize('DCC.BadValueFormulaWarning'))
      }
    }

    const speaker = { alias: this.actor.name, id: this.actor.id }
    const messageData = {
      user: game.user.id,
      speaker,
      style: CONST.CHAT_MESSAGE_STYLES.EMOTE,
      content: game.i18n.format('DCC.ResolveValueEmote', {
        itemName: this.name,
        pp: valueRolls.pp,
        ep: valueRolls.ep,
        gp: valueRolls.gp,
        sp: valueRolls.sp,
        cp: valueRolls.cp
      }),
      sound: CONFIG.sounds.dice,
      flags: {
        'dcc.RollType': 'LootValue'
      }
    }
    await CONFIG.ChatMessage.documentClass.create(messageData)

    await this.update(updates)
  }

  /**
   * Shift currency to the next highest denomination
   */
  async convertCurrencyUpward (currency) {
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
      if (this.system.value[currency] >= conversionFactor) {
        // Apply the conversion
        const updates = {}
        updates[`system.value.${currency}`] = parseInt(this.system.value[currency]) - conversionFactor
        updates[`system.value.${toCurrency}`] = parseInt(this.system.value[toCurrency]) + 1
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
      if (this.system.value[currency] >= 1) {
        // Calculate the conversion factor
        const conversionFactor = currencyValue[currency] / currencyValue[toCurrency]
        // Apply the conversion
        const updates = {}
        updates[`system.value.${currency}`] = parseInt(this.system.value[currency]) - 1
        updates[`system.value.${toCurrency}`] = parseInt(this.system.value[toCurrency]) + conversionFactor
        this.update(updates)
      }
    }
  }
}

export default CurrencyItemMixin
