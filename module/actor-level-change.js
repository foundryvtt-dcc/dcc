/* global ChatMessage, game, CONFIG, Roll, ui, foundry */

import DiceChain from './dice-chain.js'
import { ensurePlus } from './utilities.js'

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

class DCCActorLevelChange extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ['dcc', 'sheet', 'actor-level-change', 'themed'],
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

  constructor (options = {}) {
    super(options)
    this.currentLevel = this.options.document.system.details.level.value
    this.levelData = null
    this.newHitPointsExpression = ''
  }

  /* -------------------------------------------- */

  /**
   * Runs when the dialog is closed without submitting
   */
  async close (options = {}) {
    this.currentLevel = this.options.document.system.details.level.value || 0
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

    context.isNPC = (this.options.document.type === 'NPC')
    context.isPC = (this.options.document.type === 'Player')
    context.isZero = (this.options.document.system.details.level.value === 0)
    context.user = game.user
    context.config = CONFIG.DCC
    context.system = this.options.document.system
    context.actor = this.options.document

    // Add dynamic level data
    context.currentLevel = this.currentLevel
    context.originalLevel = this.options.document.system.details.level.value

    // Check that we have a class name
    this.classNameLower = this.options.document.system.class.className.toLowerCase()
    const genericClassNameLower = game.i18n.localize('DCC.Generic').toLowerCase()
    if (!this.classNameLower || this.classNameLower === 'generic' || this.classNameLower === genericClassNameLower) {
      ui.notifications.error(game.i18n.localize('DCC.ChooseAClass'))
      await this.close({ force: true })
      return context
    }

    // Add level data if available
    if (this.levelData) {
      context.levelDataEntries = Object.entries(this.levelData)
        .map(([key, value]) => ({
          label: game.i18n.localize(`DCC.${key}`),
          value
        }))
      context.levelDataHeader = game.i18n.localize('DCC.UpdatesAtLevel')
    } else if (this.currentLevel !== this.options.document.system.details.level.value) {
      context.levelDataNotFound = game.i18n.localize('DCC.LevelDataNotFound')
    }

    // Add hit points data
    if (this.newHitPointsExpression) {
      context.hitPointsExpression = this.newHitPointsExpression
      context.hitPointsHeader = game.i18n.localize('DCC.AdjustHitPoints')
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
      let levelData = levelItem.system.levelData || ''
      if (this.options.document.system.details.alignment === 'l' && levelItem.system.levelDataLawful) {
        levelData += '\n' + levelItem.system.levelDataLawful
      }
      if (this.options.document.system.details.alignment === 'n' && levelItem.system.levelDataNeutral) {
        levelData += '\n' + levelItem.system.levelDataNeutral
      }
      if (this.options.document.system.details.alignment === 'c' && levelItem.system.levelDataChaotic) {
        levelData += '\n' + levelItem.system.levelDataChaotic
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
    // If the current language is not English, translate the class name to English
    let searchClassName = className
    if (game.i18n.lang !== 'en') {
      searchClassName = this._translateClassNameToEnglish(className)
    }

    // Normalize class name by replacing spaces with hyphens
    const normalizedClassName = searchClassName.replace(/\s+/g, '-')
    const itemName = `${normalizedClassName}-${level}`

    // Iterate over all registered level data packs
    const levelDataPacks = CONFIG.DCC.levelDataPacks
    if (levelDataPacks) {
      for (const packName of levelDataPacks.packs) {
        const pack = game.packs.get(packName)
        if (pack) {
          await pack.getIndex() // Load the compendium index
          const entry = pack.index.find(item => item.name === itemName)
          if (entry) {
            const item = await pack.getDocument(entry._id)
            // console.log(item)
            return item
          }
        }
      }
    }
    return {}
  }

  /**
   * _translateClassNameToEnglish
   * Translates a localized class name back to English for compendium lookup
   * @param localizedClassName <string>
   * @return englishClassName <string>
   * @private
   */
  _translateClassNameToEnglish (localizedClassName) {
    // Map of English class names to their translation keys
    const classTranslationKeys = [
      'DCC.Cleric',
      'DCC.Thief',
      'DCC.Warrior',
      'DCC.Wizard',
      'DCC.Dwarf',
      'DCC.Elf',
      'DCC.Halfling'
    ]

    // Check each translation key to see if its localized value matches our input
    for (const key of classTranslationKeys) {
      const translatedValue = game.i18n.localize(key)
      if (translatedValue.toLowerCase() === localizedClassName.toLowerCase()) {
        // Extract the English class name from the key (everything after 'DCC.')
        return key.substring(4).toLowerCase()
      }
    }

    // If no translation match found, return the original className
    return localizedClassName.toLowerCase()
  }

  /**
   * Decrease level action handler
   * @this {DCCActorLevelChange}
   * @param {PointerEvent} event - The originating click event
   * @param {HTMLElement} target - The capturing HTML element which defined a [data-action]
   */
  static async #decreaseLevel (event, target) {
    event.preventDefault()
    this.currentLevel = parseInt(this.currentLevel) - 1
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
    this.currentLevel = parseInt(this.currentLevel) + 1
    return this._updateLevelUpDisplay()
  }

  async _updateLevelUpDisplay () {
    const levelItem = await this._lookupLevelItem(this.classNameLower, this.currentLevel)

    if (Object.hasOwn(levelItem, 'system')) {
      // Calculate level data
      this.levelData = await this._getLevelDataFromItem(levelItem)

      // Calculate hit points expression
      const hitDie = this.levelData['system.attributes.hitDice.value'] || '1d6'
      let hpExpression = `+(${hitDie}${ensurePlus(this.options.document.system?.abilities?.sta?.mod)})`
      let levelDifference = parseInt(this.currentLevel) - parseInt(this.options.document.system.details.level.value)

      if (levelDifference !== 1) {
        if (parseInt(this.options.document.system.details.level.value) === 0) {
          levelDifference -= 1
        }
        hpExpression = DiceChain.bumpDieCount(hitDie, levelDifference)

        const staModTotal = levelDifference * this.options.document.system?.abilities?.sta?.mod
        hpExpression = `+(${hpExpression}${ensurePlus(staModTotal)})`

        if (levelDifference < 0) {
          hpExpression = hpExpression.replace('+', '-')
        }
        if (levelDifference === 0) {
          hpExpression = ''
        }
      }
      this.newHitPointsExpression = hpExpression
    } else {
      this.levelData = null
      this.newHitPointsExpression = ''
    }

    // Re-render the application with updated data
    this.render({ force: false })
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
    await this.options.document.update(formData.object)

    // Try and get data for the new level from the compendium
    const newLevel = this.currentLevel
    const levelItem = await this._lookupLevelItem(this.classNameLower, newLevel)

    if (levelItem) {
      // Get Level Data for new level and update this actor
      const levelData = await this._getLevelDataFromItem(levelItem)
      levelData['system.details.level.value'] = newLevel

      // Adjust ActionDice
      const actionDice = levelData['system.attributes.actionDice.value']
      levelData['system.config.actionDice'] = actionDice
      if (actionDice && actionDice.includes(',')) {
        levelData['system.attributes.actionDice.value'] = actionDice.split(',')[0].trim()
      }

      // Roll new Hit Points
      if (this.newHitPointsExpression) {
        const hpRoll = new Roll(this.newHitPointsExpression)
        await hpRoll.toMessage({ flavor: game.i18n.localize('DCC.HitDiceRoll'), speaker: ChatMessage.getSpeaker({ actor: this.options.document }) })
        const newHp = this.options.document.system.attributes.hp.value + hpRoll.total
        const newMaxHp = parseInt(this.options.document.system.attributes.hp.max) + hpRoll.total
        levelData['system.attributes.hp.value'] = newHp
        levelData['system.attributes.hp.max'] = newMaxHp
      }

      // Create chat message with levelUp data
      delete levelData._id
      // delete levelData.system
      const levelDataString = Object.entries(levelData)
        .map(([key, value]) => `<div>${game.i18n.localize(`DCC.${key}`)} = ${value}</div>`)
        .join('\n')
      const messageData = {
        user: game.user.id,
        flavor: game.i18n.format('DCC.LevelChanged', { level: newLevel }),
        speaker: ChatMessage.getSpeaker({ actor: this.options.document }),
        flags: {
          'dcc.isLevelChange': true
        },
        content: levelDataString
      }
      ChatMessage.create(messageData)

      await this.options.document.update(levelData)
    }

    // Re-draw the updated sheet
    await this.options.document.sheet.render(true)
  }
}

export default DCCActorLevelChange
