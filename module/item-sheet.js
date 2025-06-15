/* global Dialog, game, foundry, CONFIG */
// noinspection JSClosureCompilerSyntax

import DCCItemConfig from './item-config.js'
import EntityImages from './entity-images.js'
import { ensurePlus } from './utilities.js'
// eslint-disable-next-line no-unused-vars
const { ApplicationTabsConfiguration } = foundry.applications.types
const { HandlebarsApplicationMixin } = foundry.applications.api
const { ItemSheetV2 } = foundry.applications.sheets
const { TextEditor } = foundry.applications.ux

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
    }
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
    tabs.tabs[0] = { id: this.document.type, group: 'sheet', label: `DCC.${initCapTypeName}` }
    tabs.initial = this.document.type
    this.tabGroups[group] = this.document.type
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

  /** @override */
  activateListeners (html) {
    super.activateListeners(html)

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return

    // Make this droppable for RollTables if this is a spell
    if (this.item.type === 'spell') {
      this.form.ondragover = ev => this._onDragOver(ev)
      this.form.ondrop = ev => this._onDrop(ev)
    }

    // Owner only listeners
    if (this.item.isOwner) {
      // Roll mercurial effect for spells
      if (this.item.type === 'spell') {
        html.querySelector('.manifestation-roll').addEventListener('click', this._onRollManifestation.bind(this))
        html.querySelector('.mercurial-roll').addEventListener('click', this._onRollMercurialMagic.bind(this))
      }

      // Roll value and currency conversions for treasure
      if (this.item.type === 'treasure') {
        html.querySelector('.roll-value-button').addEventListener('click', this._onRollValue.bind(this))
        html.querySelector('.roll-value-label').addEventListener('click', this._onRollValue.bind(this))
        html.querySelector('.left-arrow-button').addEventListener('click', this._onConvertUpward.bind(this))
        html.querySelector('.right-arrow-button').addEventListener('click', this._onConvertDownward.bind(this))
      }
    }
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

    if (this.item.type === 'spell') {
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
          data: { results }
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
    new DCCItemConfig(this.item, {
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
   * Roll a new Manifestation, prompting to replace if necessary
   */
  _onRollManifestation (event) {
    event.preventDefault()
    const options = this._fillRollOptions(event)
    // Prompt if there's an existing effect, or we're using the roll modifier dialog
    if (!options.showModifierDialog && this.item.hasExistingManifestation()) {
      new Dialog({
        title: game.i18n.localize('DCC.ManifestationRerollPrompt'),
        content: `<p>${game.i18n.localize('DCC.ManifestationRerollExplain')}</p>`,
        buttons: {
          reroll: {
            icon: '<i class="fas fa-check"></i>',
            label: game.i18n.localize('DCC.ManifestationButtonReroll'),
            callback: () => this._rollManifestation(event, options)
          },
          lookup: {
            icon: '<i class="fas fa-check"></i>',
            label: game.i18n.localize('DCC.ManifestationButtonLookup'),
            callback: () => this._lookupManifestation(event, options)
          },
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: game.i18n.localize('DCC.ManifestationButtonCancel')
          }
        }
      }).render(true)
    } else {
      this._rollManifestation(event, options)
    }
  }

  /**
   * Roll a new Mercurial Magic effect, prompting to replace if necessary
   */
  _onRollMercurialMagic (event) {
    event.preventDefault()
    const options = this._fillRollOptions(event)
    // Prompt if there's an existing effect, or we're using the roll modifier dialog
    if (!options.showModifierDialog && this.item.hasExistingMercurialMagic()) {
      new Dialog({
        title: game.i18n.localize('DCC.MercurialMagicRerollPrompt'),
        content: `<p>${game.i18n.localize('DCC.MercurialMagicRerollExplain')}</p>`,
        buttons: {
          reroll: {
            icon: '<i class="fas fa-check"></i>',
            label: game.i18n.localize('DCC.MercurialMagicButtonReroll'),
            callback: () => this._rollMercurialMagic(event, options)
          },
          lookup: {
            icon: '<i class="fas fa-check"></i>',
            label: game.i18n.localize('DCC.MercurialMagicButtonLookup'),
            callback: () => this._lookupMercurialMagic()
          },
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: game.i18n.localize('DCC.MercurialMagicButtonCancel')
          }
        }
      }).render(true)
    } else {
      this._rollMercurialMagic(event, options)
    }
  }

  /**
   * Roll a new Manifestation
   * @param {Event}  event   The originating click event
   * @param options
   * @private
   */
  _rollManifestation (event, options) {
    this.item.rollManifestation(undefined, options)
    this.render(false)
  }

  /**
   * Roll a new Mercurial Magic effect
   * @param {Event}  event   The originating click event
   * @param options
   * @private
   */
  _rollMercurialMagic (event, options) {
    this.item.rollMercurialMagic(undefined, options)
    this.render(false)
  }

  /**
   * Look up a Manifestation
   * @private
   */
  _lookupManifestation () {
    this.item.rollManifestation(this.item.system.manifestation.value)
    this.render(false)
  }

  /**
   * Look up a Mercurial Magic effect
   * @private
   */
  _lookupMercurialMagic () {
    this.item.rollMercurialMagic(this.item.system.mercurialEffect.value)
    this.render(false)
  }

  /**
   * Roll the value of this item
   */
  _onRollValue (event) {
    event.preventDefault()
    this.item.rollValue()
    this.render(false)
  }

  /**
   * Convert currency upwards
   */
  _onConvertUpward (event) {
    event.preventDefault()
    this.item.convertCurrencyUpward(event.currentTarget.dataset.currency)
    this.render(false)
  }

  /**
   * Convert currency downwards
   */
  _onConvertDownward (event) {
    event.preventDefault()
    this.item.convertCurrencyDownward(event.currentTarget.dataset.currency)
    this.render(false)
  }
}

export default DCCItemSheet
