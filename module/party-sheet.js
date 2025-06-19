/* global game, foundry */

import DCCActorSheet from './actor-sheet.js'

const { TextEditor } = foundry.applications.ux

/**
 * Extend the basic ActorSheet to represent a party
 * @extends {DCCActorSheet}
 */
class DCCPartySheet extends DCCActorSheet {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ['dcc', 'sheet', 'actor', 'party'],
    tag: 'form',
    position: {
      width: 800,
      height: 635
    },
    window: {
      resizable: true
    },
    form: {
      submitOnChange: true
    },
    actor: {
      type: 'Party'
    },
    actions: {
      editMember: this.#editMember,
      removeMember: this.#removeMember,
      rollAbility: this.#rollAbility,
      rollSave: this.#rollSave,
      rollAttack: this.#rollAttack,
      editImage: this.#editImage
    },
    dragDrop: [{
      dragSelector: '.party-draggable',
      dropSelector: '.party',
      permissions: {
        dragstart: '_canDragStart',
        drop: '_canDragDrop'
      },
      callbacks: {
        dragstart: '_onDragStart',
        drop: '_onDrop'
      }
    }]
  }

  /** @inheritDoc */
  static PARTS = {
    tabs: {
      id: 'tabs',
      template: 'systems/dcc/templates/party-sheet-partial-tabs.html'
    },
    body: {
      id: 'body',
      template: 'systems/dcc/templates/party-sheet-body.html'
    },
    party: {
      id: 'party',
      template: 'systems/dcc/templates/party-sheet-partial-party.html'
    },
    notes: {
      id: 'notes',
      template: 'systems/dcc/templates/actor-partial-pc-notes.html'
    }
  }

  /** @inheritDoc */
  static TABS = {
    sheet: {
      tabs: [
        { id: 'party', group: 'sheet', label: 'DCC.Party' },
        { id: 'notes', group: 'sheet', label: 'DCC.Notes' }
      ],
      initial: 'party'
    }
  }

  /** @inheritdoc */
  _getHeaderButtons () {
    const buttons = super._getHeaderButtons()

    // Remove the Config button
    return buttons.filter((button) => button.class !== 'configure-actor')
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext (options) {
    const context = await super._prepareContext(options)

    // Prepare party-specific data
    this.#preparePartyMembers(context)

    // Format Notes HTML
    context.notesHTML = await TextEditor.enrichHTML(this.actor.system.details.notes.value, {
      relativeTo: this.document,
      secrets: this.document.isOwner
    })

    return context
  }

  /**
   * Organize and classify the actors in the party
   *
   * @param {Object} context   The context data
   * @return {undefined}
   * @private
   */
  #preparePartyMembers (context) {
    context.partyMembers = []
    for (const member of this.members) {
      const actor = game.actors.get(member.id)

      if (actor) {
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

        context.partyMembers.push(memberData)
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
   * Check a member is eligible to join the party
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
    return actor.type !== 'Party'
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

  /* -------------------------------------------- */

  /**
   * Open the party member's sheet for editing
   * @this {DCCPartySheet}
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   * @private
   */
  static async #editMember (event, target) {
    event.preventDefault()
    const actorId = target.closest('[data-actor-id]')?.dataset.actorId
    if (actorId) {
      const actor = game.actors.get(actorId)
      if (actor) {
        actor.sheet.render(true)
      }
    }
  }

  /**
   * Prompt to remove a member
   * @this {DCCPartySheet}
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   * @private
   */
  static async #removeMember (event, target) {
    event.preventDefault()
    const actorId = target.closest('[data-actor-id]')?.dataset.actorId
    if (!actorId) return

    const removeMemberFn = (context) => {
      context._removeMember(actorId)
      const item = target.closest('.character-row')
      if (item) {
        item.style.transition = 'height 0.2s ease-out'
        item.style.height = '0px'
        item.style.overflow = 'hidden'
        setTimeout(() => {
          item.remove()
          context.render(false)
        }, 200)
      }
    }

    if (game.settings.get('dcc', 'promptForItemDeletion')) {
      await new foundry.applications.api.DialogV2({
        window: { title: 'DCC.PartyDeletePrompt' },
        content: `<p>${game.i18n.localize('DCC.PartyDeleteExplain')}</p>`,
        buttons: {
          yes: {
            icon: '<i class="fas fa-check"></i>',
            label: game.i18n.localize('DCC.Yes'),
            callback: () => removeMemberFn(this)
          },
          no: {
            icon: '<i class="fas fa-times"></i>',
            label: game.i18n.localize('DCC.No')
          }
        }
      }).render(true)
    } else {
      removeMemberFn(this)
    }
  }

  /**
   * Roll an ability check for a party member
   * @this {DCCPartySheet}
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   * @private
   */
  static async #rollAbility (event, target) {
    event.preventDefault()
    const actorId = target.closest('[data-actor-id]')?.dataset.actorId
    const abilityId = target.dataset.ability
    if (actorId && abilityId) {
      const options = this._fillRollOptions?.(event) || {}
      const actor = game.actors.get(actorId)
      if (actor) {
        actor.rollAbilityCheck(abilityId, options)
      }
    }
  }

  /**
   * Roll a saving throw for a party member
   * @this {DCCPartySheet}
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   * @private
   */
  static async #rollSave (event, target) {
    event.preventDefault()
    const actorId = target.closest('[data-actor-id]')?.dataset.actorId
    const saveId = target.dataset.save
    if (actorId && saveId) {
      const options = this._fillRollOptions?.(event) || {}
      const actor = game.actors.get(actorId)
      if (actor) {
        actor.rollSavingThrow(saveId, options)
      }
    }
  }

  /**
   * Roll an attack for a party member
   * @this {DCCPartySheet}
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   * @private
   */
  static async #rollAttack (event, target) {
    event.preventDefault()
    const actorId = target.closest('[data-actor-id]')?.dataset.actorId
    const weaponId = target.nextElementSibling?.value
    if (actorId && weaponId) {
      const options = this._fillRollOptions?.(event) || {}
      const actor = game.actors.get(actorId)
      if (actor) {
        actor.rollWeaponAttack(weaponId, options)
      }
    }
  }

  /**
   * Handle image editing
   * @this {DCCPartySheet}
   * @param {PointerEvent} event - The originating click event
   * @param {HTMLElement} target - The capturing HTML element which defined a [data-action]
   * @private
   */
  static async #editImage (event, target) {
    const field = target.dataset.field || 'img'
    const current = foundry.utils.getProperty(this.document, field)

    const fp = new foundry.applications.apps.FilePicker({
      type: 'image',
      current,
      callback: (path) => {
        this.document.update({ [field]: path })
      }
    })

    fp.render(true)
  }

  /**
   * Fill options for a roll based on event
   * @param {Event} event   The originating click event
   * @private
   */
  _fillRollOptions (event) {
    const rollModifierDefault = game.settings.get('dcc', 'showRollModifierByDefault')
    return {
      showModifierDialog: rollModifierDefault ^ (event.ctrlKey || event.metaKey)
    }
  }

  /**
   * Create drag-and-drop workflow handlers for this Application
   * @returns {DragDrop[]} An array of DragDrop handlers
   * @private
   */
  static #createDragDropHandlers () {
    return [{
      dragSelector: '.party-draggable',
      dropSelector: '.party',
      permissions: {
        dragstart: this.prototype._canDragStart.bind(this),
        drop: this.prototype._canDragDrop.bind(this)
      },
      callbacks: {
        dragstart: this.prototype._onDragStart.bind(this),
        drop: this.prototype._onDrop.bind(this)
      }
    }]
  }

  /**
   * Check if drag start is allowed
   * @param {string} selector
   * @returns {boolean}
   */
  _canDragStart (selector) {
    return this.document.isOwner && this.isEditable
  }

  /**
   * Check if drag/drop is allowed
   * @param {string} selector
   * @returns {boolean}
   */
  _canDragDrop (selector) {
    return this.document.isOwner && this.isEditable
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

    if (event?.currentTarget) {
      const actorId = event.currentTarget.closest('[data-actor-id]')?.dataset.actorId

      if (actorId && expanded.weaponUpdates?.[actorId]) {
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
      const tokenImg = this.document.prototypeToken.texture.src
      if (!tokenImg || tokenImg === 'icons/svg/mystery-man.svg' || tokenImg === 'systems/dcc/styles/images/actor.webp') {
        foundry.utils.mergeObject(formData, { prototypeToken: { texture: { src: expanded.img } } })
      }
    }

    // Update the Actor
    return this.document.update(formData)
  }
}

export default DCCPartySheet
