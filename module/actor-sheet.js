/* global CONFIG, CONST, game, foundry */

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
      applyDisapproval: this._applyDisapproval,
      configureActor: this._configureActor,
      configureMeleeMissileBonus: this._configureMeleeMissileBonus,
      configureSavingThrows: this._configureSavingThrows,
      decreaseQty: this._decreaseQty,
      increaseQty: this._increaseQty,
      itemCreate: this._itemCreate,
      itemEdit: this._itemEdit,
      itemDelete: this._itemDelete,
      levelChange: this._levelChange,
      openCompendium: this._openCompendium,
      rollAbilityCheck: this._rollAbilityCheck,
      rollCritDie: this._rollCritDie,
      rollDisapproval: this._rollDisapproval,
      rollHitDice: this._rollHitDice,
      rollInitiative: this._rollInitiative,
      rollLuckDie: this._rollLuckDie,
      rollSavingThrow: this._rollSavingThrow,
      'lankhmar-rollPatronDie': this._lankhmarRollPatronDie,
      rollPatronDie: this._rollPatronDie,
      rollSkillCheck: this._rollSkillCheck,
      rollSpellCheck: this._rollSpellCheck,
      rollWeaponAttack: this._rollWeaponAttack,
      effectCreate: this._effectCreate,
      effectEdit: this._effectEdit,
      effectDelete: this._effectDelete,
      effectToggle: this._effectToggle
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
          { id: 'character', group: 'sheet', label: 'DCC.Character', icon: 'fas fa-user', tooltip: 'DCC.CharacterTabHint' },
          { id: 'equipment', group: 'sheet', label: 'DCC.Equipment', icon: 'fas fa-suitcase', tooltip: 'DCC.EquipmentTabHint' }
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
          { id: 'effects', group: 'sheet', label: 'DCC.Effects', tooltip: 'DCC.Effects' },
          { id: 'notes', group: 'sheet', label: 'DCC.Notes', tooltip: 'DCC.NotesTabHint' }
        ]
    }
  }

  constructor (options = {}) {
    super(options)
    if (this.options.document.type === 'Player') {
      this.options.position.height = 640
    }

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

    const preparedItems = await this.#prepareItems()

    foundry.utils.mergeObject(context, {
      abilityEffects: this.#prepareAbilityEffects(),
      saveEffects: this.#prepareSaveEffects(),
      attributeEffects: this.#prepareAttributeEffects(),
      actor: this.options.document,
      compendiumLinks: this.#prepareCompendiumLinks(),
      config: CONFIG.DCC,
      corruptionHTML: await this.#prepareCorruption(),
      documentType: 'Actor',
      effects: this.options.document.effects,
      incomplete: {},
      img: await this.#prepareImage(),
      isOwner: this.options.document.isOwner,
      isNPC: this.options.document.type === 'NPC',
      isPC: this.options.document.type === 'Player',
      isZero: this.options.document.system.details.level.value === 0,
      items: this.options.document.items,
      notesHTML: await this.#prepareNotes(),
      parts: {},
      system: this.options.document.system,
      ...preparedItems
    })

    const lankhmarEnabled = game.settings.get('dcc', 'enableLankhmar')
    if (lankhmarEnabled) {
      context.benisonsAndDoomsHTML = await this.#prepareBenisonsAndDooms()
    }

    return context
  }

  /** @override */
  _onRender (context, options) {
    super._onRender(context, options)

    try {
      const lankhmarEnabled = game.settings.get('dcc', 'enableLankhmar')
      if (lankhmarEnabled && this.actor.type === 'Player') {
        const fundsContainer = this.element.querySelector('.item-list-currency')
        if (fundsContainer) {
          const currencyMap = {
            pp: { labelKey: 'DCC.CurrencyShortDAG', titleKey: 'DCC.CurrencyDAG' },
            gp: { labelKey: 'DCC.CurrencyShortGR', titleKey: 'DCC.CurrencyGR' },
            sp: { labelKey: 'DCC.CurrencyShortSS', titleKey: 'DCC.CurrencySS' },
            cp: { labelKey: 'DCC.CurrencyShortCP', titleKey: 'DCC.CurrencyCPenny' },
            ep: { labelKey: 'DCC.CurrencyShortBA', titleKey: 'DCC.CurrencyBA' }
          }

          let lastCurrencyElement = null

          for (const [key, currency] of Object.entries(currencyMap)) {
            const input = fundsContainer.querySelector(`input[name="system.currency.${key}"]`)
            if (input) {
              const currencyDiv = input.closest('div')
              if (currencyDiv) {
                lastCurrencyElement = currencyDiv
                const label = currencyDiv.querySelector('label')
                if (label) {
                  label.textContent = game.i18n.localize(currency.labelKey)
                  label.title = game.i18n.localize(currency.titleKey)
                }
              }
            }
          }

          // Add Iron Tiks if it doesn't exist
          if (lastCurrencyElement && !fundsContainer.querySelector('input[name="system.currency.it"]')) {
            const itHTML = `
            <div class="currency">
              <label title="${game.i18n.localize('DCC.CurrencyIT')}">${game.i18n.localize('DCC.CurrencyShortIT')}</label>
              <input type="text" name="system.currency.it" value="${this.actor.system.currency.it || 0}" data-dtype="Number"/>
            </div>`
            lastCurrencyElement.parentElement.insertAdjacentHTML('beforeend', itHTML)
          }
        }

        const sheetClass = this.actor.system.details.sheetClass

        // Common changes for Lankhmar classes
        if (['Warrior', 'Thief', 'Wizard'].includes(sheetClass)) {
          // Change Lucky Roll to Birth Augur
          const birthAugurInput = this.element.querySelector('textarea[name="system.details.birthAugur"], textarea[name="system.details.birthAugur.value"]')
          if (birthAugurInput) {
            // Ensure the input name matches the schema (String) to prevent data migration errors
            if (birthAugurInput.name === 'system.details.birthAugur.value') {
              birthAugurInput.name = 'system.details.birthAugur'
            }

            const label = birthAugurInput.closest('.form-group')?.querySelector('label')
            if (label) {
              label.textContent = game.i18n.localize('DCC.BirthAugur')
            }
          }

          // Fix Languages input name if it's using .value (which creates an object) instead of direct string
          const languagesInput = this.element.querySelector('input[name="system.details.languages.value"]')
          if (languagesInput) {
            languagesInput.name = 'system.details.languages'
          }

          // Add Patron Die section
          const savesElement = this.element.querySelector('.saves')
          if (savesElement && !this.element.querySelector('.patron-die-section')) {
            let patronHTML = `<div class="patron-die-section box-background">
              <h3 class="header">${game.i18n.localize('DCC.PatronDie')}</h3>
              <div class="header flexrow">
                <label class="flex3">${game.i18n.localize('DCC.Patron')}</label>
                <label class="flex1">${game.i18n.localize('DCC.PatronDie')}</label>
              </div>`

            const patronDieOptions = ['', '1d10', '1d12', '1d14', '1d16', '1d20', '1d24']

            for (let i = 1; i <= 5; i++) {
              const patron = this.actor.system.patrons?.[`patron${i}`] || { name: '', die: '' }
              patronHTML += `
                <div class="form-group flexrow patron-row">
                  <input class="flex3" type="text" name="system.patrons.patron${i}.name" value="${patron.name}" />
                  <select class="flex1" name="system.patrons.patron${i}.die">
                    ${patronDieOptions.map(d => `<option value="${d}" ${patron.die === d ? 'selected' : ''}>${d}</option>`).join('')}
                  </select>
                  <a class="rollable" data-action="rollPatronDie" data-patron-index="${i}"><i class="fas fa-dice-d20"></i></a>
                </div>
              `
            }

            patronHTML += '</div>'
            savesElement.insertAdjacentHTML('afterend', patronHTML)
          }
        }

        // Class-specific changes
        if (sheetClass === 'Thief') {
          const occupationInput = this.element.querySelector('input[name="system.details.occupation.value"]')
          if (occupationInput) {
            const label = occupationInput.closest('.form-group')?.querySelector('label')
            if (label) { label.textContent = game.i18n.localize('DCC.ThievingPath') }
          }
          const titleInput = this.element.querySelector('input[name="system.details.title.value"]')
          if (titleInput) {
            const label = titleInput.closest('.form-group')?.querySelector('label')
            if (label) { label.textContent = game.i18n.localize('DCC.PlaceOfOrigin') }
          }
          const titleFormGroup = titleInput?.closest('.form-group')
          if (titleFormGroup && !this.element.querySelector('input[name="system.details.neighborhood.value"]')) {
            const neighborhoodHTML = `<div class="form-group"><label>${game.i18n.localize('DCC.NeighborhoodQuarter')}</label><div class="form-fields"><input type="text" name="system.details.neighborhood.value" value="${this.actor.system.details.neighborhood?.value || ''}" /></div></div>`
            const hangoutHTML = `<div class="form-group"><label>${game.i18n.localize('DCC.Hangout')}</label><div class="form-fields"><input type="text" name="system.details.hangout.value" value="${this.actor.system.details.hangout?.value || ''}" /></div></div>`
            titleFormGroup.insertAdjacentHTML('afterend', hangoutHTML)
            titleFormGroup.insertAdjacentHTML('afterend', neighborhoodHTML)
          }
        } else if (sheetClass === 'Warrior') {
          const titleInput = this.element.querySelector('input[name="system.details.title.value"]')
          const formGroup = titleInput?.closest('.form-group')
          if (formGroup) { formGroup.remove() }

          const occupationInput = this.element.querySelector('input[name="system.details.occupation.value"]')
          const occupationFormGroup = occupationInput?.closest('.form-group')
          if (occupationFormGroup && !this.element.querySelector('input[name="system.details.neighborhood.value"]')) {
            const neighborhoodHTML = `<div class="form-group"><label>${game.i18n.localize('DCC.NeighborhoodQuarter')}</label><div class="form-fields"><input type="text" name="system.details.neighborhood.value" value="${this.actor.system.details.neighborhood?.value || ''}" /></div></div>`
            const hangoutHTML = `<div class="form-group"><label>${game.i18n.localize('DCC.Hangout')}</label><div class="form-fields"><input type="text" name="system.details.hangout.value" value="${this.actor.system.details.hangout?.value || ''}" /></div></div>`
            occupationFormGroup.insertAdjacentHTML('afterend', hangoutHTML)
            occupationFormGroup.insertAdjacentHTML('afterend', neighborhoodHTML)
          }
        } else if (sheetClass === 'Wizard') {
          const titleInput = this.element.querySelector('input[name="system.details.title.value"]')
          if (titleInput) {
            const label = titleInput.closest('.form-group')?.querySelector('label')
            if (label) { label.textContent = game.i18n.localize('DCC.SpellPath') }
          }
          const titleFormGroup = titleInput?.closest('.form-group')
          if (titleFormGroup && !this.element.querySelector('input[name="system.details.neighborhood.value"]')) {
            const neighborhoodHTML = `<div class="form-group"><label>${game.i18n.localize('DCC.NeighborhoodQuarter')}</label><div class="form-fields"><input type="text" name="system.details.neighborhood.value" value="${this.actor.system.details.neighborhood?.value || ''}" /></div></div>`
            const hangoutHTML = `<div class="form-group"><label>${game.i18n.localize('DCC.Hangout')}</label><div class="form-fields"><input type="text" name="system.details.hangout.value" value="${this.actor.system.details.hangout?.value || ''}" /></div></div>`
            titleFormGroup.insertAdjacentHTML('afterend', hangoutHTML)
            titleFormGroup.insertAdjacentHTML('afterend', neighborhoodHTML)
          }
        }
      }
    } catch (err) {
      console.error('DCC | Error in Lankhmar sheet rendering:', err)
    }

    this.#dragDrop.forEach((d) => d.bind(this.element))
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

    // Add benisons and dooms part if lankhmar is enabled
    const lankhmarEnabled = game.settings.get('dcc', 'enableLankhmar')
    if (lankhmarEnabled) {
      parts.benisonsAndDooms = {
        id: 'benisonsAndDooms',
        template: 'systems/dcc/templates/actor-partial-benisons-and-dooms.html'
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
      tabs.tabs.push({ id: 'skills', group: 'sheet', label: 'DCC.Skills', icon: 'fas fa-cogs', tooltip: 'DCC.SkillsTabHint' })
    }
    if (this.options.document?.system?.config?.showSpells && !tabs.wizardSpells) {
      tabs.tabs.push({ id: 'wizardSpells', group: 'sheet', label: 'DCC.Spells', icon: 'fas fa-hat-wizard', tooltip: 'DCC.SpellsTabHint' })
    }

    // Add end tabs (e.g. notes)
    if (this.constructor.END_TABS && this.constructor.END_TABS[group].tabs) {
      for (const tab of this.constructor.END_TABS[group].tabs) {
        tabs.tabs.push(tab)
      }
    }

    // Add Lankhmar specific tabs
    const lankhmarEnabled = game.settings.get('dcc', 'enableLankhmar')
    if (lankhmarEnabled) {
      // Find the index of the 'notes' tab
      const notesIndex = tabs.tabs.findIndex(tab => tab.id === 'notes')
      // Insert 'benisonsAndDooms' before 'notes'
      if (notesIndex !== -1) {
        tabs.tabs.splice(notesIndex, 0, { id: 'benisonsAndDooms', group: 'sheet', label: 'DCC.BenisonsAndDooms', icon: 'fas fa-balance-scale', tooltip: 'DCC.BenisonsAndDooms' })
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

    // Convert items collection to array immediately to ensure proper initialization
    let inventory = [...this.options.document.items]

    if (this.options.document.system.config.sortInventory) {
      // Lexical sort
      inventory = inventory.sort((a, b) => a.name.localeCompare(b.name))
    }

    // Iterate through items, allocating to containers
    const removeEmptyItems = this.options.document.system.config.removeEmptyItems
    for (const i of inventory) {
      // Remove physical items with zero quantity
      if (removeEmptyItems && i.system.quantity !== undefined && i.system.quantity <= 0) {
        await this.options.document.deleteEmbeddedDocuments('Item', [i._id])
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
        // Enrich HTML for spell description for tooltips
        if (i.system.description?.value) {
          i.descriptionHTML = await TextEditor.enrichHTML(i.system.description.value, {
            relativeTo: i,
            secrets: this.options.document.isOwner
          })
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
          const item = this.options.document.items.get(i._id)
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
        pp: parseInt(this.options.document.system.currency.pp),
        ep: parseInt(this.options.document.system.currency.ep),
        gp: parseInt(this.options.document.system.currency.gp),
        sp: parseInt(this.options.document.system.currency.sp),
        cp: parseInt(this.options.document.system.currency.cp)
      }
      let needsUpdate = false
      for (const c of coins) {
        funds.pp += parseInt(c.system.value.pp)
        funds.ep += parseInt(c.system.value.ep)
        funds.gp += parseInt(c.system.value.gp)
        funds.sp += parseInt(c.system.value.sp)
        funds.cp += parseInt(c.system.value.cp)
        await this.options.document.deleteEmbeddedDocuments('Item', [c._id])
        needsUpdate = true
      }
      if (needsUpdate) {
        await this.options.document.update({
          'system.currency': funds
        }, { diff: true })
      }
    }

    // Helper function to calculate total weight for an array of items
    const calculateWeight = (items) => {
      let total = 0
      for (const item of items) {
        const weight = parseFloat(item.system.weight) || 0
        const quantity = parseInt(item.system.quantity) || 1
        total += weight * quantity
      }
      return Number.isFinite(total) ? total : 0
    }

    // Calculate weights for each section
    const meleeWeight = calculateWeight(weapons.melee)
    const rangedWeight = calculateWeight(weapons.ranged)
    const armorWeight = calculateWeight(armor)
    const equipmentWeight = calculateWeight(equipment)
    const ammunitionWeight = calculateWeight(ammunition)
    const mountsWeight = calculateWeight(mounts)

    // Return the inventory object
    return {
      'equipment.ammunition': ammunition,
      'equipment.armor': armor,
      'equipment.equipment': equipment,
      'equipment.mounts': mounts,
      'equipment.treasure': treasure,
      'equipment.weapons': weapons,
      'equipment.weights': {
        melee: meleeWeight,
        ranged: rangedWeight,
        armor: armorWeight,
        equipment: equipmentWeight,
        ammunition: ammunitionWeight,
        mounts: mountsWeight,
        total: meleeWeight + rangedWeight + armorWeight + equipmentWeight + ammunitionWeight + mountsWeight
      },
      skills,
      spells
    }
  }

  /* -------------------------------------------- */

  /**
   * Prepare enriched benisons & dooms HTML for the actor.
   * @returns {string}
   */
  async #prepareBenisonsAndDooms () {
    try {
      const context = { relativeTo: this.options.document, secrets: this.options.document.isOwner }
      const benisonsAndDooms = this.actor.getFlag('dcc', 'benisonsAndDooms') || ''
      return await TextEditor.enrichHTML(benisonsAndDooms, context)
    } catch (err) {
      console.warn('DCC | Failed to prepare Benisons & Dooms HTML:', err)
      return ''
    }
  }

  /**
   * Prepare enriched notes HTML for the actor.
   * @returns {notes: string}
   */
  async #prepareNotes () {
    const context = { relativeTo: this.options.document, secrets: this.options.document.isOwner }
    return await TextEditor.enrichHTML(this.options.document.system.details.notes.value, context)
  }

  /**
   * Prepare enriched corruption HTML for the actor.
   * @returns {corruption: string}
   */
  async #prepareCorruption () {
    if (this.options.document.system.class) {
      const context = { relativeTo: this.options.document, secrets: this.options.document.isOwner }
      const corruption = this.options.document.system.class.corruption || ''
      return await TextEditor.enrichHTML(corruption, context)
    }
    return ''
  }

  #prepareImage () {
    // Default images are now set in preCreateActor hook, so this is just a fallback
    // for actors created before that hook existed
    if (!this.options.document.img || this.options.document.img === 'icons/svg/mystery-man.svg') {
      const img = EntityImages.imageForActor(this.options.document.type)
      // Only return the image for display - don't update to avoid race conditions
      // The preCreateActor hook handles setting default images for new actors
      return img
    }
    return this.options.document.img
  }

  /**
   * Collect active effects that modify ability scores
   * Returns an object keyed by ability ID with arrays of effect info
   */
  #prepareAbilityEffects () {
    const abilityEffects = {
      str: [],
      agl: [],
      sta: [],
      per: [],
      int: [],
      lck: []
    }

    const actor = this.options.document

    // Collect all active effects (from actor and transferred from items)
    const allEffects = []

    // Effects directly on actor
    for (const effect of actor.effects) {
      if (!effect.disabled && !effect.isSuppressed) {
        allEffects.push(effect)
      }
    }

    // Effects from equipped items that transfer
    for (const item of actor.items) {
      const isEquipped = item.system?.equipped ?? true
      if (isEquipped) {
        for (const effect of item.effects) {
          if (!effect.disabled && !effect.isSuppressed && effect.transfer) {
            allEffects.push(effect)
          }
        }
      }
    }

    // Check each effect for ability modifications
    for (const effect of allEffects) {
      if (!effect.changes) continue

      for (const change of effect.changes) {
        const key = change.key
        // Match patterns like system.abilities.str.value or system.abilities.str.mod
        const match = key.match(/^system\.abilities\.(\w+)\.(value|mod|max)$/)
        if (match) {
          const abilityId = match[1]
          if (abilityEffects[abilityId]) {
            // Check if this effect is already added for this ability
            const existing = abilityEffects[abilityId].find(e => e.id === effect.id)
            if (!existing) {
              abilityEffects[abilityId].push({
                id: effect.id,
                name: effect.name,
                img: effect.img || 'icons/svg/aura.svg',
                value: change.value,
                mode: change.mode
              })
            }
          }
        }
      }
    }

    return abilityEffects
  }

  /**
   * Collect active effects that modify saving throws
   * Returns an object keyed by save ID with arrays of effect info
   */
  #prepareSaveEffects () {
    const saveEffects = {
      ref: [],
      frt: [],
      wil: []
    }

    const actor = this.options.document

    // Collect all active effects (from actor and transferred from items)
    const allEffects = []

    // Effects directly on actor
    for (const effect of actor.effects) {
      if (!effect.disabled && !effect.isSuppressed) {
        allEffects.push(effect)
      }
    }

    // Effects from equipped items that transfer
    for (const item of actor.items) {
      const isEquipped = item.system?.equipped ?? true
      if (isEquipped) {
        for (const effect of item.effects) {
          if (!effect.disabled && !effect.isSuppressed && effect.transfer) {
            allEffects.push(effect)
          }
        }
      }
    }

    // Check each effect for save modifications
    for (const effect of allEffects) {
      if (!effect.changes) continue

      for (const change of effect.changes) {
        const key = change.key
        // Match patterns like system.saves.ref.otherBonus or system.saves.ref.value
        const match = key.match(/^system\.saves\.(\w+)\.(otherBonus|value)$/)
        if (match) {
          const saveId = match[1]
          if (saveEffects[saveId]) {
            // Check if this effect is already added for this save
            const existing = saveEffects[saveId].find(e => e.id === effect.id)
            if (!existing) {
              saveEffects[saveId].push({
                id: effect.id,
                name: effect.name,
                img: effect.img || 'icons/svg/aura.svg',
                value: change.value,
                mode: change.mode
              })
            }
          }
        }
      }
    }

    return saveEffects
  }

  /**
   * Collect active effects that modify AC and HP attributes
   * Returns an object with ac and hp arrays of effect info
   */
  #prepareAttributeEffects () {
    const attributeEffects = {
      ac: [],
      hp: []
    }

    const actor = this.options.document

    // Collect all active effects (from actor and transferred from items)
    const allEffects = []

    // Effects directly on actor
    for (const effect of actor.effects) {
      if (!effect.disabled && !effect.isSuppressed) {
        allEffects.push(effect)
      }
    }

    // Effects from equipped items that transfer
    for (const item of actor.items) {
      const isEquipped = item.system?.equipped ?? true
      if (isEquipped) {
        for (const effect of item.effects) {
          if (!effect.disabled && !effect.isSuppressed && effect.transfer) {
            allEffects.push(effect)
          }
        }
      }
    }

    // Check each effect for AC and HP modifications
    for (const effect of allEffects) {
      if (!effect.changes) continue

      for (const change of effect.changes) {
        const key = change.key
        // Match patterns for AC: system.attributes.ac.value, system.attributes.ac.otherMod
        if (key.match(/^system\.attributes\.ac\.(value|otherMod)$/)) {
          const existing = attributeEffects.ac.find(e => e.id === effect.id)
          if (!existing) {
            attributeEffects.ac.push({
              id: effect.id,
              name: effect.name,
              img: effect.img || 'icons/svg/aura.svg',
              value: change.value,
              mode: change.mode
            })
          }
        }
        // Match patterns for HP: system.attributes.hp.value, system.attributes.hp.max, system.attributes.hp.temp
        if (key.match(/^system\.attributes\.hp\.(value|max|temp)$/)) {
          const existing = attributeEffects.hp.find(e => e.id === effect.id)
          if (!existing) {
            attributeEffects.hp.push({
              id: effect.id,
              name: effect.name,
              img: effect.img || 'icons/svg/aura.svg',
              value: change.value,
              mode: change.mode
            })
          }
        }
      }
    }

    return attributeEffects
  }

  /**
   * Prepare compendium links for the equipment tab
   * Returns links from CONFIG.DCC if the dcc-core-book module is active
   * @returns {Object|null} Object with compendium pack names keyed by section, or null if module not active
   */
  #prepareCompendiumLinks () {
    return CONFIG.DCC.coreBookCompendiumLinks
  }

  /**
   * Search the object and then its parent elements for a dataset attribute
   @param {Object} element    The starting element
   @param {String} attribute  The name of the dataset attribute
   */
  static findDataset (element, attribute) {
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
  static async _itemCreate (event, target) {
    // Get the type of item to create.
    const type = target.dataset.type
    // Grab any data associated with this control.
    const system = foundry.utils.duplicate(target.dataset)
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
  static async _itemDelete (event, target) {
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
  static async _itemEdit (event, target) {
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
  static async _decreaseQty (event, target) {
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
  static async _increaseQty (event, target) {
    const itemId = DCCActorSheet.findDataset(target, 'itemId')
    const item = this.options.document?.items?.get(itemId)
    let qty = item.system?.quantity || 0
    qty += 1
    item.update({ 'system.quantity': qty })
  }

  /**
   * Create a new active effect
   @this {DCCActorSheet}
   @param {PointerEvent} event   The originating click event
   @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   @returns {Promise<Document[]>}
   **/
  static async _effectCreate (event, target) {
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
  static async _effectEdit (event, target) {
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
  static async _effectDelete (event, target) {
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
  static async _effectToggle (event, target) {
    const effectId = DCCActorSheet.findDataset(target, 'effectId')
    const effect = this.options.document.effects.get(effectId)
    await effect.update({ disabled: !effect.disabled })
    // Force a re-render to update the UI immediately
    this.render(false)
  }

  /**
   * Create a macro when a rollable element is dragged
   * @param {Event} event
   * @override */
  _onDragStart (event) {
    const li = event.currentTarget

    // Check if element is draggable
    if (!li.dataset.drag) return

    let dragData = null

    // Handle ActiveEffect drags
    if (li.dataset.dragType === 'ActiveEffect') {
      const effectId = li.dataset.effectId
      const effect = this.options.document.effects.get(effectId)
      if (effect) {
        dragData = {
          type: 'ActiveEffect',
          uuid: effect.uuid,
          data: effect.toObject()
        }
        event.dataTransfer.setData('text/plain', JSON.stringify(dragData))
      }
      return
    }

    // Use data-drag-action for specific drag types
    const dragAction = li.dataset.dragAction

    // Get common data
    const actorId = this.options.document.id
    const classes = event.target.classList

    switch (dragAction) {
      case 'ability': {
        const abilityId = DCCActorSheet.findDataset(event.currentTarget, 'ability')
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
            dice: this.options.document.system.attributes.hitDice.value
          }
        }
        break

      case 'save': {
        const saveId = DCCActorSheet.findDataset(event.currentTarget, 'save')
        dragData = {
          type: 'Save',
          actorId,
          data: saveId
        }
      }
        break

      case 'skill': {
        const skillId = DCCActorSheet.findDataset(event.currentTarget, 'skill')
        const actorSkill = this.options.document.system.skills[skillId]
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
            die: this.options.document.system.class.luckDie
          }
        }
        break

      case 'spellCheck': {
        const ability = DCCActorSheet.findDataset(event.currentTarget, 'ability')
        const itemId = DCCActorSheet.findDataset(event.currentTarget, 'itemId')
        const spell = DCCActorSheet.findDataset(event.currentTarget, 'spell')

        const dragDataContent = { ability }

        // If we have an itemId, include spell details for item-based macros
        if (itemId) {
          const item = this.options.document.items.get(itemId)
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
            die: this.options.document.system.details.attackBonus
          }
        }
        break

      case 'actionDice':
        dragData = {
          type: 'Action Dice',
          actorId,
          data: {
            die: this.options.document.system.attributes.actionDice.value || '1d20'
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
        const itemId = DCCActorSheet.findDataset(event.currentTarget, 'itemId')
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
        const itemId = DCCActorSheet.findDataset(event.currentTarget, 'itemId')
        const item = this.options.document.items.get(itemId)
        if (item) {
          // Use 'DCC Item' for spells to prevent Foundry's default macro creation
          // Use 'Item' for other items to maintain normal drag/drop functionality
          const dragType = item.type === 'spell' ? 'DCC Item' : 'Item'

          dragData = {
            type: dragType,
            actorId,
            uuid: item.uuid,
            data: item,
            system: {
              item
            }
          }
        }
      }
        break
    }

    if (dragData) {
      if (this.options.document.isToken) dragData.tokenId = this.options.document.token.id
      event.dataTransfer.setData('text/plain', JSON.stringify(dragData))
    }
  }

  /**
   * Display sheet specific configuration settings
   * @this {DCCActorSheet}
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static async _configureActor (event) {
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
  static async _configureMeleeMissileBonus (event, target) {
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
  static async _configureSavingThrows (event, target) {
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
  static async _levelChange (event, target) {
    this.options.document.levelChange()
  }

  /**
   * Open a compendium pack from the equipment tab
   * @this {DCCActorSheet}
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @returns {Promise<void>}
   */
  static async _openCompendium (event, target) {
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
  static async _rollAbilityCheck (event, target) {
    const options = DCCActorSheet.fillRollOptions(event)

    const ability = target.parentElement.dataset.ability

    // Luck checks are roll under unless the user explicitly clicks the modifier
    const rollUnder = (ability === 'lck') && (target.htmlFor !== 'system.abilities.lck.mod')

    Object.assign(options, {
      rollUnder
    })

    this.options.document.rollAbilityCheck(ability, options)
  }

  /**
   * Handle rolling Crit Die on its own
   * @this {DCCActorSheet}
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @returns {Promise<void>}
   */
  static async _rollCritDie (event, target) {
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
  static async _rollHitDice (event, target) {
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
  static async _rollInitiative (event, target) {
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
  static async _rollSavingThrow (event, target) {
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
  static async _rollSkillCheck (event, target) {
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
  static async _rollLuckDie (event, target) {
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
  static async _rollSpellCheck (event, target) {
    const options = DCCActorSheet.fillRollOptions(event)
    const dataset = target.parentElement.dataset
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
  static async _applyDisapproval (event, target) {
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
  static async _rollDisapproval (event, target) {
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
  static async _rollWeaponAttack (event, target) {
    event.preventDefault()
    const itemId = DCCActorSheet.findDataset(target, 'itemId')
    const options = DCCActorSheet.fillRollOptions(event)
    Object.assign(options, {
      backstab: target.classList.contains('backstab-button')
    })
    this.options.document.rollWeaponAttack(itemId, options)
  }

  /**
   * Handle rolling a Patron Die
   * @this {DCCActorSheet}
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @returns {Promise<void>}
   */
  static async _rollPatronDie (event, target) {
    const options = DCCActorSheet.fillRollOptions(event)
    const patronIndex = DCCActorSheet.findDataset(target, 'patronIndex')
    if (patronIndex) {
      this.options.document.rollPatronDie(patronIndex, options)
    }
  }

  /**
   * Handle rolling of a patron die for Lankhmar characters
   * @this {DCCActorSheet}
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @private
   */
  static async _lankhmarRollPatronDie (event, target) {
    event.preventDefault()
    const dataset = target.dataset
    const die = dataset.die
    const name = dataset.name || game.i18n.localize('DCC.Patron')

    if (die) {
      const roll = new Roll(die)
      await roll.evaluate()

      // Create an inline roll that can be hovered to see the roll details
      const rollHTML = `<a class="inline-roll inline-result" data-roll="${encodeURIComponent(JSON.stringify(roll.toJSON()))}" title="${roll.formula}">${roll.total}</a>`

      // Format the chat message using a new localization string
      const content = game.i18n.format('DCC.RolledPatronDieEmote', {
        actorName: this.actor.name,
        rollHTML,
        patronName: name
      })

      // Create the chat message as an emote
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content,
        style: CONST.CHAT_MESSAGE_STYLES.EMOTE,
        sound: CONFIG.sounds.dice
      })
    } else {
      return ui.notifications.warn(game.i18n.localize('DCC.PatronDieNotSetWarning'))
    }
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
   * Handle dropping an ActiveEffect onto the actor
   * Creates a copy of the effect on the actor (does not remove from source)
   * @param {DragEvent} event - The drop event
   * @param {Object} data - The drag data containing the effect
   * @returns {Promise<ActiveEffect|boolean>}
   */
  async _onDropActiveEffect (event, data) {
    const actor = this.options.document
    if (!actor.isOwner) return false

    // Get the effect data
    const effectData = data.data
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
