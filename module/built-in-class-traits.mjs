/**
 * Built-in class-trait registrations for the DCC system itself (#998).
 *
 * Rules that used to check for a specific built-in class ID read a trait
 * from `game.dcc.registerClassTraits` instead, so a sibling-module class can
 * opt in to the same rule (a crawl Halfling Champion's two-weapon fighting,
 * a Dwarven Priest's idol magic). The system registers the built-in classes'
 * traits through the same helper, and `getClassTrait` falls back to this
 * table before the registry is populated (unit tests, pre-init).
 *
 * Traits (see `CLASS_TRAIT_TYPES` in `module/extension-api.mjs`):
 *
 * - `twoWeaponMinAgility` (number): two-weapon fighting uses at least this
 *   Agility for Table 4-3.
 * - `twoWeaponCritOnMax` (boolean): selects the lib's halfling two-weapon
 *   rules — at an effective Agility of 17 or less, a natural max on the
 *   reduced die is a crit and an automatic hit, on either hand. It also
 *   floors the Table 4-3 row at Agility 16 (#996).
 * - `twoWeaponFumbleBothOnes` (boolean): a two-weapon fumble needs both
 *   hands to roll a natural 1 (#968).
 * - `idolMagic` (boolean): spell checks and spell-like skills with no
 *   casting mode of their own default to cleric casting (disapproval, no
 *   spell loss).
 * - `detectSecretDoorsBonus` (string): bonus written to the Detect Secret
 *   Doors skill, e.g. `'+4'`.
 * - `luckRecovers` (boolean): spent Luck recovers rather than being lost
 *   for good (ability score log recovery class).
 */

export const BUILT_IN_CLASS_TRAITS = {
  cleric: {
    idolMagic: true
  },
  elf: {
    detectSecretDoorsBonus: '+4'
  },
  halfling: {
    twoWeaponMinAgility: 16,
    twoWeaponCritOnMax: true,
    twoWeaponFumbleBothOnes: true,
    luckRecovers: true
  },
  thief: {
    luckRecovers: true
  }
}

/**
 * Register every built-in class's traits through the supplied register
 * function (the system calls it with `registerClassTraits` at init).
 * @param {(classId: string, traits: object) => void} register
 */
export function registerBuiltInClassTraits (register) {
  for (const [classId, traits] of Object.entries(BUILT_IN_CLASS_TRAITS)) {
    register(classId, traits)
  }
}
