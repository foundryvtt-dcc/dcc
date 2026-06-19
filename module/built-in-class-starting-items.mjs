/**
 * Built-in class-starting-items registrations for the DCC system itself.
 *
 * Phase 5 of the `refactor/dcc-core-lib-adapter` arc lifts auto-created
 * class equipment off the per-class sheet subclasses and onto the
 * `game.dcc.registerClassStartingItems` registry. The DCC system
 * dogfoods its own helper by registering one entry per built-in PC
 * class that needs starting equipment through this single table;
 * sibling modules contribute homebrew entries the same way
 * (Phase 5 §2.8 / §2.11).
 *
 * Today the dwarf is the only built-in class with starting items
 * (the ShieldBash weapon that the class sheet has historically
 * auto-created on first open). The table exists for homebrew classes
 * — a "Squire" class that needs a starting longsword, a "Cultist"
 * with a holy symbol — without forcing them to subclass or
 * monkey-patch the sheet.
 *
 * Each entry shape is understood by `applyClassStartingItems` in
 * `module/extension-api.mjs`:
 *
 * - `nameKey` — i18n key (e.g. `'DCC.ShieldBash'`); localized at apply
 *   time and used both for the created item's `name` and the
 *   "already have this item?" duplicate check.
 * - `type` — Foundry Item sub-type (`'weapon'`, `'armor'`, …).
 * - `img` — optional image path passed through to the create payload.
 * - `system` — optional `system: {...}` block.
 */

export const BUILT_IN_CLASS_STARTING_ITEMS = {
  dwarf: [
    {
      nameKey: 'DCC.ShieldBash',
      type: 'weapon',
      img: 'systems/dcc/styles/images/game-icons-net/shield-bash.svg',
      system: {
        melee: true,
        damage: '1d3',
        config: {
          actionDieOverride: '1d14'
        }
      }
    }
  ]
}

/**
 * Register every entry in `BUILT_IN_CLASS_STARTING_ITEMS` with the
 * supplied `registerClassStartingItems` function. Production code
 * (`module/dcc.js:init`) is the only consumer today — integration tests
 * don't open sheets, so the registry has no observable effect outside
 * of sheet-render paths. Kept as a separate helper so any future test
 * harness that DOES need the seed can wire it without duplicating the
 * table.
 *
 * @param {(classId: string, items: Array<object>) => void} register
 *   The `registerClassStartingItems` from `module/extension-api.mjs`.
 */
export function registerBuiltInClassStartingItems (register) {
  for (const [classId, items] of Object.entries(BUILT_IN_CLASS_STARTING_ITEMS)) {
    register(classId, items)
  }
}
