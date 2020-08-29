/* global Item */

/**
 * Extend the base Item entity for DCC RPG
 * @extends {Item}
 */
class DCCItem extends Item {
  prepareData () {
    super.prepareData()

    // If this is a spell owned by an actor, check if it should inherit the actor's spell check
    if (this.actor && this.data.data.config && this.data.data.config.inheritSpellCheck) {
      this.data.data.spellCheck.value = this.actor.data.data.class.spellCheck
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
    let resultsTable = game.tables.entities.find(t => t.name === resultsRef.table)
    if (!resultsTable) {
      const pack = game.packs.get(resultsRef.collection)
      await pack.getIndex()
      const entry = pack.index.find(e => e.name === resultsRef.table)
      resultsTable = await pack.getEntity(entry._id)
    }
    const results = resultsTable.roll({roll})
    resultsTable.draw(results)
  }

  /**
   * Pre-load a table 
   * @param {Object} tableRef    Object containing a table reference or fixed result text
   * @return {Object}            { text: <static text>, table: <table object> }
   * @private
   */
  async _preloadTable (tableRef) {
    const result = {}
    if (tableRef.text) {
      result.text = tableRef.text
    }
    if (tableRef.table) {
      return 
    } else {
      return result
    }
  }
}

export default DCCItem
