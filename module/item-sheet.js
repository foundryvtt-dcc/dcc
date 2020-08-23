/* global ItemSheet, mergeObject, CONFIG */

/**
 * Extend the basic ItemSheet for DCC RPG
 * @extends {ItemSheet}
 */
export class DCCItemSheet extends ItemSheet {
  /** @override */
  static get defaultOptions () {
    return mergeObject(super.defaultOptions, {
      classes: ['dcc', 'sheet', 'item'],
      width: 520,
      height: 480,
      tabs: [{ navSelector: '.sheet-tabs', contentSelector: '.sheet-body', initial: 'description' }]
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
}

export default DCCItemSheet
