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
  static DEFAULT_OPTIONS = {
    position: {
      height: 635
    }
  }

  static {
    this._initializeActorSheetClass()
  }

  /** @override */
  async _prepareContext (options) {
    const context = await super._prepareContext(options)
    const { actor } = context

    actor.system.class.className = game.i18n.localize('DCC.Cleric')
    actor.system.class.classLink = await TextEditor.enrichHTML(game.i18n.localize('DCC.ClericClassLink'))

    if (actor.system.details.sheetClass !== 'Cleric') {
      actor.update({
        'system.class.className': game.i18n.localize('DCC.Cleric'),
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
  static DEFAULT_OPTIONS = {
    position: {
      height: 635
    }
  }

  static {
    this._initializeActorSheetClass()
  }

  /** @override */
  async _prepareContext (options) {
    const context = await super._prepareContext(options)
    const { actor } = context
    this.options.template = 'systems/dcc/templates/actor-sheet-thief.html'
    this.options.classes = ['dcc', 'sheet', 'actor', 'pc']
    actor.system.class.className = game.i18n.localize('DCC.Thief')
    actor.system.class.classLink = await TextEditor.enrichHTML(game.i18n.localize('DCC.ThiefClassLink'))

    if (actor.system.details.sheetClass !== 'Thief') {
      actor.update({
        'system.class.className': game.i18n.localize('DCC.Thief'),
        'system.details.sheetClass': 'Thief',
        'system.details.critRange': 20,
        'system.class.disapproval': 1,
        'system.config.attackBonusMode': 'flat',
        'system.config.showBackstab': true,
        'system.config.addClassLevelToInitiative': false
      })
    }

    return actor
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
      height: 635
    }
  }

  static {
    this._initializeActorSheetClass()
  }

  /** @override */
  async _prepareContext (options) {
    const context = await super._prepareContext(options)
    const { actor } = context
    this.options.template = 'systems/dcc/templates/actor-sheet-halfling.html'
    this.options.classes = ['dcc', 'sheet', 'actor', 'pc']
    actor.system.class.className = game.i18n.localize('DCC.Halfling')
    actor.system.class.classLink = await TextEditor.enrichHTML(game.i18n.localize('DCC.HalflingClassLink'))

    if (actor.system.details.sheetClass !== 'Halfling') {
      actor.update({
        'system.class.className': game.i18n.localize('DCC.Halfling'),
        'system.details.sheetClass': 'Halfling',
        'system.details.critRange': 20,
        'system.class.disapproval': 1,
        'system.config.attackBonusMode': 'flat',
        'system.config.addClassLevelToInitiative': false
      })
    }

    return actor
  }
}

/**
 * Extend the zero-level/NPC sheet for a Warrior
 * @extends {DCCActorSheet}
 */
class DCCActorSheetWarrior extends DCCActorSheet {
  static height = 635

  /** @override */
  async getData (options) {
    const data = await super.getData(options)
    this.options.template = 'systems/dcc/templates/actor-sheet-warrior.html'
    this.options.classes = ['dcc', 'sheet', 'actor', 'pc']
    data.system.class.className = game.i18n.localize('DCC.Warrior')
    data.system.class.classLink = await TextEditor.enrichHTML(game.i18n.localize('DCC.WarriorClassLink'))
    data.system.class.mightyDeedsLink = await TextEditor.enrichHTML(game.i18n.localize('DCC.MightyDeedsLink'))

    if (data.system.details.sheetClass !== 'Warrior') {
      this.actor.update({
        'system.class.className': game.i18n.localize('DCC.Warrior'),
        'system.details.sheetClass': 'Warrior',
        'system.class.disapproval': 1,
        'system.config.attackBonusMode': 'autoPerAttack',
        'system.config.addClassLevelToInitiative': true
      })
    }

    return data
  }
}

/**
 * Extend the zero-level/NPC sheet for a Wizard
 * @extends {DCCActorSheet}
 */
class DCCActorSheetWizard extends DCCActorSheet {
  static height = 635

  /** @override */
  async getData (options) {
    const data = await super.getData(options)
    this.options.template = 'systems/dcc/templates/actor-sheet-wizard.html'
    this.options.classes = ['dcc', 'sheet', 'actor', 'pc']
    data.system.class.className = game.i18n.localize('DCC.Wizard')
    data.system.class.classLink = await TextEditor.enrichHTML(game.i18n.localize('DCC.WizardClassLink'))

    if (data.system.details.sheetClass !== 'Wizard') {
      this.actor.update({
        'system.class.className': game.i18n.localize('DCC.Wizard'),
        'system.details.sheetClass': 'Wizard',
        'system.class.spellCheckAbility': 'int',
        'system.details.critRange': 20,
        'system.class.disapproval': 1,
        'system.config.attackBonusMode': 'flat',
        'system.config.addClassLevelToInitiative': false
      })
    }

    return data
  }
}

/**
 * Extend the zero-level/NPC sheet for a Dwarf
 * @extends {DCCActorSheet}
 */
class DCCActorSheetDwarf extends DCCActorSheet {
  static height = 635

  /** @override */
  async getData (options) {
    const data = await super.getData(options)
    this.options.template = 'systems/dcc/templates/actor-sheet-dwarf.html'
    this.options.classes = ['dcc', 'sheet', 'actor', 'pc']
    data.system.class.className = game.i18n.localize('DCC.Dwarf')
    data.system.class.classLink = await TextEditor.enrichHTML(game.i18n.localize('DCC.DwarfClassLink'))
    data.system.class.mightyDeedsLink = await TextEditor.enrichHTML(game.i18n.localize('DCC.MightyDeedsLink'))

    if (data.system.details.sheetClass !== 'Dwarf') {
      this.actor.update({
        'system.class.className': game.i18n.localize('DCC.Dwarf'),
        'system.details.sheetClass': 'Dwarf',
        'system.class.disapproval': 1,
        'system.config.attackBonusMode': 'autoPerAttack',
        'system.skills.shieldBash.useDeed': true,
        'system.config.addClassLevelToInitiative': false
      })
    }

    return data
  }
}

/**
 * Extend the zero-level/NPC sheet for an Elf
 * @extends {DCCActorSheet}
 */
class DCCActorSheetElf extends DCCActorSheet {
  static height = 635

  /** @override */
  async getData (options) {
    const data = await super.getData(options)
    this.options.template = 'systems/dcc/templates/actor-sheet-elf.html'
    this.options.classes = ['dcc', 'sheet', 'actor', 'pc']
    data.system.class.className = game.i18n.localize('DCC.Elf')
    data.system.class.classLink = await TextEditor.enrichHTML(game.i18n.localize('DCC.ElfClassLink'))

    if (data.system.details.sheetClass !== 'Elf') {
      this.actor.update({
        'system.class.className': game.i18n.localize('DCC.Elf'),
        'system.details.sheetClass': 'Elf',
        'system.class.spellCheckAbility': 'int',
        'system.details.critRange': 20,
        'system.class.disapproval': 1,
        'system.config.attackBonusMode': 'flat',
        'system.config.addClassLevelToInitiative': false
      })
    }

    return data
  }
}

/**
 * Extend the zero-level/NPC sheet for a generic upper level character
 * @extends {DCCActorSheet}
 */
class DCCActorSheetGeneric extends DCCActorSheet {
  static height = 635

  /** @override */
  async getData (options) {
    const data = await super.getData(options)
    this.options.template = 'systems/dcc/templates/actor-sheet-generic.html'
    this.options.classes = ['dcc', 'sheet', 'actor', 'pc']
    data.system.class.className = game.i18n.localize('DCC.Generic')

    this.actor.update({
      'system.class.className': game.i18n.localize('DCC.Generic'),
      'system.config.attackBonusMode': 'flat',
      'system.config.addClassLevelToInitiative': false
    })

    return data
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
