/* global ActorSheet, CONFIG, Dialog, TextEditor, game, foundry, $, CONST */

import DCCActorConfig from './actor-config.js'
import MeleeMissileBonusConfig from './melee-missile-bonus-config.js'
import EntityImages from './entity-images.js'

/**
 * Extend the basic ActorSheet
 * @extends {ActorSheet}
 */
class DCCActorSheet extends ActorSheet {
  static height = 640

  /** @override */
  static get defaultOptions () {
    const options = {
      classes: ['dcc', 'sheet', 'actor'],
      width: 533,
      height: this.height,
      tabs: [{ navSelector: '.sheet-tabs', contentSelector: '.sheet-body', initial: 'description' }],
      dragDrop: [{ dragSelector: null, dropSelector: null }],
      resizable: true,
      scrollY: [
        '.tab.character',
        '.tab.equipment .equipment-container',
        '.tab.skills',
        '.tab.spells'
      ]
    }
    const finalOptions = foundry.utils.mergeObject(super.defaultOptions, options)
    return finalOptions
  }

  /** @inheritdoc */
  _getHeaderButtons () {
    const buttons = super._getHeaderButtons()

    // Header buttons shown only with Owner permission
    if (this.actor.permission === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER) {
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
  async getData (options) {
    // Basic data
    const isOwner = this.document.isOwner
    const data = {
      isOwner,
      limited: this.document.limited,
      options: this.options,
      editable: this.isEditable,
      cssClass: isOwner ? 'editable' : 'locked',
      isNPC: this.document.type === 'NPC',
      isPC: this.document.type === 'Player',
      isZero: this.document.system.details.level === 0,
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
    }

    // Should the Deed Roll button be available on the sheet?
    data.system.config.showAttackBonusButton = (this.actor.getAttackBonusMode() === 'manual')

    // Prepare item lists by type
    this._prepareItems(data)

    // Format Notes HTML
    data.notesHTML = await TextEditor.enrichHTML(this.actor.system.details.notes.value, {
      async: true,
      relativeTo: this.actor,
      secrets: this.actor.isOwner
    })

    // Format Corruption HTML if present
    if (this.actor.system.class?.corruption) {
      data.corruptionHTML = await TextEditor.enrichHTML(this.actor.system.class.corruption, {
        async: true,
        relativeTo: this.actor,
        secrets: this.actor.isOwner
      })
    }

    return data
  }

  /**
   * Organize and classify Items for Character sheets.
   *
   * @return {undefined}
   * @param sheetData
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
    const spells = {}
    const skills = []
    const treasure = []
    const coins = []

    let inventory = this.actor.items
    if (sheetData.system.config.sortInventory) {
      // Shallow copy and lexical sort
      inventory = [...inventory].sort((a, b) => a.name.localeCompare(b.name))
    }

    // Iterate through items, allocating to containers
    const removeEmptyItems = sheetData.system.config.removeEmptyItems
    for (let i of inventory) {
      // Remove physical items with zero quantity
      if (removeEmptyItems && i.system.quantity !== undefined && i.system.quantity <= 0) {
        this.actor.deleteEmbeddedDocuments('Item', [i._id])
        continue
      }

      // Fix the icon for items Foundry created with no icon or the mystery-man icon
      if (!i.img || i.img === 'icons/svg/mystery-man.svg') {
        i.img = EntityImages.imageForItem(i.type)
      }

      if (i.type === 'weapon') {
        if (i.system.melee) {
          weapons.melee.push(i)
        } else {
          weapons.ranged.push(i)
        }
      }
      if (i.type === 'ammunition') {
        ammunition.push(i)
      } else if (i.type === 'armor') {
        armor.push(i)
      } else if (i.type === 'equipment') {
        equipment.push(i)
      } else if (i.type === 'mount') {
        mounts.push(i)
      } else if (i.type === 'spell') {
        if (!i.system.level) {
          i.system.level = 0
        }
        if (spells[i.system.level]) {
          spells[i.system.level].push(i)
        } else {
          spells[i.system.level] = [i]
        }
      } else if (i.type === 'skill') {
        skills.push(i)
      } else if (i.type === 'treasure') {
        let treatAsCoins = false

        if (i.system.isCoins) {
          // Safe to treat as coins if the item's value is resolved
          const item = this.actor.items.get(i._id)
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
      const funds = {
        pp: parseInt(this.actor.system.currency.pp),
        ep: parseInt(this.actor.system.currency.ep),
        gp: parseInt(this.actor.system.currency.gp),
        sp: parseInt(this.actor.system.currency.sp),
        cp: parseInt(this.actor.system.currency.cp)
      }
      let needsUpdate = false
      for (let c of coins) {
        funds.pp += parseInt(c.system.value.pp)
        funds.ep += parseInt(c.system.value.ep)
        funds.gp += parseInt(c.system.value.gp)
        funds.sp += parseInt(c.system.value.sp)
        funds.cp += parseInt(c.system.value.cp)
        await this.actor.deleteEmbeddedDocuments('Item', [c._id])
        needsUpdate = true
      }
      if (needsUpdate) {
        await this.actor.update({
          'system.currency': funds
        }, { diff: true })
      }
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

    // Helper function to make things draggable
    const makeDraggable = function (index, element) {
      // Add draggable attribute and dragstart listener.
      element.setAttribute('draggable', true)
      element.addEventListener('dragstart', dragHandler, false)
    }

    // Owner Only Listeners
    if (this.actor.isOwner) {
      // Ability Checks
      html.find('.ability-box label[for*=".value"]').click(this._onRollAbilityCheck.bind(this))
      html.find('.ability-box label[data-ability="lck"][data-modifier="true"]').click(this._onRollAbilityCheck.bind(this))
      html.find('.ability-box label[for*=".value"]').each(makeDraggable)
      html.find('[data-ability="lck"] label[data-modifier="true"]').each(makeDraggable)

      // Initiative
      html.find('label[for="system.attributes.init.value"]').click(this._onRollInitiative.bind(this))
      html.find('label[for="system.attributes.init.value"]').each(makeDraggable)

      // Hit Dice
      html.find('label[for="system.attributes.hitDice.value"]').click(this._onRollHitDice.bind(this))
      html.find('label[for="system.attributes.hitDice.value"]').each(makeDraggable)

      // Saving Throws
      html.find('label[for*="system.saves"]').click(this._onRollSavingThrow.bind(this))
      html.find('label[for*="system.saves"]').each(makeDraggable)

      // Skills
      html.find('.skill-check.rollable').click(this._onRollSkillCheck.bind(this))
      html.find('label.skill-check').each(makeDraggable)

      // Luck Die
      html.find('label[for*="system.class.luckDie"]').click(this._onRollLuckDie.bind(this))
      html.find('label[for*="system.class.luckDie"]').each(makeDraggable)

      // Spell Checks
      html.find('.spell-check').click(this._onRollSpellCheck.bind(this))
      html.find('.spell-item-button').click(this._onRollSpellCheck.bind(this))
      html.find('label.spell-check').each(makeDraggable)
      html.find('.spell-draggable').each(makeDraggable)

      // Disapproval
      html.find('label[for="system.class.disapproval"]').click(this._onApplyDisapproval.bind(this))
      html.find('label[for="system.class.disapprovalTable"]').click(this._onRollDisapproval.bind(this))
      html.find('label[for="system.class.disapprovalTable"]').each(makeDraggable)
      html.find('label[for="system.class.disapproval"]').each(makeDraggable)

      // Attack Bonus
      html.find('label[for="system.details.attackBonus"]').click(this._onRollAttackBonus.bind(this))
      html.find('label[for="system.details.attackBonus"]').each(makeDraggable)

      // Action Dice
      html.find('label[for="system.attributes.actionDice.value"]').each(makeDraggable)

      // Crit Die
      html.find('label[for="system.attributes.critical.die"]').click(this._onRollCritDie.bind(this))
      html.find('label[for="system.attributes.critical.die"]').each(makeDraggable)

      // Weapons
      html.find('.weapon-button').click(this._onRollWeaponAttack.bind(this))
      html.find('.backstab-button').click(this._onRollWeaponAttack.bind(this))
      html.find('.weapon-draggable').each(makeDraggable)

      // Draggable items, including armor
      html.find('.item-draggable').each(makeDraggable)

      // Melee/Missile Attack/Damage Bonus Config
      if (this.object.system.config.computeMeleeAndMissileAttackAndDamage) {
        html.find('input[id*="system.details.attackHitBonus"]').click(this._onConfigureMeleeMissileBonus.bind(this))
        html.find('input[id*="system.details.attackDamageBonus"]').click(this._onConfigureMeleeMissileBonus.bind(this))
        html.find('label[for*="system.details.attackHitBonus"]').click(this._onRollMeleeMissileBonus.bind(this))
        html.find('label[for*="system.details.attackDamageBonus"]').click(this._onRollMeleeMissileBonus.bind(this))
      }

      // Only for editable sheets
      if (this.options.editable) {
        // Add Inventory Item
        html.find('.item-create').click(this._onItemCreate.bind(this))

        // Update Inventory Item
        html.find('.item-edit').click(ev => {
          const itemId = this._findDataset(ev.currentTarget, 'itemId')
          const item = this.actor.items.get(itemId)
          item.sheet.render(true)
        })

        // Delete Inventory Item
        html.find('.item-delete').click(ev => {
          this._onDeleteItem(ev)
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
   * Display melee/missile bonus configuration settings
   * @param {Event} event   The originating click event
   * @private
   */
  _onConfigureMeleeMissileBonus (event) {
    event.preventDefault()
    new MeleeMissileBonusConfig(this.actor, {
      top: this.position.top + 40,
      left: this.position.left + (this.position.width - 400) / 2
    }).render(true)
  }

  /**
   * Display melee/missile bonus configuration settings
   * @param {Event} event   The originating click event
   * @private
   */
  _onRollMeleeMissileBonus (event) {
    event.preventDefault()
    console.log('on melee missile bonus')
  }

  /** Prompt to delete an item
   * @param {Event}  event   The originating click event
   * @private
   */
  _onDeleteItem (event) {
    event.preventDefault()
    if (game.settings.get('dcc', 'promptForItemDeletion')) {
      new Dialog({
        title: game.i18n.localize('DCC.DeleteItem'),
        content: `<p>${game.i18n.localize('DCC.DeleteItemExplain')}</p>`,
        buttons: {
          yes: {
            icon: '<i class="fas fa-check"></i>',
            label: game.i18n.localize('DCC.Yes'),
            callback: () => this._deleteItem(event)
          },
          no: {
            icon: '<i class="fas fa-times"></i>',
            label: game.i18n.localize('DCC.No')
          }
        }
      }).render(true)
    } else {
      this._deleteItem(event)
    }
  }

  /**
   * Delete an item
   * @param {Event}  event   The originating click event
   * @private
   */
  _deleteItem (event) {
    const itemId = this._findDataset(event.currentTarget, 'itemId')
    this.actor.deleteEmbeddedDocuments('Item', [itemId])
  }

  /**
   * Search the object and then its parent elements for a dataset attribute
   * @param {Object} element    The starting element
   * @param {String} attribute  The name of the dataset attribute
   */
  _findDataset (element, attribute) {
    while (element && !(attribute in element.dataset)) {
      element = element.parentElement
    }
    if (attribute in element.dataset) {
      return element.dataset[attribute]
    }
    return null
  }

  /**
   * Create a macro when a rollable element is dragged
   * @param {Event} event
   * @override */
  _onDragStart (event) {
    let dragData = null

    // Handle the various draggable elements on the sheet
    const classes = event.target.classList
    const labelFor = event.currentTarget.getAttribute('for') || ''
    if (classes.contains('ability-name') ||
      event.target.tagName === 'LABEL' && labelFor.includes('.value')
    ) {
      // Normal ability rolls and DCC d20 roll under luck rolls
      const abilityId = this._findDataset(event.currentTarget, 'ability')
      const rollUnder = (abilityId === 'lck')
      dragData = {
        type: 'Ability',
        actorId: this.actor.id,
        data: {
          abilityId,
          rollUnder
        }
      }
    }

    if (event.currentTarget.getAttribute('data-modifier') === 'true' || classes.contains('ability-modifiers')) {
      // Force d20 + Mod roll over (for non-standard luck rolls) by dragging the modifier
      const abilityId = this._findDataset(event.currentTarget, 'ability')
      if (abilityId) {
        dragData = {
          type: 'Ability',
          actorId: this.actor.id,
          data: {
            abilityId,
            rollUnder: false
          }
        }
      }
    }

    if (classes.contains('init') || labelFor === 'system.attributes.init.value') {
      dragData = {
        type: 'Initiative',
        actorId: this.actor.id,
        data: {}
      }
    }

    if (classes.contains('hd') || labelFor === 'system.attributes.hd.value') {
      dragData = {
        type: 'Hit Dice',
        actorId: this.actor.id,
        data: {
          dice: this.actor.system.attributes.hitDice.value
        }
      }
    }

    if (classes.contains('save') || labelFor.includes('system.saves')) {
      dragData = {
        type: 'Save',
        actorId: this.actor.id,
        data: this._findDataset(event.currentTarget, 'save')
      }
    }

    if (classes.contains('skill-check')) {
      const skillId = this._findDataset(event.currentTarget, 'skill')
      const actorSkill = this.actor.system.skills[skillId]
      const skillName = actorSkill ? actorSkill.label : skillId
      dragData = {
        type: 'Skill',
        actorId: this.actor.id,
        data: {
          skillId,
          skillName
        }
      }
    }

    if (classes.contains('luck-die')) {
      dragData = {
        type: 'Luck Die',
        actorId: this.actor.id,
        data: {
          die: this.actor.system.class.luckDie
        }
      }
    }

    if (classes.contains('spell-check')) {
      dragData = {
        type: 'Spell Check',
        actorId: this.actor.id,
        data: {
          ability: this._findDataset(event.currentTarget, 'ability')
        }
      }
    }

    if (classes.contains('spell-draggable')) {
      const spell = this._findDataset(event.currentTarget, 'spell')
      const spellItem = this.actor.items.find(i => i.name === spell)
      let img
      if (spellItem) {
        img = spellItem.img
      }
      dragData = {
        type: 'Item',
        dccType: 'Spell Check',
        actorId: this.actor.id,
        data: spellItem,
        dccData: {
          ability: this._findDataset(event.currentTarget, 'ability'),
          spell,
          img
        }
      }
    }

    if (classes.contains('attack-bonus')) {
      dragData = {
        type: 'Attack Bonus',
        actorId: this.actor.id,
        data: {
          die: this.actor.system.details.attackBonus
        }
      }
    }

    if (classes.contains('action-dice')) {
      dragData = {
        type: 'Action Dice',
        actorId: this.actor.id,
        data: {
          die: this.actor.system.attributes.actionDice.value || '1d20'
        }
      }
    }

    if (classes.contains('weapon-draggable')) {
      const itemId = this._findDataset(event.currentTarget, 'itemId')
      const weapon = this.actor.items.get(itemId)
      dragData = Object.assign(
        weapon.toDragData(),
        {
          dccType: 'Weapon',
          actorId: this.actor.id,
          data: weapon,
          dccData: {
            weapon,
            slot: this._findDataset(event.currentTarget, 'itemSlot'),
            backstab: classes.contains('backstab-button')
          }
        }
      )
    }

    if (classes.contains('item-draggable')) {
      const itemId = this._findDataset(event.currentTarget, 'itemId')
      const item = this.actor.items.get(itemId)
      dragData = Object.assign(
        item.toDragData(),
        {
          dccType: 'Item',
          actorId: this.actor.id,
          data: item,
          dccData: {
            item
          }
        }
      )
    }

    if (classes.contains('disapproval-range')) {
      dragData = {
        type: 'Apply Disapproval',
        actorId: this.actor.id,
        data: {}
      }
    }

    if (classes.contains('disapproval-table')) {
      dragData = {
        type: 'Roll Disapproval',
        actorId: this.actor.id,
        data: {}
      }
    }

    if (dragData) {
      if (this.actor.isToken) dragData.tokenId = this.actor.token.id
      event.dataTransfer.setData('text/plain', JSON.stringify(dragData))
    }
  }

  /* -------------------------------------------- */

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
   * Handle rolling an Ability check
   * @param {Event} event   The originating click event
   * @private
   */
  _onRollAbilityCheck (event) {
    event.preventDefault()
    const options = this._fillRollOptions(event)

    const ability = event.currentTarget.parentElement.dataset.ability

    // Luck checks are roll under unless the user explicitly clicks the modifier
    const rollUnder = (ability === 'lck') && (event.currentTarget.className !== 'ability-modifiers')

    // Allow alternate behaviour if the modifier is clicked instead of the attribute
    const modClick = (event.currentTarget.className === 'ability-modifiers' || event.currentTarget.dataset.modifier === 'true')

    Object.assign(options, {
      modClick,
      rollUnder
    })

    this.actor.rollAbilityCheck(ability, options)
  }

  /**
   * Handle rolling Crit Die on its own
   * @param {Event} event   The originating click event
   * @private
   */
  _onRollCritDie (event) {
    event.preventDefault()
    const options = this._fillRollOptions(event)
    options.displayStandardCards = true
    this.actor.rollCritical(options)
  }

  /**
   * Handle rolling Hit Dice
   * @param {Event} event   The originating click event
   * @private
   */
  _onRollHitDice (event) {
    event.preventDefault()
    const options = this._fillRollOptions(event)
    this.actor.rollHitDice(options)
  }

  /**
   * Handle rolling Initiative
   * @param {Event} event   The originating click event
   * @private
   */
  async _onRollInitiative (event) {
    event.preventDefault()
    if (this.actor?.token?.combatant?.initiative) {
      ui.notifications.warn(game.i18n.localize('DCC.AlreadyHasInitiative'))
      return
    }
    const rollOptions = this._fillRollOptions(event)
    let formula = null
    if (rollOptions.showModifierDialog) {
      formula = await this.actor.getInitiativeRoll({ showModifierDialog: true })
    }
    const options = {
      createCombatants: true,
      initiativeOptions: {
        formula: formula
      }
    }
    this.actor.rollInitiative(options)
  }

  /**
   * Handle rolling a saving throw
   * @param {Event} event   The originating click event
   * @private
   */
  _onRollSavingThrow (event) {
    event.preventDefault()
    const options = this._fillRollOptions(event)
    const save = event.currentTarget.parentElement.dataset.save
    this.actor.rollSavingThrow(save, options)
  }

  /**
   * Handle rolling a skill check
   * @param {Event} event   The originating click event
   * @private
   */
  _onRollSkillCheck (event) {
    event.preventDefault()
    const options = this._fillRollOptions(event)
    const skill = event.currentTarget.parentElement.dataset.skill
    this.actor.rollSkillCheck(skill, options)
    this.render(false)
  }

  /**
   * Handle rolling the luck die
   * @param {Event} event   The originating click event
   * @private
   */
  _onRollLuckDie (event) {
    event.preventDefault()
    const options = this._fillRollOptions(event)
    this.actor.rollLuckDie(options)
  }

  /**
   * Handle rolling a spell check
   * @param {Event} event   The originating click event
   * @private
   */
  _onRollSpellCheck (event) {
    event.preventDefault()
    const options = this._fillRollOptions(event)
    const dataset = event.currentTarget.parentElement.dataset
    if (dataset.itemId) {
      // Roll through a spell item
      const item = this.actor.items.find(i => i.id === dataset.itemId)
      const ability = dataset.ability || ''
      item.rollSpellCheck(ability, options)
    } else {
      // Roll a raw spell check for the actor
      this.actor.rollSpellCheck(options)
    }
  }

  /**
   * Handle applying disapproval
   * @private
   */
  _onApplyDisapproval (event) {
    event.preventDefault()
    this.actor.applyDisapproval()
  }

  /**
   * Prompt and roll for disapproval
   * @private
   */
  _onRollDisapproval (event) {
    event.preventDefault()
    const options = this._fillRollOptions(event)
    this.actor.rollDisapproval(undefined, options)
  }

  /**
   * Handle rolling attack bonus
   * @param {Event} event   The originating click event
   * @private
   */
  _onRollAttackBonus (event) {
    if (this.actor.getAttackBonusMode() === 'manual') {
      event.preventDefault()
      const options = this._fillRollOptions(event)
      this.actor.rollAttackBonus(options)
      this.render(false)
    }
  }

  /**
   * Handle rolling generic melee attack
   * @param {Event} event   The originating click event
   * @private
   */
  _onRollMeleeAttack (event) {
    if (this.actor.getAttackBonusMode() === 'manual') {
      event.preventDefault()
      const options = this._fillRollOptions(event)
      this.actor.rollMeleeAttack(options)
      this.render(false)
    }
  }

  /**
   * Handle rolling generic melee attack
   * @param {Event} event   The originating click event
   * @private
   */
  _onRollRangedAttack (event) {
    if (this.actor.getAttackBonusMode() === 'manual') {
      event.preventDefault()
      const options = this._fillRollOptions(event)
      this.actor.rollRangedAttack(options)
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
    const slot = this._findDataset(event.currentTarget, 'itemId')
    const options = this._fillRollOptions(event)
    Object.assign(options, {
      backstab: event.currentTarget.classList.contains('backstab-button')
    })
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
    const system = foundry.utils.duplicate(header.dataset)
    // Initialize a default name.
    const name = `New ${type.capitalize()}`
    // Prepare the item object.
    const itemData = {
      name,
      img: EntityImages.imageForItem(type),
      type,
      system
    }
    // Remove the type from the dataset since it's in the itemData.type prop.
    delete itemData.system.type

    // Finally, create the item!
    return this.actor.createEmbeddedDocuments('Item', [itemData])
  }

  /* -------------------------------------------- */

  /** @override */
  // setPosition (options = {}) {
  //   const position = super.setPosition(options)
  //   const sheetBody = this.element.find('.sheet-body')
  //   // const bodyHeight = position.height - 192
  //   sheetBody.css('height', bodyHeight)
  //   return position
  // }

  /* -------------------------------------------- */

  /** @override */
  async _updateObject (event, formData) {
    // Handle owned item updates separately
    if (event.currentTarget) {
      let parentElement = event.currentTarget.parentElement
      const expanded = foundry.utils.expandObject(formData)
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
          const item = this.actor.items.get(itemId)
          if (item) {
            const updateData = expanded.itemUpdates[itemId]
            await item.update(updateData)
          }
        }
      }
    }

    // Update the Actor
    return this.object.update(formData)
  }
}

export default DCCActorSheet
