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
    data.currentLevel = this.object.system.details.level.value
    return data
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners (html) {
    super.activateListeners(html)

    html.find('.level-increase').click(this._increaseLevel.bind(this))
    html.find('.level-decrease').click(this._decreaseLevel.bind(this))
  }

  /**
   * _getLevelDataFromItem
   * Gets the level data from the item and turns it into key/value pairs
   * Also gets the alignment data and adds that in
   * @param levelItem <object>
   * @return levelData <object>
   */
  async _getLevelDataFromItem (levelItem) {
    if (levelItem) {
      let levelData = levelItem.system.levelData
      if (this.object.system.details.alignment === 'l') {
        levelData += levelItem.system.levelDataLawful
      }
      if (this.object.system.details.alignment === 'n') {
        levelData += levelItem.system.levelDataNeutral
      }
      if (this.object.system.details.alignment === 'c') {
        levelData += levelItem.system.levelDataChaotic
      }
      // console.log(levelData)
      return levelData
        .trim() // Remove leading/trailing whitespace
        .split('\n') // Split into lines
        .reduce((acc, line) => {
          let [key, value] = line.split('=')
          key = game.i18n.localize(`DCC.${key}`)
          acc[key] = isNaN(value) ? value : Number(value) // Convert numeric values
          return acc
        }, {})
    }
  }

  /**
   * _lookupLevelItem
   * Finds the level data in the compendium based on class and level
   * @param className <string>
   * @param level <string>
   * @return levelItem <object>
   * @private
   */
  async _lookupLevelItem (className, level) {
    // Lookup the level item
    const pack = game.packs.get(CONFIG.DCC.levelData)
    if (pack) {
      await pack.getIndex() // Load the compendium index
      const entry = pack.index.find(item => item.name === `${className}-${level}`)
      if (entry) {
        const item = await pack.getDocument(entry._id)
        // console.log(item)
        return item
      }
    }
  }

  /**
   * _decreaseLevel
   * Fetches the level data for the next lower level from current
   * @private
   */
  async _decreaseLevel () {
    this.object.currentLevel = this.object.currentLevel - 1
    const levelItem = await this._lookupLevelItem(this.object.system.class.className.toLowerCase(), this.object.currentLevel)
    if (levelItem) {
      const levelData = await this._getLevelDataFromItem(levelItem)
      const levelDataString = Object.entries(levelData)
        .map(([key, value]) => `<div>${key} = ${value}</div>`)
        .join('\n')
      this.element.find('#system\\.details\\.level\\.value').html(this.object.currentLevel)
      const levelDataHeader = game.i18n.localize('DCC.UpdatesAtLevel')
      this.element.find('#levelDataDisplay').html(`<h3>${levelDataHeader}</h3> ${levelDataString}`)
    }
    // console.log(levelItem)
  }

  /**
   * _increaseLevel
   * Fetches the level data for the next upper level from current
   * @private
   */
  async _increaseLevel () {
    this.object.currentLevel = this.object.currentLevel + 1
    const levelItem = await this._lookupLevelItem(this.object.system.class.className.toLowerCase(), this.object.currentLevel)
    if (levelItem) {
      const levelData = await this._getLevelDataFromItem(levelItem)
      const levelDataString = Object.entries(levelData)
        .map(([key, value]) => `<div>${key} = ${value}</div>`)
        .join('\n')
      this.element.find('#system\\.details\\.level\\.value').html(this.object.currentLevel)
      const levelDataHeader = game.i18n.localize('DCC.UpdatesAtLevel')
      this.element.find('#levelDataDisplay').html(`<h3>${levelDataHeader}</h3> ${levelDataString}`)
    }
    // console.log(levelItem)
  }

  /**
   * This method is called upon form submission after form data is validated
   * @param event {Event}       The initial triggering submission event
   * @param formData {Object}   The object of validated form data with which to update the object
   * @private
   */
  async _updateObject (event, formData) {
    event.preventDefault()
    // Update the actor's level
    await this.object.update(formData)

    const newLevel = this.object.system.details.level.value
    const levelItem = await this._lookupLevelItem(this.object.system.class.className.toLowerCase(), newLevel)

    if (levelItem) {
      const updateData = await this._getLevelDataFromItem(levelItem)
      // console.log(updateData)
      await this.object.update(updateData)
    }

    // Re-draw the updated sheet
    await this.object.sheet.render(true)
  }
}

export default DCCActorLevelChange
