/* global ItemSheet, mergeObject */

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
    return 'systems/dcc/templates/item-sheet-equipment.html'
  }

  /** @override */
  getData () {
    const data = super.getData()

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
