/* global game, foundry */
// noinspection JSClosureCompilerSyntax

/**
 * DCC specific character sheet overrides
 */

import DCCActorSheet from './actor-sheet.js'

const { TextEditor } = foundry.applications.ux

/**
 * Extend the zero-level/NPC sheet for a Cleric
 * @extends {DCCActorSheet}
 */
class DCCActorSheetCleric extends DCCActorSheet {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    position: {
      height: 640
    }
  }

  /** @inheritDoc */
  static CLASS_PARTS = {
    character: {
      id: 'character',
      template: 'systems/dcc/templates/actor-partial-pc-common.html'
    },
    equipment: {
      id: 'equipment',
      template: 'systems/dcc/templates/actor-partial-pc-equipment.html'
    },
    clericSpells: {
      id: 'clericSpells',
      template: 'systems/dcc/templates/actor-partial-cleric-spells.html'
    },
    cleric: {
      id: 'cleric',
      template: 'systems/dcc/templates/actor-partial-cleric.html'
    }
  }

  /** @inheritDoc */
  static CLASS_TABS = {
    sheet: {
      tabs: [
        { id: 'character', group: 'sheet', label: 'DCC.Character' },
        { id: 'equipment', group: 'sheet', label: 'DCC.Equipment' },
        { id: 'cleric', group: 'sheet', label: 'DCC.Cleric' },
        { id: 'clericSpells', group: 'sheet', label: 'DCC.ClericSpells' }
      ]
    }
  }

  /** @inheritDoc */
  async _prepareContext (options) {
    const context = await super._prepareContext(options)

    // Only set class defaults on initial setup (when sheetClass doesn't match)
    if (this.options.document.system.details.sheetClass !== 'Cleric') {
      await this.options.document.update({
        'system.class.className': game.i18n.localize('DCC.Cleric'),
        'system.class.classLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.ClericClassLink')),
        'system.details.sheetClass': 'Cleric',
        'system.class.spellCheckAbility': 'per',
        'system.details.critRange': 20,
        'system.config.attackBonusMode': 'flat',
        'system.config.addClassLevelToInitiative': false,
        'system.config.showBackstab': false,
        'system.config.showSpells': false,
        'system.skills.shieldBash.useDeed': false
      })
    } else if (!this.options.document.system.class.classLink) {
      // Regenerate classLink if missing (e.g., core book wasn't installed initially)
      await this.options.document.update({
        'system.class.classLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.ClericClassLink'))
      })
    }

    return context
  }
}

/**
 * Extend the zero-level/NPC sheet for a Thief
 * @extends {DCCActorSheet}
 */
class DCCActorSheetThief extends DCCActorSheet {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    position: {
      height: 640
    }
  }

  /** @inheritDoc */
  static CLASS_PARTS = {
    character: {
      id: 'character',
      template: 'systems/dcc/templates/actor-partial-pc-common.html'
    },
    equipment: {
      id: 'equipment',
      template: 'systems/dcc/templates/actor-partial-pc-equipment.html'
    },
    thief: {
      id: 'thief',
      template: 'systems/dcc/templates/actor-partial-thief.html'
    }
  }

  /** @inheritDoc */
  static CLASS_TABS = {
    sheet: {
      tabs: [
        { id: 'character', group: 'sheet', label: 'DCC.Character' },
        { id: 'equipment', group: 'sheet', label: 'DCC.Equipment' },
        { id: 'thief', group: 'sheet', label: 'DCC.Thief' }
      ]
    }
  }

  /** @override */
  async _prepareContext (options) {
    const context = await super._prepareContext(options)

    // Only set class defaults on initial setup (when sheetClass doesn't match)
    if (this.options.document.system.details.sheetClass !== 'Thief') {
      await this.options.document.update({
        'system.class.className': game.i18n.localize('DCC.Thief'),
        'system.class.classLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.ThiefClassLink')),
        'system.details.sheetClass': 'Thief',
        'system.details.critRange': 20,
        'system.class.disapproval': 1,
        'system.config.attackBonusMode': 'flat',
        'system.config.showBackstab': true,
        'system.config.addClassLevelToInitiative': false,
        'system.class.spellCheckAbility': null,
        'system.config.showSpells': false,
        'system.skills.shieldBash.useDeed': false
      })
    } else if (!this.options.document.system.class.classLink) {
      // Regenerate classLink if missing (e.g., core book wasn't installed initially)
      await this.options.document.update({
        'system.class.classLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.ThiefClassLink'))
      })
    }

    return context
  }

  /** @override */
  _onRender (context, options) {
    super._onRender(context, options)
    const lankhmarEnabled = game.settings.get('dcc', 'enableLankhmar')
    if (lankhmarEnabled) {
      // Find the label for occupation and change its text
      const occupationInput = this.element.querySelector('input[name="system.details.occupation.value"]')
      if (occupationInput) {
        const label = occupationInput.closest('.form-group')?.querySelector('label')
        if (label) {
          label.textContent = game.i18n.localize('DCC.ThievingPath')
        }
      }
      // Find the label for title and change its text
      const titleInput = this.element.querySelector('input[name="system.details.title.value"]')
      if (titleInput) {
        const label = titleInput.closest('.form-group')?.querySelector('label')
        if (label) {
          label.textContent = game.i18n.localize('DCC.PlaceOfOrigin')
        }
      }
      // Find the label for Lucky Roll and change its text to Birth Augur
      const birthAugurInput = this.element.querySelector('textarea[name="system.details.birthAugur.value"]')
      if (birthAugurInput) {
        const label = birthAugurInput.closest('.form-group')?.querySelector('label')
        if (label) {
          label.textContent = game.i18n.localize('DCC.BirthAugur')
        }
      }

      // Find the title form group to insert after
      const titleFormGroup = titleInput?.closest('.form-group')

      if (titleFormGroup) {
        // Create Neighborhood/Quarter field
        const neighborhoodHTML = `
            <div class="form-group">
                <label>${game.i18n.localize('DCC.NeighborhoodQuarter')}</label>
                <div class="form-fields">
                    <input type="text" name="system.details.neighborhood.value" value="${this.actor.system.details.neighborhood?.value || ''}" />
                </div>
            </div>
        `
        // Create Hangout field
        const hangoutHTML = `
            <div class="form-group">
                <label>${game.i18n.localize('DCC.Hangout')}</label>
                <div class="form-fields">
                    <input type="text" name="system.details.hangout.value" value="${this.actor.system.details.hangout?.value || ''}" />
                </div>
            </div>
        `
        // Insert after title
        titleFormGroup.insertAdjacentHTML('afterend', hangoutHTML)
        titleFormGroup.insertAdjacentHTML('afterend', neighborhoodHTML)
      }

      // Add Patron Die section
      const savesElement = this.element.querySelector('.saves')
      if (savesElement) {
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
  }
}

/**
 * Extend the zero-level/NPC sheet for a Halfling
 * @extends {DCCActorSheet}
 */
class DCCActorSheetHalfling extends DCCActorSheet {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    position: {
      height: 640
    }
  }

  /**
   * Parts specific to this class
   **/
  static CLASS_PARTS = {
    character: {
      id: 'character',
      template: 'systems/dcc/templates/actor-partial-pc-common.html'
    },
    equipment: {
      id: 'equipment',
      template: 'systems/dcc/templates/actor-partial-pc-equipment.html'
    },
    halfling: {
      id: 'halfling',
      template: 'systems/dcc/templates/actor-partial-halfling.html'
    }
  }

  /**
   * Tabs specific to this class
   **/
  static CLASS_TABS = {
    sheet: {
      tabs: [
        { id: 'character', group: 'sheet', label: 'DCC.Character' },
        { id: 'equipment', group: 'sheet', label: 'DCC.Equipment' },
        { id: 'halfling', group: 'sheet', label: 'DCC.Halfling' }
      ]
    }
  }

  /** @override */
  async _prepareContext (options) {
    const context = await super._prepareContext(options)

    // Only set class defaults on initial setup (when sheetClass doesn't match)
    if (this.options.document.system.details.sheetClass !== 'Halfling') {
      await this.options.document.update({
        'system.class.className': game.i18n.localize('DCC.Halfling'),
        'system.class.classLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.HalflingClassLink')),
        'system.details.sheetClass': 'Halfling',
        'system.details.critRange': 20,
        'system.class.disapproval': 1,
        'system.config.attackBonusMode': 'flat',
        'system.config.addClassLevelToInitiative': false,
        'system.class.spellCheckAbility': null,
        'system.config.showBackstab': false,
        'system.skills.shieldBash.useDeed': false
      })
    } else if (!this.options.document.system.class.classLink) {
      // Regenerate classLink if missing (e.g., core book wasn't installed initially)
      await this.options.document.update({
        'system.class.classLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.HalflingClassLink'))
      })
    }

    return context
  }
}

/**
 * Extend the zero-level/NPC sheet for a Warrior
 * @extends {DCCActorSheet}
 */
class DCCActorSheetWarrior extends DCCActorSheet {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    position: {
      height: 640
    }
  }

  /** @inheritDoc */
  static CLASS_PARTS = {
    character: {
      id: 'character',
      template: 'systems/dcc/templates/actor-partial-pc-common.html'
    },
    equipment: {
      id: 'equipment',
      template: 'systems/dcc/templates/actor-partial-pc-equipment.html'
    },
    warrior: {
      id: 'warrior',
      template: 'systems/dcc/templates/actor-partial-warrior.html'
    }
  }

  /** @inheritDoc */
  static CLASS_TABS = {
    sheet: {
      tabs: [
        { id: 'character', group: 'sheet', label: 'DCC.Character' },
        { id: 'equipment', group: 'sheet', label: 'DCC.Equipment' },
        { id: 'warrior', group: 'sheet', label: 'DCC.Warrior' }
      ]
    }
  }

  /** @inheritDoc */
  async _prepareContext (options) {
    const context = await super._prepareContext(options)

    // Only set class defaults on initial setup (when sheetClass doesn't match)
    if (this.options.document.system.details.sheetClass !== 'Warrior') {
      await this.options.document.update({
        'system.class.className': game.i18n.localize('DCC.Warrior'),
        'system.class.classLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.WarriorClassLink')),
        'system.class.mightyDeedsLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.MightyDeedsLink')),
        'system.details.sheetClass': 'Warrior',
        'system.details.critRange': 20,
        'system.class.disapproval': 1,
        'system.config.attackBonusMode': 'autoPerAttack',
        'system.config.addClassLevelToInitiative': true,
        'system.class.spellCheckAbility': null,
        'system.config.showBackstab': false,
        'system.skills.shieldBash.useDeed': false
      })
    } else if (!this.options.document.system.class.classLink) {
      // Regenerate classLink if missing (e.g., core book wasn't installed initially)
      await this.options.document.update({
        'system.class.classLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.WarriorClassLink')),
        'system.class.mightyDeedsLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.MightyDeedsLink'))
      })
    }

    return context
  }

  /** @override */
  _onRender (context, options) {
    super._onRender(context, options)
    const lankhmarEnabled = game.settings.get('dcc', 'enableLankhmar')
    if (lankhmarEnabled) {
      // Find the title form group and remove it
      const titleInput = this.element.querySelector('input[name="system.details.title.value"]')
      const formGroup = titleInput?.closest('.form-group')
      if (formGroup) {
        formGroup.remove()
      }
      // Find the label for Lucky Roll and change its text to Birth Augur
      const birthAugurInput = this.element.querySelector('textarea[name="system.details.birthAugur.value"]')
      if (birthAugurInput) {
        const label = birthAugurInput.closest('.form-group')?.querySelector('label')
        if (label) {
          label.textContent = game.i18n.localize('DCC.BirthAugur')
        }
      }

      // Find the occupation form group to insert after
      const occupationInput = this.element.querySelector('input[name="system.details.occupation.value"]')
      const occupationFormGroup = occupationInput?.closest('.form-group')

      if (occupationFormGroup) {
        // Create Neighborhood/Quarter field
        const neighborhoodHTML = `
            <div class="form-group">
                <label>${game.i18n.localize('DCC.NeighborhoodQuarter')}</label>
                <div class="form-fields">
                    <input type="text" name="system.details.neighborhood.value" value="${this.actor.system.details.neighborhood?.value || ''}" />
                </div>
            </div>
        `
        // Create Hangout field
        const hangoutHTML = `
            <div class="form-group">
                <label>${game.i18n.localize('DCC.Hangout')}</label>
                <div class="form-fields">
                    <input type="text" name="system.details.hangout.value" value="${this.actor.system.details.hangout?.value || ''}" />
                </div>
            </div>
        `
        // Insert after occupation
        occupationFormGroup.insertAdjacentHTML('afterend', hangoutHTML)
        occupationFormGroup.insertAdjacentHTML('afterend', neighborhoodHTML)
      }

      // Add Patron Die section
      const savesElement = this.element.querySelector('.saves')
      if (savesElement) {
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
  }
}

/**
 * Extend the zero-level/NPC sheet for a Wizard
 * @extends {DCCActorSheet}
 */
class DCCActorSheetWizard extends DCCActorSheet {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    position: {
      height: 640
    }
  }

  /** @inheritDoc */
  static CLASS_PARTS = {
    character: {
      id: 'character',
      template: 'systems/dcc/templates/actor-partial-pc-common.html'
    },
    equipment: {
      id: 'equipment',
      template: 'systems/dcc/templates/actor-partial-pc-equipment.html'
    },
    wizard: {
      id: 'wizard',
      template: 'systems/dcc/templates/actor-partial-wizard.html'
    },
    wizardSpells: {
      id: 'wizardSpells',
      template: 'systems/dcc/templates/actor-partial-wizard-spells.html'
    }
  }

  /** @inheritDoc */
  static CLASS_TABS = {
    sheet: {
      tabs: [
        { id: 'character', group: 'sheet', label: 'DCC.Character' },
        { id: 'equipment', group: 'sheet', label: 'DCC.Equipment' },
        { id: 'wizard', group: 'sheet', label: 'DCC.Wizard' },
        { id: 'wizardSpells', group: 'sheet', label: 'DCC.WizardSpells' }
      ]
    }
  }

  /** @inheritDoc */
  async _prepareContext (options) {
    const context = await super._prepareContext(options)

    // Only set class defaults on initial setup (when sheetClass doesn't match)
    if (this.options.document.system.details.sheetClass !== 'Wizard') {
      await this.options.document.update({
        'system.class.className': game.i18n.localize('DCC.Wizard'),
        'system.class.classLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.WizardClassLink')),
        'system.class.spellcastingLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.SpellcastingLink')),
        'system.class.spellburnLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.SpellburnLink')),
        'system.details.sheetClass': 'Wizard',
        'system.class.spellCheckAbility': 'int',
        'system.details.critRange': 20,
        'system.class.disapproval': 1,
        'system.config.attackBonusMode': 'flat',
        'system.config.addClassLevelToInitiative': false,
        'system.config.showSpells': true,
        'system.config.showBackstab': false,
        'system.skills.shieldBash.useDeed': false
      })
    } else if (!this.options.document.system.class.classLink) {
      // Regenerate classLink if missing (e.g., core book wasn't installed initially)
      await this.options.document.update({
        'system.class.classLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.WizardClassLink')),
        'system.class.spellcastingLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.SpellcastingLink')),
        'system.class.spellburnLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.SpellburnLink'))
      })
    }

    return context
  }

  /** @override */
  _onRender (context, options) {
    super._onRender(context, options)
    const lankhmarEnabled = game.settings.get('dcc', 'enableLankhmar')
    if (lankhmarEnabled) {
      // Find the label for title and change its text
      const titleInput = this.element.querySelector('input[name="system.details.title.value"]')
      const label = titleInput?.closest('.form-group')?.querySelector('label')
      if (label) {
        label.textContent = game.i18n.localize('DCC.SpellPath')
      }
      // Find the label for Lucky Roll and change its text to Birth Augur
      const birthAugurInput = this.element.querySelector('textarea[name="system.details.birthAugur.value"]')
      if (birthAugurInput) {
        const label = birthAugurInput.closest('.form-group')?.querySelector('label')
        if (label) {
          label.textContent = game.i18n.localize('DCC.BirthAugur')
        }
      }

      // Find the title form group to insert after
      const titleFormGroup = titleInput?.closest('.form-group')

      if (titleFormGroup) {
        // Create Neighborhood/Quarter field
        const neighborhoodHTML = `
            <div class="form-group">
                <label>${game.i18n.localize('DCC.NeighborhoodQuarter')}</label>
                <div class="form-fields">
                    <input type="text" name="system.details.neighborhood.value" value="${this.actor.system.details.neighborhood?.value || ''}" />
                </div>
            </div>
        `
        // Create Hangout field
        const hangoutHTML = `
            <div class="form-group">
                <label>${game.i18n.localize('DCC.Hangout')}</label>
                <div class="form-fields">
                    <input type="text" name="system.details.hangout.value" value="${this.actor.system.details.hangout?.value || ''}" />
                </div>
            </div>
        `
        // Insert after title
        titleFormGroup.insertAdjacentHTML('afterend', hangoutHTML)
        titleFormGroup.insertAdjacentHTML('afterend', neighborhoodHTML)
      }

      // Add Patron Die section
      const savesElement = this.element.querySelector('.saves')
      if (savesElement) {
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
  }
}

/**
 * Extend the zero-level/NPC sheet for a Dwarf
 * @extends {DCCActorSheet}
 */
class DCCActorSheetDwarf extends DCCActorSheet {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    position: {
      height: 640
    }
  }

  /** @inheritDoc */
  static CLASS_PARTS = {
    character: {
      id: 'character',
      template: 'systems/dcc/templates/actor-partial-pc-common.html'
    },
    equipment: {
      id: 'equipment',
      template: 'systems/dcc/templates/actor-partial-pc-equipment.html'
    },
    dwarf: {
      id: 'dwarf',
      template: 'systems/dcc/templates/actor-partial-dwarf.html'
    }
  }

  /** @inheritDoc */
  static CLASS_TABS = {
    sheet: {
      tabs: [
        { id: 'character', group: 'sheet', label: 'DCC.Character' },
        { id: 'equipment', group: 'sheet', label: 'DCC.Equipment' },
        { id: 'dwarf', group: 'sheet', label: 'DCC.Dwarf' }
      ]
    }
  }

  /** @inheritDoc */
  async _prepareContext (options) {
    const context = await super._prepareContext(options)

    // Only set class defaults on initial setup (when sheetClass doesn't match)
    if (this.options.document.system.details.sheetClass !== 'Dwarf') {
      await this.options.document.update({
        'system.class.className': game.i18n.localize('DCC.Dwarf'),
        'system.class.classLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.DwarfClassLink')),
        'system.class.mightyDeedsLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.MightyDeedsLink')),
        'system.details.sheetClass': 'Dwarf',
        'system.details.critRange': 20,
        'system.class.disapproval': 1,
        'system.config.attackBonusMode': 'autoPerAttack',
        'system.skills.shieldBash.useDeed': true,
        'system.config.addClassLevelToInitiative': false,
        'system.class.spellCheckAbility': null,
        'system.config.showBackstab': false
      })

      // Check if the dwarf has a shield bash weapon
      const shieldBashName = game.i18n.localize('DCC.ShieldBash')
      const hasBashWeapon = this.options.document.items.some(item =>
        item.type === 'weapon' &&
        item.name === shieldBashName
      )

      // If no shield bash weapon exists, create it
      if (!hasBashWeapon) {
        // Create the item after this render completes
        await this.options.document.createEmbeddedDocuments('Item', [{
          name: shieldBashName,
          type: 'weapon',
          img: 'systems/dcc/styles/images/game-icons-net/shield-bash.svg',
          system: {
            melee: true,
            damage: '1d3',
            config: {
              actionDieOverride: '1d14'
            }
          }
        }])
        // Explicitly trigger a re-render to show the new item
        this.render(false)
      }
    } else if (!this.options.document.system.class.classLink) {
      // Regenerate classLink if missing (e.g., core book wasn't installed initially)
      await this.options.document.update({
        'system.class.classLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.DwarfClassLink')),
        'system.class.mightyDeedsLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.MightyDeedsLink'))
      })
    }

    return context
  }
}

/**
 * Extend the zero-level/NPC sheet for an Elf
 * @extends {DCCActorSheet}
 */
class DCCActorSheetElf extends DCCActorSheet {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    position: {
      height: 640
    }
  }

  /** @inheritDoc */
  static CLASS_PARTS = {
    character: {
      id: 'character',
      template: 'systems/dcc/templates/actor-partial-pc-common.html'
    },
    equipment: {
      id: 'equipment',
      template: 'systems/dcc/templates/actor-partial-pc-equipment.html'
    },
    elf: {
      id: 'elf',
      template: 'systems/dcc/templates/actor-partial-elf.html'
    },
    wizardSpells: {
      id: 'wizardSpells',
      template: 'systems/dcc/templates/actor-partial-wizard-spells.html'
    }
  }

  /** @inheritDoc */
  static CLASS_TABS = {
    sheet: {
      tabs: [
        { id: 'character', group: 'sheet', label: 'DCC.Character' },
        { id: 'equipment', group: 'sheet', label: 'DCC.Equipment' },
        { id: 'elf', group: 'sheet', label: 'DCC.Elf' },
        { id: 'wizardSpells', group: 'sheet', label: 'DCC.WizardSpells' }
      ]
    }
  }

  /** @inheritDoc */
  async _prepareContext (options) {
    const context = await super._prepareContext(options)

    // Only set class defaults on initial setup (when sheetClass doesn't match)
    if (this.options.document.system.details.sheetClass !== 'Elf') {
      await this.options.document.update({
        'system.class.className': game.i18n.localize('DCC.Elf'),
        'system.class.classLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.ElfClassLink')),
        'system.details.sheetClass': 'Elf',
        'system.class.spellCheckAbility': 'int',
        'system.details.critRange': 20,
        'system.class.disapproval': 1,
        'system.config.attackBonusMode': 'flat',
        'system.config.addClassLevelToInitiative': false,
        'system.config.showSpells': true,
        'system.config.showBackstab': false,
        'system.skills.shieldBash.useDeed': false
      })
    } else if (!this.options.document.system.class.classLink) {
      // Regenerate classLink if missing (e.g., core book wasn't installed initially)
      await this.options.document.update({
        'system.class.classLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.ElfClassLink'))
      })
    }

    return context
  }
}

/**
 * Extend the sheet for a generic upper level character
 * @extends {DCCActorSheet}
 */
class DCCActorSheetGeneric extends DCCActorSheet {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    position: {
      height: 640
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
    effects: {
      id: 'effects',
      template: 'systems/dcc/templates/partial-effects.html'
    },
    notes: {
      id: 'notes',
      template: 'systems/dcc/templates/actor-partial-pc-notes.html'
    }
  }

  /** @inheritDoc */
  static CLASS_TABS = {}

  /** @override */
  async _prepareContext (options) {
    const context = await super._prepareContext(options)

    if (this.options.document.system.details.sheetClass !== 'Generic') {
      await this.options.document.update({
        'system.class.className': game.i18n.localize('DCC.Generic'),
        'system.details.sheetClass': 'Generic',
        'system.details.critRange': 20,
        'system.class.disapproval': 1,
        'system.config.attackBonusMode': 'flat',
        'system.config.addClassLevelToInitiative': false,
        'system.class.spellCheckAbility': null,
        'system.config.showBackstab': false,
        'system.config.showSpells': false,
        'system.skills.shieldBash.useDeed': false
      })
    }

    return context
  }
}

export {
  DCCActorSheetCleric,
  DCCActorSheetThief,
  DCCActorSheetHalfling,
  DCCActorSheetWarrior,
  DCCActorSheetWizard,
  DCCActorSheetDwarf,
  DCCActorSheetElf,
  DCCActorSheetGeneric
}
