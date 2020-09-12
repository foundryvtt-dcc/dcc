/* global Item, game, ChatMessage, Roll, CONFIG */

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
}

export default DCCItem
