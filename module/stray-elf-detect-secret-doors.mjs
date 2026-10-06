/**
 * Detect Secret Doors values left behind by the old elf schema mixin
 * (#1000). The mixin replaced the shared Player schema's
 * `skills.detectSecretDoors`, so every Player, and every pregen or
 * adventure actor exported while it shipped, carries the elf's Heightened
 * Senses triple. Used by the 0.73 world migration and by
 * `DCCActor._preCreate` (compendium and adventure imports skip the world
 * migration).
 */
import { getClassTraits } from './extension-api.mjs'

/** The base-body default every Player starts with. */
export const BASE_DETECT_SECRET_DOORS = Object.freeze({
  label: 'DCC.DetectSecretDoors',
  ability: '',
  value: '+0'
})

// Classes the system ships (plus the classless/0-level sheets). Homebrew
// classes are never reset: their module may be disabled or predate the
// `detectSecretDoorsBonus` trait, so the elf values could be intended.
const CORE_CLASS_IDS = new Set(['', 'zero', 'generic', 'cleric', 'dwarf', 'elf', 'halfling', 'thief', 'warrior', 'wizard'])

/**
 * The base Detect Secret Doors to write if `detect` is the untouched elf
 * triple on a core class without the `detectSecretDoorsBonus` trait, else
 * `null`. Edited values (any of label / ability / value changed) are kept.
 *
 * @param {object|undefined} detect - raw `system.skills.detectSecretDoors`
 * @param {string|undefined} sheetClass - raw `system.details.sheetClass`
 *   (legacy `dcc.DCCActorSheetWarrior` forms are accepted)
 * @param {object} [deps] - passed to `getClassTraits` (tests)
 * @returns {object|null}
 */
export function strayElfDetectSecretDoorsReset (detect, sheetClass, deps = {}) {
  if (detect?.label !== 'DCC.HeightenedSenses' || detect.ability !== 'int' || detect.value !== '+4') return null
  const classId = String(sheetClass ?? '').toLowerCase().replace(/^dcc\.dccactorsheet/, '')
  if (!CORE_CLASS_IDS.has(classId)) return null
  if (getClassTraits(classId, deps).detectSecretDoorsBonus) return null
  return { ...BASE_DETECT_SECRET_DOORS }
}
