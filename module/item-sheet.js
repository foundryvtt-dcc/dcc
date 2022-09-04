/* global Dialog, ItemSheet, TextEditor, game, mergeObject, CONFIG */

import DCCItemConfig from './item-config.js'
import EntityImages from './entity-images.js'

/**
 * Extend the basic ItemSheet for DCC RPG
 * @extends {ItemSheet}
 */
export class DCCItemSheet extends ItemSheet {
  /** @override */
  static get defaultOptions () {
    return mergeObject(super.defaultOptions, {
      classes: ['dcc', 'sheet', 'item'],
      tabs: [{ navSelector: '.sheet-tabs', contentSelector: '.sheet-body', initial: 'description' }],
      dragDrop: [{ dragSelector: null, dropSelector: null }]
    })
  }

  /** @override */
  get template () {
    switch (this.object.type) {
      case 'weapon':
        return 'systems/dcc/templates/item-sheet-weapon.html'
      case 'armor':
        return 'systems/dcc/templates/item-sheet-armor.html'
      case 'spell':
        return 'systems/dcc/templates/item-sheet-spell.html'
      case 'skill':
        return 'systems/dcc/templates/item-sheet-skill.html'
      case 'treasure':
        return 'systems/dcc/templates/item-sheet-treasure.html'
      case 'equipment':
      case 'ammunition':
      case 'mount':
      default:
        return 'systems/dcc/templates/item-sheet-equipment.html'
    }
  }

  /** @override */
  async getData (options) {
    const data = await super.getData(options)

    // Lookup the localizable string for the item's type
    data.typeString = CONFIG.DCC.items[data.type] || 'DCC.Unknown'

    if (data.item.type === 'spell') {
      // Allow mercurial magic roll only on wizard spells owned by an actor
      const castingMode = data.item.system.config.castingMode || 'wizard'
      const forceShowMercurialEffect = data.item.system.config.showMercurialEffect
      data.showMercurialRoll = !!this.actor && (castingMode === 'wizard' || forceShowMercurialEffect)

      // Format Mercurial Effect HTML
      data.mercurialEffectHTML = await TextEditor.enrichHTML(this.item.system.mercurialEffect.description, {
        async: true,
        relativeTo: this.item,
        secrets: this.item.isOwner
      })
    } else if (data.item.type === 'treasure') {
      // Allow rolling the item's value if it's unresolved and owned by an actor
      data.unresolved = data.item.needsValueRoll()
      data.allowResolve = data.unresolved && !!this.actor && !this.limited
      // Only allow currency conversion on items representing coins that have a resolved value
      data.allowConversions = data.item.system.isCoins && !data.unresolved && !this.limited
    }

    // Pass through the item data in the format we expect
    data.system = data.item.system

    if (!data.item.img || data.item.img === 'icons/svg/mystery-man.svg') {
      data.data.img = EntityImages.imageForItem(data.type)
    }

    // Format Description HTML
    data.descriptionHTML = await TextEditor.enrichHTML(this.item.system.description.value, {
      async: true,
      relativeTo: this.item,
      secrets: this.item.isOwner
    })

    return data
  }

  /** @override */
  setPosition (options = {}) {
    const position = super.setPosition(options)
    const sheetBody = this.element.find('.sheet-body')
    const bodyHeight = position.height - 160
    sheetBody.css('height', bodyHeight)
    return position
  }

  /** @override */
  activateListeners (html) {
    super.activateListeners(html)

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return

    // Make this droppable for RollTables if this is a spell
    if (this.item.type === 'spell') {
      this.form.ondragover = ev => this._onDragOver(ev)
      this.form.ondrop = ev => this._onDrop(ev)
    }

    // Owner only listeners
    if (this.item.isOwner) {
      // Roll mercurial effect for spells
      if (this.item.type === 'spell') {
        html.find('.mercurial-roll').click(this._onRollMercurialMagic.bind(this))
      }

      // Roll value and currency conversions for treasure
      if (this.item.type === 'treasure') {
        html.find('.roll-button').click(this._onRollValue.bind(this))
        html.find('.left-arrow-button').click(this._onConvertUpward.bind(this))
        html.find('.right-arrow-button').click(this._onConvertDownward.bind(this))
      }
    }
  }

  async _onDrop (event) {
    event.preventDefault()
    event.stopPropagation()

    let data
    try {
      data = JSON.parse(event.dataTransfer.getData('text/plain'))
    } catch (err) {
      return false
    }

    if (this.item.type === 'spell') {
      // Handle dropping a roll table to set the spells table
      if (data.type === 'RollTable') {
        // Expected format from the tables tab
        // {type: "RollTable", id: "y3X7GKu7qzDhUGto"}
        // Expected format from a compendium
        // {type: "RollTable", pack: "dcc-compendium.spell-tables", id: "NGsI5F12GngHsbA1"}
        const results = {
          table: data.id,
          collection: null
        }
        if (data.pack) {
          results.collection = data.pack
        }
        this.object.update({
          data: { results }
        })
      }
    }
  }

  _onDragOver (event) {
    event.preventDefault()
    return false
  }

  /** @inheritdoc */
  _getHeaderButtons () {
    const buttons = super._getHeaderButtons()

    // Header buttons shown only with Owner permissions
    if (this.options.editable) {
      if (this.object.type === 'spell' || this.object.type === 'weapon' || this.object.type === 'skill') {
        buttons.unshift(
          {
            label: game.i18n.localize('DCC.ConfigureItem'),
            class: 'configure-item',
            icon: 'fas fa-code',
            onclick: ev => this._onConfigureItem(ev)
          }
        )
      }
    }

    return buttons
  }

  /**
   * Display item specific configuration settings
   * @param {Event} event   The originating click event
   * @private
   */
  _onConfigureItem (event) {
    event.preventDefault()
    new DCCItemConfig(this.item, {
      top: this.position.top + 40,
      left: this.position.left + (this.position.width - 400) / 2
    }).render(true)
  }

  /**
   * Fill options for a roll based on event
   * @param {Event} event   The originating click event
   * @private
   */
  _fillRollOptions (event) {
    const rollModifierDefault = game.settings.get('dcc', 'showRollModifierByDefault')
    return {
      showModifierDialog: rollModifierDefault ^ event.ctrlKey
    }
  }

  /**
   * Roll a new Mercurial Magic effect, prompting to replace if necessary
   */
  _onRollMercurialMagic (event) {
    event.preventDefault()
    const options = this._fillRollOptions(event)
    // Prompt if there's an existing effect or we're using the roll modifier dialog
    if (!options.showModifierDialog && this.item.hasExistingMercurialMagic()) {
      new Dialog({
        title: game.i18n.localize('DCC.MercurialMagicRerollPrompt'),
        content: `<p>${game.i18n.localize('DCC.MercurialMagicRerollExplain')}</p>`,
        buttons: {
          reroll: {
            icon: '<i class="fas fa-check"></i>',
            label: game.i18n.localize('DCC.MercurialMagicButtonReroll'),
            callback: () => this._rollMercurialMagic(event, options)
          },
          lookup: {
            icon: '<i class="fas fa-check"></i>',
            label: game.i18n.localize('DCC.MercurialMagicButtonLookup'),
            callback: () => this._lookupMercurialMagic(event, options)
          },
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: game.i18n.localize('DCC.MercurialMagicButtonCancel')
          }
        }
      }).render(true)
    } else {
      this._rollMercurialMagic(event, options)
    }
  }

  /**
   * Roll a new Mercurial Magic effect
   * @param {Event}  event   The originating click event
   * @private
   */
  _rollMercurialMagic (event, options) {
    this.item.rollMercurialMagic(undefined, options)
    this.render(false)
  }

  /**
   * Look up a Mercurial Magic effect
   * @param {Event}  event   The originating click event
   * @private
   */
  _lookupMercurialMagic (event, options) {
    this.item.rollMercurialMagic(this.item.system.mercurialEffect.value)
    this.render(false)
  }

  /**
   * Roll the value of this item
   */
  _onRollValue (event) {
    event.preventDefault()
    this.item.rollValue()
    this.render(false)
  }

  /**
   * Convert currency upwards
   */
  _onConvertUpward (event) {
    event.preventDefault()
    this.item.convertCurrencyUpward(event.currentTarget.dataset.currency)
    this.render(false)
  }

  /**
   * Convert currency downwards
   */
  _onConvertDownward (event) {
    event.preventDefault()
    this.item.convertCurrencyDownward(event.currentTarget.dataset.currency)
    this.render(false)
  }
}

export default DCCItemSheet
