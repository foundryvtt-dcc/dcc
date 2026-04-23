/**
 * Foundry → dcc-core-lib character accessor adapter.
 *
 * dcc-core-lib is pure and agnostic: its check pipeline reads character
 * data through the CharacterAccessors interface. We translate Foundry
 * DCCActor shape into the minimal Character structure that
 * DEFAULT_ACCESSORS expects, and provide a lookup hook for the
 * DCC-specific save-id mapping.
 *
 * Phase 1 scope: the fields needed for ability checks, saving throws,
 * skill checks, and initiative — i.e. abilities, saves, level, luck,
 * classId. Combat / spell / attack fields land in later phases.
 *
 * All reads happen against *post-Active-Effects* values, because
 * Foundry applies AEs before `prepareDerivedData` runs and by the time
 * this runs, `actor.system.*` reflects the AE-modified state.
 */

/**
 * DCC save IDs in Foundry (frt/ref/wil) differ from lib save IDs
 * (fortitude/reflex/will). Map between them.
 */
const FOUNDRY_TO_LIB_SAVE_ID = Object.freeze({
  frt: 'fortitude',
  ref: 'reflex',
  wil: 'will'
})

const LIB_TO_FOUNDRY_SAVE_ID = Object.freeze({
  fortitude: 'frt',
  reflex: 'ref',
  will: 'wil'
})

/**
 * Parse a save value that Foundry stores as a signed string like "+2" or "-1".
 */
function parseSaveValue (raw) {
  if (raw === undefined || raw === null) return 0
  if (typeof raw === 'number') return raw
  const n = parseInt(String(raw), 10)
  return Number.isFinite(n) ? n : 0
}

/**
 * Build a lib `Character` shape from a Foundry DCCActor.
 *
 * We populate only the fields that the lib's check / save / skill /
 * initiative pipeline actually reads. Extra fields on the Character
 * type (birthAugur, combat, currency, inventory, …) are unused by
 * these pipelines; later phases will fill them as needed.
 */
export function actorToCharacter (actor) {
  const abilities = actor.system.abilities ?? {}
  const saves = actor.system.saves ?? {}

  // Workaround for dcc-core-lib double-counting the save's ability mod:
  // the lib's save check definition has `roll.ability` set (Fort→sta,
  // Ref→agl, Will→per), so the resolver auto-adds the ability modifier.
  // The lib *also* adds `getSaveBonus(state.saves[id])` on top — and
  // Foundry's `saves.{frt,ref,wil}.value` already bakes the ability mod
  // into the displayed total (see actor.js#computeSaves). Subtract the
  // ability mod here so the lib's auto-add restores the correct total.
  // Remove this once dcc-core-lib treats `state.saves` as the final
  // bonus and stops auto-adding ability via `roll.ability` on saves.
  const aglMod = Number(abilities.agl?.mod) || 0
  const staMod = Number(abilities.sta?.mod) || 0
  const perMod = Number(abilities.per?.mod) || 0
  const libSaves = {
    reflex: parseSaveValue(saves.ref?.value) - aglMod,
    fortitude: parseSaveValue(saves.frt?.value) - staMod,
    will: parseSaveValue(saves.wil?.value) - perMod
  }

  const libAbilities = {}
  for (const id of ['str', 'agl', 'sta', 'per', 'int', 'lck']) {
    const a = abilities[id]
    if (a) {
      libAbilities[id] = {
        current: Number(a.value) || 0,
        max: Number(a.max ?? a.value) || 0
      }
    }
  }

  const className = actor.system.class?.className
  const classId = typeof className === 'string' && className.length > 0
    ? className.toLowerCase()
    : undefined

  return {
    identity: {
      id: actor.uuid ?? actor._id ?? actor.id ?? 'unknown',
      name: actor.name ?? ''
    },
    state: {
      abilities: libAbilities,
      saves: libSaves
    },
    classInfo: {
      level: Number(actor.system.details?.level?.value ?? 0),
      ...(classId !== undefined ? { classId } : {})
    }
  }
}

/**
 * Map a lib save ID (reflex/fortitude/will) to the Foundry save ID
 * used in actor.system.saves.
 */
export function libSaveIdToFoundry (libSaveId) {
  return LIB_TO_FOUNDRY_SAVE_ID[libSaveId] ?? libSaveId
}

/**
 * Map a Foundry save ID (frt/ref/wil) to the lib save ID.
 */
export function foundrySaveIdToLib (foundrySaveId) {
  return FOUNDRY_TO_LIB_SAVE_ID[foundrySaveId] ?? foundrySaveId
}
