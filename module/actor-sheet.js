/* global CONFIG, game, foundry */

import DCCActorConfig from './actor-config.js'
import MeleeMissileBonusConfig from './melee-missile-bonus-config.js'
import SavingThrowConfig from './saving-throw-config.js'
import EntityImages from './entity-images.js'

const { HandlebarsApplicationMixin } = foundry.applications.api
// eslint-disable-next-line no-unused-vars
const { TextEditor, DragDrop } = foundry.applications.ux
const { ActorSheetV2 } = foundry.applications.sheets
// eslint-disable-next-line no-unused-vars
const { ApplicationTabsConfiguration } = foundry.applications.types

/**
 * Extend the basic ActorSheet
 */
class DCCActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  #dragDrop
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ['dcc', 'sheet', 'actor'],
    tag: 'form',
    position: {
      width: 555,
      height: 450
    },
    actions: {
      applyDisapproval: this.#applyDisapproval,
      configureActor: this.#configureActor,
      configureMeleeMissileBonus: this.#configureMeleeMissileBonus,
      configureSavingThrows: this.#configureSavingThrows,
      decreaseQty: this.#decreaseQty,
      editImage: this.#editImage,
      increaseQty: this.#increaseQty,
      itemCreate: this.#itemCreate,
      itemEdit: this.#itemEdit,
      itemDelete: this.#itemDelete,
      levelChange: this.#levelChange,
      rollAbilityCheck: this.#rollAbilityCheck,
      rollCritDie: this.#rollCritDie,
      rollDisapproval: this.#rollDisapproval,
      rollHitDice: this.#rollHitDice,
      rollInitiative: this.#rollInitiative,
      rollLuckDie: this.#rollLuckDie,
      rollSavingThrow: this.#rollSavingThrow,
      rollSkillCheck: this.#rollSkillCheck,
      rollSpellCheck: this.#rollSpellCheck,
      rollWeaponAttack: this.#rollWeaponAttack
    },
    form: {
      // handler: DCCActorSheet.#onSubmitForm,
      submitOnChange: true
    },
    actor: {
      type: 'Player'
    },
    dragDrop: [{
      dragSelector: '[data-drag="true"]',
      dropSelector: '.item-list, .weapon-list, .armor-list, .skill-list'
    }],
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
      template: 'systems/dcc/templates/actor-partial-npc-common.html'
    },
    equipment: {
      id: 'equipment',
      template: 'systems/dcc/templates/actor-partial-npc-equipment.html'
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

  constructor (options = {}) {
    super(options)
    this.#dragDrop = this.#createDragDropHandlers()
  }

  /* @inheritDoc */
  async _prepareContext (options) {
    const context = await super._prepareContext(options)

    if (!this.options.classes.includes(' pc') && !this.options.classes.includes(' npc')) {
      this.options.classes.push(this.document.type === 'Player' ? 'pc' : 'npc')
    }

    const preparedItems = await this.#prepareItems()

    foundry.utils.mergeObject(context, {
      actor: this.document,
      config: CONFIG.DCC,
      corruptionHTML: await this.#prepareCorruption(),
      incomplete: {},
      img: this.#prepareImage(),
      isOwner: this.document.isOwner,
      isNPC: this.document.type === 'NPC',
      isPC: this.document.type === 'Player',
      isZero: this.document.system.details.level.value === 0,
      items: this.document.items,
      notesHTML: await this.#prepareNotes(),
      parts: {},
      source: this.document.toObject(),
      system: this.document.system,
      ...preparedItems
    })

    return context
  }

  /** @inheritDoc */
  _onRender (context, options) {
    this.#dragDrop.forEach((d) => d.bind(this.element))
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
    // Initialize containers.
    const ammunition = []
    const armor = []
    const coins = []
    const equipment = []
    const mounts = []
    const spells = {}
    const skills = []
    const treasure = []
    const weapons = {
      melee: [],
      ranged: []
    }

    let inventory = this.document.items
    if (this.document.system.config.sortInventory) {
      // Shallow copy and lexical sort
      inventory = [...inventory].sort((a, b) => a.name.localeCompare(b.name))
    }

    // Iterate through items, allocating to containers
    const removeEmptyItems = this.document.system.config.removeEmptyItems
    for (const i of inventory) {
      // Remove physical items with zero quantity
      if (removeEmptyItems && i.system.quantity !== undefined && i.system.quantity <= 0) {
        await this.actor.deleteEmbeddedDocuments('Item', [i._id])
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

    // Return the inventory object
    return {
      'equipment.ammunition': ammunition,
      'equipment.armor': armor,
      'equipment.equipment': equipment,
      'equipment.mounts': mounts,
      'equipment.treasure': treasure,
      'equipment.weapons': weapons,
      skills,
      spells
    }
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
    if (this.actor.system.class) {
      const context = { relativeTo: this.document, secrets: this.document.isOwner }
      const corruption = this.actor.system.class.corruption || ''
      return await TextEditor.enrichHTML(corruption, context)
    }
    return ''
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

  /**
   * Search the object and then its parent elements for a dataset attribute
   @this {DCCActorSheet}
   @param {Object} element    The starting element
   @param {String} attribute  The name of the dataset attribute
   */
  static #findDataset (element, attribute) {
    while (element && !(attribute in element.dataset)) {
      element = element.parentElement
    }
    if (element && attribute in element.dataset) {
      return element.dataset[attribute]
    }
    return null
  }

  /**
   * Create an inline item
   @this {DCCActorSheet}
   @param {PointerEvent} event   The originating click event
   @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   @returns {Promise<Document[]>}
   **/
  static async #itemCreate (event, target) {
    // Get the type of item to create.
    const type = target.dataset.type
    // Grab any data associated with this control.
    const system = foundry.utils.duplicate(target.dataset)
    // Initialize a default name.
    let name = game.i18n.format('DCC.ItemNew', { type: type.capitalize() })
    if (this.actor.type === 'NPC' && type === 'weapon') {
      name = game.i18n.localize('DCC.NewAttack')
    }
    console.log(target.dataset.type)
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

  /**
   * Open the item Delete dialog
   @this {DCCActorSheet}
   @param {PointerEvent} event   The originating click event
   @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   @returns {Promise<void>}
   **/
  static async #itemDelete (event, target) {
    const itemId = DCCActorSheet.#findDataset(target, 'itemId')
    const item = this.actor.items.get(itemId)
    await item.deleteDialog()
  }

  /**
   * Open the item edit dialog
   @this {DCCActorSheet}
   @param {PointerEvent} event   The originating click event
   @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   @returns {Promise<void>}
   **/
  static async #itemEdit (event, target) {
    const itemId = DCCActorSheet.#findDataset(target, 'itemId')
    const item = this.document.items.get(itemId)
    await item.sheet.render({ force: true })
  }

  /**
   * Increase quantity of an item
   @this {DCCActorSheet}
   @param {PointerEvent} event   The originating click event
   @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   @returns {Promise<void>}
   **/
  static async #decreaseQty (event, target) {
    const itemId = DCCActorSheet.#findDataset(target, 'itemId')
    const item = this.actor.items?.get(itemId)
    let qty = item.system?.quantity || 0
    qty -= 1
    item.update({ 'system.quantity': qty })
  }

  /**
   * Decrease quantity of an item
   @this {DCCActorSheet}
   @param {PointerEvent} event   The originating click event
   @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   @returns {Promise<void>}
   **/
  static async #increaseQty (event, target) {
    const itemId = DCCActorSheet.#findDataset(target, 'itemId')
    const item = this.actor?.items?.get(itemId)
    let qty = item.system?.quantity || 0
    qty += 1
    item.update({ 'system.quantity': qty })
  }

  /**
   * Create a macro when a rollable element is dragged
   * @param {Event} event
   * @param {HTMLElement} target element
   * @override */
  _onDragStart (event, target) {
    const li = event.currentTarget

    // Check if element is draggable
    if (!li.dataset.drag) return

    let dragData = null

    // Use data-drag-action for specific drag types
    const dragAction = li.dataset.dragAction

    // Get common data
    const actorId = this.actor.id
    const classes = event.target.classList

    switch (dragAction) {
      case 'ability': {
        const abilityId = DCCActorSheet.#findDataset(event.currentTarget, 'ability')
        const labelFor = event.target.getAttribute('for') || ''
        const rollUnder = (labelFor === 'system.abilities.lck.value') || classes.contains('luck-roll-under')
        dragData = {
          type: 'Ability',
          actorId,
          data: {
            abilityId,
            rollUnder
          }
        }
      }
        break

      case 'initiative':
        dragData = {
          type: 'Initiative',
          actorId,
          data: {}
        }
        break

      case 'hitDice':
        dragData = {
          type: 'Hit Dice',
          actorId,
          data: {
            dice: this.actor.system.attributes.hitDice.value
          }
        }
        break

      case 'save': {
        const saveId = DCCActorSheet.#findDataset(event.currentTarget, 'save')
        dragData = {
          type: 'Save',
          actorId,
          data: saveId
        }
      }
        break

      case 'skill': {
        const skillId = DCCActorSheet.#findDataset(event.currentTarget, 'skill')
        const actorSkill = this.actor.system.skills[skillId]
        const skillName = actorSkill ? actorSkill.label : skillId
        dragData = {
          type: 'Skill',
          actorId,
          data: {
            skillId,
            skillName
          }
        }
      }
        break

      case 'luckDie':
        dragData = {
          type: 'Luck Die',
          actorId,
          data: {
            die: this.actor.system.class.luckDie
          }
        }
        break

      case 'spellCheck': {
        const ability = DCCActorSheet.#findDataset(event.currentTarget, 'ability')
        const itemId = DCCActorSheet.#findDataset(event.currentTarget, 'itemId')
        const spell = DCCActorSheet.#findDataset(event.currentTarget, 'spell')

        const dragDataContent = { ability }

        // If we have an itemId, include spell details for item-based macros
        if (itemId) {
          const item = this.actor.items.get(itemId)
          if (item) {
            dragDataContent.itemId = itemId
            dragDataContent.name = item.name
            dragDataContent.img = item.img
          }
        } else if (spell) {
          // Fallback to spell name from data attribute
          dragDataContent.name = spell
        }

        dragData = {
          type: 'Spell Check',
          actorId,
          data: dragDataContent
        }
      }
        break

      case 'attackBonus':
        dragData = {
          type: 'Attack Bonus',
          actorId,
          data: {
            die: this.actor.system.details.attackBonus
          }
        }
        break

      case 'actionDice':
        dragData = {
          type: 'Action Dice',
          actorId,
          data: {
            die: this.actor.system.attributes.actionDice.value || '1d20'
          }
        }
        break

      case 'disapprovalRange':
        dragData = {
          type: 'Apply Disapproval',
          actorId,
          data: {}
        }
        break

      case 'disapprovalTable':
        dragData = {
          type: 'Roll Disapproval',
          actorId,
          data: {}
        }
        break

      case 'weapon': {
        const itemId = DCCActorSheet.#findDataset(event.currentTarget, 'itemId')
        const weapon = this.actor.items.get(itemId)
        if (weapon) {
          dragData = Object.assign(
            weapon.toDragData(),
            {
              dccType: 'Weapon',
              actorId,
              data: weapon,
              dccData: {
                weapon,
                backstab: classes.contains('backstab-button')
              }
            }
          )
        }
      }
        break

      case 'item': {
        const itemId = DCCActorSheet.#findDataset(event.currentTarget, 'itemId')
        const item = this.actor.items.get(itemId)
        if (item) {
          // Use 'DCC Item' for spells to prevent Foundry's default macro creation
          // Use 'Item' for other items to maintain normal drag/drop functionality
          const dragType = item.type === 'spell' ? 'DCC Item' : 'Item'

          dragData = {
            type: dragType,
            actorId,
            data: item,
            system: {
              item
            }
          }
        }
      }
        break
    }

    // Handle legacy drag classes for party draggable and other elements that haven't been updated yet
    if (!dragData && classes.contains('party-draggable')) {
      const actorId = DCCActorSheet.#findDataset(event.currentTarget, 'actorId')
      const partyActor = game.actors.get(actorId)
      if (partyActor) {
        if (classes.contains('ability-label')) {
          const abilityId = DCCActorSheet.#findDataset(event.currentTarget, 'ability')
          const rollUnder = (abilityId === 'lck')
          dragData = {
            type: 'Ability',
            actorId,
            data: {
              abilityId,
              rollUnder
            }
          }
        } else if (classes.contains('save-label')) {
          const saveId = DCCActorSheet.#findDataset(event.currentTarget, 'save')
          dragData = {
            type: 'Save',
            actorId,
            data: saveId
          }
        } else if (classes.contains('weapon')) {
          const itemId = DCCActorSheet.#findDataset(event.currentTarget, 'itemId')
          const weapon = partyActor.items.get(itemId)
          dragData = Object.assign(
            weapon.toDragData(),
            {
              dccType: 'Weapon',
              actorId,
              data: weapon,
              dccData: {
                weapon,
                backstab: false
              }
            }
          )
        }
      }
    }

    if (dragData) {
      if (this.actor.isToken) dragData.tokenId = this.actor.token.id
      event.dataTransfer.setData('text/plain', JSON.stringify(dragData))
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
    new DCCActorConfig({
      document: this.actor,
      position: {
        top: this.position.top + 40,
        left: this.position.left + (this.position.width - 400) / 2
      }
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
    new MeleeMissileBonusConfig({
      document: this.actor,
      position: {
        top: this.position.top + 40,
        left: this.position.left + (this.position.width - 400) / 2
      }
    }).render(true)
  }

  /**
   * Display saving throw configuration settings
   * @this {DCCActorSheet}
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @returns {Promise<void>}
   **/
  static async #configureSavingThrows (event, target) {
    new SavingThrowConfig({
      document: this.document,
      top: this.position.top + 40,
      left: this.position.left + (this.position.width - 250) / 2
    }).render(true)
  }

  /**
   * Handle image editing
   * @this {DCCActorSheet}
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
   * Open level change dialog
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
   */
  static fillRollOptions (event) {
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
    const options = DCCActorSheet.fillRollOptions(event)

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
    const options = DCCActorSheet.fillRollOptions(event)
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
    const options = DCCActorSheet.fillRollOptions(event)
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
    const options = DCCActorSheet.fillRollOptions(event)
    await this.actor.rollInit(event, options)
  }

  /**
   * Handle rolling a saving throw
   * @this {DCCActorSheet}
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @returns {Promise<void>}
   */
  static async #rollSavingThrow (event, target) {
    event.preventDefault() // Stops the Save Config from opening because clicking label elements focus their input
    const options = DCCActorSheet.fillRollOptions(event)
    const save = target.parentElement.dataset.save
    await this.actor.rollSavingThrow(save, options)
  }

  /**
   * Handle rolling a skill check
   * @this {DCCActorSheet}
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @returns {Promise<void>}
   */
  static async #rollSkillCheck (event, target) {
    const options = DCCActorSheet.fillRollOptions(event)
    const skill = target.parentElement.dataset.skill
    await this.actor.rollSkillCheck(skill, options)
    // this.render(false)
  }

  /**
   * Handle rolling the luck die (for Thieves)
   * @this {DCCActorSheet}
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @returns {Promise<void>}
   */
  static async #rollLuckDie (event, target) {
    const options = DCCActorSheet.fillRollOptions(event)
    this.actor.rollLuckDie(options)
  }

  /**
   * Handle rolling a spell check
   @this {DCCActorSheet}
   @param {PointerEvent} event   The originating click event
   @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   @returns {Promise<void>}
   **/
  static async #rollSpellCheck (event, target) {
    const options = DCCActorSheet.fillRollOptions(event)
    const dataset = target.parentElement.dataset
    if (dataset.itemId) {
      // Roll through a spell item
      const item = this.actor.items.find(i => i.id === dataset.itemId)
      const ability = dataset.ability || ''
      await item.rollSpellCheck(ability, options)
    } else {
      // Roll a raw spell check for the actor
      await this.actor.rollSpellCheck(options)
    }
  }

  /**
   * Handle increasing disapproval
   @this {DCCActorSheet}
   @param {PointerEvent} event   The originating click event
   @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   @returns {Promise<void>}
   **/
  static async #applyDisapproval (event, target) {
    event.preventDefault()
    this.actor.applyDisapproval()
  }

  /**
   * Handle rolling on disapproval table
   @this {DCCActorSheet}
   @param {PointerEvent} event   The originating click event
   @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   @returns {Promise<void>}
   **/
  static async #rollDisapproval (event, target) {
    event.preventDefault()
    const options = DCCActorSheet.fillRollOptions(event)
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
    const itemId = DCCActorSheet.#findDataset(target, 'itemId')
    const options = DCCActorSheet.fillRollOptions(event)
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
  _processFormData (event, form, formData) {
    // Extract the raw form data object BEFORE validation strips out items
    const expanded = foundry.utils.expandObject(formData.object)

    // Handle items separately if they exist
    if (expanded.items) {
      // Store for later processing
      this._pendingItemUpdates = Object.entries(expanded.items).map(([id, itemData]) => ({
        _id: id,
        ...itemData
      }))

      // Remove from the expanded object
      delete expanded.items

      // Flatten and replace the existing formData.object properties
      const flattened = foundry.utils.flattenObject(expanded)

      // Clear existing object and repopulate (since we can't reassign)
      for (const key in formData.object) {
        delete formData.object[key]
      }
      Object.assign(formData.object, flattened)
    }

    // Call parent with modified formData
    return super._processFormData(event, form, formData)
  }

  /** @override */
  async _processSubmitData (event, form, formData) {
    // Process the actor data normally
    const result = await super._processSubmitData(event, form, formData)

    // Now handle any pending item updates
    if (this._pendingItemUpdates?.length > 0) {
      await this.document.updateEmbeddedDocuments('Item', this._pendingItemUpdates)
      delete this._pendingItemUpdates // Clean up
    }

    return result
  }

  /**
   * Create drag-and-drop workflow handlers for this Application
   * @returns {DragDrop[]} An array of DragDrop handlers
   * @private
   */
  #createDragDropHandlers () {
    return this.options.dragDrop.map((d) => {
      d.permissions = {
        dragstart: this._canDragStart.bind(this),
        drop: this._canDragDrop.bind(this)
      }
      d.callbacks = {
        dragstart: this._onDragStart.bind(this),
        dragover: this._onDragOver.bind(this),
        drop: this._onDrop.bind(this)
      }
      return new DragDrop(d)
    })
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

  /**
   * Handle drag over events
   * @param {DragEvent} event
   */
  _onDragOver (event) {
    // Optional: handle dragover events if needed
  }

  /**
   * Handle drop events
   * @param {DragEvent} event
   * @returns {Promise<boolean|void>}
   */
  async _onDrop (event) {
    const data = foundry.applications.ux.TextEditor.getDragEventData(event)
    if (!data) return false

    // Convert 'DCC Item' back to 'Item' for inventory drops
    if (data.type === 'DCC Item') {
      data.type = 'Item'
    }

    // Handle different drop types - delegate to base class
    return super._onDrop?.(event)
  }

  // Need to Make the Party Draggable Draggable
  // html.find('.party-draggable').each(makeDraggable)
}

export default DCCActorSheet
