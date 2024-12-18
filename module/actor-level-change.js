/* global FormApplication, game, CONFIG, ui */

import DiceChain from './dice-chain.js'
import { ensurePlus } from './utilities.js'

class DCCActorLevelChange extends FormApplication {
  static get defaultOptions () {
    const options = super.defaultOptions
    options.template =
      'systems/dcc/templates/dialog-actor-level-change.html'
    options.width = 380
    options.height = 580
    options.resizable = true
    return options
  }

  /* -------------------------------------------- */

  /**
   * Runs when the dialog is closed without submitting
   */
  async close (options = {}) {
    this.object.currentLevel = this.object.system.details.level.value || 0
    await super.close(options)
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
    data.currentLevel = this.object.system.details.level.value || 0
    data.classNameLower = this.object.system.class.className.toLowerCase()
    if (!data.classNameLower || data.classNameLower === 'generic') {
      ui.notifications.error(game.i18n.localize('DCC.ChooseAClass'))
      return this.close({ force: true })
    }
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
    this.object.currentLevel = parseInt(this.object.currentLevel) - 1
    return this._updateLevelUpDisplay()
  }

  /**
   * _increaseLevel
   * Fetches the level data for the next upper level from current
   * @private
   */
  async _increaseLevel () {
    this.object.currentLevel = parseInt(this.object.currentLevel) + 1
    return this._updateLevelUpDisplay()
  }

  async _updateLevelUpDisplay () {
    const levelItem = await this._lookupLevelItem(this.object.classNameLower, this.object.currentLevel)
    if (levelItem) {
      // Level Data
      const levelData = await this._getLevelDataFromItem(levelItem)
      const levelDataString = Object.entries(levelData)
        .map(([key, value]) => `<div>${game.i18n.localize(`DCC.${key}`)} = ${value}</div>`)
        .join('\n')
      this.element.find('#system\\.details\\.level\\.value').html(this.object.currentLevel)
      const levelDataHeader = game.i18n.localize('DCC.UpdatesAtLevel')
      this.element.find('#levelDataDisplay').html(`<h3>${levelDataHeader}</h3> ${levelDataString}`)

      // Hit Points
      let hpExpression = `+(${this.object.system.attributes.hitDice.value}${ensurePlus(this.object.system?.abilities?.sta?.mod)})`
      const levelDifference = parseInt(this.object.currentLevel) - parseInt(this.object.system.details.level.value)
      if (levelDifference !== 1) {
        hpExpression = DiceChain.bumpDieCount(this.object.system.attributes.hitDice.value, levelDifference)

        const staModTotal = levelDifference * this.object.system?.abilities?.sta?.mod
        hpExpression = `+(${hpExpression}${ensurePlus(staModTotal)})`

        if (levelDifference < 0) {
          hpExpression = hpExpression.replace('+', '-')
        }
        if (levelDifference === 0) {
          hpExpression = ''
        }
      }
      this.object.newHitPointsExpression = hpExpression
      const hitPointsString = `Hit Points = ${hpExpression}`
      this.element.find('#hitPoints').html(`<h3>Adjust Hit Points</h3> ${hitPointsString}`)
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

    // Do any basic updates from this dialog
    await this.object.update(formData)

    // Try and get data for the new level from the compendium
    const newLevel = this.object.currentLevel
    const levelItem = await this._lookupLevelItem(this.object.classNameLower, newLevel)

    if (levelItem) {
      // Get Level Data for new level and update this actor
      const levelData = await this._getLevelDataFromItem(levelItem)
      levelData['system.details.level.value'] = newLevel

      // Roll new Hit Points
      if (this.object.newHitPointsExpression) {
        const hpRoll = new Roll(this.object.newHitPointsExpression)
        await hpRoll.toMessage({ flavor: game.i18n.localize('DCC.HitDiceRoll'), speaker: ChatMessage.getSpeaker({ actor: this.object }) })
        const newHp = this.object.system.attributes.hp.value + hpRoll.total
        const newMaxHp = parseInt(this.object.system.attributes.hp.max) + hpRoll.total
        levelData['system.attributes.hp.value'] = newHp
        levelData['system.attributes.hp.max'] = newMaxHp
      }

      await this.object.update(levelData)

      // Create chat message with levelUp data
      delete levelData._id
      // delete levelData.system
      const levelDataString = Object.entries(levelData)
        .map(([key, value]) => `<div>${game.i18n.localize(`DCC.${key}`)} = ${value}</div>`)
        .join('\n')
      const messageData = {
        user: game.user.id,
        flavor: game.i18n.format('DCC.LevelChanged', { level: newLevel }),
        speaker: ChatMessage.getSpeaker({ actor: this.object }),
        flags: {
          'dcc.isLevelChange': true,
        },
        content: levelDataString
      }
      ChatMessage.create(messageData)
    }

    // Re-draw the updated sheet
    await this.object.sheet.render(true)
  }
}

export default DCCActorLevelChange
