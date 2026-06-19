/**
 * Built-in class-defaults registrations for the DCC system itself.
 *
 * Phase 5 of the `refactor/dcc-core-lib-adapter` arc lifts the
 * `_prepareContext` first-open default-write block out of each per-class
 * sheet subclass in `module/actor-sheets-dcc.js` and onto the
 * `game.dcc.registerClassDefaults` registry. The DCC system dogfoods
 * its own helper by registering one entry per built-in PC class through
 * this single table; sibling modules contribute homebrew entries the
 * same way (Phase 5 §2.8 / §2.11).
 *
 * Each entry is a payload object understood by `applyClassDefaults`
 * (exported alongside `registerClassDefaults` in
 * `module/extension-api.mjs`):
 *
 * - `sheetClass`: capitalized sentinel written to
 *   `system.details.sheetClass`. Drives initial-setup vs.
 *   maintenance-vs.-no-op dispatch in `applyClassDefaults`.
 * - `localize`: `'class.path'` → `'DCC.I18nKey'`. Resolved via
 *   `game.i18n.localize`.
 * - `enrichHtml`: `'class.path'` → `'DCC.I18nKey'`. Localized then
 *   passed through `TextEditor.enrichHTML`, so compendium document
 *   links rendered as inline anchors. Regenerated on the maintenance
 *   branch when `system.class.classLink` is empty.
 * - `literal`: `'class.path'` → scalar value. Written verbatim.
 *
 * The Generic sheet stays inline in `actor-sheets-dcc.js` for now —
 * it's the upper-level fallback (not class-bound) and its
 * `_prepareContext` block has no maintenance branch.
 *
 * **No-op writes are preserved on purpose.** Many `literal` paths
 * (e.g. `class.disapproval = 1` on halflings) target fields that no
 * longer exist on the class's schema post-Phase-4. Foundry silently
 * drops writes to unknown paths, so these are functional no-ops, but
 * preserving them keeps this slice a byte-for-byte refactor. Cleanup
 * is on the Phase 5+ todo list once the registry shape is settled.
 */

export const BUILT_IN_CLASS_DEFAULTS = {
  cleric: {
    sheetClass: 'Cleric',
    localize: { 'class.className': 'DCC.Cleric' },
    enrichHtml: { 'class.classLink': 'DCC.ClericClassLink' },
    literal: {
      'class.spellCheckAbility': 'per',
      'details.critRange': 20,
      'config.attackBonusMode': 'flat',
      'config.addClassLevelToInitiative': false,
      'config.showBackstab': false,
      'config.showSpells': false,
      'skills.shieldBash.useDeed': false
    }
  },
  dwarf: {
    sheetClass: 'Dwarf',
    localize: { 'class.className': 'DCC.Dwarf' },
    enrichHtml: {
      'class.classLink': 'DCC.DwarfClassLink',
      'class.mightyDeedsLink': 'DCC.MightyDeedsLink'
    },
    literal: {
      'details.critRange': 20,
      'class.disapproval': 1,
      'config.attackBonusMode': 'autoPerAttack',
      'skills.shieldBash.useDeed': true,
      'config.addClassLevelToInitiative': false,
      'class.spellCheckAbility': null,
      'config.showBackstab': false
    }
  },
  elf: {
    sheetClass: 'Elf',
    localize: { 'class.className': 'DCC.Elf' },
    enrichHtml: { 'class.classLink': 'DCC.ElfClassLink' },
    literal: {
      'class.spellCheckAbility': 'int',
      'details.critRange': 20,
      'class.disapproval': 1,
      'config.attackBonusMode': 'flat',
      'config.addClassLevelToInitiative': false,
      'config.showSpells': true,
      'config.showBackstab': false,
      'skills.shieldBash.useDeed': false
    }
  },
  halfling: {
    sheetClass: 'Halfling',
    localize: { 'class.className': 'DCC.Halfling' },
    enrichHtml: { 'class.classLink': 'DCC.HalflingClassLink' },
    literal: {
      'details.critRange': 20,
      'class.disapproval': 1,
      'config.attackBonusMode': 'flat',
      'config.addClassLevelToInitiative': false,
      'class.spellCheckAbility': null,
      'config.showBackstab': false,
      'skills.shieldBash.useDeed': false
    }
  },
  thief: {
    sheetClass: 'Thief',
    localize: { 'class.className': 'DCC.Thief' },
    enrichHtml: { 'class.classLink': 'DCC.ThiefClassLink' },
    literal: {
      'details.critRange': 20,
      'class.disapproval': 1,
      'config.attackBonusMode': 'flat',
      'config.showBackstab': true,
      'config.addClassLevelToInitiative': false,
      'class.spellCheckAbility': null,
      'config.showSpells': false,
      'skills.shieldBash.useDeed': false
    }
  },
  warrior: {
    sheetClass: 'Warrior',
    localize: { 'class.className': 'DCC.Warrior' },
    enrichHtml: {
      'class.classLink': 'DCC.WarriorClassLink',
      'class.mightyDeedsLink': 'DCC.MightyDeedsLink'
    },
    literal: {
      'details.critRange': 20,
      'class.disapproval': 1,
      'config.attackBonusMode': 'autoPerAttack',
      'config.addClassLevelToInitiative': true,
      'class.spellCheckAbility': null,
      'config.showBackstab': false,
      'skills.shieldBash.useDeed': false
    }
  },
  wizard: {
    sheetClass: 'Wizard',
    localize: { 'class.className': 'DCC.Wizard' },
    enrichHtml: {
      'class.classLink': 'DCC.WizardClassLink',
      'class.spellcastingLink': 'DCC.SpellcastingLink',
      'class.spellburnLink': 'DCC.SpellburnLink'
    },
    literal: {
      'class.spellCheckAbility': 'int',
      'details.critRange': 20,
      'class.disapproval': 1,
      'config.attackBonusMode': 'flat',
      'config.addClassLevelToInitiative': false,
      'config.showSpells': true,
      'config.showBackstab': false,
      'skills.shieldBash.useDeed': false
    }
  }
}

/**
 * Register every entry in `BUILT_IN_CLASS_DEFAULTS` with the supplied
 * `registerClassDefaults` function. Production code (`module/dcc.js:init`)
 * is the only consumer today — integration tests don't open sheets, so
 * the registry has no observable effect outside of sheet-render paths.
 * Kept as a separate helper so any future test harness that DOES need
 * the seed can wire it without duplicating the table.
 *
 * @param {(classId: string, defaults: object) => void} register
 *   The `registerClassDefaults` from `module/extension-api.mjs`.
 */
export function registerBuiltInClassDefaults (register) {
  for (const [classId, defaults] of Object.entries(BUILT_IN_CLASS_DEFAULTS)) {
    register(classId, defaults)
  }
}
