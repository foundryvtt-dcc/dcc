/**
 * Built-in level-data item-name prefix registrations for the seven
 * canonical DCC PC classes.
 *
 * Phase 6 session 3 lifted the previously hardcoded
 * `BUILT_IN_CLASS_LEVEL_NAMES` table out of
 * `module/adapter/foundry-data-loader.mjs` and onto the
 * `CONFIG.DCC.classLevelNames` registry contributed via
 * `game.dcc.registerHomebrewClassForProgressionLoad`. The DCC system
 * dogfoods its own helper by registering one entry per built-in class
 * through this single entry point; sibling content modules that ship
 * homebrew classes call the same helper from their own `init` hook.
 *
 * The convention today is lowercase classId === lowercase itemPrefix
 * (both `'cleric'`, both `'warrior'`, …) because the level-data
 * packs that ship in `dcc-core-book` use the lowercase form. The
 * helper accepts an explicit `itemPrefix` argument so a homebrew pack
 * with a different prefix (e.g., classId `'my-druid'` →
 * itemPrefix `'druid'`) can register without renaming items.
 */

export const BUILT_IN_CLASS_LEVEL_NAMES = {
  cleric: 'cleric',
  dwarf: 'dwarf',
  elf: 'elf',
  halfling: 'halfling',
  thief: 'thief',
  warrior: 'warrior',
  wizard: 'wizard'
}

/**
 * Register all built-in class level-name entries through the supplied
 * registration helper (production wires this to
 * `registerHomebrewClassForProgressionLoad`). Kept as a thin loop so
 * `module/dcc.js`'s init hook reads as a list of `register…` calls
 * without inlining the built-in payload.
 *
 * @param {(classId: string, itemPrefix: string) => void} register
 */
export function registerBuiltInClassLevelNames (register) {
  for (const [classId, itemPrefix] of Object.entries(BUILT_IN_CLASS_LEVEL_NAMES)) {
    register(classId, itemPrefix)
  }
}
