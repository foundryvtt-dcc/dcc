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
    data.data.class.className = 'Cleric'
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
    data.data.class.className = 'Thief'
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
    data.data.class.className = 'Halfling'
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
    data.data.class.className = 'Warrior'
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
    data.data.class.className = 'Wizard'
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
    data.data.class.className = 'Dwarf'
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
    data.data.class.className = 'Elf'
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
    data.data.class.className = 'Generic'
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
