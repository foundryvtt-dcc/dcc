/* global TextEditor, game */

/**
 * DCC specific character sheet overrides
 */

import DCCActorSheet from './actor-sheet.js'

/**
 * Extend the zero-level/NPC sheet for a Cleric
 * @extends {DCCActorSheet}
 */
class DCCActorSheetCleric extends DCCActorSheet {
  /** @override */
  async getData (options) {
    const data = await super.getData(options)
    this.options.template = 'systems/dcc/templates/actor-sheet-cleric.html'
    data.system.class.className = game.i18n.localize('DCC.Cleric')
    data.system.class.classLink = await TextEditor.enrichHTML(game.i18n.localize('DCC.ClericClassLink'))

    if (data.system.details.sheetClass !== 'Cleric') {
      this.actor.update({
        'data.class.className': game.i18n.localize('DCC.Cleric'),
        'data.details.sheetClass': 'Cleric',
        'data.class.spellCheckAbility': 'per',
        'data.details.critRange': 20
      })
    }

    return data
  }
}

/**
 * Extend the zero-level/NPC sheet for a Thief
 * @extends {DCCActorSheet}
 */
class DCCActorSheetThief extends DCCActorSheet {
  /** @override */
  async getData (options) {
    const data = await super.getData(options)
    this.options.template = 'systems/dcc/templates/actor-sheet-thief.html'
    data.system.class.className = game.i18n.localize('DCC.Thief')
    data.system.class.classLink = await TextEditor.enrichHTML(game.i18n.localize('DCC.ThiefClassLink'))

    if (data.system.details.sheetClass !== 'Thief') {
      this.actor.update({
        'data.class.className': game.i18n.localize('DCC.Thief'),
        'data.details.sheetClass': 'Thief',
        'data.details.critRange': 20,
        'data.class.disapproval': 1,
        'data.details.showBackstab': true
      })
    }

    return data
  }
}

/**
 * Extend the zero-level/NPC sheet for a Halfling
 * @extends {DCCActorSheet}
 */
class DCCActorSheetHalfling extends DCCActorSheet {
  /** @override */
  async getData (options) {
    const data = await super.getData(options)
    this.options.template = 'systems/dcc/templates/actor-sheet-halfling.html'
    data.system.class.className = game.i18n.localize('DCC.Halfling')
    data.system.class.classLink = await TextEditor.enrichHTML(game.i18n.localize('DCC.HalflingClassLink'))

    if (data.system.details.sheetClass !== 'Halfling') {
      this.actor.update({
        'data.class.className': game.i18n.localize('DCC.Halfling'),
        'data.details.sheetClass': 'Halfling',
        'data.details.critRange': 20,
        'data.class.disapproval': 1
      })
    }

    return data
  }
}

/**
 * Extend the zero-level/NPC sheet for a Warrior
 * @extends {DCCActorSheet}
 */
class DCCActorSheetWarrior extends DCCActorSheet {
  /** @override */
  async getData (options) {
    const data = await super.getData(options)
    this.options.template = 'systems/dcc/templates/actor-sheet-warrior.html'
    data.system.class.className = game.i18n.localize('DCC.Warrior')
    data.system.class.classLink = await TextEditor.enrichHTML(game.i18n.localize('DCC.WarriorClassLink'))
    data.system.class.mightyDeedsLink = await TextEditor.enrichHTML(game.i18n.localize('DCC.MightyDeedsLink'))

    if (data.system.details.sheetClass !== 'Warrior') {
      this.actor.update({
        'data.class.className': game.i18n.localize('DCC.Warrior'),
        'data.details.sheetClass': 'Warrior',
        'data.class.disapproval': 1,
        'data.config.attackBonusMode': 'manual'
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
  /** @override */
  async getData (options) {
    const data = await super.getData(options)
    this.options.template = 'systems/dcc/templates/actor-sheet-wizard.html'
    data.system.class.className = game.i18n.localize('DCC.Wizard')
    data.system.class.classLink = await TextEditor.enrichHTML(game.i18n.localize('DCC.WizardClassLink'))

    if (data.system.details.sheetClass !== 'Wizard') {
      this.actor.update({
        'data.class.className': game.i18n.localize('DCC.Wizard'),
        'data.details.sheetClass': 'Wizard',
        'data.class.spellCheckAbility': 'int',
        'data.details.critRange': 20,
        'data.class.disapproval': 1
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
  /** @override */
  async getData (options) {
    const data = await super.getData(options)
    this.options.template = 'systems/dcc/templates/actor-sheet-dwarf.html'
    data.system.class.className = game.i18n.localize('DCC.Dwarf')
    data.system.class.classLink = await TextEditor.enrichHTML(game.i18n.localize('DCC.DwarfClassLink'))
    data.system.class.mightyDeedsLink = await TextEditor.enrichHTML(game.i18n.localize('DCC.MightyDeedsLink'))

    if (data.system.details.sheetClass !== 'Dwarf') {
      this.actor.update({
        'data.class.className': game.i18n.localize('DCC.Dwarf'),
        'data.details.sheetClass': 'Dwarf',
        'data.class.disapproval': 1,
        'data.config.attackBonusMode': 'manual',
        'data.skills.shieldBash.useDeed': true
      })
    }

    return data
  }
}

/**
 * Extend the zero-level/NPC sheet for a Elf
 * @extends {DCCActorSheet}
 */
class DCCActorSheetElf extends DCCActorSheet {
  /** @override */
  async getData (options) {
    const data = await super.getData(options)
    this.options.template = 'systems/dcc/templates/actor-sheet-elf.html'
    data.system.class.className = game.i18n.localize('DCC.Elf')
    data.system.class.classLink = await TextEditor.enrichHTML(game.i18n.localize('DCC.ElfClassLink'))

    if (data.system.details.sheetClass !== 'Elf') {
      this.actor.update({
        'data.class.className': game.i18n.localize('DCC.Elf'),
        'data.details.sheetClass': 'Elf',
        'data.class.spellCheckAbility': 'int',
        'data.details.critRange': 20,
        'data.class.disapproval': 1
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
  /** @override */
  async getData (options) {
    const data = await super.getData(options)
    this.options.template = 'systems/dcc/templates/actor-sheet-upper-level.html'
    data.system.class.className = game.i18n.localize('DCC.Generic')

    this.actor.update({
      'data.class.className': game.i18n.localize('DCC.Generic')
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
