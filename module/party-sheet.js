/* global $, CONFIG, Dialog, game, foundry, TextEditor */

import DCCActorSheet from './actor-sheet.js'
import EntityImages from './entity-images.js'

/**
 * Extend the basic ActorSheet to represent a party
 * @extends {DCCActorSheet}
 */
class DCCPartySheet extends DCCActorSheet {
  /** @override */
  static get defaultOptions () {
    const options = {
      classes: ['dcc', 'sheet', 'actor', 'party'],
      height: 635,
      tabs: [{ navSelector: '.sheet-tabs', contentSelector: '.sheet-body', initial: 'description' }],
      dragDrop: [{ dragSelector: null, dropSelector: null }],
      scrollY: [
        '.tab.party'
      ],
      template: 'systems/dcc/templates/actor-sheet-party.html'
    }
    return foundry.utils.mergeObject(super.defaultOptions, options)
  }

  /** @inheritdoc */
  _getHeaderButtons () {
    const buttons = super._getHeaderButtons()

    // Remove the Config button
    return buttons.filter((button) => button.class !== 'configure-actor')
  }

  /* -------------------------------------------- */

  /** @override */
  async getData (options) {
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

    // Format Notes HTML
    data.notesHTML = await TextEditor.enrichHTML(this.actor.system.details.notes.value, {
      relativeTo: this.actor,
      secrets: this.actor.isOwner
    })

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
        const memberData = foundry.utils.mergeObject(
          foundry.utils.duplicate(member),
          {
            actor,
            melee,
            ranged,
            isNPC: actor.type === 'NPC'
          }
        )

        // Ensure activeMelee and activeRanged are set if valid
        if (!memberData.activeMelee && melee.length > 0) {
          memberData.activeMelee = melee[0].id
        }
        if (!memberData.activeRanged && ranged.length > 0) {
          memberData.activeRanged = ranged[0].id
        }

        // Are melee and ranged weapons valid?
        memberData.hasMelee = !!memberData.hasMelee
        memberData.hasRanged = !!memberData.hasRanged

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
   * Check a member is elegible to join the party
   *
   * @param {string} actorId   Uuid of the actor to add
   * @return {undefined}
   */
  async _validateMember (actorId) {
    const actorRef = foundry.utils.parseUuid(actorId)
    const actor = await game.actors.get(actorRef.id)

    // Actor must be valid
    if (!actor) { return false }

    // Cannot add a Party Sheet to a Party
    return actor.type !== 'Party';


  }

  /**
   * Add a member to the party
   *
   * @param {string} actorId   Uuid of the actor to add
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
    const options = this._fillRollOptions(event)
    const actor = game.actors.get(actorId)
    if (actor) {
      actor.rollAbilityCheck(abilityId, options)
    }
  }

  _onRollSave (event) {
    event.preventDefault()
    const actorId = event.currentTarget.parentElement.dataset.actorId
    const saveId = event.currentTarget.dataset.save
    const options = this._fillRollOptions(event)
    const actor = game.actors.get(actorId)
    if (actor) {
      actor.rollSavingThrow(saveId, options)
    }
  }

  _onRollAttack (event) {
    event.preventDefault()
    const actorId = event.currentTarget.parentElement.dataset.actorId
    const weaponId = event.currentTarget.nextElementSibling.value
    const options = this._fillRollOptions(event)
    const actor = game.actors.get(actorId)
    if (actor) {
      actor.rollWeaponAttack(weaponId, options)
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

    if (!await this._validateMember(data.uuid)) return false

    this._addMember(data.uuid)

    return true
  }

  /** @override */
  async _updateObject (event, formData) {
    const expanded = foundry.utils.expandObject(formData)

    if (event.currentTarget) {
      const actorId = event.currentTarget.parentElement.dataset.actorId

      if (expanded.weaponUpdates[actorId]) {
        const memberUpdates = {}

        const weaponUpdates = expanded.weaponUpdates[actorId]
        if (weaponUpdates.melee) {
          memberUpdates.activeMelee = weaponUpdates.melee
        }
        if (weaponUpdates.ranged) {
          memberUpdates.activeRanged = weaponUpdates.ranged
        }

        this._updateMember(actorId, memberUpdates)
      }
    }

    if (expanded.img) {
      const tokenImg = this.actor.prototypeToken.texture.src
      if (!tokenImg || tokenImg === 'icons/svg/mystery-man.svg' || tokenImg === 'systems/dcc/styles/images/actor.webp') {
        foundry.utils.mergeObject(formData, { prototypeToken: { texture: { src: expanded.img } } })
      }
    }

    // Update the Actor
    return this.object.update(formData)
  }
}

export default DCCPartySheet
