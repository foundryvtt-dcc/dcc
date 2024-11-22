/* global FormApplication, game, CONFIG */

class DCCActorLevelChange extends FormApplication {
  static get defaultOptions () {
    const options = super.defaultOptions
    options.template =
      'systems/dcc/templates/dialog-actor-level-change.html'
    options.width = 380
    options.height = '580'
    options.resizable = true
    return options
  }

  /* -------------------------------------------- */

  /**
   * Add the Entity name into the window title
   * @type {String}
   */
  get title () {
    return `${this.object.name}: ${game.i18n.localize('DCC.ChangeLevel')}`
  }

  /* -------------------------------------------- */

  /**
   * Construct and return the data object used to render the HTML template for this form application.
   * @return {Object}
   */
  getData (options = {}) {
    const data = this.object
    data.isNPC = (this.object.type === 'NPC')
    data.isPC = (this.object.type === 'Player')
    data.isZero = (this.object.system.details.level.value === 0)
    data.user = game.user
    data.config = CONFIG.DCC
    return data
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners (html) {
    super.activateListeners(html)

    html.find('.level-increase').click(this._increaseLevel.bind(this))
    html.find('.level-decrease').click(this._decreaseLevel.bind(this))
  }

  async _decreaseLevel () {
    const currentLevel = this.object.system.details.level.value
    await this.object.update({ 'system.details.level.value': currentLevel - 1 })
    const levelItem = await this._lookupLevelItem(this.object.system.class.className.toLowerCase(), currentLevel - 1)
    if (levelItem) {
      this.element.find('#levelValue').html(this.object.system.details.level.value)
      this.element.find('#levelDataDisplay').html(levelItem.system.levelData)
    }
    console.log(levelItem)
  }

  async _increaseLevel () {
    const currentLevel = this.object.system.details.level.value
    await this.object.update({ 'system.details.level.value': currentLevel + 1 })
    const levelItem = await this._lookupLevelItem(this.object.system.class.className.toLowerCase(), currentLevel + 1)
    if (levelItem) {
      this.element.find('#system\\.details\\.level\\.value').html(this.object.system.details.level.value)
      this.element.find('#levelDataDisplay').html(`<h3>Updates at your new level:</h3> ${levelItem.system.levelData}`)
    }
    console.log(levelItem)
  }

  async _lookupLevelItem (className, level) {
    // Lookup the level item
    let levelItem = null
    const pack = game.packs.get(CONFIG.DCC.levelData)
    if (pack) {
      await pack.getIndex() // Load the compendium index
      const entry = pack.index.find(item => item.name === `${className}-${level}`)
      if (entry) {
        const item = await pack.getDocument(entry._id)
        console.log(item)
        return item
      }
    }
  }

  /**
   * This method is called upon form submission after form data is validated
   * @param event {Event}       The initial triggering submission event
   * @param formData {Object}   The object of validated form data with which to update the object
   * @private
   */
  async _updateObject (event, formData) {
    event.preventDefault()
    // Update the actor
    await this.object.update(formData)
    // Re-draw the updated sheet
    await this.object.sheet.render(true)
  }
}

export default DCCActorLevelChange
