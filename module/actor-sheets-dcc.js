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

    await this.options.document.update({
      'system.class.classLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.ClericClassLink'))
    })

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

    await this.options.document.update({
      'system.class.classLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.ThiefClassLink'))
    })

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
    }

    return context
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

    await this.options.document.update({
      'system.class.classLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.HalflingClassLink'))
    })

    if (this.options.document.system.details.sheetClass !== 'Halfling') {
      await this.options.document.update({
        'system.class.className': game.i18n.localize('DCC.Halfling'),
        'system.details.sheetClass': 'Halfling',
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

    await this.options.document.update({
      'system.class.classLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.WarriorClassLink')),
      'system.class.mightyDeedsLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.MightyDeedsLink'))
    })

    if (this.options.document.system.details.sheetClass !== 'Warrior') {
      await this.options.document.update({
        'system.class.className': game.i18n.localize('DCC.Warrior'),
        'system.details.sheetClass': 'Warrior',
        'system.details.critRange': 20,
        'system.class.disapproval': 1,
        'system.config.attackBonusMode': 'autoPerAttack',
        'system.config.addClassLevelToInitiative': true,
        'system.class.spellCheckAbility': null,
        'system.config.showBackstab': false,
        'system.config.showSpells': false,
        'system.skills.shieldBash.useDeed': false
      })
    }

    return context
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

    await this.options.document.update({
      'system.class.classLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.WizardClassLink')),
      'system.class.spellcastingLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.SpellcastingLink')),
      'system.class.spellburnLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.SpellburnLink'))
    })

    if (this.options.document.system.details.sheetClass !== 'Wizard') {
      await this.options.document.update({
        'system.class.className': game.i18n.localize('DCC.Wizard'),
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
    }

    return context
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

    await this.options.document.update({
      'system.class.classLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.DwarfClassLink')),
      'system.class.mightyDeedsLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.MightyDeedsLink'))
    })

    if (this.options.document.system.details.sheetClass !== 'Dwarf') {
      await this.options.document.update({
        'system.class.className': game.i18n.localize('DCC.Dwarf'),
        'system.details.sheetClass': 'Dwarf',
        'system.details.critRange': 20,
        'system.class.disapproval': 1,
        'system.config.attackBonusMode': 'autoPerAttack',
        'system.skills.shieldBash.useDeed': true,
        'system.config.addClassLevelToInitiative': false,
        'system.class.spellCheckAbility': null,
        'system.config.showBackstab': false,
        'system.config.showSpells': false
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

    await this.options.document.update({
      'system.class.classLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.ElfClassLink'))
    })

    if (this.options.document.system.details.sheetClass !== 'Elf') {
      await this.options.document.update({
        'system.class.className': game.i18n.localize('DCC.Elf'),
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
