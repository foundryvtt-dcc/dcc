/* global ItemSheet, mergeObject, CONFIG */

import DCCItemConfig from './item-config.js'

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
    switch (this.object.data.type) {
      case 'spell':
        return 'systems/dcc/templates/item-sheet-spell.html'
      case 'treasure':
        return 'systems/dcc/templates/item-sheet-treasure.html'
      case 'weapon':
      case 'armor':
      case 'ammunition':
      case 'equipment':
      case 'mount':
      default:
        return 'systems/dcc/templates/item-sheet-equipment.html'
    }
  }

  /** @override */
  getData () {
    const data = super.getData()

    // Lookup the localizable string for the item's type
    data.item.data.typeString = CONFIG.DCC.items[data.item.type] || 'DCC.Unknown'

    return data
  }

  /** @override */
  setPosition (options = {}) {
    const position = super.setPosition(options)
    const sheetBody = this.element.find('.sheet-body')
    const bodyHeight = position.height - 192
    sheetBody.css('height', bodyHeight)
    return position
  }

  /** @override */
  activateListeners (html) {
    super.activateListeners(html)

    // Everything below here is only needed if the sheet is editable
    // if (!this.options.editable) return

    // Roll handlers, click handlers, etc. would go here.
  }

  /** @inheritdoc */
  _getHeaderButtons () {
    const buttons = super._getHeaderButtons()

    // Header buttons shown only with Owner permissions
    if (this.object.permission === ENTITY_PERMISSIONS.OWNER) {
      if (this.object.data.type === 'spell') {
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

}

export default DCCItemSheet
