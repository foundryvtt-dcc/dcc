/* global game */

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
  getData () {
    const data = super.getData()
    this.options.template = 'systems/dcc/templates/actor-sheet-cleric.html'
    data.data.class.className = game.i18n.localize('DCC.Cleric')

    if (data.data.details.sheetClass !== 'Cleric') {
      this.actor.update({
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
  getData () {
    const data = super.getData()
    this.options.template = 'systems/dcc/templates/actor-sheet-thief.html'
    data.data.class.className = game.i18n.localize('DCC.Thief')

    if (data.data.details.sheetClass !== 'Thief') {
      this.actor.update({
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
  getData () {
    const data = super.getData()
    this.options.template = 'systems/dcc/templates/actor-sheet-halfling.html'
    data.data.class.className = game.i18n.localize('DCC.Halfling')

    if (data.data.details.sheetClass !== 'Halfling') {
      this.actor.update({
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
  getData () {
    const data = super.getData()
    this.options.template = 'systems/dcc/templates/actor-sheet-warrior.html'
    data.data.class.className = game.i18n.localize('DCC.Warrior')

    if (data.data.details.sheetClass !== 'Warrior') {
      this.actor.update({
        'data.details.sheetClass': 'Warrior',
        'data.class.disapproval': 1,
        'data.config.rollAttackBonus': true
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
  getData () {
    const data = super.getData()
    this.options.template = 'systems/dcc/templates/actor-sheet-wizard.html'
    data.data.class.className = game.i18n.localize('DCC.Wizard')

    if (data.data.details.sheetClass !== 'Wizard') {
      this.actor.update({
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
  getData () {
    const data = super.getData()
    this.options.template = 'systems/dcc/templates/actor-sheet-dwarf.html'
    data.data.class.className = game.i18n.localize('DCC.Dwarf')

    if (data.data.details.sheetClass !== 'Dwarf') {
      this.actor.update({
        'data.details.sheetClass': 'Dwarf',
        'data.class.disapproval': 1,
        'data.config.rollAttackBonus': true,
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
  getData () {
    const data = super.getData()
    this.options.template = 'systems/dcc/templates/actor-sheet-elf.html'
    data.data.class.className = game.i18n.localize('DCC.Elf')

    if (data.data.details.sheetClass !== 'Elf') {
      this.actor.update({
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
  getData () {
    const data = super.getData()
    this.options.template = 'systems/dcc/templates/actor-sheet-upper-level.html'
    data.data.class.className = game.i18n.localize('DCC.Generic')
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
