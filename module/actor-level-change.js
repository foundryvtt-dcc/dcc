/* global ChatMessage, game, CONFIG, Roll, ui, foundry */

import { ensurePlus, removeActiveEffectOverrides } from './utilities.js'
import { rollHPForLevel } from './vendor/dcc-core-lib/index.js'

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

/**
 * Hit point roll for a level change (#983)
 *
 * Every level gained or lost is one hit die roll plus the Stamina modifier,
 * with a minimum of 1 per level - the lib's `rollHPForLevel` rule. Going from
 * level 0 to 1 is a gained level like any other. A level drop rolls the same
 * dice and subtracts them.
 *
 * The formula spells each level out (`max(1, 1d6-1) + max(1, 1d6-1)`) so the
 * chat card shows every die and a total that matches the rule; the `max` is
 * dropped when the modifier can't take a roll below 1.
 * @param {string} hitDie       The level's hit die, e.g. `1d6`
 * @param {number} staMod       Stamina modifier
 * @param {number} oldLevel     Level before the change
 * @param {number} newLevel     Level after the change
 * @returns {Object|null}       {formula, sign, levels, faces, staMod}, or null for no change
 */
export function levelChangeHitPoints (hitDie, staMod, oldLevel, newLevel) {
  const levels = (parseInt(newLevel) || 0) - (parseInt(oldLevel) || 0)
  if (!levels) return null
  const sign = Math.sign(levels)
  const count = Math.abs(levels)
  const mod = parseInt(staMod) || 0
  const faces = parseInt(/d(\d+)/i.exec(hitDie || '')?.[1]) || 6
  const perLevel = mod < 0 ? `max(1, 1d${faces}${ensurePlus(mod)})` : `1d${faces}${mod ? ensurePlus(mod) : ''}`
  const sum = Array(count).fill(perLevel).join(' + ')
  const formula = sign < 0 ? `-(${sum})` : sum
  return { formula, sign, levels: count, faces, staMod: mod }
}

/**
 * Hit points actually gained (or lost) for an evaluated level-change roll
 *
 * Runs each rolled hit die through the lib's `rollHPForLevel` so the rule
 * (Stamina modifier per level, minimum 1 per level) lives in the lib; the
 * Foundry roll only supplies the dice.
 * @param {Object} hpChange     The result of `levelChangeHitPoints`
 * @param {Roll} roll           The evaluated roll of `hpChange.formula`
 * @returns {number}            Signed hit point change
 */
export function levelChangeHitPointTotal (hpChange, roll) {
  const results = roll.dice.flatMap(die => die.results.filter(r => r.active !== false).map(r => r.result))
  const gained = results.reduce((total, rolled) => {
    const random = { roll: () => rolled, rollMultiple: (count) => Array(count).fill(rolled) }
    return total + rollHPForLevel(`d${hpChange.faces}`, hpChange.staMod, random).gained
  }, 0)
  return hpChange.sign * gained
}

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
    this.hitPointChange = null
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

    // Fall back to an unregistered world-level item named by convention,
    // mirroring the world-table fallback used for crit/fumble tables in
    // utilities.js. Registered packs win (checked above) so installing an
    // official level-data pack module never changes existing behavior;
    // this lets homebrew classes work by simply dropping `level` items
    // named `{class}-{level}` into the world without registering a pack.
    const worldLevelItem = game.items?.find(item => item.type === 'level' && item.name === itemName)
    if (worldLevelItem) {
      return worldLevelItem
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

      // Hit points: one hit die + Stamina modifier per level changed (#983)
      const hitDie = this.levelData['system.attributes.hitDice.value'] || '1d6'
      this.hitPointChange = levelChangeHitPoints(
        hitDie,
        this.options.document.system?.abilities?.sta?.mod,
        this.options.document.system.details.level.value,
        this.currentLevel
      )
      this.newHitPointsExpression = this.hitPointChange?.formula || ''
    } else {
      this.levelData = null
      this.newHitPointsExpression = ''
      this.hitPointChange = null
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
    const updateData = removeActiveEffectOverrides(this.options.document, formData.object)
    await this.options.document.update(updateData)

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
      if (this.hitPointChange) {
        const hpRoll = new Roll(this.hitPointChange.formula)
        await hpRoll.evaluate()
        const hpTotal = levelChangeHitPointTotal(this.hitPointChange, hpRoll)
        if (hpTotal !== hpRoll.total) {
          console.warn('[DCC] level-change hit points: roll total and lib rule disagree - using the lib', { formula: this.hitPointChange.formula, roll: hpRoll.total, lib: hpTotal })
        }
        await hpRoll.toMessage({ flavor: game.i18n.localize('DCC.HitDiceRoll'), speaker: ChatMessage.getSpeaker({ actor: this.options.document }) })
        const newHp = (parseInt(this.options.document.system.attributes.hp.value) || 0) + hpTotal
        const newMaxHp = (parseInt(this.options.document.system.attributes.hp.max) || 0) + hpTotal
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
