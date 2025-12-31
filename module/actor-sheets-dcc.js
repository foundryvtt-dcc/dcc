/* global game, foundry */
// noinspection JSClosureCompilerSyntax

/**
 * DCC specific character sheet overrides
 */

import DCCActorSheet from './actor-sheet.js'

/*
* Automated Fleeting Luck Hook
* Listens for d20 rolls to grant or remove Fleeting Luck per Lankhmar rules.
*/
Hooks.once('init', () => {
  Hooks.on('createChatMessage', async (message, options, userId) => {
    // Only proceed if Fleeting Luck is enabled
    // We check this inside the hook to avoid race conditions during init
    if (!game.settings.get('dcc', 'enableFleetingLuck')) return

    // Only process messages that are dice rolls from the current user
    if (!message.isRoll || message.user.id !== game.user.id) return

    // Get the actor for this roll
    const actor = ChatMessage.getSpeakerActor(message.speaker)

    // Only process for player characters
    if (!actor || actor.type !== 'Player') return

    // Check each d20 roll in the message
    for (const roll of message.rolls) {
      for (const die of roll.dice) {
        if (die.faces === 20) {
          for (const result of die.results) {
            if (result.result === 20 && result.active) {
              // Natural 20! Award Fleeting Luck.
              const currentLuck = actor.system.attributes.fleetingLuck.value || 0
              await actor.update({ 'system.attributes.fleetingLuck.value': currentLuck + 1 })
              ui.notifications.info(game.i18n.format('DCCL.FleetingLuckGained', {
                actor: actor.name
              }))
            } else if (result.result === 1 && result.active) {
              // Natural 1! The gods are displeased.
              ui.notifications.warn(game.i18n.localize('DCCL.FleetingLuckLostAll'))

              // Reset fleeting luck for all player characters
              const updates = game.actors.filter(a => a.type === 'Player').map(pc => {
                return { _id: pc.id, 'system.attributes.fleetingLuck.value': 0 }
              })
              if (updates.length) { await Actor.updateDocuments(updates) }

              // Since we found a 1 and processed it, we can stop.
              return
            }
          }
        }
      }
    }
  })
})

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
    if (this.actor.type === 'Player' && this.actor.system.details.sheetClass !== 'Cleric') {
      // Fire and forget
      await this.actor.update({
        'system.details.sheetClass': 'Cleric',
        'system.class.className': game.i18n.localize('DCC.Cleric'),
        'system.class.classLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.ClericClassLink')),
        'system.class.spellCheckAbility': 'per',
        'system.config.attackBonusMode': 'flat',
        'system.config.addClassLevelToInitiative': false,
        'system.config.showBackstab': false,
        'system.config.showSpells': false
      })
    } else if (this.actor.type === 'Player' && !this.actor.system.class.classLink) {
      // Regenerate classLink if missing (e.g., core book wasn't installed initially)
      await this.actor.update({
        'system.class.classLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.ClericClassLink'))
      })
    }

    return context
  }

  /** @override */
  async _onRender (context, options) {
    super._onRender(context, options)
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
    if (this.actor.type === 'Player' && this.actor.system.details.sheetClass !== 'Halfling') {
      await this.actor.update({
        'system.details.sheetClass': 'Halfling',
        'system.class.className': game.i18n.localize('DCC.Halfling'),
        'system.class.classLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.HalflingClassLink')),
        'system.config.attackBonusMode': 'flat'
      })
    } else if (this.actor.type === 'Player' && !this.actor.system.class.classLink) {
      // Regenerate classLink if missing (e.g., core book wasn't installed initially)
      await this.actor.update({
        'system.class.classLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.HalflingClassLink'))
      })
    }

    return context
  }

  /** @override */
  async _onRender (context, options) {
    super._onRender(context, options)
  }
}

/**
 * Extend the zero-level/NPC sheet for a Thief
 * @extends {DCCActorSheet}
 */
class DCCActorSheetThief extends DCCActorSheet {
  /** @inheritDoc */
  static get DEFAULT_OPTIONS () {
    const options = {
      position: {
        height: 640
      }
    }
    if (game.settings.get('dcc', 'enableLankhmar')) {
      options.position.width = 755
      options.position.height = 705
    }
    return foundry.utils.mergeObject(super.DEFAULT_OPTIONS, options)
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
  _configureRenderParts (options) {
    const parts = super._configureRenderParts(options)
    if (game.settings.get('dcc', 'enableLankhmar')) {
      parts.character.template = 'systems/dcc/templates/actor-partial-pc-common-lankhmar.html'
      parts.equipment.template = 'systems/dcc/templates/actor-partial-pc-equipment-lankhmar.html'
    }
    return parts
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
    if (this.actor.type === 'Player' && this.actor.system.details.sheetClass !== 'Thief') {
      await this.actor.update({
        'system.details.sheetClass': 'Thief',
        'system.class.className': game.i18n.localize('DCC.Thief'),
        'system.class.classLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.ThiefClassLink')),
        'system.config.attackBonusMode': 'flat',
        'system.config.showBackstab': true
      })
    } else if (this.actor.type === 'Player' && !this.actor.system.class.classLink) {
      // Regenerate classLink if missing (e.g., core book wasn't installed initially)
      await this.actor.update({
        'system.class.classLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.ThiefClassLink'))
      })
    }

    return context
  }

  /** @override */
  async _onRender (context, options) {
    super._onRender(context, options)
  }
}

/**
 * Extend the zero-level/NPC sheet for a Warrior
 * @extends {DCCActorSheet}
 */
class DCCActorSheetWarrior extends DCCActorSheet {
  /** @inheritDoc */
  static get DEFAULT_OPTIONS () {
    const options = {
      position: {
        height: 640
      }
    }
    if (game.settings.get('dcc', 'enableLankhmar')) {
      options.position.width = 755
      options.position.height = 705
    }
    return foundry.utils.mergeObject(super.DEFAULT_OPTIONS, options)
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
  _configureRenderParts (options) {
    const parts = super._configureRenderParts(options)
    if (game.settings.get('dcc', 'enableLankhmar')) {
      parts.character.template = 'systems/dcc/templates/actor-partial-pc-common-lankhmar.html'
      parts.equipment.template = 'systems/dcc/templates/actor-partial-pc-equipment-lankhmar.html'
    }
    return parts
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
    if (this.actor.type === 'Player' && this.actor.system.details.sheetClass !== 'Warrior') {
      await this.actor.update({
        'system.details.sheetClass': 'Warrior',
        'system.class.className': game.i18n.localize('DCC.Warrior'),
        'system.class.classLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.WarriorClassLink')),
        'system.class.mightyDeedsLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.MightyDeedsLink')),
        'system.config.attackBonusMode': 'autoPerAttack',
        'system.config.addClassLevelToInitiative': true
      })
    } else if (this.actor.type === 'Player' && !this.actor.system.class.classLink) {
      // Regenerate classLink if missing (e.g., core book wasn't installed initially)
      await this.actor.update({
        'system.class.classLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.WarriorClassLink')),
        'system.class.mightyDeedsLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.MightyDeedsLink'))
      })
    }

    return context
  }

  /** @override */
  async _onRender (context, options) {
    super._onRender(context, options)
  }
}

/**
 * Extend the zero-level/NPC sheet for a Wizard
 * @extends {DCCActorSheet}
 */
class DCCActorSheetWizard extends DCCActorSheet {
  /** @inheritDoc */
  static get DEFAULT_OPTIONS () {
    const options = {
      position: {
        height: 640
      }
    }
    if (game.settings.get('dcc', 'enableLankhmar')) {
      options.position.width = 855
      options.position.height = 705
    } else {
      options.position.width = 755
      options.position.height = 705
    }
    return foundry.utils.mergeObject(super.DEFAULT_OPTIONS, options)
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
  _configureRenderParts (options) {
    const parts = super._configureRenderParts(options)
    if (game.settings.get('dcc', 'enableLankhmar')) {
      parts.character.template = 'systems/dcc/templates/actor-partial-pc-common-lankhmar.html'
      parts.equipment.template = 'systems/dcc/templates/actor-partial-pc-equipment-lankhmar.html'
    }
    return parts
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
    if (this.actor.type === 'Player' && this.actor.system.details.sheetClass !== 'Wizard') {
      await this.actor.update({
        'system.details.sheetClass': 'Wizard',
        'system.class.className': game.i18n.localize('DCC.Wizard'),
        'system.class.classLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.WizardClassLink')),
        'system.class.spellcastingLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.SpellcastingLink')),
        'system.class.spellburnLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.SpellburnLink')),
        'system.class.spellCheckAbility': 'int',
        'system.config.attackBonusMode': 'flat',
        'system.config.showSpells': true
      })
    } else if (this.actor.type === 'Player' && !this.actor.system.class.classLink) {
      // Regenerate classLink if missing (e.g., core book wasn't installed initially)
      await this.actor.update({
        'system.class.classLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.WizardClassLink')),
        'system.class.spellcastingLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.SpellcastingLink')),
        'system.class.spellburnLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.SpellburnLink'))
      })
    }

    return context
  }

  /** @override */
  async _onRender (context, options) {
    super._onRender(context, options)
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
    if (this.actor.type === 'Player' && this.actor.system.details.sheetClass !== 'Dwarf') {
      await this.actor.update({
        'system.details.sheetClass': 'Dwarf',
        'system.class.className': game.i18n.localize('DCC.Dwarf'),
        'system.class.classLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.DwarfClassLink')),
        'system.class.mightyDeedsLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.MightyDeedsLink')),
        'system.config.attackBonusMode': 'autoPerAttack',
        'system.skills.shieldBash.useDeed': true
      })

      const shieldBashName = game.i18n.localize('DCC.ShieldBash')
      const hasBashWeapon = this.actor.items.some(item =>
        item.type === 'weapon' &&
        item.name === shieldBashName
      )

      if (!hasBashWeapon) {
        this.actor.createEmbeddedDocuments('Item', [{
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
      }
    } else if (this.actor.type === 'Player' && !this.actor.system.class.classLink) {
      // Regenerate classLink if missing (e.g., core book wasn't installed initially)
      await this.actor.update({
        'system.class.classLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.DwarfClassLink')),
        'system.class.mightyDeedsLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.MightyDeedsLink'))
      })
    }

    return context
  }

  /** @override */
  async _onRender (context, options) {
    super._onRender(context, options)
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
    if (this.actor.type === 'Player' && this.actor.system.details.sheetClass !== 'Elf') {
      await this.actor.update({
        'system.details.sheetClass': 'Elf',
        'system.class.className': game.i18n.localize('DCC.Elf'),
        'system.class.classLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.ElfClassLink')),
        'system.class.spellCheckAbility': 'int',
        'system.config.attackBonusMode': 'flat',
        'system.config.showSpells': true
      })
    } else if (this.actor.type === 'Player' && !this.actor.system.class.classLink) {
      // Regenerate classLink if missing (e.g., core book wasn't installed initially)
      await this.actor.update({
        'system.class.classLink': await TextEditor.enrichHTML(game.i18n.localize('DCC.ElfClassLink'))
      })
    }

    return context
  }

  /** @override */
  async _onRender (context, options) {
    super._onRender(context, options)
  }
}

/**
 * Extend the sheet for a generic upper level character
 * @extends {DCCActorSheet}
 */
class DCCActorSheetGeneric extends DCCActorSheet {
  /** @inheritDoc */
  static get DEFAULT_OPTIONS () {
    const options = {
      position: {
        height: 640
      }
    }
    if (game.settings.get('dcc', 'enableLankhmar')) {
      options.position.width = 755
    }
    return foundry.utils.mergeObject(super.DEFAULT_OPTIONS, options)
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
  _configureRenderParts (options) {
    const parts = super._configureRenderParts(options)
    if (game.settings.get('dcc', 'enableLankhmar')) {
      parts.character.template = 'systems/dcc/templates/actor-partial-pc-common-lankhmar.html'
      parts.equipment.template = 'systems/dcc/templates/actor-partial-pc-equipment-lankhmar.html'
    }
    return parts
  }

  /** @inheritDoc */
  static CLASS_TABS = {}

  /** @override */
  async _prepareContext (options) {
    const context = await super._prepareContext(options)

    // Only set class defaults on initial setup (when sheetClass doesn't match)
    if (this.actor.type === 'Player' && this.actor.system.details.sheetClass !== 'Generic') {
      await this.actor.update({
        'system.details.sheetClass': 'Generic',
        'system.class.className': game.i18n.localize('DCC.Generic'),
        'system.config.attackBonusMode': 'flat',
        'system.config.addClassLevelToInitiative': false,
        'system.config.showBackstab': false,
        'system.config.showSpells': false
      })
    }

    return context
  }

  /** @override */
  async _onRender (context, options) {
    super._onRender(context, options)
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
