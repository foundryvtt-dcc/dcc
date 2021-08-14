/* global $, ActorSheet, CONFIG, CONST, Dialog, duplicate, game, mergeObject */

import EntityImages from './entity-images.js'

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
      tabs: [{ navSelector: '.sheet-tabs', contentSelector: '.sheet-body', initial: 'description' }],
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

    // Prepare item lists by type
    this._prepareParty(data)

    return data
  }

  /**
   * Organize and classify the actors in the party
   *
   * @param {Object} actorData   The party Actor data
   * @return {undefined}
   */
  _prepareParty (actorData) {
    actorData.partyMembers = []
    for (const member of this.members) {
      const actor = game.actors.get(member)
      if (actor) {
        actorData.partyMembers.push(actor.data)
      }
    }
  }

  /**
   * Getter for the members of the party
   *
   * @return {Array}
   */
  get members () {
    const partyFlag = this.actor.getFlag('dcc', 'partyMembers')
    if (!partyFlag || !(partyFlag instanceof Array)) {
      return []
    }
    return partyFlag
  }

  /**
   * Setter for the members of the party
   *
   * @param members {Array} List of party members
   * @return {Array}
   */
  set members (members) {
    if (members instanceof Array) {
      this.actor.setFlag('dcc', 'partyMembers', members)
    }
  }

  /**
   * Add a member to the party
   *
   * @param {string} actorId   Id of the actor to add
   * @return {undefined}
   */
  _addMember (actorId) {
    const members = this.members
    members.push(actorId)
    this.members = members
  }

  /**
   * Remove a member from the party
   *
   * @param {string} actorId   Id of the actor to remove
   * @return {undefined}
   */
  _removeMember (actorId) {
    const members = this.members

    const index = members.indexOf(actorId)
    if (index >= 0) {
      members.splice(index, 1)
    }

    this.members = members
  }

  /**
   * Open the sheet for a member from the party
   *
   * @param {string} actorId   Id of the actor to edit
   * @return {undefined}
   */
  _editMember (actorId) {
    const actor = game.actors.get(actorId)
    if (actor) {
      actor.sheet.render(true)
    }
  }

  /* -------------------------------------------- */

  /** Prompt to remove a member
   * @param {Event}  event   The originating click event
   * @private
   */
  _onRemoveMember (event) {
    event.preventDefault()
    const actorId = event.currentTarget.dataset.actorId
    const removeMember = function (context) {
      context._removeMember(actorId)
      $(event.currentTarget).parents('.item').slideUp(200, () => context.render(false))
    }
    if (game.settings.get('dcc', 'promptForItemDeletion')) {
      new Dialog({
        title: game.i18n.localize('DCC.PartyDeletePrompt'),
        content: `<p>${game.i18n.localize('DCC.PartyDeleteExplain')}</p>`,
        buttons: {
          yes: {
            icon: '<i class="fas fa-check"></i>',
            label: game.i18n.localize('DCC.Yes'),
            callback: () => removeMember(this)
          },
          no: {
            icon: '<i class="fas fa-times"></i>',
            label: game.i18n.localize('DCC.No')
          }
        }
      }).render(true)
    } else {
      removeMember(this)
    }
  }

  /**
   * Delete an item
   * @param {Event}  event   The originating click event
   * @private
   */
  _deleteItem (event) {
    const li = $(event.currentTarget).parents('.item')
    this.actor.deleteOwnedItem(li.data('itemId'))
    li.slideUp(200, () => this.render(false))
  }

  /** @override */
  activateListeners (html) {
    super.activateListeners(html)

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return

    // Owner Only Listeners
    if (this.actor.isOwner) {
      // Update party member
      html.find('.party-edit').click(ev => {
        this._editMember(ev.currentTarget.dataset.actorId)
      })

      // Remove party member
      html.find('.party-delete').click(ev => {
        this._onRemoveMember(ev)
      })
    } else {
      // Otherwise remove rollable classes
      html.find('.rollable').each((i, el) => el.classList.remove('rollable'))
    }
  }

  /** @override */
  async _onDropActor (event, data) {
    super._onDropActor(event, data)

    if (!this.actor.isOwner) return false

    this._addMember(data.id)
  }
}

export default DCCPartySheet
