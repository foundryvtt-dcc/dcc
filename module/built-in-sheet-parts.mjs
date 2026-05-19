/**
 * Built-in class-sheet-parts registrations for the DCC system itself.
 *
 * Phase 5 session 4 of the `refactor/dcc-core-lib-adapter` arc lifts
 * the per-class `CLASS_PARTS` + `CLASS_TABS` statics off each per-class
 * PC sheet subclass in `module/actor-sheets-dcc.js` and onto the
 * `game.dcc.registerSheetPart` registry. The DCC system dogfoods its
 * own helper by registering one entry per built-in PC class; the
 * shared `DCCSheet` base class consumes the registry via inherited
 * static getters (`static get CLASS_PARTS`, `static get CLASS_TABS`)
 * keyed on `this.CLASS_ID`. The per-class subclasses collapse to
 * 4-line stubs that pin `static CLASS_ID = '<classId>'`.
 *
 * Each entry shape is understood by `DCCSheet` (which reads
 * `parts` for `_configureRenderParts` and `tabs` for
 * `_getTabsConfig`):
 *
 * - `parts` — `partKey → { id, template }`. Standard ApplicationV2
 *   PARTS shape. The `character` + `equipment` keys override the base
 *   DCCActorSheet's NPC-flavored templates with the PC-flavored ones;
 *   each class adds its own class-specific part(s) on top. Templates
 *   are pre-registered via `loadTemplates` in `module/dcc.js:init`.
 * - `tabs` — `group → { tabs: [{ id, group, label }, …] }`. Inserted
 *   between the base TABS (character + equipment) and END_TABS
 *   (effects + notes) by the `DCCSheet._getTabsConfig` override. The
 *   character + equipment entries here are a legacy shape pre-dating
 *   Phase 5 session 4 — preserved byte-for-byte from the original
 *   sheet subclasses to keep the refactor observational.
 */

export const BUILT_IN_SHEET_PARTS = {
  cleric: {
    parts: {
      character: { id: 'character', template: 'systems/dcc/templates/actor-partial-pc-common.html' },
      equipment: { id: 'equipment', template: 'systems/dcc/templates/actor-partial-pc-equipment.html' },
      clericSpells: { id: 'clericSpells', template: 'systems/dcc/templates/actor-partial-cleric-spells.html' },
      cleric: { id: 'cleric', template: 'systems/dcc/templates/actor-partial-cleric.html' }
    },
    tabs: {
      sheet: {
        tabs: [
          { id: 'character', group: 'sheet', label: 'DCC.Character' },
          { id: 'equipment', group: 'sheet', label: 'DCC.Equipment' },
          { id: 'cleric', group: 'sheet', label: 'DCC.Cleric' },
          { id: 'clericSpells', group: 'sheet', label: 'DCC.ClericSpells' }
        ]
      }
    }
  },
  dwarf: {
    parts: {
      character: { id: 'character', template: 'systems/dcc/templates/actor-partial-pc-common.html' },
      equipment: { id: 'equipment', template: 'systems/dcc/templates/actor-partial-pc-equipment.html' },
      dwarf: { id: 'dwarf', template: 'systems/dcc/templates/actor-partial-dwarf.html' }
    },
    tabs: {
      sheet: {
        tabs: [
          { id: 'character', group: 'sheet', label: 'DCC.Character' },
          { id: 'equipment', group: 'sheet', label: 'DCC.Equipment' },
          { id: 'dwarf', group: 'sheet', label: 'DCC.Dwarf' }
        ]
      }
    }
  },
  elf: {
    parts: {
      character: { id: 'character', template: 'systems/dcc/templates/actor-partial-pc-common.html' },
      equipment: { id: 'equipment', template: 'systems/dcc/templates/actor-partial-pc-equipment.html' },
      elf: { id: 'elf', template: 'systems/dcc/templates/actor-partial-elf.html' },
      wizardSpells: { id: 'wizardSpells', template: 'systems/dcc/templates/actor-partial-wizard-spells.html' }
    },
    tabs: {
      sheet: {
        tabs: [
          { id: 'character', group: 'sheet', label: 'DCC.Character' },
          { id: 'equipment', group: 'sheet', label: 'DCC.Equipment' },
          { id: 'elf', group: 'sheet', label: 'DCC.Elf' },
          { id: 'wizardSpells', group: 'sheet', label: 'DCC.WizardSpells' }
        ]
      }
    }
  },
  halfling: {
    parts: {
      character: { id: 'character', template: 'systems/dcc/templates/actor-partial-pc-common.html' },
      equipment: { id: 'equipment', template: 'systems/dcc/templates/actor-partial-pc-equipment.html' },
      halfling: { id: 'halfling', template: 'systems/dcc/templates/actor-partial-halfling.html' }
    },
    tabs: {
      sheet: {
        tabs: [
          { id: 'character', group: 'sheet', label: 'DCC.Character' },
          { id: 'equipment', group: 'sheet', label: 'DCC.Equipment' },
          { id: 'halfling', group: 'sheet', label: 'DCC.Halfling' }
        ]
      }
    }
  },
  thief: {
    parts: {
      character: { id: 'character', template: 'systems/dcc/templates/actor-partial-pc-common.html' },
      equipment: { id: 'equipment', template: 'systems/dcc/templates/actor-partial-pc-equipment.html' },
      thief: { id: 'thief', template: 'systems/dcc/templates/actor-partial-thief.html' }
    },
    tabs: {
      sheet: {
        tabs: [
          { id: 'character', group: 'sheet', label: 'DCC.Character' },
          { id: 'equipment', group: 'sheet', label: 'DCC.Equipment' },
          { id: 'thief', group: 'sheet', label: 'DCC.Thief' }
        ]
      }
    }
  },
  warrior: {
    parts: {
      character: { id: 'character', template: 'systems/dcc/templates/actor-partial-pc-common.html' },
      equipment: { id: 'equipment', template: 'systems/dcc/templates/actor-partial-pc-equipment.html' },
      warrior: { id: 'warrior', template: 'systems/dcc/templates/actor-partial-warrior.html' }
    },
    tabs: {
      sheet: {
        tabs: [
          { id: 'character', group: 'sheet', label: 'DCC.Character' },
          { id: 'equipment', group: 'sheet', label: 'DCC.Equipment' },
          { id: 'warrior', group: 'sheet', label: 'DCC.Warrior' }
        ]
      }
    }
  },
  wizard: {
    parts: {
      character: { id: 'character', template: 'systems/dcc/templates/actor-partial-pc-common.html' },
      equipment: { id: 'equipment', template: 'systems/dcc/templates/actor-partial-pc-equipment.html' },
      wizard: { id: 'wizard', template: 'systems/dcc/templates/actor-partial-wizard.html' },
      wizardSpells: { id: 'wizardSpells', template: 'systems/dcc/templates/actor-partial-wizard-spells.html' }
    },
    tabs: {
      sheet: {
        tabs: [
          { id: 'character', group: 'sheet', label: 'DCC.Character' },
          { id: 'equipment', group: 'sheet', label: 'DCC.Equipment' },
          { id: 'wizard', group: 'sheet', label: 'DCC.Wizard' },
          { id: 'wizardSpells', group: 'sheet', label: 'DCC.WizardSpells' }
        ]
      }
    }
  }
}

/**
 * Register every entry in `BUILT_IN_SHEET_PARTS` with the supplied
 * `registerSheetPart` function. Production code (`module/dcc.js:init`)
 * is the only consumer today — `DCCSheet` resolves the registry only
 * at sheet-render time, so integration tests that don't open sheets
 * don't need the seed.
 *
 * @param {(classId: string, descriptor: object) => void} register
 *   The `registerSheetPart` from `module/extension-api.mjs`.
 */
export function registerBuiltInSheetParts (register) {
  for (const [classId, descriptor] of Object.entries(BUILT_IN_SHEET_PARTS)) {
    register(classId, descriptor)
  }
}
