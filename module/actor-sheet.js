/* global ActorSheet, CONFIG, duplicate, Dialog, game, mergeObject, expandObject, $, ENTITY_PERMISSIONS */

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
      dragDrop: [{ dragSelector: null, dropSelector: null }],
      scrollY: [
        '.tab.character',
        '.tab.equipment .equipment-container',
        '.tab.skills',
        '.tab.spells'
      ]
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
  async _prepareItems (sheetData) {
    const actorData = sheetData.actor

    // Initialize containers.
    const equipment = []
    const weapons = {
      melee: [],
      ranged: []
    }
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
    const skills = []
    const treasure = []
    const coins = []

    let inventory = actorData.items
    if (sheetData.data.config.sortInventory) {
      // Shallow copy and lexical sort
      inventory = [...inventory].sort((a, b) => a.name.localeCompare(b.name))
    }

    // Iterate through items, allocating to containers
    const removeEmptyItems = sheetData.data.config.removeEmptyItems
    for (const i of inventory) {
      // Remove physical items with zero quantity
      if (removeEmptyItems && i.data.quantity !== undefined && i.data.quantity <= 0) {
        this.actor.deleteOwnedItem(i._id, {})
        continue
      }

      if (i.type === 'weapon') {
        if (i.data.melee) {
          weapons.melee.push(i)
        } else {
          weapons.ranged.push(i)
        }
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
      } else if (i.type === 'skill') {
        skills.push(i)
      } else if (i.type === 'treasure') {
        let treatAsCoins = false

        if (i.data.isCoins) {
          // Safe to treat as coins if the item's value is resolved
          const item = this.actor.getOwnedItem(i._id)
          if (!item.needsValueRoll()) {
            treatAsCoins = true
          }
        }

        if (treatAsCoins) {
          coins.push(i)
        } else {
          treasure.push(i)
        }
      }
    }

    // Combine any extra coins into a single item
    if (coins.length) {
      const wallet = coins.shift()
      let needsUpdate = false
      for (const c of coins) {
        wallet.data.value.pp = parseInt(wallet.data.value.pp) + parseInt(c.data.value.pp)
        wallet.data.value.ep = parseInt(wallet.data.value.ep) + parseInt(c.data.value.ep)
        wallet.data.value.gp = parseInt(wallet.data.value.gp) + parseInt(c.data.value.gp)
        wallet.data.value.sp = parseInt(wallet.data.value.sp) + parseInt(c.data.value.sp)
        wallet.data.value.cp = parseInt(wallet.data.value.cp) + parseInt(c.data.value.cp)
        await this.actor.deleteOwnedItem(c._id, {})
        needsUpdate = true
      }
      if (needsUpdate) {
        await this.actor.updateOwnedItem(wallet, { diff: true })
      }
      treasure.push(wallet)
    }

    // Assign and return
    actorData.equipment = equipment
    actorData.weapons = weapons
    actorData.armor = armor
    actorData.ammunition = ammunition
    actorData.mounts = mounts
    actorData.spells = spells
    actorData.skills = skills
    actorData.treasure = treasure
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners (html) {
    super.activateListeners(html)

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return

    // Drag event handler
    const dragHandler = ev => this._onDragStart(ev)

    // Owner Only Listeners
    if (this.actor.owner) {
      // Ability Checks
      html.find('.ability-name').click(this._onRollAbilityCheck.bind(this))
      html.find('.ability-modifiers').click(this._onRollAbilityCheck.bind(this))
      html.find('li.ability').each((i, li) => {
        // Add draggable attribute and dragstart listener.
        li.setAttribute('draggable', true)
        li.addEventListener('dragstart', dragHandler, false)
      })
      html.find('div.ability-modifiers').each((i, li) => {
        // Also make the luck modifier draggable for non-standard luck checks
        if (li.parentElement.dataset.ability === 'lck') {
          li.setAttribute('draggable', true)
          li.addEventListener('dragstart', dragHandler, false)
        }
      })

      // Initiative
      html.find('.init-label').click(this._onRollInitiative.bind(this))
      html.find('div.init').each((i, li) => {
        // Add draggable attribute and dragstart listener.
        li.setAttribute('draggable', true)
        li.addEventListener('dragstart', dragHandler, false)
      })

      // Saving Throws
      html.find('.save-name').click(this._onRollSavingThrow.bind(this))
      html.find('li.save').each((i, li) => {
        // Add draggable attribute and dragstart listener.
        li.setAttribute('draggable', true)
        li.addEventListener('dragstart', dragHandler, false)
      })

      // Skills
      html.find('.skill-check').click(this._onRollSkillCheck.bind(this))
      html.find('label.skill-check').each((i, li) => {
        // Add draggable attribute and dragstart listener.
        li.setAttribute('draggable', true)
        li.addEventListener('dragstart', dragHandler, false)
      })

      // Luck Die
      html.find('.luck-die').click(this._onRollLuckDie.bind(this))
      html.find('label.luck-die').each((i, li) => {
        // Add draggable attribute and dragstart listener.
        li.setAttribute('draggable', true)
        li.addEventListener('dragstart', dragHandler, false)
      })

      // Spell Checks
      html.find('.spell-check').click(this._onRollSpellCheck.bind(this))
      html.find('.spell-item-button').click(this._onRollSpellCheck.bind(this))
      html.find('label.spell-check').each((i, li) => {
        // Add draggable attribute and dragstart listener.
        li.setAttribute('draggable', true)
        li.addEventListener('dragstart', dragHandler, false)
      })
      html.find('li.spell-item').each((i, li) => {
        // Add draggable attribute and dragstart listener.
        li.setAttribute('draggable', true)
        li.addEventListener('dragstart', dragHandler, false)
      })

      // Attack Bonus
      html.find('.attack-bonus').click(this._onRollAttackBonus.bind(this))
      html.find('.attack-bonus').each((i, li) => {
        // Add draggable attribute and dragstart listener.
        li.setAttribute('draggable', true)
        li.addEventListener('dragstart', dragHandler, false)
      })

      // Action Dice
      html.find('.action-dice').each((i, li) => {
        // Add draggable attribute and dragstart listener.
        li.setAttribute('draggable', true)
        li.addEventListener('dragstart', dragHandler, false)
      })

      // Weapons
      html.find('.weapon-button').click(this._onRollWeaponAttack.bind(this))
      html.find('.backstab-button').click(this._onRollWeaponAttack.bind(this))
      html.find('div.weapon-button').each((i, li) => {
        // Add draggable attribute and dragstart listener.
        li.setAttribute('draggable', true)
        li.addEventListener('dragstart', dragHandler, false)
      })
      html.find('div.backstab-button').each((i, li) => {
        // Add draggable attribute and dragstart listener.
        li.setAttribute('draggable', true)
        li.addEventListener('dragstart', dragHandler, false)
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
    let dragData = null

    // Handle the various draggable elements on the sheet
    const classes = event.target.classList
    if (classes.contains('ability')) {
      // Normal ability rolls and DCC d20 roll under luck rolls
      const abilityId = event.currentTarget.dataset.ability
      const rollUnder = (abilityId === 'lck')
      dragData = {
        type: 'Ability',
        actorId: this.actor.id,
        data: {
          abilityId: abilityId,
          rollUnder: rollUnder
        }
      }
    } else if (classes.contains('ability-modifiers')) {
      // Force d20 + Mod roll over (for non-standard luck rolls) by dragging the modifier
      const abilityId = event.currentTarget.parentElement.dataset.ability
      if (abilityId) {
        dragData = {
          type: 'Ability',
          actorId: this.actor.id,
          data: {
            abilityId: abilityId,
            rollUnder: false
          }
        }
      }
    } else if (classes.contains('init')) {
      dragData = {
        type: 'Initiative',
        actorId: this.actor.id,
        data: {}
      }
    } else if (classes.contains('save')) {
      dragData = {
        type: 'Save',
        actorId: this.actor.id,
        data: event.currentTarget.dataset.save
      }
    } else if (classes.contains('skill-check')) {
      const skillId = event.currentTarget.parentElement.dataset.skill
      dragData = {
        type: 'Skill',
        actorId: this.actor.id,
        data: {
          skillId: skillId,
          skillName: this.actor.data.data.skills[skillId].label
        }
      }
    } else if (classes.contains('luck-die')) {
      dragData = {
        type: 'Luck Die',
        actorId: this.actor.id,
        data: {}
      }
    } else if (classes.contains('spell-check')) {
      dragData = {
        type: 'Spell Check',
        actorId: this.actor.id,
        data: {
          ability: event.currentTarget.parentElement.dataset.ability
        }
      }
    } else if (classes.contains('spell-item')) {
      const spell = event.currentTarget.dataset.spell
      const spellItem = this.actor.items.find(i => i.name === spell)
      let img
      if (spellItem) {
        img = spellItem.data.img
      }
      dragData = {
        type: 'Spell Check',
        actorId: this.actor.id,
        data: {
          ability: event.currentTarget.dataset.ability,
          spell: spell,
          img: img
        }
      }
    } else if (classes.contains('attack-bonus')) {
      dragData = {
        type: 'Attack Bonus',
        actorId: this.actor.id,
        data: {}
      }
    } else if (classes.contains('action-dice')) {
      dragData = {
        type: 'Action Dice',
        actorId: this.actor.id,
        data: {
          die: this.actor.data.data.attributes.actionDice.value
        }
      }
    } else if (classes.contains('weapon-button') || classes.contains('backstab-button')) {
      const li = event.currentTarget.parentElement
      const weapon = this.actor.items.get(li.dataset.itemId)
      dragData = {
        type: 'Weapon',
        actorId: this.actor.id,
        data: {
          weapon: weapon,
          slot: li.dataset.itemSlot,
          backstab: classes.contains('backstab-button')
        }
      }
    }

    if (dragData) {
      if (this.actor.isToken) dragData.tokenId = this.actor.token.id
      event.dataTransfer.setData('text/plain', JSON.stringify(dragData))
    }
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
          callback: html => this._pasteStatBlock(html)
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
  async _pasteStatBlock (statBlockHTML) {
    const statBlock = statBlockHTML[0].querySelector('#stat-block-form')[0].value
    const parsedCharacter = this.getData().isNPC ? parseNPC(statBlock) : parsePC(statBlock)

    // Handle any items
    const items = parsedCharacter.items
    delete parsedCharacter.items
    for (const item of items) {
      await this.actor.createOwnedItem(item)
    }

    // Update the actor itself
    await this.object.update(parsedCharacter)
  }

  /* -------------------------------------------- */

  /**
   * Handle rolling an Ability check
   * @param {Event} event   The originating click event
   * @private
   */
  _onRollAbilityCheck (event) {
    event.preventDefault()
    const options = {}
    if (event.currentTarget.className === 'ability-modifiers') {
      options.modClick = true
    }

    const ability = event.currentTarget.parentElement.dataset.ability

    // Luck checks are roll under unless the user explicitly clicks the modifier
    const rollUnder = (ability === 'lck') && (event.currentTarget.className !== 'ability-modifiers')

    this.actor.rollAbilityCheck(ability, { rollUnder: rollUnder })
  }

  /**
   * Handle rolling Initiative
   * @param {Event} event   The originating click event
   * @private
   */
  _onRollInitiative (event) {
    event.preventDefault()
    this.actor.rollInitiative(this.token)
  }

  /**
   * Handle rolling a saving throw
   * @param {Event} event   The originating click event
   * @private
   */
  _onRollSavingThrow (event) {
    event.preventDefault()
    const save = event.currentTarget.parentElement.dataset.save
    this.actor.rollSavingThrow(save)
  }

  /**
   * Handle rolling a skill check
   * @param {Event} event   The originating click event
   * @private
   */
  _onRollSkillCheck (event) {
    event.preventDefault()
    const skill = event.currentTarget.parentElement.dataset.skill
    this.actor.rollSkillCheck(skill)
    this.render(false)
  }

  /**
   * Handle rolling the luck die
   * @param {Event} event   The originating click event
   * @private
   */
  _onRollLuckDie (event) {
    event.preventDefault()
    this.actor.rollLuckDie()
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
      item.rollSpellCheck(ability)
    } else {
      // Roll a raw spell check for the actor
      this.actor.rollSpellCheck()
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
      this.actor.rollAttackBonus()
      this.render(false)
    }
  }

  /**
   * Handle rolling a weapon attack
   * @param {Event} event   The originating click event
   * @private
   */
  _onRollWeaponAttack (event) {
    event.preventDefault()
    const slot = event.currentTarget.parentElement.dataset.itemSlot
    const options = {
      event: event,
      backstab: event.currentTarget.classList.contains('backstab-button')
    }
    this.actor.rollWeaponAttack(slot, options)
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
    // Handle owned item updates separately
    if (event.currentTarget) {
      let parentElement = event.currentTarget.parentElement
      const expanded = expandObject(formData)
      if (expanded.itemUpdates) {
        if (parentElement.classList.contains('weapon') ||
            parentElement.classList.contains('armor') ||
            parentElement.classList.contains('spell-item') ||
            parentElement.classList.contains('skill-field')) {
          // Handle extra nesting in skill lists
          if (parentElement.classList.contains('skill-field')) {
            parentElement = parentElement.parentElement
          }
          const itemId = parentElement.dataset.itemId
          const item = this.actor.getOwnedItem(itemId)
          if (item) {
            const updateData = expanded.itemUpdates[itemId]
            item.update(updateData)
          }
        }
      }
    }

    // Update the Actor
    return this.object.update(formData)
  }
}

export default DCCActorSheet
