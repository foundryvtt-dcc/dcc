/* global ActorSheet, CONFIG */

import EntityImage from './entity-images.js'

/**
 * Extend the basic ActorSheet to represent a party
 * @extends {ActorSheet}
 */
class DCCPartySheet extends ActorSheet {
  /** @override */
  static get defaultOptions () {
    return mergeObject(super.defaultOptions, {
      classes: ['dcc', 'sheet', 'actor'],
      template: 'systems/dcc/templates/actor-sheet-party.html',
      width: 600,
      height: 600,
      tabs: [{ navSelector: '.sheet-tabs', contentSelector: '.sheet-body', initial: 'party' }],
      dragDrop: [{ dragSelector: null, dropSelector: null }],
      scrollY: [
        '.tab.party'
      ]
    })
  }

  /** @inheritdoc */
  _getHeaderButtons () {
    const buttons = super._getHeaderButtons()

    // Header buttons shown only with Owner permission
    if (this.actor.permission === CONST.ENTITY_PERMISSIONS.OWNER) {
      buttons.unshift(
        {
          label: game.i18n.localize('DCC.ConfigureSheet'),
          class: 'configure-actor',
          icon: 'fas fa-code',
          onclick: ev => this._onConfigureActor(ev)
        }
      )
    }

    return buttons
  }

  /* -------------------------------------------- */

  /** @override */
  getData () {
    // Basic data
    const isOwner = this.document.isOwner
    const data = {
      isOwner: isOwner,
      limited: this.document.limited,
      options: this.options,
      editable: this.isEditable,
      cssClass: isOwner ? 'editable' : 'locked',
      type: this.document.data.type,
      config: CONFIG.DCC
    }

    data.actor = duplicate(this.document.data)
    data.data = duplicate(this.document.data.data)
    data.labels = this.document.labels || {}
    data.filters = this._filters

    if (!data.actor.img || data.actor.img === 'icons/svg/mystery-man.svg') {
      data.actor.data.img = EntityImages.imageForActor(data.type)
    }

    if (data.isNPC) {
      this.options.template = 'systems/dcc/templates/actor-sheet-npc.html'
    } else {
      this.options.template = 'systems/dcc/templates/actor-sheet-zero-level.html'

      if (!data.isZero) {
        // Reorder saves on upper level sheet to define tabbing order
        data.data.saves = {
          ref: data.data.saves.ref,
          frt: data.data.saves.frt,
          wil: data.data.saves.wil
        }
      }

      // Should the Deed Roll button be available on the sheet?
      data.data.config.rollAttackBonus = (data.data.config.attackBonusMode === 'manual')
    }

    // Prepare item lists by type
    this._prepareItems(data)

    return data
  }
}

export default DCCPartySheet
