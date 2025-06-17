/* global game, foundry, CONFIG */
// noinspection JSClosureCompilerSyntax

import DCCItemConfig from './item-config.js'
import EntityImages from './entity-images.js'
import { ensurePlus } from './utilities.js'
// eslint-disable-next-line no-unused-vars
const { ApplicationTabsConfiguration } = foundry.applications.types
const { HandlebarsApplicationMixin } = foundry.applications.api
const { ItemSheetV2 } = foundry.applications.sheets
// eslint-disable-next-line no-unused-vars
const { TextEditor, DragDrop } = foundry.applications.ux

/**
 * Extend the basic ItemSheet for DCC RPG
 */
class DCCItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ['dcc', 'sheet', 'item', 'themed', 'theme-light'],
    tabs: [{ navSelector: '.sheet-tabs', contentSelector: '.sheet-body', initial: 'main' }],
    position: {
      width: 475,
      height: 442
    },
    form: {
      submitOnChange: true
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
    },
    actions: {
      editImage: this.#editImage,
      rollManifestation: this.#rollManifestation,
      rollMercurialMagic: this.#rollMercurialMagic,
      rollValue: this.#rollValue,
      convertUpward: this.#convertUpward,
      convertDownward: this.#convertDownward
    },
    dragDrop: this.#createDragDropHandlers
  }

  /** @inheritDoc */
  static PARTS = {
    tabs: {
      id: 'tabs',
      template: 'systems/dcc/templates/item-sheet-partial-tabs.html'
    },
    body: {
      id: 'body',
      template: 'systems/dcc/templates/item-sheet-body.html'
    },
    description: {
      id: 'description',
      template: 'systems/dcc/templates/item-sheet-partial-description.html'
    }
  }

  /** @inheritDoc */
  _configureRenderParts (options) {
    const parts = super._configureRenderParts(options)

    if (this.document.type) {
      parts[this.document.type] = {
        id: this.document.type,
        template: `systems/dcc/templates/item-sheet-${this.document.type}.html`
      }
    }

    // Add spell-specific tabs
    if (this.document.type === 'spell') {
      parts.manifestation = {
        id: 'manifestation',
        template: 'systems/dcc/templates/item-sheet-spell-manifestation.html'
      }
      parts.mercurial = {
        id: 'mercurial',
        template: 'systems/dcc/templates/item-sheet-spell-mercurial.html'
      }
    }

    return parts
  }

  /**
   * Define the structure of tabs used by this sheet.
   * @type {Record<string, ApplicationTabsConfiguration>}
   */
  static TABS = {
    sheet: { // this is the group name
      tabs:
        [
          { id: 'weapon', group: 'sheet', label: 'DCC.Weapon' },
          { id: 'description', group: 'sheet', label: 'DCC.Description' }
        ],
      initial: 'equipment'
    }
  }

  /** @inheritdoc */
  _getTabsConfig (group) {
    const tabs = foundry.utils.deepClone(super._getTabsConfig(group))
    const initCapTypeName = this.document.type.charAt(0).toUpperCase() + this.document.type.slice(1)

    if (this.document.type === 'spell') {
      // Spell items have multiple tabs
      tabs.tabs = [
        { id: 'spell', group: 'sheet', label: 'DCC.Spell' },
        { id: 'manifestation', group: 'sheet', label: 'DCC.Manifestation' },
        { id: 'description', group: 'sheet', label: 'DCC.Description' }
      ]

      // Add mercurial tab only if it should be shown
      const castingMode = this.document.system.config.castingMode || 'wizard'
      const forceShowMercurialTab = this.document.system.config.showMercurialTab
      const showMercurialTab = !!this.actor && (castingMode === 'wizard' || forceShowMercurialTab)

      if (showMercurialTab) {
        tabs.tabs.splice(2, 0, { id: 'mercurial', group: 'sheet', label: 'DCC.Mercurial' })
      }

      tabs.initial = 'spell'
    } else {
      // Other item types use the standard configuration
      tabs.tabs[0] = { id: this.document.type, group: 'sheet', label: `DCC.${initCapTypeName}` }
      tabs.initial = this.document.type
    }

    // Only set the initial tab if one isn't already selected (to preserve current tab on re-render)
    if (!this.tabGroups[group]) {
      this.tabGroups[group] = tabs.initial
    }
    return tabs
  }

  /** @override */
  async _prepareContext (options) {
    const data = await super._prepareContext(options)

    if (data.document.type === 'weapon') {
      this.position.height = 663
    }

    // Lookup the localizable string for the item's type
    data.typeString = CONFIG.DCC.items[data.document.type] || 'DCC.Unknown'

    if (data.document.type === 'spell') {
      // Allow mercurial magic roll only on wizard spells owned by an actor
      const castingMode = data.document.system.config.castingMode || 'wizard'
      const forceShowMercurialTab = data.document.system.config.showMercurialTab
      data.showMercurialTab = !!this.actor && (castingMode === 'wizard' || forceShowMercurialTab)

      // Format Mercurial Effect HTML
      data.mercurialEffectHTML = await TextEditor.enrichHTML(this.document.system?.mercurialEffect?.description || '', {
        relativeTo: this.document,
        secrets: this.document.isOwner
      })

      // Format Manifestation HTML
      data.manifestationHTML = await TextEditor.enrichHTML(this.document.system?.manifestation?.description || '', {
        relativeTo: this.document,
        secrets: this.document.isOwner
      })
    }

    if (data.document.type === 'treasure') {
      // Allow rolling the item's value if it's unresolved and owned by an actor
      data.unresolved = data.document.needsValueRoll()
      data.allowResolve = data.unresolved && !!this.actor && !this.limited
      // Only allow currency conversion on items that have a resolved value
      data.allowConversions = !data.unresolved && !this.limited
    }

    // Pass through the item data in the format we expect
    data.system = data.document.system

    if (data.document.type === 'weapon' && this.actor) {
      data.system.lck = { mod: ensurePlus(this.actor.system?.abilities?.lck?.mod) || '' }
    }

    if (!data.document.img || data.document.img === 'icons/svg/mystery-man.svg') {
      data.data.img = EntityImages.imageForItem(data.document.type)
    }

    // Format Description HTML
    if (this.document.system.description) {
      data.descriptionHTML = await TextEditor.enrichHTML(this.document.system.description.value, {
        relativeTo: this.document,
        secrets: this.document.isOwner
      })
    }

    // Format Judge Description HTML
    if (this.document.system?.description?.judge) {
      data.judgeDescriptionHTML = await TextEditor.enrichHTML(this.document.system.description.judge.value, {
        relativeTo: this.document,
        secrets: this.document.isOwner
      })
    }

    data.config = CONFIG.DCC

    data.isGM = game.user.isGM
    data.editable = this.isEditable

    return data
  }

  /** @override */
  setPosition (options = {}) {
    const position = super.setPosition(options)
    const sheetBody = this.element.querySelector('.sheet-body')
    const bodyHeight = position.height - 160
    sheetBody.style.height = bodyHeight + 'px'
    return position
  }

  /**
   * Create drag-and-drop workflow handlers for this Application
   * @returns {DragDrop[]} An array of DragDrop handlers
   * @private
   */
  static #createDragDropHandlers () {
    return [{
      dropSelector: '.sheet-body',
      permissions: {
        drop: this._canDragDrop.bind(this)
      },
      callbacks: {
        drop: this._onDrop.bind(this)
      }
    }]
  }

  /**
   * Check if drag/drop is allowed
   * @param {string} selector
   * @returns {boolean}
   */
  _canDragDrop (selector) {
    // Only allow drops on spell items
    return this.document.type === 'spell' && this.isEditable
  }

  /**
   * Roll a new Manifestation
   * @this {DCCItemSheet}
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   */
  static async #rollManifestation (event, target) {
    event.preventDefault()
    if (!this.document.isOwner) return

    const options = this._fillRollOptions(event)
    // Prompt if there's an existing effect, or we're using the roll modifier dialog
    if (!options.showModifierDialog && this.document.hasExistingManifestation()) {
      foundry.applications.api.DialogV2.confirm({
        window: { title: game.i18n.localize('DCC.ManifestationRerollPrompt') },
        content: `<p>${game.i18n.localize('DCC.ManifestationRerollExplain')}</p>`,
        yes: {
          icon: 'fas fa-dice-d20',
          label: game.i18n.localize('DCC.ManifestationButtonReroll'),
          callback: () => this._rollManifestation(event, options)
        },
        no: {
          icon: 'fas fa-search',
          label: game.i18n.localize('DCC.ManifestationButtonLookup'),
          callback: () => this._lookupManifestation(event, options)
        }
      })
    } else {
      this._rollManifestation(event, options)
    }
  }

  /**
   * Roll a new Mercurial Magic effect
   * @this {DCCItemSheet}
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   */
  static async #rollMercurialMagic (event, target) {
    event.preventDefault()
    if (!this.document.isOwner) return

    const options = this._fillRollOptions(event)
    // Prompt if there's an existing effect, or we're using the roll modifier dialog
    if (!options.showModifierDialog && this.document.hasExistingMercurialMagic()) {
      foundry.applications.api.DialogV2.confirm({
        window: { title: game.i18n.localize('DCC.MercurialMagicRerollPrompt') },
        content: `<p>${game.i18n.localize('DCC.MercurialMagicRerollExplain')}</p>`,
        yes: {
          icon: 'fas fa-dice-d20',
          label: game.i18n.localize('DCC.MercurialMagicButtonReroll'),
          callback: () => this._rollMercurialMagic(event, options)
        },
        no: {
          icon: 'fas fa-search',
          label: game.i18n.localize('DCC.MercurialMagicButtonLookup'),
          callback: () => this._lookupMercurialMagic()
        }
      })
    } else {
      this._rollMercurialMagic(event, options)
    }
  }

  /**
   * Roll the value of this item
   * @this {DCCItemSheet}
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   */
  static async #rollValue (event, target) {
    event.preventDefault()
    if (!this.document.isOwner) return

    await this.document.rollValue()
    this.render(false)
  }

  /**
   * Convert currency upward
   * @this {DCCItemSheet}
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   */
  static async #convertUpward (event, target) {
    event.preventDefault()
    if (!this.document.isOwner) return

    await this.document.convertCurrencyUpward(target.dataset.currency)
    this.render(false)
  }

  /**
   * Convert currency downward
   * @this {DCCItemSheet}
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   */
  static async #convertDownward (event, target) {
    event.preventDefault()
    if (!this.document.isOwner) return

    await this.document.convertCurrencyDownward(target.dataset.currency)
    this.render(false)
  }

  /**
   * Handle editing an image
   * @this {DCCItemSheet}
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
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

  async _onDrop (event) {
    event.preventDefault()
    event.stopPropagation()

    let data
    try {
      data = JSON.parse(event.dataTransfer.getData('text/plain'))
    } catch (err) {
      return false
    }

    if (this.document.type === 'spell') {
      // Handle dropping a roll table to set the spells table
      if (data.type === 'RollTable') {
        // Expected format from the tables tab
        // {type: "RollTable", id: "y3X7GKu7qzDhUGto"}
        // Expected format from a compendium
        // {type: "RollTable", pack: "dcc-compendium.spell-tables", id: "NGsI5F12GngHsbA1"}
        const results = {
          table: data.id,
          collection: null
        }
        if (data.pack) {
          results.collection = data.pack
        }
        this.object.update({
          system: { results }
        })
      }
    }
  }

  _onDragOver (event) {
    event.preventDefault()
    return false
  }

  /** @inheritdoc */
  _getHeaderButtons () {
    const buttons = super._getHeaderButtons()

    // Header buttons shown only with Owner permissions
    if (this.options.editable) {
      if (this.object.type === 'spell' || this.object.type === 'skill') {
        buttons.unshift(
          {
            label: game.i18n.localize('DCC.ConfigureItem'),
            class: 'configure-item',
            icon: 'fas fa-code',
            onclick: ev => this._onConfigureItem(ev)
          }
        )
      }
    }

    return buttons
  }

  /**
   * Display item specific configuration settings
   * @param {Event} event   The originating click event
   * @private
   */
  _onConfigureItem (event) {
    event.preventDefault()
    new DCCItemConfig(this.document, {
      top: this.position.top + 40,
      left: this.position.left + (this.position.width - 400) / 2
    }).render(true)
  }

  /**
   * Fill options for a roll based on event
   * @param {Event} event   The originating click event
   * @private
   */
  _fillRollOptions (event) {
    const rollModifierDefault = game.settings.get('dcc', 'showRollModifierByDefault')
    return {
      showModifierDialog: rollModifierDefault ^ event.ctrlKey
    }
  }

  /**
   * Roll a new Manifestation
   * @param {Event}  event   The originating click event
   * @param options
   * @private
   */
  _rollManifestation (event, options) {
    console.log('rollManifestation')
    this.document.rollManifestation(undefined, options)
  }

  /**
   * Roll a new Mercurial Magic effect
   * @param {Event}  event   The originating click event
   * @param options
   * @private
   */
  _rollMercurialMagic (event, options) {
    console.log('rollMercurialMagic')
    this.document.rollMercurialMagic(undefined, options)
    // No need to render - the document update will trigger re-render automatically
  }

  /**
   * Roll a new Mercurial Magic effect
   * @param {Event}  event   The originating click event
   * @param options
   * @private
   */
  _fooBar (event, options) {
    console.log('fooBar')
  }

  /**
   * Look up a Manifestation
   * @private
   */
  _lookupManifestation () {
    this.document.rollManifestation(this.document.system.manifestation.value)
    // No need to render - the document update will trigger re-render automatically
  }

  /**
   * Look up a Mercurial Magic effect
   * @private
   */
  _lookupMercurialMagic () {
    console.log('lookupMercurialMagic')
    this.document.rollMercurialMagic(this.document.system.mercurialEffect.value)
    // No need to render - the document update will trigger re-render automatically
  }
}

export default DCCItemSheet
