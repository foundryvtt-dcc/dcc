/* global game */
// noinspection JSClosureCompilerSyntax

/**
 * DCC PC sheet bases + per-class subclasses.
 *
 * `DCCSheet` is the Player-side intermediate between `DCCActorSheet`
 * (NPC base) and the per-class subclasses. It consumes the
 * `CONFIG.DCC.sheetParts` registry via inherited static getters keyed
 * on `static CLASS_ID`, so each per-class subclass is a 4-line stub
 * that just pins its classId. `_prepareContext` runs the shared
 * `applyClassDefaults` + `applyClassStartingItems` write/auto-create
 * pair gated on `this.constructor.CLASS_ID` resolving to a registered
 * entry.
 *
 * Sibling modules registering a homebrew class do the four-call
 * sequence in their `init` hook (see `EXTENSION_API.md`):
 *
 *   game.dcc.registerClassMixin('<id>', mixinFn)
 *   game.dcc.registerClassDefaults('<id>', defaults)
 *   game.dcc.registerClassStartingItems('<id>', items)  // optional
 *   game.dcc.registerSheetPart('<id>', { parts, tabs })
 *
 * Then a tiny sheet subclass:
 *
 *   class MyHomebrewSheet extends DCCSheet {
 *     static DEFAULT_OPTIONS = { position: { height: 660 } }
 *     static CLASS_ID = '<id>'
 *   }
 *
 * registered via `game.dcc.registerActorSheet('Player', MyHomebrewSheet, …)`.
 */

import DCCActorSheet from './actor-sheet.js'
import { applyClassDefaults, applyClassStartingItems } from './extension-api.mjs'

/**
 * Shared Player-side sheet base. Reads parts + tabs from the
 * `CONFIG.DCC.sheetParts` registry by `this.CLASS_ID`; the per-class
 * subclasses below pin that field and inherit everything else.
 *
 * @extends {DCCActorSheet}
 */
class DCCSheet extends DCCActorSheet {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    position: {
      height: 660
    }
  }

  /**
   * Lowercase canonical class identifier (`'halfling'`, `'cleric'`, …)
   * — pinned by each per-class subclass. Resolves the entry in
   * `CONFIG.DCC.sheetParts` used for `CLASS_PARTS` + `CLASS_TABS` and
   * the `classId` passed to `applyClassDefaults` /
   * `applyClassStartingItems` on first open. Subclasses MUST override.
   * @type {string | null}
   */
  static CLASS_ID = null

  /**
   * Inherited static getter — resolves CLASS_PARTS from
   * `CONFIG.DCC.sheetParts[this.CLASS_ID].parts` at lookup time.
   * `this` in a static getter is the class the getter is accessed on
   * (e.g. `DCCActorSheetCleric.CLASS_PARTS` → `this === DCCActorSheetCleric`
   * → `this.CLASS_ID === 'cleric'` → registry lookup).
   */
  static get CLASS_PARTS () {
    if (!this.CLASS_ID) return {}
    return globalThis.CONFIG?.DCC?.sheetParts?.[this.CLASS_ID]?.parts ?? {}
  }

  /** Inherited static getter for tabs — same resolution pattern. */
  static get CLASS_TABS () {
    if (!this.CLASS_ID) return {}
    return globalThis.CONFIG?.DCC?.sheetParts?.[this.CLASS_ID]?.tabs ?? {}
  }

  /** @inheritDoc */
  async _prepareContext (options) {
    const context = await super._prepareContext(options)
    const classId = this.constructor.CLASS_ID
    if (classId) {
      const result = await applyClassDefaults(this.options.document, classId)
      if (result === 'initialized') {
        const created = await applyClassStartingItems(this.options.document, classId)
        if (created.length > 0) this.render(false)
      }
    }
    return context
  }
}

/**
 * Extend the zero-level/NPC sheet for a Cleric.
 * @extends {DCCSheet}
 */
class DCCActorSheetCleric extends DCCSheet {
  static CLASS_ID = 'cleric'
}

/**
 * Extend the zero-level/NPC sheet for a Thief.
 * @extends {DCCSheet}
 */
class DCCActorSheetThief extends DCCSheet {
  static CLASS_ID = 'thief'
}

/**
 * Extend the zero-level/NPC sheet for a Halfling.
 * @extends {DCCSheet}
 */
class DCCActorSheetHalfling extends DCCSheet {
  static CLASS_ID = 'halfling'
}

/**
 * Extend the zero-level/NPC sheet for a Warrior.
 * @extends {DCCSheet}
 */
class DCCActorSheetWarrior extends DCCSheet {
  static CLASS_ID = 'warrior'
}

/**
 * Extend the zero-level/NPC sheet for a Wizard.
 * @extends {DCCSheet}
 */
class DCCActorSheetWizard extends DCCSheet {
  static CLASS_ID = 'wizard'
}

/**
 * Extend the zero-level/NPC sheet for a Dwarf.
 * @extends {DCCSheet}
 */
class DCCActorSheetDwarf extends DCCSheet {
  static CLASS_ID = 'dwarf'
}

/**
 * Extend the zero-level/NPC sheet for an Elf.
 * @extends {DCCSheet}
 */
class DCCActorSheetElf extends DCCSheet {
  static CLASS_ID = 'elf'
}

/**
 * Extend the sheet for a generic upper level character.
 * Stays separate from the per-class subclasses — no `CLASS_ID`, uses
 * a fully-static `PARTS` declaration, and its initial-setup logic
 * isn't class-bound (no enriched-HTML link, no auto-created starting
 * items).
 * @extends {DCCActorSheet}
 */
class DCCActorSheetGeneric extends DCCActorSheet {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    position: {
      height: 660
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
  DCCSheet,
  DCCActorSheetCleric,
  DCCActorSheetThief,
  DCCActorSheetHalfling,
  DCCActorSheetWarrior,
  DCCActorSheetWizard,
  DCCActorSheetDwarf,
  DCCActorSheetElf,
  DCCActorSheetGeneric
}
