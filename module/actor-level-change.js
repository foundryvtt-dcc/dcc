/* global ChatMessage, game, CONFIG, Roll, ui, foundry */

import DiceChain from './dice-chain.js'
import { ensurePlus } from './utilities.js'

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

class DCCActorLevelChange extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ['dcc', 'sheet', 'actor-level-change', 'themed', 'theme-light'],
    tag: 'form',
    position: {
      width: 380,
      height: 580
    },
    window: {
      title: 'DCC.ChangeLevel',
      resizable: true
    },
    form: {
      handler: DCCActorLevelChange.#onSubmitForm,
      submitOnChange: false,
      closeOnSubmit: true
    },
    actions: {
      increaseLevel: this.#increaseLevel,
      decreaseLevel: this.#decreaseLevel
    }
  }

  /** @inheritDoc */
  static PARTS = {
    form: {
      template: 'systems/dcc/templates/dialog-actor-level-change.html'
    }
  }

  /* -------------------------------------------- */

  /**
   * Get the document being configured
   * @type {Actor}
   */
  get document () {
    return this.options.document
  }

  /**
   * Get the window title including the actor name
   * @type {String}
   */
  get title () {
    return `${this.document.name}: ${game.i18n.localize('DCC.ChangeLevel')}`
  }

  /**
   * Runs when the dialog is closed without submitting
   */
  async close (options = {}) {
    this.document.currentLevel = this.document.system.details.level.value || 0
    await super.close(options)
  }

  /* -------------------------------------------- */

  /**
   * Prepare context data for rendering the HTML template
   * @param {Object} options - Rendering options
   * @return {Object} The context data
   */
  async _prepareContext (options = {}) {
    const context = await super._prepareContext(options)
    const actor = this.document

    context.isNPC = (actor.type === 'NPC')
    context.isPC = (actor.type === 'Player')
    context.isZero = (actor.system.details.level.value === 0)
    context.user = game.user
    context.config = CONFIG.DCC
    context.currentLevel = actor.system.details.level.value || 0
    context.classNameLower = actor.system.class.className.toLowerCase()
    context.system = actor.system
    context.actor = actor

    if (!context.classNameLower || context.classNameLower === 'generic') {
      ui.notifications.error(game.i18n.localize('DCC.ChooseAClass'))
      this.close({ force: true })
      return context
    }

    return context
  }

  /**
   * _getLevelDataFromItem
   * Gets the level data from the item and turns it into key/value pairs
   * Also gets the alignment data and adds that in
   * @param levelItem <object>
   * @return levelData <object>
   */
  async _getLevelDataFromItem (levelItem) {
    if (Object.hasOwn(levelItem, 'system')) {
      let levelData = levelItem.system.levelData
      if (this.document.system.details.alignment === 'l') {
        levelData += levelItem.system.levelDataLawful
      }
      if (this.document.system.details.alignment === 'n') {
        levelData += levelItem.system.levelDataNeutral
      }
      if (this.document.system.details.alignment === 'c') {
        levelData += levelItem.system.levelDataChaotic
      }
      // console.log(levelData)
      return levelData
        .trim() // Remove leading/trailing whitespace
        .split('\n') // Split into lines
        .reduce((acc, line) => {
          const [key, value] = line.split('=')
          acc[key] = isNaN(value) ? value : Number(value) // Convert numeric values
          return acc
        }, {})
    }
    return {}
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
      const entry = pack.index.find(item => item.name === `${className}-${level}`)
      if (entry) {
        const item = await pack.getDocument(entry._id)
        // console.log(item)
        return item
      }
    }
    return {}
  }

  /**
   * Decrease level action handler
   * @this {DCCActorLevelChange}
   * @param {PointerEvent} event - The originating click event
   * @param {HTMLElement} target - The capturing HTML element which defined a [data-action]
   */
  static async #decreaseLevel (event, target) {
    event.preventDefault()
    this.document.currentLevel = parseInt(this.document.currentLevel) - 1
    return this._updateLevelUpDisplay()
  }

  /**
   * Increase level action handler
   * @this {DCCActorLevelChange}
   * @param {PointerEvent} event - The originating click event
   * @param {HTMLElement} target - The capturing HTML element which defined a [data-action]
   */
  static async #increaseLevel (event, target) {
    event.preventDefault()
    this.document.currentLevel = parseInt(this.document.currentLevel) + 1
    return this._updateLevelUpDisplay()
  }

  async _updateLevelUpDisplay () {
    const levelItem = await this._lookupLevelItem(this.document.classNameLower, this.document.currentLevel)
    if (Object.hasOwn(levelItem, 'system')) {
      // Level Data
      const levelData = await this._getLevelDataFromItem(levelItem)
      const levelDataString = Object.entries(levelData)
        .map(([key, value]) => `<div>${game.i18n.localize(`DCC.${key}`)} = ${value}</div>`)
        .join('\n')

      // Update level display using vanilla DOM
      const levelElement = this.element.querySelector('#system\\.details\\.level\\.value')
      if (levelElement) {
        levelElement.innerHTML = this.document.currentLevel
      }

      const levelDataHeader = game.i18n.localize('DCC.UpdatesAtLevel')
      const levelDataDisplay = this.element.querySelector('#levelDataDisplay')
      if (levelDataDisplay) {
        levelDataDisplay.innerHTML = `<h3>${levelDataHeader}</h3> ${levelDataString}`
      }

      // Hit Points
      const hitDie = levelData['system.attributes.hitDice.value'] || '1d6'
      let hpExpression = `+(${hitDie}${ensurePlus(this.document.system?.abilities?.sta?.mod)})`
      let levelDifference = parseInt(this.document.currentLevel) - parseInt(this.document.system.details.level.value)
      if (levelDifference !== 1) {
        if (parseInt(this.document.system.details.level.value) === 0) {
          levelDifference -= 1
        }
        hpExpression = DiceChain.bumpDieCount(hitDie, levelDifference)

        const staModTotal = levelDifference * this.document.system?.abilities?.sta?.mod
        hpExpression = `+(${hpExpression}${ensurePlus(staModTotal)})`

        if (levelDifference < 0) {
          hpExpression = hpExpression.replace('+', '-')
        }
        if (levelDifference === 0) {
          hpExpression = ''
        }
      }
      this.document.newHitPointsExpression = hpExpression
      const hitPointsString = `Hit Points = ${hpExpression}`
      const hitPointsElement = this.element.querySelector('#hitPoints')
      if (hitPointsElement) {
        hitPointsElement.innerHTML = `<h3>Adjust Hit Points</h3> ${hitPointsString}`
      }
    } else {
      const levelDataDisplay = this.element.querySelector('#levelDataDisplay')
      if (levelDataDisplay) {
        levelDataDisplay.innerHTML = game.i18n.localize('DCC.LevelDataNotFound')
      }
    }
  }

  /**
   * Handle form submission
   * @this {DCCActorLevelChange}
   * @param {SubmitEvent} event - The form submission event
   * @param {HTMLFormElement} form - The form element
   * @param {FormDataExtended} formData - The processed form data
   * @private
   */
  static async #onSubmitForm (event, form, formData) {
    event.preventDefault()

    // Do any basic updates from this dialog
    await this.document.update(formData.object)

    // Try and get data for the new level from the compendium
    const newLevel = this.document.currentLevel
    const levelItem = await this._lookupLevelItem(this.document.classNameLower, newLevel)

    if (levelItem) {
      // Get Level Data for new level and update this actor
      const levelData = await this._getLevelDataFromItem(levelItem)
      levelData['system.details.level.value'] = newLevel

      // Adjust ActionDice
      const actionDice = levelData['system.attributes.actionDice.value']
      levelData['system.config.actionDice'] = actionDice
      if (actionDice.includes(',')) {
        levelData['system.attributes.actionDice.value'] = actionDice.split(',')[0].trim()
      }

      // Roll new Hit Points
      if (this.document.newHitPointsExpression) {
        const hpRoll = new Roll(this.document.newHitPointsExpression)
        await hpRoll.toMessage({ flavor: game.i18n.localize('DCC.HitDiceRoll'), speaker: ChatMessage.getSpeaker({ actor: this.document }) })
        const newHp = this.document.system.attributes.hp.value + hpRoll.total
        const newMaxHp = parseInt(this.document.system.attributes.hp.max) + hpRoll.total
        levelData['system.attributes.hp.value'] = newHp
        levelData['system.attributes.hp.max'] = newMaxHp
      }

      await this.document.update(levelData)

      // Create chat message with levelUp data
      delete levelData._id
      // delete levelData.system
      const levelDataString = Object.entries(levelData)
        .map(([key, value]) => `<div>${game.i18n.localize(`DCC.${key}`)} = ${value}</div>`)
        .join('\n')
      const messageData = {
        user: game.user.id,
        flavor: game.i18n.format('DCC.LevelChanged', { level: newLevel }),
        speaker: ChatMessage.getSpeaker({ actor: this.document }),
        flags: {
          'dcc.isLevelChange': true
        },
        content: levelDataString
      }
      ChatMessage.create(messageData)
    }

    // Re-draw the updated sheet
    await this.document.sheet.render(true)
  }
}

export default DCCActorLevelChange
