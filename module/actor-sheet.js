/* global ActorSheet, CONFIG, duplicate, Dialog, game, mergeObject, $, ENTITY_PERMISSIONS */

import parsePC from './pc-parser.js'
import parseNPC from './npc-parser.js'
import DCCActorConfig from './actor-config.js'

/**
 * Extend the basic ActorSheet
 * @extends {ActorSheet}
 */
class DCCActorSheet extends ActorSheet {
  /** @override */
  static get defaultOptions () {
    return mergeObject(super.defaultOptions, {
      classes: ['dcc', 'sheet', 'actor'],
      template: 'systems/dcc/templates/actor-sheet-zero-level.html',
      width: 600,
      height: 600,
      tabs: [{ navSelector: '.sheet-tabs', contentSelector: '.sheet-body', initial: 'description' }],
      dragDrop: [{ dragSelector: '.weapon-list .weapon', dropSelector: null }]
    })
  }

  /** @inheritdoc */
  _getHeaderButtons () {
    const buttons = super._getHeaderButtons()

    // Header buttons shown only with Owner permissions
    if (this.actor.permission === ENTITY_PERMISSIONS.OWNER) {
      buttons.unshift(
        {
          label: game.i18n.localize('DCC.ConfigureSheet'),
          class: 'configure-actor',
          icon: 'fas fa-code',
          onclick: ev => this._onConfigureActor(ev)
        },
        {
          label: game.i18n.localize('DCC.ImportStats'),
          class: 'paste-block',
          icon: 'fas fa-paste',
          onclick: ev => this._onPasteStatBlock(ev)
        },
        {
          label: game.i18n.localize('DCC.Clear'),
          class: 'clear-sheet',
          icon: 'fas fa-eraser',
          onclick: ev => this._onClearSheet(ev)
        }
      )
    }

    return buttons
  }

  /* -------------------------------------------- */

  /** @override */
  getData () {
    // Basic data
    const isOwner = this.entity.owner
    const data = {
      owner: isOwner,
      limited: this.entity.limited,
      options: this.options,
      editable: this.isEditable,
      cssClass: isOwner ? 'editable' : 'locked',
      isNPC: this.entity.data.type === 'NPC',
      izPC: this.entity.data.type === 'Player',
      isZero: this.entity.data.data.details.level === 0,
      type: this.entity.data.type,
      config: CONFIG.DCC
    }

    data.actor = duplicate(this.actor.data)
    data.data = data.actor.data
    data.labels = this.actor.labels || {}
    data.filters = this._filters

    data.data.utility = {}
    data.data.utility.meleeWeapons = [0, 1, 2]
    data.data.utility.rangedWeapons = [3, 4]
    // console.log(data.data);

    if (data.isNPC) {
      this.options.template = 'systems/dcc/templates/actor-sheet-npc.html'
    } else {
      this.options.template = 'systems/dcc/templates/actor-sheet-zero-level.html'
    }

    // Prepare item lists by type
    this._prepareItems(data)

    return data
  }

  /**
   * Organize and classify Items for Character sheets.
   *
   * @param {Object} actorData The actor to prepare.
   * @return {undefined}
   */
  _prepareItems (sheetData) {
    const actorData = sheetData.actor

    // Initialize containers.
    const equipment = []
    const weapons = []
    const armor = []
    const ammunition = []
    const mounts = []
    const spells = {
      1: [],
      2: [],
      3: [],
      4: [],
      5: []
    }
    const treasure = []
    const coins = []

    // Iterate through items, allocating to containers
    for (const i of actorData.items) {
      // Remove physical items with zero quantity
      if (i.quantity && i.quantity <= 0) {
        this.actor.deleteOwnedItem(i._id, {})
        continue
      }

      if (i.type === 'weapon') {
        weapons.push(i)
      } if (i.type === 'ammunition') {
        ammunition.push(i)
      } else if (i.type === 'armor') {
        armor.push(i)
      } else if (i.type === 'equipment') {
        equipment.push(i)
      } else if (i.type === 'mount') {
        mounts.push(i)
      } else if (i.type === 'spell') {
        if (i.data.level !== undefined) {
          spells[i.data.level].push(i)
        }
      } else if (i.type === 'treasure') {
        if (i.data.isCoins) {
          coins.push(i)
        } else {
          treasure.push(i)
        }
      }
    }

    // Combine any coins into a single item
    if (coins.length) {
      const wallet = coins.shift()
      for (const c of coins) {
        wallet.data.value.gp += c.data.value.gp
        wallet.data.value.sp += c.data.value.sp
        wallet.data.value.cp += c.data.value.cp
        this.actor.deleteOwnedItem(c._id, {})
      }
      this.actor.updateOwnedItem(wallet, { diff: true })
      treasure.push(wallet)
    }

    // Assign and return
    actorData.equipment = equipment
    actorData.weapons = weapons
    actorData.armor = armor
    actorData.ammunition = ammunition
    actorData.mounts = mounts
    actorData.spells = spells
    actorData.treasure = treasure
  }
  /* -------------------------------------------- */

  /** @override */
  activateListeners (html) {
    super.activateListeners(html)

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return

    // Owner Only Listeners
    if (this.actor.owner) {
      // Ability Checks
      html.find('.ability-name').click(this._onRollAbilityTest.bind(this))
      html.find('.ability-modifiers').click(this._onRollAbilityTest.bind(this))

      // Initiative
      html.find('.init-label').click(this._onRollInitiative.bind(this))

      // Saving Throws
      html.find('.save-name').click(this._onRollSavingThrow.bind(this))

      // Skills
      html.find('.skill-check').click(this._onRollSkillCheck.bind(this))

      // Luck Die
      html.find('.luck-die').click(this._onRollLuckDie.bind(this))

      // Spell Checks
      html.find('.spell-check').click(this._onRollSpellCheck.bind(this))
      html.find('.spell-item-button').click(this._onRollSpellCheck.bind(this))

      // Attack Bonus
      html.find('.attack-bonus').click(this._onRollAttackBonus.bind(this))

      // Weapons
      const handler = ev => this._onDragStart(ev)
      html.find('.weapon-button').click(this._onRollWeaponAttack.bind(this))
      html.find('li.weapon').each((i, li) => {
        // Add draggable attribute and dragstart listener.
        li.setAttribute('draggable', true)
        li.addEventListener('dragstart', handler, false)
      })

      // Only for editable sheets
      if (this.options.editable) {
        // Add Inventory Item
        html.find('.item-create').click(this._onItemCreate.bind(this))

        // Update Inventory Item
        html.find('.item-edit').click(ev => {
          const li = $(ev.currentTarget).parents('.item')
          const item = this.actor.getOwnedItem(li.data('itemId'))
          item.sheet.render(true)
        })

        // Delete Inventory Item
        html.find('.item-delete').click(ev => {
          const li = $(ev.currentTarget).parents('.item')
          this.actor.deleteOwnedItem(li.data('itemId'))
          li.slideUp(200, () => this.render(false))
        })
      }
    } else {
      // Otherwise remove rollable classes
      html.find('.rollable').each((i, el) => el.classList.remove('rollable'))
    }
  }

  /**
   * Display sheet specific configuration settings
   * @param {Event} event   The originating click event
   * @private
   */
  _onConfigureActor (event) {
    event.preventDefault()
    new DCCActorConfig(this.actor, {
      top: this.position.top + 40,
      left: this.position.left + (this.position.width - 400) / 2
    }).render(true)
  }

  /**
   * Prompt to Clear This Sheet
   * @param {Event} event   The originating click event
   * @private
   */
  _onClearSheet (event) {
    event.preventDefault()
    new Dialog({
      title: game.i18n.localize('DCC.ClearSheet'),
      content: `<p>${game.i18n.localize('DCC.ClearSheetExplain')}</p>`,
      buttons: {
        yes: {
          icon: '<i class="fas fa-check"></i>',
          label: 'Yes',
          callback: () => this._clearSheet()
        },
        no: {
          icon: '<i class="fas fa-times"></i>',
          label: 'No'
        }
      }
    }).render(true)
  }

  /**
   * Clear out all form fields on this sheet
   * @private
   */
  _clearSheet () {
    [...this.form.elements].forEach((el) => {
      el.value = ''
    })
  }

  /**
   * Create a macro when a rollable element is dragged
   * @param {Event} event
   * @override */
  _onDragStart (event) {
    const li = event.currentTarget
    const weapon = this.actor.data.data.items.weapons[li.dataset.weaponId]
    weapon.id = li.dataset.weaponId
    const dragData = {
      type: 'Item',
      actorId: this.actor.id,
      data: weapon
    }
    if (this.actor.isToken) dragData.tokenId = this.actor.token.id
    event.dataTransfer.setData('text/plain', JSON.stringify(dragData))
  }

  /**
   * Prompt for a stat block to import
   * @param {Event} event   The originating click event
   * @private
   */
  _onPasteStatBlock (event) {
    event.preventDefault()
    const html = `<form id="stat-block-form">
            <p><a href="https://purplesorcerer.com/create.php?oc=rulebook&mode=3d6&stats=&abLow=Any&abHigh=Any&hp=normal&at=toggle&display=text&sc=4">${game.i18n.localize('DCC.PurpleSorcererPCLink')}</a></p>
            <textarea name="statblock"></textarea>
        </form>`
    new Dialog({
      title: game.i18n.localize('DCC.PasteBlock'),
      content: html,
      buttons: {
        yes: {
          icon: '<i class="fas fa-check"></i>',
          label: 'Import Stats',
          callback: html => this._pasteStateBlock(html)
        },
        no: {
          icon: '<i class="fas fa-times"></i>',
          label: 'Cancel'
        }
      }
    }).render(true)
  }

  /**
   * Import a stat block
   * @param {string} statBlockHTML   The stat block to import
   * @private
   */
  _pasteStateBlock (statBlockHTML) {
    const statBlock = statBlockHTML[0].querySelector('#stat-block-form')[0].value
    const parsedNPC = this.getData().isNPC ? parseNPC(statBlock) : parsePC(statBlock)
    // console.log(this.object.data.data)
    Object.entries(parsedNPC).forEach(([key, value]) => {
      // console.log(key + ' ' + value)
      // ToDo: Cannot set notes this way as the text editor is not a standard form input
      if (this.form[key]) this.form[key].value = value
    })
  }

  /* -------------------------------------------- */

  /**
   * Handle rolling an Ability check
   * @param {Event} event   The originating click event
   * @private
   */
  _onRollAbilityTest (event) {
    event.preventDefault()
    const options = {}
    if (event.currentTarget.className === 'ability-modifiers') {
      options.modClick = true
    }
    const ability = event.currentTarget.parentElement.dataset.ability
    this.actor.rollAbilityCheck(ability, { event: event })
  }

  /**
   * Handle rolling Initiative
   * @param {Event} event   The originating click event
   * @private
   */
  _onRollInitiative (event) {
    event.preventDefault()
    this.actor.rollInitiative({ event: event })
  }

  /**
   * Handle rolling a saving throw
   * @param {Event} event   The originating click event
   * @private
   */
  _onRollSavingThrow (event) {
    event.preventDefault()
    const save = event.currentTarget.parentElement.dataset.save
    this.actor.rollSavingThrow(save, { event: event })
  }

  /**
   * Handle rolling a skill check
   * @param {Event} event   The originating click event
   * @private
   */
  _onRollSkillCheck (event) {
    event.preventDefault()
    const skill = event.currentTarget.parentElement.dataset.skill
    this.actor.rollSkillCheck(skill, { event: event })
  }

  /**
   * Handle rolling the luck die
   * @param {Event} event   The originating click event
   * @private
   */
  _onRollLuckDie (event) {
    event.preventDefault()
    this.actor.rollLuckDie({ event: event })
  }

  /**
   * Handle rolling a spell check
   * @param {Event} event   The originating click event
   * @private
   */
  _onRollSpellCheck (event) {
    event.preventDefault()
    const dataset = event.currentTarget.parentElement.dataset
    if (dataset.itemId) {
      // Roll through a spell item
      const item = this.actor.items.find(i => i.id === dataset.itemId)
      const ability = dataset.ability || 'int'
      item.rollSpellCheck(ability, {event: event})
    } else {
      // Roll a raw spell check for the actor
      const ability = dataset.ability || 'int'
      const die = dataset.die || '1d20'
      const bonus = this.actor.data.data.class.spellCheck || '+0'
      const spellName = dataset.spell || null
      this.actor.rollSpellCheck(die, bonus, ability, spellName, { event: event })
    }
  }

  /**
   * Handle rolling attack bonus
   * @param {Event} event   The originating click event
   * @private
   */
  _onRollAttackBonus (event) {
    if (this.actor._getConfig().rollAttackBonus) {
      event.preventDefault()
      this.actor.rollAttackBonus({ event: event })
    }
  }

  /**
   * Handle rolling a weapon attack
   * @param {Event} event   The originating click event
   * @private
   */
  _onRollWeaponAttack (event) {
    event.preventDefault()
    const weaponId = event.currentTarget.parentElement.dataset.weaponId
    this.actor.rollWeaponAttack(weaponId, { event: event })
  }

  /**
   * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
   * @param {Event} event   The originating click event
   * @private
   */
  _onItemCreate (event) {
    event.preventDefault()
    const header = event.currentTarget
    // Get the type of item to create.
    const type = header.dataset.type
    // Grab any data associated with this control.
    const data = duplicate(header.dataset)
    // Initialize a default name.
    const name = `New ${type.capitalize()}`
    // Prepare the item object.
    const itemData = {
      name: name,
      type: type,
      data: data
    }
    // Remove the type from the dataset since it's in the itemData.type prop.
    delete itemData.data.type

    // Finally, create the item!
    return this.actor.createOwnedItem(itemData)
  }

  /* -------------------------------------------- */

  /** @override */
  setPosition (options = {}) {
    const position = super.setPosition(options)
    const sheetBody = this.element.find('.sheet-body')
    const bodyHeight = position.height - 192
    sheetBody.css('height', bodyHeight)
    return position
  }

  /* -------------------------------------------- */

  /** @override */
  _updateObject (event, formData) {
    // Update the Actor
    return this.object.update(formData)
  }
}

export default DCCActorSheet
