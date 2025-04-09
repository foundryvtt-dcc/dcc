/* global TextEditor, game */
// noinspection JSClosureCompilerSyntax

/**
 * DCC specific character sheet overrides
 */

import DCCActorSheet from './actor-sheet.js'

/**
 * Extend the zero-level/NPC sheet for a Cleric
 * @extends {DCCActorSheet}
 */
class DCCActorSheetCleric extends DCCActorSheet {
  /** @inheritDoc */
  static CLASS_PARTS = {
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
        { id: 'cleric', group: 'sheet', label: 'DCC.Cleric' },
        { id: 'clericSpells', group: 'sheet', label: 'DCC.ClericSpells' }
      ]
    }
  }

  /** @inheritDoc */
  async _prepareContext (options) {
    const context = await super._prepareContext(options)

    await this.actor.update({
      'system.class.classLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.ClericClassLink'))
    })

    if (this.actor.system.details.sheetClass !== 'Cleric') {
      await this.actor.update({
        'system.class.className': game.i18n.localize('DCC.Cleric'),
        'system.class.classLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.ClericClassLink')),
        'system.details.sheetClass': 'Cleric',
        'system.class.spellCheckAbility': 'per',
        'system.details.critRange': 20,
        'system.config.attackBonusMode': 'flat',
        'system.config.addClassLevelToInitiative': false
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
  static CLASS_PARTS = {
    thief: {
      id: 'thief',
      template: 'systems/dcc/templates/actor-partial-thief.html'
    }
  }

  /** @inheritDoc */
  static CLASS_TABS = {
    sheet: {
      tabs: [
        { id: 'thief', group: 'sheet', label: 'DCC.Thief' }
      ]
    }
  }

  /** @override */
  async _prepareContext (options) {
    const context = await super._prepareContext(options)

    await this.actor.update({
      'system.class.classLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.ThiefClassLink'))
    })

    if (this.actor.system.details.sheetClass !== 'Thief') {
      await this.actor.update({
        'system.class.className': game.i18n.localize('DCC.Thief'),
        'system.class.classLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.ThiefClassLink')),
        'system.details.sheetClass': 'Thief',
        'system.details.critRange': 20,
        'system.class.disapproval': 1,
        'system.config.attackBonusMode': 'flat',
        'system.config.showBackstab': true,
        'system.config.addClassLevelToInitiative': false
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
  /**
   * Parts specific to this class
   **/
  static CLASS_PARTS = {
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
        { id: 'halfling', group: 'sheet', label: 'DCC.Halfling' }
      ]
    }
  }

  /** @override */
  async _prepareContext (options) {
    const context = await super._prepareContext(options)

    await this.actor.update({
      'system.class.classLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.HalflingClassLink'))
    })

    if (this.actor.system.details.sheetClass !== 'Halfling') {
      await this.actor.update({
        'system.class.className': game.i18n.localize('DCC.Halfling'),
        'system.details.sheetClass': 'Halfling',
        'system.details.critRange': 20,
        'system.class.disapproval': 1,
        'system.config.attackBonusMode': 'flat',
        'system.config.addClassLevelToInitiative': false
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
  static CLASS_PARTS = {
    warrior: {
      id: 'warrior',
      template: 'systems/dcc/templates/actor-partial-warrior.html'
    }
  }

  /** @inheritDoc */
  static CLASS_TABS = {
    sheet: {
      tabs: [
        { id: 'warrior', group: 'sheet', label: 'DCC.Warrior' }
      ]
    }
  }

  /** @inheritDoc */
  async _prepareContext (options) {
    const context = await super._prepareContext(options)

    await this.actor.update({
      'system.class.classLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.WarriorClassLink')),
      'system.class.mightyDeedsLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.MightyDeedsLink'))
    })

    if (this.actor.system.details.sheetClass !== 'Warrior') {
      await this.actor.update({
        'system.class.className': game.i18n.localize('DCC.Warrior'),
        'system.details.sheetClass': 'Warrior',
        'system.class.disapproval': 1,
        'system.config.attackBonusMode': 'autoPerAttack',
        'system.config.addClassLevelToInitiative': true
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
  static CLASS_PARTS = {
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
        { id: 'wizard', group: 'sheet', label: 'DCC.Wizard' },
        { id: 'wizardSpells', group: 'sheet', label: 'DCC.WizardSpells' }
      ]
    }
  }

  /** @inheritDoc */
  async _prepareContext (options) {
    const context = await super._prepareContext(options)

    await this.actor.update({
      'system.class.classLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.WizardClassLink'))
    })

    if (this.actor.system.details.sheetClass !== 'Wizard') {
      await this.actor.update({
        'system.class.className': game.i18n.localize('DCC.Wizard'),
        'system.details.sheetClass': 'Wizard',
        'system.class.spellCheckAbility': 'int',
        'system.details.critRange': 20,
        'system.class.disapproval': 1,
        'system.config.attackBonusMode': 'flat',
        'system.config.addClassLevelToInitiative': false,
        'system.config.showSpells': true
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
  static CLASS_PARTS = {
    dwarf: {
      id: 'dwarf',
      template: 'systems/dcc/templates/actor-partial-dwarf.html'
    }
  }

  /** @inheritDoc */
  static CLASS_TABS = {
    sheet: {
      tabs: [
        { id: 'dwarf', group: 'sheet', label: 'DCC.Dwarf' }
      ]
    }
  }

  /** @inheritDoc */
  async _prepareContext (options) {
    const context = await super._prepareContext(options)

    await this.actor.update({
      'system.class.classLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.DwarfClassLink')),
      'system.class.mightyDeedsLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.MightyDeedsLink'))
    })

    if (this.actor.system.details.sheetClass !== 'Dwarf') {
      await this.actor.update({
        'system.class.className': game.i18n.localize('DCC.Dwarf'),
        'system.details.sheetClass': 'Dwarf',
        'system.class.disapproval': 1,
        'system.config.attackBonusMode': 'autoPerAttack',
        'system.skills.shieldBash.useDeed': true,
        'system.config.addClassLevelToInitiative': false
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
  static CLASS_PARTS = {
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
        { id: 'elf', group: 'sheet', label: 'DCC.Elf' },
        { id: 'wizardSpells', group: 'sheet', label: 'DCC.WizardSpells' }
      ]
    }
  }

  /** @inheritDoc */
  async _prepareContext (options) {
    const context = await super._prepareContext(options)

    await this.actor.update({
      'system.class.classLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.ElfClassLink'))
    })

    if (this.actor.system.details.sheetClass !== 'Elf') {
      await this.actor.update({
        'system.class.className': game.i18n.localize('DCC.Elf'),
        'system.details.sheetClass': 'Elf',
        'system.class.spellCheckAbility': 'int',
        'system.details.critRange': 20,
        'system.class.disapproval': 1,
        'system.config.attackBonusMode': 'flat',
        'system.config.addClassLevelToInitiative': false,
        'system.config.showSpells': true
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

  /** @inheritDoc */
  static CLASS_TABS = {}

  /** @override */
  async _prepareContext (options) {
    const context = await super._prepareContext(options)

    if (this.actor.system.details.sheetClass !== 'Generic') {
      await this.actor.update({
        'system.class.className': game.i18n.localize('DCC.Generic'),
        'system.details.sheetClass': 'Generic',
        'system.config.attackBonusMode': 'flat',
        'system.config.addClassLevelToInitiative': false
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
