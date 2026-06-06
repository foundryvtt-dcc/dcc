/* global CONFIG, document, fromUuid, game, foundry, ResizeObserver, ui */

import DCCActorConfig from './actor-config.js'
import MeleeMissileBonusConfig from './melee-missile-bonus-config.js'
import SavingThrowConfig from './saving-throw-config.js'
import EntityImages from './entity-images.js'
import { applyActiveVariantSheetTheme } from './extension-api.mjs'
import { prepareAbilityEffects, prepareAttackBonusEffects, prepareSaveEffects, prepareAttributeEffects } from './actor-sheet/effects.mjs'
import { prepareItems } from './actor-sheet/items.mjs'
import { prepareNotes, prepareCorruption, prepareImage, prepareCompendiumLinks } from './actor-sheet/presentation.mjs'
import { findDataset, buildDragStartData } from './actor-sheet/drag-drop.mjs'

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
  #dragDrop // Private field to hold dragDrop handlers

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ['dcc', 'sheet', 'actor'],
    tag: 'form',
    position: {
      width: 560,
      height: 455
    },
    actions: {
      applyDisapproval: this.#applyDisapproval,
      configureActor: this.#configureActor,
      configureMeleeMissileBonus: this.#configureMeleeMissileBonus,
      configureSavingThrows: this.#configureSavingThrows,
      decreaseQty: this.#decreaseQty,
      increaseQty: this.#increaseQty,
      itemCreate: this.#itemCreate,
      itemEdit: this.#itemEdit,
      itemDelete: this.#itemDelete,
      levelChange: this.#levelChange,
      openCompendium: this.#openCompendium,
      rollAbilityCheck: this.#rollAbilityCheck,
      rollCritDie: this.#rollCritDie,
      rollDisapproval: this.#rollDisapproval,
      rollHitDice: this.#rollHitDice,
      rollInitiative: this.#rollInitiative,
      rollLuckDie: this.#rollLuckDie,
      rollSavingThrow: this.#rollSavingThrow,
      rollSkillCheck: this.#rollSkillCheck,
      rollSpellCheck: this.#rollSpellCheck,
      rollWeaponAttack: this.#rollWeaponAttack,
      containerRemoveItem: this.#containerRemoveItem,
      containerToggle: this.#containerToggle,
      effectCreate: this.#effectCreate,
      effectEdit: this.#effectEdit,
      effectDelete: this.#effectDelete,
      effectToggle: this.#effectToggle
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
      dropSelector: '.dcc.actor'
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
    character: {
      id: 'character',
      template: 'systems/dcc/templates/actor-partial-npc-common.html'
    },
    equipment: {
      id: 'equipment',
      template: 'systems/dcc/templates/actor-partial-npc-equipment.html'
    },
    effects: {
      id: 'effects',
      template: 'systems/dcc/templates/partial-effects.html'
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
          { id: 'effects', group: 'sheet', label: 'DCC.Effects' },
          { id: 'notes', group: 'sheet', label: 'DCC.Notes' }
        ]
    }
  }

  constructor (options = {}) {
    super(options)
    this.#dragDrop = this.#createDragDropHandlers()
  }

  /**
   * Getter to ensure backward compatibility and correct actor reference for tokens
   * @returns {DCCActor}
   */
  get actor () {
    return this.options.document
  }

  /* @inheritDoc */
  async _prepareContext (options) {
    const context = await super._prepareContext(options)

    if (!this.options.classes.includes(' pc') && !this.options.classes.includes(' npc')) {
      this.options.classes.push(this.options.document.type === 'Player' ? 'pc' : 'npc')
    }

    const preparedItems = await prepareItems(this.options.document)

    const actor = this.options.document
    foundry.utils.mergeObject(context, {
      abilityEffects: prepareAbilityEffects(actor),
      attackBonusEffects: prepareAttackBonusEffects(actor),
      saveEffects: prepareSaveEffects(actor),
      attributeEffects: prepareAttributeEffects(actor),
      actor: this.options.document,
      compendiumLinks: prepareCompendiumLinks(),
      config: CONFIG.DCC,
      corruptionHTML: await prepareCorruption(actor),
      documentType: 'Actor',
      effects: this.options.document.effects,
      incomplete: {},
      img: prepareImage(actor),
      isOwner: this.options.document.isOwner,
      isNPC: this.options.document.type === 'NPC',
      isPC: this.options.document.type === 'Player',
      isZero: this.options.document.system.details.level.value === 0,
      items: this.options.document.items,
      notesHTML: await prepareNotes(actor),
      parts: {},
      system: this.options.document.system,
      ...preparedItems
    })

    return context
  }

  /** @inheritDoc */
  _onRender (context, options) {
    this.#dragDrop.forEach((d) => d.bind(this.element))
    this.#setupResponsiveTabs()
    this.#fitFixedNumericFields()
    applyActiveVariantSheetTheme(this.element)
  }

  /**
   * Annotate fixed-size numeric fields (AC, HP, saving throws) with the
   * character length of their value via a `data-len` attribute. The
   * stylesheet keys off this to shrink the font for multi-digit values so
   * they don't overflow their fixed-size container (e.g. a +12 save in the
   * small saving-throw circle). Updates live as the field is edited.
   * @private
   */
  #fitFixedNumericFields () {
    const fields = this.element.querySelectorAll('.ac-and-hp input, .saving-throw-box input')
    for (const input of fields) {
      const annotate = () => { input.dataset.len = String(input.value ?? '').length }
      annotate()
      input.addEventListener('input', annotate)
    }
  }

  /**
   * Set up responsive tabs with overflow dropdown
   * @private
   */
  #setupResponsiveTabs () {
    const nav = this.element.querySelector('.sheet-tabs.responsive-tabs')
    if (!nav) return

    const tabsContainer = nav.querySelector('.tabs-container')
    const overflowContainer = nav.querySelector('.tabs-overflow')
    const overflowButton = nav.querySelector('.tabs-overflow-button')
    const overflowMenu = nav.querySelector('.tabs-overflow-menu')

    if (!tabsContainer || !overflowContainer || !overflowMenu) return

    // Store original tab elements for reference
    const allTabs = Array.from(tabsContainer.querySelectorAll('a[data-tab]'))

    /**
     * Calculate which tabs fit and update the overflow menu
     */
    const updateOverflowTabs = () => {
      // Reset all tabs to visible
      allTabs.forEach(tab => tab.classList.remove('tab-hidden'))
      overflowMenu.innerHTML = ''

      // Get available width (container width minus overflow button width)
      const containerWidth = tabsContainer.offsetWidth
      const overflowButtonWidth = 40 // Approximate width for the overflow button

      let usedWidth = 0
      const overflowTabs = []

      // Determine which tabs fit
      for (const tab of allTabs) {
        // Temporarily show tab to measure
        tab.classList.remove('tab-hidden')
        const tabWidth = tab.offsetWidth

        if (usedWidth + tabWidth + overflowButtonWidth > containerWidth && overflowTabs.length === 0 && usedWidth > 0) {
          // This tab and all following go to overflow
          tab.classList.add('tab-hidden')
          overflowTabs.push(tab)
        } else if (overflowTabs.length > 0) {
          // Already in overflow mode
          tab.classList.add('tab-hidden')
          overflowTabs.push(tab)
        } else {
          usedWidth += tabWidth
        }
      }

      // Update overflow container visibility
      if (overflowTabs.length > 0) {
        overflowContainer.classList.add('has-overflow')

        // Populate overflow menu
        for (const tab of overflowTabs) {
          const menuItem = document.createElement('a')
          menuItem.dataset.action = 'tab'
          menuItem.dataset.group = tab.dataset.group
          menuItem.dataset.tab = tab.dataset.tab
          menuItem.dataset.tooltip = tab.dataset.tooltip
          menuItem.className = tab.className.replace('tab-hidden', '').trim()
          menuItem.textContent = tab.textContent

          // Handle click to switch tab
          menuItem.addEventListener('click', (event) => {
            event.preventDefault()
            event.stopPropagation()
            // Trigger the original tab
            tab.click()
            // Close menu
            overflowMenu.classList.remove('open')
          })

          overflowMenu.appendChild(menuItem)
        }
      } else {
        overflowContainer.classList.remove('has-overflow')
      }
    }

    // Toggle overflow menu on button click
    overflowButton?.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      overflowMenu.classList.toggle('open')
    })

    // Close menu when clicking outside
    document.addEventListener('click', (event) => {
      if (!overflowContainer.contains(event.target)) {
        overflowMenu.classList.remove('open')
      }
    })

    // Set up ResizeObserver to handle window resize
    const resizeObserver = new ResizeObserver(() => {
      updateOverflowTabs()
    })
    resizeObserver.observe(tabsContainer)

    // Initial calculation
    updateOverflowTabs()

    // Store cleanup function for when sheet is closed
    this._responsiveTabsCleanup = () => {
      resizeObserver.disconnect()
    }
  }

  /** @inheritDoc */
  _configureRenderParts (options) {
    const parts = super._configureRenderParts(options)

    // Add skills part if skills tab is enabled
    if (this.options.document?.system?.config?.showSkills && !this.constructor.CLASS_PARTS?.skills) {
      parts.skills = {
        id: 'skills',
        template: 'systems/dcc/templates/actor-partial-skills.html'
      }
    }

    // Add wizard spells part if spells are enabled
    if (this.options.document?.system?.config?.showSpells && !this.constructor.CLASS_PARTS?.wizardSpells) {
      parts.wizardSpells = {
        id: 'wizardSpells',
        template: 'systems/dcc/templates/actor-partial-wizard-spells.html'
      }
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
    if (this.options.document?.system?.config?.showSkills && !tabs.skills) {
      tabs.tabs.push({ id: 'skills', group: 'sheet', label: 'DCC.Skills' })
    }
    if (this.options.document?.system?.config?.showSpells && !tabs.wizardSpells) {
      tabs.tabs.push({ id: 'wizardSpells', group: 'sheet', label: 'DCC.Spells' })
    }

    // Add end tabs (e.g. notes)
    if (this.constructor.END_TABS && this.constructor.END_TABS[group].tabs) {
      for (const tab of this.constructor.END_TABS[group].tabs) {
        tabs.tabs.push(tab)
      }
    }

    // Validate current tab state - prevent reset to initial if current tab is valid
    const tabIds = tabs.tabs.map(tab => tab.id)
    const validInitial = tabIds.includes(tabs.initial) ? tabs.initial : tabIds[0]

    if (!this.tabGroups[group] || !tabIds.includes(this.tabGroups[group])) {
      this.tabGroups[group] = validInitial
    }

    return tabs
  }

  /* -------------------------------------------- */

  /**
   * Search the object and then its parent elements for a dataset attribute.
   * Thin static wrapper delegating to the `findDataset` free function in
   * `actor-sheet/drag-drop.mjs` — preserves the public static surface consumed
   * cross-module (`party-sheet.js`) and documented (`CLICKABLE_ITEMS.md`).
   @param {Object} element    The starting element
   @param {String} attribute  The name of the dataset attribute
   */
  static findDataset (element, attribute) {
    return findDataset(element, attribute)
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
    // Grab any data associated with this control. Spread DOMStringMap into a
    // plain object — deepClone returns non-plain objects by reference, which
    // causes SchemaField._cast to discard all values during DataModel cleaning.
    const system = { ...target.dataset }
    // Initialize a default name.
    let name = game.i18n.format('DCC.ItemNew', { type: type.capitalize() })
    if (this.options.document.type === 'NPC' && type === 'weapon') {
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
    return this.options.document.createEmbeddedDocuments('Item', [itemData])
  }

  /**
   * Open the item Delete dialog
   @this {DCCActorSheet}
   @param {PointerEvent} event   The originating click event
   @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   @returns {Promise<void>}
   **/
  static async #itemDelete (event, target) {
    const itemId = DCCActorSheet.findDataset(target, 'itemId')
    const item = this.options.document.items.get(itemId)
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
    const itemId = DCCActorSheet.findDataset(target, 'itemId')
    const item = this.options.document.items.get(itemId)
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
    const itemId = DCCActorSheet.findDataset(target, 'itemId')
    const item = this.options.document.items?.get(itemId)
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
    const itemId = DCCActorSheet.findDataset(target, 'itemId')
    const item = this.options.document?.items?.get(itemId)
    let qty = item.system?.quantity || 0
    qty += 1
    item.update({ 'system.quantity': qty })
  }

  /**
   * Remove an item from its container
   * @this {DCCActorSheet}
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   */
  static async #containerRemoveItem (event, target) {
    const itemId = DCCActorSheet.findDataset(target, 'itemId')
    const item = this.options.document.items.get(itemId)
    if (item) {
      await item.update({ 'system.container': null })
    } else {
      console.warn(`DCC | Container remove: item ${itemId} not found`)
    }
  }

  /**
   * Toggle a container's collapsed/expanded state
   * @this {DCCActorSheet}
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   */
  static async #containerToggle (event, target) {
    const containerId = DCCActorSheet.findDataset(target, 'containerId')
    const containerEl = this.element.querySelector(`.container-contents[data-container-id="${containerId}"]`)
    if (containerEl) {
      containerEl.classList.toggle('collapsed')
      const icon = target.querySelector('i')
      if (icon) {
        icon.classList.toggle('fa-chevron-down')
        icon.classList.toggle('fa-chevron-right')
      }
    }
  }

  /**
   * Create a new active effect
   @this {DCCActorSheet}
   @param {PointerEvent} event   The originating click event
   @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   @returns {Promise<Document[]>}
   **/
  static async #effectCreate (event, target) {
    const effectData = {
      name: game.i18n.localize('DCC.EffectNew'),
      label: game.i18n.localize('DCC.EffectNew'),
      img: 'icons/svg/aura.svg',
      origin: this.options.document.uuid,
      changes: [],
      disabled: false,
      duration: {},
      flags: {}
    }
    return this.options.document.createEmbeddedDocuments('ActiveEffect', [effectData])
  }

  /**
   * Edit an active effect
   @this {DCCActorSheet}
   @param {PointerEvent} event   The originating click event
   @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   @returns {Promise<void>}
   **/
  static async #effectEdit (event, target) {
    const effectId = DCCActorSheet.findDataset(target, 'effectId')
    const effect = this.options.document.effects.get(effectId)
    await effect.sheet.render({ force: true })
  }

  /**
   * Delete an active effect
   @this {DCCActorSheet}
   @param {PointerEvent} event   The originating click event
   @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   @returns {Promise<void>}
   **/
  static async #effectDelete (event, target) {
    const effectId = DCCActorSheet.findDataset(target, 'effectId')
    const effect = this.options.document.effects.get(effectId)
    await effect.deleteDialog()
  }

  /**
   * Toggle an active effect on/off
   @this {DCCActorSheet}
   @param {PointerEvent} event   The originating click event
   @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   @returns {Promise<void>}
   **/
  static async #effectToggle (event, target) {
    const effectId = DCCActorSheet.findDataset(target, 'effectId')
    const effect = this.options.document.effects.get(effectId)
    await effect.update({ disabled: !effect.disabled })
    // Force a re-render to update the UI immediately
    this.render(false)
  }

  /**
   * Create a macro when a rollable element is dragged. The `dragData` payload is
   * built by the `buildDragStartData` free function in
   * `actor-sheet/drag-drop.mjs`; this wrapper owns the only side effect (writing
   * the payload to the drag event).
   * @param {Event} event
   * @override */
  _onDragStart (event) {
    const dragData = buildDragStartData(this.options.document, event)
    if (dragData) {
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
    await new DCCActorConfig({
      document: this.options.document,
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
    await new MeleeMissileBonusConfig({
      document: this.options.document,
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
    await new SavingThrowConfig({
      document: this.options.document,
      top: this.position.top + 40,
      left: this.position.left + (this.position.width - 250) / 2
    }).render(true)
  }

  /**
   * Open level change dialog
   * @this {DCCActorSheet}
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @returns {Promise<void>}
   */
  static async #levelChange (event, target) {
    this.options.document.levelChange()
  }

  /**
   * Open a compendium pack from the equipment tab
   * @this {DCCActorSheet}
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @returns {Promise<void>}
   */
  static async #openCompendium (event, target) {
    event.preventDefault()
    const packName = target.dataset.pack
    if (!packName) return

    const pack = game.packs.get(packName)
    if (pack) {
      pack.render(true)
    }
  }

  /**
   * Fill options for a roll based on event
   * @param {Event} event   The originating click event
   */
  static fillRollOptions (event) {
    const rollModifierDefault = game.settings.get('dcc', 'showRollModifierByDefault')
    return {
      showModifierDialog: rollModifierDefault ^ (event.ctrlKey || event.metaKey),
      forceCrit: event.shiftKey
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

    await this.options.document.rollAbilityCheck(ability, options)
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
    this.options.document.rollCritical(options)
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
    this.options.document.rollHitDice(options)
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
    await this.options.document.rollInit(event, options)
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
    await this.options.document.rollSavingThrow(save, options)
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
    await this.options.document.rollSkillCheck(skill, options)
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
    this.options.document.rollLuckDie(options)
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
    // Optional label override for raw (no-item) spell checks. Lets a
    // class/module relabel the chat flavor of a class-level spell check
    // (e.g. MCC's "Mutation Check" / "Wetware Program Check") via a
    // `data-check-label` attribute on the rollable cell. Inert for item
    // casts (they already flavor with the item name).
    if (dataset.checkLabel) options.checkLabel = dataset.checkLabel
    if (dataset.itemId) {
      // Roll through a spell item
      const item = this.actor.items.find(i => i.id === dataset.itemId)
      const ability = dataset.ability || ''
      await item.rollSpellCheck(ability, options)
    } else {
      // Roll a raw spell check for the actor
      await this.options.document.rollSpellCheck(options)
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
    this.options.document.applyDisapproval()
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
    this.options.document.rollDisapproval(undefined, options)
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
    const itemId = DCCActorSheet.findDataset(target, 'itemId')
    const options = DCCActorSheet.fillRollOptions(event)
    Object.assign(options, {
      backstab: target.classList.contains('backstab-button')
    })
    await this.options.document.rollWeaponAttack(itemId, options)
  }

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

      // // Remove from the expanded object
      // delete expanded.items
      //
      // // Flatten and replace the existing formData.object properties
      // const flattened = foundry.utils.flattenObject(expanded)
      //
      // // Clear existing object and repopulate (since we can't reassign)
      // for (const key in formData.object) {
      //   delete formData.object[key]
      // }
      // Object.assign(formData.object, flattened)
    }

    // Call parent with modified formData
    return super._processFormData(event, form, formData)
  }

  /** @override */
  async _processSubmitData (event, form, formData) {
    // Remove fields overridden by active effects to prevent persisting computed values (#714)
    const overrides = this.document.overrides
    if (overrides) {
      for (const key of Object.keys(overrides)) {
        delete formData[key]
      }
    }

    // Process the actor data normally
    const result = await super._processSubmitData(event, form, formData)

    // Now handle any pending item updates
    if (this._pendingItemUpdates?.length > 0) {
      await this.options.document.updateEmbeddedDocuments('Item', this._pendingItemUpdates)
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
    return this.options.document.isOwner && this.isEditable
  }

  /**
   * Check if drag/drop is allowed
   * @param {string} selector
   * @returns {boolean}
   */
  _canDragDrop (selector) {
    return this.options.document.isOwner && this.isEditable
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

    // Handle ActiveEffect drops - create a copy on the actor
    if (data.type === 'ActiveEffect') {
      return this._onDropActiveEffect(event, data)
    }

    // Convert 'DCC Item' back to 'Item' for inventory drops
    if (data.type === 'DCC Item') {
      data.type = 'Item'
    }

    // Check if this item is being dropped onto a container
    if (data.type === 'Item' && data.uuid) {
      const containerDrop = await this._handleContainerDrop(event, data)
      if (containerDrop !== undefined) return containerDrop
    }

    // Check if this is an item being dragged from another actor
    const isItemTransfer = (data.type === 'Item') && data.actorId && (data.actorId !== this.options.document.id)

    // Store the source actor and item ID before delegating to parent
    let sourceActor = null
    let sourceItemId = null
    if (isItemTransfer) {
      sourceActor = game.actors.get(data.actorId)
      sourceItemId = data.data._id
    }

    // Handle different drop types - delegate to base class
    const result = await super._onDrop?.(event)

    // If this was an item transfer from another actor, delete it from the source
    if (isItemTransfer && sourceActor && sourceItemId && result !== false) {
      await sourceActor.deleteEmbeddedDocuments('Item', [sourceItemId])
    }

    return result
  }

  /**
   * Handle dropping an item onto a container element
   * @param {DragEvent} event
   * @param {object} data - Drag event data
   * @returns {Promise<boolean|undefined>} false if handled with error, true if handled, undefined if not a container drop
   */
  async _handleContainerDrop (event, data) {
    // Find the closest container drop target
    const containerEl = event.target.closest('[data-container-id]')
    if (!containerEl) return undefined

    const containerId = containerEl.dataset.containerId
    const container = this.options.document.items.get(containerId)
    if (!container) return undefined

    // Get the dropped item
    let item
    try {
      item = await fromUuid(data.uuid)
    } catch (err) {
      console.warn(`DCC | Failed to resolve dropped item UUID: ${data.uuid}`, err)
      return false
    }
    if (!item) return false

    // Item already on this actor — just set the container reference
    if (item.parent?.id === this.options.document.id) {
      const check = container.canContainItem(item)
      if (!check.allowed) {
        ui.notifications.warn(game.i18n.localize(check.reason))
        return false
      }
      try {
        await item.update({ 'system.container': containerId })
      } catch (err) {
        console.error(`DCC | Failed to add item "${item.name}" to container`, err)
        return false
      }
      return true
    }

    // Item from sidebar, compendium, or another actor — create on actor inside the container
    const itemData = item.toObject ? item.toObject() : data.data
    if (!itemData) return undefined
    // Validate capacity (circularity checks don't apply for items not yet on the actor)
    if (container.availableItemCapacity !== null) {
      const itemQuantity = parseInt(itemData.system?.quantity) || 1
      if (itemQuantity > container.availableItemCapacity) {
        ui.notifications.warn(game.i18n.localize('DCC.ContainerFull'))
        return false
      }
    }
    if (container.availableWeightCapacity !== null) {
      const itemWeight = (parseFloat(itemData.system?.weight) || 0) * (parseInt(itemData.system?.quantity) || 1)
      if (itemWeight > container.availableWeightCapacity) {
        ui.notifications.warn(game.i18n.localize('DCC.ContainerTooHeavy'))
        return false
      }
    }
    itemData.system = itemData.system || {}
    itemData.system.container = containerId
    try {
      await this.options.document.createEmbeddedDocuments('Item', [itemData])
    } catch (err) {
      console.error('DCC | Failed to create item in container', err)
      return false
    }
    return true
  }

  /**
   * Handle dropping an ActiveEffect onto the actor
   * Creates a copy of the effect on the actor (does not remove from source)
   * @param {DragEvent} event - The drop event
   * @param {Object} data - The drag data containing the effect
   * @returns {Promise<ActiveEffect|boolean>}
   */
  async _onDropActiveEffect (event, data) {
    const actor = this.options.document
    if (!actor.isOwner) return false

    // Get the effect - either from data.data or by resolving the UUID (for compendium drags)
    let effectData = data.data
    if (!effectData && data.uuid) {
      const effect = await fromUuid(data.uuid)
      if (!effect) return false
      effectData = effect.toObject()
    }
    if (!effectData) return false

    // Prepare the effect data for creation on the actor
    // Use foundry.utils.deepClone to preserve all effect data including module flags (e.g., aura settings)
    const createData = foundry.utils.deepClone(effectData)
    // Override specific fields for actor-based effects
    delete createData._id // Remove ID so a new one is generated
    createData.origin = actor.uuid // Set origin to this actor
    createData.transfer = false // Effects directly on actors don't transfer
    createData.img = createData.img || 'icons/svg/aura.svg'

    // Create the effect on the actor
    return actor.createEmbeddedDocuments('ActiveEffect', [createData])
  }
}

export default DCCActorSheet
