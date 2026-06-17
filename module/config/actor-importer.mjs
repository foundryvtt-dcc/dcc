// DCC actor-importer config data.
//
// Extracted from `module/config.js` (Phase 7 — Appendix-A config.js
// shrinkage arc). The data tables the stat-block importer reads: the
// actor-type select options (`importTypes`, rendered by
// `templates/dialog-actor-import.html` via the `config.importTypes`
// Handlebars context), the bulk-import warning threshold
// (`actorImporterPromptThreshold`), the list of compendium packs searched
// for matching items (`actorImporterItemPacks`), the birth-augur
// active-effects pack (`birthAugurEffectsPack`), and the weapon/spell
// name re-mapping table (`actorImporterNameMap`). All are consumed via the
// `CONFIG.DCC.*` object onto which `config.js` re-composes them, so the
// public `CONFIG.DCC` shape is unchanged. The only runtime consumer is
// `module/parser.js` (+ its import dialog template). Pure data — no
// behavior here.

/**
 * Import Types — actor-type select options for the import dialog.
 * @type {Object}
 */
export const importTypes = {
  Player: 'DCC.ActorTypePlayer',
  NPC: 'DCC.ActorTypeNPC'
}

/**
 * Actor importer warning threshold — prompt for confirmation before
 * bulk-importing more than this many parsed characters at once.
 * @type {number}
 */
export const actorImporterPromptThreshold = 25

/**
 * Compendium packs searched (in order) for matching items when importing
 * actors from a stat block.
 * @type {string[]}
 */
export const actorImporterItemPacks = [
  'dcc-core-book.dcc-core-ammunition',
  'dcc-core-book.dcc-core-armor',
  'dcc-core-book.dcc-core-equipment',
  'dcc-core-book.dcc-core-weapons',
  'dcc-core-book.dcc-core-mounts',
  'dcc-core-book.dcc-core-spells-wizard-1',
  'dcc-core-book.dcc-core-spells-wizard-2',
  'dcc-core-book.dcc-core-spells-wizard-3',
  'dcc-core-book.dcc-core-spells-wizard-4',
  'dcc-core-book.dcc-core-spells-wizard-5',
  'dcc-core-book.dcc-core-spells-cleric-1',
  'dcc-core-book.dcc-core-spells-cleric-2',
  'dcc-core-book.dcc-core-spells-cleric-3',
  'dcc-core-book.dcc-core-spells-cleric-4',
  'dcc-core-book.dcc-core-spells-cleric-5',
  'dcc-core-book.dcc-core-spells-patron'
]

/**
 * Compendium pack for birth augur active effects used by the actor importer.
 * @type {string}
 */
export const birthAugurEffectsPack = 'dcc-core-book.dcc-core-birth-augur-effects'

/**
 * Name re-mappings for the actor importer — maps a stat-block item name to
 * the canonical compendium item name(s) to search for.
 * @type {Object}
 */
export const actorImporterNameMap = {
  'Hammer (as club)': ['Club'],
  'Razor (as dagger)': ['Dagger'],
  'Cleaver (as axe)': ['Axe'],
  'Cudgel (as staff)': ['Staff'],
  'Awl (as dagger)': ['Dagger'],
  'Crowbar (as club)': ['Club'],
  'Shovel (as staff)': ['Staff'],
  'Pick (as club)': ['Club'],
  'Quill (as dart)': ['Dart'],
  'Scissors (as dagger)': ['Dagger'],
  'Pitchfork (as spear)': ['Spear'],
  'Trowel (as dagger)': ['Dagger'],
  'Knife (as dagger)': ['Dagger'],
  'Stick (as club)': ['Club'],
  'Patron Bond/Invoke Patron': ['Patron Bond', 'Patron Bond (Self)', 'Patron Bond (Other)', 'Invoke Patron'],
  'Demon Summoning': ['Demon Summoning', 'Demon Summoning - No Patron', 'Demon Summoning - Patron', 'Demon Summoning - True Name'],
  Blessing: ['Blessing', 'Blessing Self', 'Blessing Ally', 'Blessing Object']
}
