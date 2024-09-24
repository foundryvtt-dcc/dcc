/* global $, ActorSheet, CONFIG, Dialog, game, foundry */

import EntityImages from './entity-images.js'

/**
 * Extend the basic ActorSheet to represent a party
 * @extends {ActorSheet}
 */
class DCCPartySheet extends ActorSheet {
  /** @override */
  static get defaultOptions () {
    const options = {
      classes: ['dcc', 'sheet', 'actor', 'party'],
      width: 600,
      // height: 600,
      tabs: [{ navSelector: '.sheet-tabs', contentSelector: '.sheet-body', initial: 'description' }],
      dragDrop: [{ dragSelector: null, dropSelector: null }],
      scrollY: [
        '.tab.party'
      ],
      template: 'systems/dcc/templates/actor-sheet-party.html'
    }
    const finalOptions = foundry.utils.mergeObject(super.defaultOptions, options)
    return finalOptions
  }

  /* -------------------------------------------- */

  /** @override */
  async getData () {
    // Basic data
    const isOwner = this.document.isOwner
    const data = {
      isOwner,
      limited: this.document.limited,
      options: this.options,
      editable: this.isEditable,
      cssClass: isOwner ? 'editable' : 'locked',
      type: this.document.type,
      config: CONFIG.DCC
    }

    data.actor = foundry.utils.duplicate(this.document)
    data.actor.name = this.document.name
    data.system = foundry.utils.duplicate(this.document.system)
    data.labels = this.document.labels || {}
    data.filters = this._filters

    if (!data.actor.img || data.actor.img === 'icons/svg/mystery-man.svg') {
      data.actor.img = EntityImages.imageForActor(data.type)
      if (!data.actor.prototypeToken.texture.src || data.actor.prototypeToken.texture.src === 'icons/svg/mystery-man.svg') {
        data.actor.prototypeToken.texture.src = EntityImages.imageForActor(data.type)
      }
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
      const actor = game.actors.get(member.id)

      const melee = []
      const ranged = []
      for (const i of actor.items) {
        if (i.type === 'weapon') {
          if (i.system.melee) {
            melee.push(i)
          } else {
            ranged.push(i)
          }
        }
      }

      if (actor) {
        const memberData = foundry.utils.mergeObject(foundry.utils.duplicate(member), { actor, melee, ranged, isNPC: actor.type === 'NPC' })
        actorData.partyMembers.push(memberData)
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
      const validMembers = []
      for (const member of members) {
        try {
          const actor = game.actors.get(member.id)
          if (actor) {
            validMembers.push(member)
          }
        } catch { }
      }
      this.actor.setFlag('dcc', 'partyMembers', validMembers)
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

    members.push({
      id: foundry.utils.parseUuid(actorId).id
    })

    this.members = members

    this.render(false)
  }

  /**
   * Update a member of the party
   *
   * @param {string} actorId   Id of the actor to edit
   * @param {Object} updates   Dictionary of updates
   * @return {undefined}
   */
  _updateMember (actorId, updates) {
    const members = this.members

    const index = members.findIndex(m => m.id === actorId)
    if (index >= 0) {
      members[index] = foundry.utils.mergeObject(members[index], updates)
    }

    this.members = members

    this.render(false)
  }

  /**
   * Remove a member from the party
   *
   * @param {string} actorId   Id of the actor to remove
   * @return {undefined}
   */
  _removeMember (actorId) {
    const members = this.members

    const index = members.findIndex(m => m.id === actorId)
    if (index >= 0) {
      members.splice(index, 1)
    }

    this.members = members

    this.render(false)
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
    const actorId = event.currentTarget.parentElement.dataset.actorId
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

  _onRollAbility (event) {
    event.preventDefault()
    const actorId = event.currentTarget.parentElement.dataset.actorId
    const abilityId = event.currentTarget.dataset.ability
    const actor = game.actors.get(actorId)
    if (actor) {
      actor.rollAbilityCheck(abilityId)
    }
  }

  _onRollSave (event) {
    event.preventDefault()
    const actorId = event.currentTarget.parentElement.dataset.actorId
    const saveId = event.currentTarget.dataset.save
    const actor = game.actors.get(actorId)
    if (actor) {
      actor.rollSavingThrow(saveId)
    }
  }

  _onRollAttack (event) {
    event.preventDefault()
    const actorId = event.currentTarget.parentElement.dataset.actorId
    const weaponId = event.currentTarget.nextElementSibling.value
    const actor = game.actors.get(actorId)
    if (actor) {
      actor.rollWeaponAttack(weaponId)
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
        this._editMember(ev.currentTarget.parentElement.dataset.actorId)
      })

      // Remove party member
      html.find('.party-delete').click(ev => {
        this._onRemoveMember(ev)
      })

      // Ability rolls
      html.find('.ability-label').click(ev => {
        this._onRollAbility(ev)
      })

      // Saving throws
      html.find('.save-label').click(ev => {
        this._onRollSave(ev)
      })

      // Melee and ranged attacks
      html.find('.weapon').click(ev => {
        this._onRollAttack(ev)
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

    this._addMember(data.uuid)
  }

  /** @override */
  async _updateObject (event, formData) {
    if (event.currentTarget) {
      const actorId = event.currentTarget.parentElement.dataset.actorId
      const expanded = foundry.utils.expandObject(formData)

      const memberUpdates = {}

      if (expanded.weaponUpdates[actorId]) {
        const weaponUpdates = expanded.weaponUpdates[actorId]
        if (weaponUpdates.melee) {
          memberUpdates.activeMelee = weaponUpdates.melee
        }
        if (weaponUpdates.ranged) {
          memberUpdates.activeRanged = weaponUpdates.ranged
        }
      }

      this._updateMember(actorId, memberUpdates)
    }

    return true
  }
}

export default DCCPartySheet
