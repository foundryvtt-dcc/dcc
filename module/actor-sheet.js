/* global CONFIG, TextEditor, game, getDocumentClass, foundry */

import DCCActorConfig from './actor-config.js'
import MeleeMissileBonusConfig from './melee-missile-bonus-config.js'
import SavingThrowConfig from './saving-throw-config.js'
import EntityImages from './entity-images.js'

const { api, sheets } = foundry.applications

/**
 * Extend the basic ActorSheet
 * @extends {ActorSheet}
 */
class DCCActorSheet extends api.HandlebarsApplicationMixin(sheets.ActorSheetV2) {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ['dcc', 'sheet', 'actor', 'themed', 'theme-light'],
    tag: 'form',
    position: {
      width: 520,
      height: 450
    },
    actions: {
      configureActor: this.#configureActor,
      configureMeleeMissileBonus: this.#configureMeleeMissileBonus,
      configureSavingThrows: this.#configureSavingThrows,
      itemCreate: this.#itemCreate,
      itemEdit: this.#itemEdit,
      itemDelete: this.#itemDelete,
      levelChange: this.#levelChange,
      rollAbilityCheck: this.#rollAbilityCheck,
      rollCritDie: this.#rollCritDie,
      rollHitDice: this.#rollHitDice,
      rollInitiative: this.#rollInitiative,
      rollSavingThrow: this.#rollSavingThrow
    },
    form: {
      submitOnChange: true
    },
    actor: {
      type: 'Player'
    },
    window: {
      resizable: true,
      controls: [
        {
          action: 'configureActor',
          icon: 'fas fa-code',
          label: 'DCC.ConfigureSheet',
          ownership: 'OWNER'
        }
      ]
    }
  }

  /** @inheritDoc */
  static PARTS = {
    tabs: {
      id: 'tabs',
      template: 'systems/dcc/templates/actor-partial-tabs.html'
    },
    body: {
      id: 'body',
      template: 'systems/dcc/templates/actor-sheet-body.html'
    },
    character: {
      id: 'character',
      template: 'systems/dcc/templates/actor-partial-pc-common.html'
    },
    equipment: {
      id: 'equipment',
      template: 'systems/dcc/templates/actor-partial-pc-equipment.html'
    },
    skills: {
      id: 'skills',
      template: 'systems/dcc/templates/actor-partial-skills.html'
    },
    wizardSpells: {
      id: 'wizardSpells',
      template: 'systems/dcc/templates/actor-partial-wizard-spells.html'
    },
    notes: {
      id: 'notes',
      template: 'systems/dcc/templates/actor-partial-pc-notes.html'
    }
  }

  /**
   * Define the structure of tabs used by this sheet.
   * @type {Record<string, ApplicationTabsConfiguration>}
   */
  static TABS = {
    sheet: { // this is the group name
      tabs:
        [
          { id: 'character', group: 'sheet', label: 'DCC.Character' },
          { id: 'equipment', group: 'sheet', label: 'DCC.Equipment' }
        ],
      initial: 'character'
    }
  }

  /**
   * Define the structure of tabs specific to a character class (should be overridden in class specific sheets).
   * @type {Record<string, ApplicationTabsConfiguration>}
   */
  static CLASS_TABS = {}

  /**
   * Define the structure of tabs to appear after the class tabs (if any). This allows for additional tabs to be added to the end of the tab list.
   * @type {Record<string, ApplicationTabsConfiguration>}
   */
  static END_TABS = {
    sheet: { // this is the group name
      tabs:
        [
          { id: 'notes', group: 'sheet', label: 'DCC.Notes' }
        ]
    }
  }

  /* @inheritDoc */
  async _prepareContext (options) {
    const context = await super._prepareContext(options)

    if (!this.options.classes.includes(' pc') && !this.options.classes.includes(' npc')) {
      this.options.classes.push(this.document.type === 'Player' ? 'pc' : 'npc')
    }

    return foundry.utils.mergeObject(context, {
      config: CONFIG.DCC,
      corruptionHTML: this.#prepareCorruption(),
      fieldDisabled: this.isEditable ? '' : 'disabled',
      incomplete: {},
      equipment: this.#prepareItems(),
      img: this.#prepareImage(),
      isEditable: this.isEditable,
      isOwner: this.document.isOwner,
      isNPC: this.document.type === 'NPC',
      isPC: this.document.type === 'Player',
      isZero: this.document.system.details.level.value === 0,
      notesHTML: await this.#prepareNotes(),
      parts: {},
      source: this.document.toObject(),
      system: this.document.system
    })
  }

  /** @inheritDoc */
  _configureRenderParts (options) {
    const parts = super._configureRenderParts(options)

    // Remove skills part if skills tab is disabled
    if (!this.document?.system?.config?.showSkills) {
      delete parts.skills
    }

    // Remove wizard spells part if spells are disabled
    if (!this.document?.system?.config?.showSpells && !this.constructor?.CLASS_PARTS?.wizardSpells) {
      delete parts.wizardSpells
    }

    // Allow subclasses to define additional parts
    for (const [key, part] of Object.entries(this.constructor.CLASS_PARTS || [])) {
      if (!part || !part.template) continue
      parts[key] = part
    }

    return parts
  }

  /** @inheritdoc */
  _getTabsConfig (group) {
    const tabs = foundry.utils.deepClone(super._getTabsConfig(group))

    // Allow subclasses to define additional tabs (they also need to define CLASS_PARTS)
    if (this.constructor.CLASS_TABS && this.constructor.CLASS_TABS[group]?.tabs) {
      for (const tab of this.constructor.CLASS_TABS[group].tabs) {
        tabs.tabs.push(tab)
      }
    }

    // Add in optional tabs
    if (this.document?.system?.config?.showSkills && !tabs.skills) {
      tabs.tabs.push({ id: 'skills', group: 'sheet', label: 'DCC.Skills' })
    }
    if (this.document?.system?.config?.showSpells && !tabs.wizardSpells) {
      tabs.tabs.push({ id: 'wizardSpells', group: 'sheet', label: 'DCC.Spells' })
    }

    // Add end tabs (e.g. notes)
    if (this.constructor.END_TABS && this.constructor.END_TABS[group].tabs) {
      for (const tab of this.constructor.END_TABS[group].tabs) {
        tabs.tabs.push(tab)
      }
    }

    return tabs
  }

  /**
   * Organize and classify Items for Character sheets.
   *
   * @return {undefined}
   */
  async #prepareItems () {
    const sheetData = this.document
    const actorData = this.document

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

    let inventory = this.document.items
    if (sheetData.system.config.sortInventory) {
      // Shallow copy and lexical sort
      inventory = [...inventory].sort((a, b) => a.name.localeCompare(b.name))
    }

    // Iterate through items, allocating to containers
    const removeEmptyItems = sheetData.system.config.removeEmptyItems
    for (const i of inventory) {
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
          const item = this.document.items.get(i._id)
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
      for (const c of coins) {
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

    return this.document.items
  }

  /* -------------------------------------------- */

  /**
   * Prepare enriched notes HTML for the actor.
   * @returns {notes: string}
   */
  async #prepareNotes () {
    const context = { relativeTo: this.document, secrets: this.document.isOwner }
    return TextEditor.enrichHTML(this.actor.system.details.notes.value, context)
  }

  /**
   * Prepare enriched corruption HTML for the actor.
   * @returns {corruption: string}
   */
  async #prepareCorruption () {
    if (this.document.system.class?.corruption) {
      const context = { relativeTo: this.document, secrets: this.document.isOwner }
      return await TextEditor.enrichHTML(this.actor.system.class.corruption, context)
    }
  }

  #prepareImage () {
    if (!this.document.img || this.document.img === 'icons/svg/mystery-man.svg') {
      this.document.img = EntityImages.imageForActor(this.document.type)
      if (!this.document.prototypeToken.texture.src || this.document.prototypeToken.texture.src === 'icons/svg/mystery-man.svg') {
        this.document.prototypeToken.texture.src = EntityImages.imageForActor(this.document.type)
      }
    }
    return this.document.img
  }

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
      html.find('.ability-box label[for*=".value"]').each(makeDraggable)
      html.find('[data-ability="lck"] label[data-modifier="true"]').each(makeDraggable)

      // Initiative
      html.find('label[for="system.attributes.init.value"]').each(makeDraggable)

      // Saving Throws
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

      // Action Dice
      html.find('label[for="system.attributes.actionDice.value"]').each(makeDraggable)

      // Crit Die
      html.find('label[for="system.attributes.critical.die"]').click(this._onRollCritDie.bind(this))

      // Quantity increase / decrease
      html.find('.qty-decrease').click(this._onDecreaseQty.bind(this))
      html.find('.qty-increase').click(this._onIncreaseQty.bind(this))

      // Weapons
      html.find('.weapon-button').click(this._onRollWeaponAttack.bind(this))
      html.find('.backstab-button').click(this._onRollWeaponAttack.bind(this))
      html.find('.weapon-draggable').each(makeDraggable)

      // Draggable items, including armor
      html.find('.item-draggable').each(makeDraggable)

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
   * @this {DCCActorSheet}
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static async #configureActor (event) {
    event.preventDefault()
    new DCCActorConfig(this.actor, {
      top: this.position.top + 40,
      left: this.position.left + (this.position.width - 400) / 2
    }).render(true)
  }

  /**
   * Display melee/missile bonus configuration settings
   * @this {DCCActorSheet}
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @returns {Promise<void>}
   **/
  static async #configureMeleeMissileBonus (event, target) {
    new MeleeMissileBonusConfig(this.actor, {
      top: this.position.top + 40,
      left: this.position.left + (this.position.width - 400) / 2
    }).render(true)
  }

  /**
   * Display saving throw configuration settings
   * @param {Event} event   The originating click event
   * @private
   */
  static async #configureSavingThrows (event) {
    new SavingThrowConfig(this.actor, {
      top: this.position.top + 40,
      left: this.position.left + (this.position.width - 250) / 2
    }).render(true)
  }

  /**
   * Get the Item document associated with an action event.
   * @param {PointerEvent} event
   * @returns {DCCItem}
   */
  async #getEventItem (event) {
    const itemId = event.target.closest('.line-item')?.dataset.itemId
    return this.actor.items.get(itemId, { strict: true })
  }

  /**
   * @this {DCCActorSheet}
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static async #itemCreate (event) {
    const cls = getDocumentClass('Item')
    await cls.createDialog({ type: 'weapon' }, { parent: this.document, pack: this.document.pack })
  }

  /**
   * @this {DCCActorSheet}
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static async #itemDelete (event) {
    const item = this.#getEventItem(event)
    await item.deleteDialog()
  }

  /**
   * @this {DCCActorSheet}
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static async #itemEdit (event) {
    const item = this.#getEventItem(event)
    await item.sheet.render({ force: true })
  }

  /** Prompt to delete an item
   * @param {Event}  event   The originating click event
   * @private
   */
  // static async #deleteItem (event) {
  //   event.preventDefault()
  //   if (game.settings.get('dcc', 'promptForItemDeletion')) {
  //     new Dialog({
  //       title: game.i18n.localize('DCC.DeleteItem'),
  //       content: `<p>${game.i18n.localize('DCC.DeleteItemExplain')}</p>`,
  //       buttons: {
  //         yes: {
  //           icon: '<i class="fas fa-check"></i>',
  //           label: game.i18n.localize('DCC.Yes'),
  //           callback: () => this._deleteItem(event)
  //         },
  //         no: {
  //           icon: '<i class="fas fa-times"></i>',
  //           label: game.i18n.localize('DCC.No')
  //         }
  //       }
  //     }).render(true)
  //   } else {
  //     this._deleteItem(event)
  //   }
  // }

  async #decreaseQty (event) {
    const itemId = this._findDataset(event.currentTarget, 'itemId')
    const item = this.actor.items.get(itemId)
    let qty = item.system?.quantity || 0
    qty -= 1
    item.update({ 'system.quantity': qty })
  }

  async #increaseQty (event) {
    const itemId = this._findDataset(event.currentTarget, 'itemId')
    const item = this.actor?.items.get(itemId)
    let qty = item.system?.quantity || 0
    qty += 1
    item.update({ 'system.quantity': qty })
  }

  /**
   * Delete an item
   * @param {Event}  event   The originating click event
   * @private
   */
  // async #deleteItem (event) {
  //   const itemId = this._findDataset(event.currentTarget, 'itemId')
  //   this.actor.deleteEmbeddedDocuments('Item', [itemId])
  // }

  /**
   * Search the object and then its parent elements for a dataset attribute
   * @param {Object} element    The starting element
   * @param {String} attribute  The name of the dataset attribute
   */
  #findDataset (element, attribute) {
    while (element && !(attribute in element.dataset)) {
      element = element.parentElement
    }
    if (element && attribute in element.dataset) {
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
    const labelFor = target.getAttribute('for') || ''

    if (classes.contains('ability-name') || (event.target.tagName === 'LABEL' && labelFor.includes('.value'))) {
      // Normal ability rolls and DCC d20 roll under luck rolls
      const rollUnder = (target.htmlFor === 'system.abilities.lck.value')
      const abilityId = this._findDataset(event.currentTarget, 'ability')
      dragData = {
        type: 'Ability',
        actorId: this.actor.id,
        data: {
          abilityId,
          rollUnder
        }
      }
    }

    if (target.htmlFor === 'system.abilities.lck.mod') {
      // Force d20 + Mod roll over (for non-standard luck rolls) by dragging the modifier
      dragData = {
        type: 'Ability',
        actorId: this.actor.id,
        data: {
          abilityId: 'lck',
          rollUnder: false
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

  /**
   * Handle changing level
   * @this {DCCActorSheet}
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @returns {Promise<void>}
   */
  static async #levelChange (event, target) {
    this.actor.levelChange()
  }

  /**
   * Fill options for a roll based on event
   * @param {Event} event   The originating click event
   * @private
   */
  #fillRollOptions (event) {
    const rollModifierDefault = game.settings.get('dcc', 'showRollModifierByDefault')
    return {
      showModifierDialog: rollModifierDefault ^ (event.ctrlKey || event.metaKey)
    }
  }

  /**
   * Handle rolling an Ability check
   * @this {DCCActorSheet}
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @returns {Promise<void>}
   */
  static async #rollAbilityCheck (event, target) {
    const options = this.#fillRollOptions(event)

    const ability = target.parentElement.dataset.ability

    // Luck checks are roll under unless the user explicitly clicks the modifier
    const rollUnder = (ability === 'lck') && (target.htmlFor !== 'system.abilities.lck.mod')

    Object.assign(options, {
      rollUnder
    })

    this.actor.rollAbilityCheck(ability, options)
  }

  /**
   * Handle rolling Crit Die on its own
   * @this {DCCActorSheet}
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @returns {Promise<void>}
   */
  static async #rollCritDie (event, target) {
    const options = this.#fillRollOptions(event)
    this.actor.rollCritical(options)
  }

  /**
   * Handle rolling Hit Dice
   * @this {DCCActorSheet}
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @returns {Promise<void>}
   */
  static async #rollHitDice (event, target) {
    const options = this.#fillRollOptions(event)
    this.actor.rollHitDice(options)
  }

  /**
   * Handle rolling Initiative
   * @this {DCCActorSheet}
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @returns {Promise<void>}
   */
  static async #rollInitiative (event, target) {
    this.actor.rollInit(event)
  }

  /**
   * Handle rolling a saving throw
   * @this {DCCActorSheet}
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @returns {Promise<void>}
   */
  static async #rollSavingThrow (event, target) {
    const options = this.#fillRollOptions(event)
    const save = target.parentElement.dataset.save
    this.actor.rollSavingThrow(save, options)
  }

  /**
   * Handle rolling a skill check
   * @this {DCCActorSheet}
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @returns {Promise<void>}
   */
  static async #rollSkillCheck (event) {
    const options = this.#fillRollOptions(event)
    const skill = target.parentElement.dataset.skill
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
    const options = this.#fillRollOptions(event)
    this.actor.rollLuckDie(options)
  }

  /**
   * Handle rolling a spell check
   * @param {Event} event   The originating click event
   * @private
   */
  _onRollSpellCheck (event) {
    event.preventDefault()
    const options = this.#fillRollOptions(event)
    const dataset = target.parentElement.dataset
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
    const options = this.#fillRollOptions(event)
    this.actor.rollDisapproval(undefined, options)
  }

  /**
   * Handle rolling a weapon attack
   * @this {DCCActorSheet}
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @returns {Promise<void>}
   */
  static async #rollWeaponAttack (event, target) {
    event.preventDefault()
    const itemId = this.#findDataset(target, 'itemId')
    const options = this.#fillRollOptions(event)
    Object.assign(options, {
      backstab: target.classList.contains('backstab-button')
    })
    this.actor.rollWeaponAttack(itemId, options)
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
    let name = game.i18n.format('DCC.ItemNew', { type: type.capitalize() })
    if (this.actor.type === 'NPC' && type === 'weapon') {
      name = game.i18n.localize('DCC.NewAttack')
    }
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
  async _updateObject (event, formData) {
    // Handle owned item updates separately
    if (event.currentTarget) {
      let parentElement = target.parentElement
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

      if (expanded.img) {
        const tokenImg = this.actor.prototypeToken.texture.src
        if (!tokenImg || tokenImg === 'icons/svg/mystery-man.svg' || tokenImg === 'systems/dcc/styles/images/actor.webp') {
          foundry.utils.mergeObject(formData, { prototypeToken: { texture: { src: expanded.img } } })
        }
      }
    }

    // Update the Actor
    return this.object.update(formData)
  }
}

export default DCCActorSheet
