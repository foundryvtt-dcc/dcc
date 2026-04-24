/* global CONFIG, game */

/**
 * Foundry → dcc-core-lib spell input builders.
 *
 * Adapter paths:
 *   - `buildSpellCastInput(actor, spellItem, options)` — lib
 *     `SpellCastInput` for `castSpell` (generic-castingMode path,
 *     session 1). Uses `syntheticGenericProfile()` so the lib sees a
 *     side-effect-free caster.
 *   - `buildSpellCheckArgs(actor, spellItem, options)` — returns
 *     `{ character, input, profile }` for `calculateSpellCheck`
 *     (wizard / cleric / elf paths). Looks up the real caster
 *     profile via `getCasterProfile(classId)`, builds a lib
 *     `SpellbookEntry` from the Foundry spell item, and populates
 *     `character.state.classState.<type>.spellbook` so the lib's
 *     orchestration finds the entry. Returns `null` when the actor's
 *     class has no lib-side caster profile — callers should fall
 *     back to the legacy path.
 *   - `loadDisapprovalTable(actor)` / `loadMercurialMagicTable(actor)` —
 *     async. Each returns a lib `SimpleTable` / `MercurialTable`
 *     loaded from a configured Foundry `RollTable` (compendium or
 *     world), or `null` when unavailable.
 *
 * Session 4 populates `wizard.patron` / `elf.patron` so
 * `getPatronId(character)` resolves; D3a (2026-04-24) additionally
 * threads `input.patronTaintChance` + `input.isPatronSpell` so the
 * lib's RAW creeping-chance + result-table triggers fire. Post-cast,
 * `_castViaCalculateSpellCheck` persists `result.newPatronTaintChance`
 * back to `system.class.patronTaintChance`.
 *
 * Session 5 adds spellburn + mercurial wiring:
 *   - `input.spellburn` is forwarded from `options.spellburn` when the
 *     caller provides an ability-burn commitment. Callers today pass
 *     it programmatically — the spellburn modifier-dialog UI (see
 *     `roll-modifier.js`) still sits on the legacy path until a
 *     dedicated dialog-adapter lands.
 *   - `spellbookEntry.mercurialEffect` is populated from the Foundry
 *     item's stored mercurial effect so the lib's `onMercurialEffect`
 *     event fires per cast; when no mercurial is stored yet on a
 *     wizard / elf spell, the adapter pre-rolls one via
 *     `rollMercurialIfMissing` (see `module/actor.js`).
 */

import { getCasterProfile } from '../vendor/dcc-core-lib/index.js'
import { actorToCharacter } from './character-accessors.mjs'

/**
 * Caster-type whitelist declared on spell definitions for the
 * lib's `calculateSpellCheck` gate (`spell.casterTypes.includes(
 * profile.type)`). Liberal superset — the Foundry adapter does not
 * yet differentiate spell availability per caster type.
 */
const DEFAULT_SPELL_CASTER_TYPES = Object.freeze(['wizard', 'cleric', 'elf', 'generic'])

/**
 * Normalize a Foundry die expression ('1d20', '1d14', 'd20', etc.) to
 * the lib's die shape ('d20', 'd14'). Falls back to 'd20'.
 */
function normalizeLibDie (die) {
  if (!die) return 'd20'
  const s = String(die).trim().toLowerCase()
  const match = /d(\d+)/.exec(s)
  return match ? `d${match[1]}` : 'd20'
}

/**
 * Synthetic caster profile for the generic-castingMode path. Every
 * side-effect flag off — no spell loss, corruption, disapproval,
 * spellburn, or mercurial magic. Matches DCC's idol-magic /
 * side-effect-free semantics.
 */
export function syntheticGenericProfile (spellCheckAbility = 'int') {
  return {
    type: 'generic',
    spellCheckAbility,
    usesMercurial: false,
    usesCorruption: false,
    usesDisapproval: false,
    canSpellburn: false,
    lostSpellRecovery: 'rest'
  }
}

function deriveSpellId (spellItem) {
  return spellItem?.id || spellItem?.name || 'generic-spell-check'
}

function deriveActionDie (actor, spellItem) {
  return normalizeLibDie(
    spellItem?.system?.spellCheck?.die ||
    actor.system.class?.spellCheckOverrideDie ||
    actor.system.attributes?.actionDice?.value
  )
}

function deriveAbility (actor, options) {
  const abilityId = options.abilityId || actor.system.class?.spellCheckAbility || 'int'
  const ability = actor.system.abilities?.[abilityId] || {}
  return {
    abilityId,
    abilityScore: Number(ability.value) || 10,
    abilityModifier: Number(ability.mod) || 0
  }
}

/**
 * Build a lib `SpellDefinition` from a Foundry spell item.
 */
function buildSpellDefinition (spellItem) {
  return {
    id: deriveSpellId(spellItem),
    name: spellItem?.name || '',
    level: Number(spellItem?.system?.level ?? 1),
    description: '',
    range: '',
    duration: '',
    castingTime: '',
    save: '',
    casterTypes: DEFAULT_SPELL_CASTER_TYPES,
    results: []
  }
}

/**
 * Convert the Foundry spell item's `system.mercurialEffect` to a lib
 * `MercurialEffect`. Returns `null` when the item has no rolled effect
 * (the `value` field is the d100 roll total; absent until the wizard
 * rolls via `DCCItem.rollMercurialMagic` or the adapter's first-cast
 * auto-roll).
 */
function readMercurialEffect (spellItem) {
  const me = spellItem?.system?.mercurialEffect
  if (!me) return null
  const rollValue = Number(me.value)
  if (!Number.isFinite(rollValue) || rollValue === 0) return null
  return {
    rollValue,
    summary: me.summary || '',
    description: me.description || '',
    displayOnCast: me.displayInChat !== false
  }
}

/**
 * Build a lib `SpellbookEntry` from a Foundry spell item. Only the
 * fields the lib actually reads (`spellId`, `lost`, optional
 * `mercurialEffect` / `manifestation` / `lastResult`).
 */
export function buildSpellbookEntry (spellItem, spellId) {
  const entry = {
    spellId,
    lost: !!spellItem?.system?.lost
  }
  const lastResult = Number(spellItem?.system?.lastResult)
  if (Number.isFinite(lastResult) && lastResult !== 0) {
    entry.lastResult = lastResult
  }
  const mercurialEffect = readMercurialEffect(spellItem)
  if (mercurialEffect) {
    entry.mercurialEffect = mercurialEffect
  }
  return entry
}

/**
 * Build a lib `SpellCastInput` for the generic-castingMode adapter
 * path. Side-effect-free — uses `syntheticGenericProfile` so
 * `castSpell`'s spell-loss / corruption / disapproval branches all
 * stay dormant.
 */
export function buildSpellCastInput (actor, spellItem, options = {}) {
  const { abilityId, abilityScore, abilityModifier } = deriveAbility(actor, options)
  const casterLevel = Number(actor.system.details?.level?.value ?? 0)
  const actionDie = deriveActionDie(actor, spellItem)
  const spell = buildSpellDefinition(spellItem)

  return {
    spell,
    spellbookEntry: buildSpellbookEntry(spellItem, spell.id),
    casterProfile: syntheticGenericProfile(abilityId),
    casterLevel,
    abilityScore,
    abilityModifier,
    actionDie
  }
}

/**
 * Resolve the lib caster profile for the actor's class. Returns
 * `null` when no lib-side profile exists (e.g. Warrior, Thief, or a
 * homebrew class unknown to `getCasterProfile`) — the adapter
 * treats that as a signal to drop back to the legacy path.
 */
function resolveCasterProfile (actor) {
  const classId = (actor.system.class?.className || '').toLowerCase()
  if (!classId) return null
  return getCasterProfile(classId) ?? null
}

/**
 * Build `{ character, input, profile }` for the lib's
 * `calculateSpellCheck`. The returned `character` extends
 * `actorToCharacter` with:
 *   - `identity.birthAugur.multiplier` + `identity.startingLuck` —
 *     read by the lib's luck-modifier helpers. Session 2 does not
 *     migrate luck burn, so defaults are sensible (multiplier 1,
 *     startingLuck from `abilities.lck.max`).
 *   - `state.classState.<profile.type>.spellbook` — single-entry
 *     spellbook so `calculateSpellCheck`'s `findSpellEntry` lookup
 *     succeeds. The entry mirrors the Foundry item's `system.lost`
 *     field; marking-lost is a result-of-cast effect handled via
 *     `onSpellLost` in `spell-events.mjs`.
 *
 * Returns `null` when the actor's class has no lib-side caster
 * profile.
 *
 * @param {Object} actor - DCCActor
 * @param {Object} spellItem - Foundry spell item
 * @param {Object} [options] - Call-site options. Reads `abilityId`.
 * @returns {Object|null}
 */
export function buildSpellCheckArgs (actor, spellItem, options = {}) {
  const profile = resolveCasterProfile(actor)
  if (!profile) return null

  const spell = buildSpellDefinition(spellItem)
  const spellbookEntry = buildSpellbookEntry(spellItem, spell.id)

  const base = actorToCharacter(actor)
  const startingLuck = Number(
    actor.system.abilities?.lck?.max ??
    actor.system.abilities?.lck?.value ??
    0
  )

  const classState = {
    ...(base.state?.classState || {}),
    [profile.type]: {
      spellbook: { spells: [spellbookEntry] }
    }
  }

  // Cleric profile needs a disapproval range so the lib's
  // `getDisapprovalRange(character)` read succeeds. Fall back to the
  // lib's default (1) if the actor has no value yet.
  if (profile.type === 'cleric') {
    const disapprovalRange = Number(actor.system.class?.disapproval)
    classState.cleric = {
      ...classState.cleric,
      disapprovalRange: Number.isFinite(disapprovalRange) && disapprovalRange > 0
        ? disapprovalRange
        : 1
    }
  }

  // Wizard / elf profiles can be patron-bound. Populate the patron id
  // so `getPatronId(character)` returns the actor's bound patron and the
  // lib records `castInput.patron`. D3a (2026-04-24) routes patron taint
  // fully through the lib's RAW pipeline — creeping-chance + result-table
  // triggers — and the adapter persists `newPatronTaintChance` via
  // `_castViaCalculateSpellCheck`'s post-cast update. No Foundry-side
  // mechanic remains.
  if (profile.type === 'wizard' || profile.type === 'elf') {
    const patron = actor.system.class?.patron
    if (patron) {
      classState[profile.type] = {
        ...classState[profile.type],
        patron
      }
    }
  }

  const character = {
    ...base,
    identity: {
      ...base.identity,
      startingLuck,
      birthAugur: { multiplier: 1 }
    },
    state: {
      ...base.state,
      classState
    }
  }

  const actionDie = deriveActionDie(actor, spellItem)
  const abilityId = options.abilityId || profile.spellCheckAbility

  const input = {
    spell,
    actionDie
  }

  // Session 5 — spellburn commitment. The caller (not wired yet to the
  // roll-modifier dialog; see module docstring) passes a lib
  // `SpellburnCommitment` via `options.spellburn`. The lib's
  // `calculateSpellCheck` forwards it to `castInput.spellburn`; the
  // `onSpellburnApplied` bridge in `spell-events.mjs` subtracts the
  // burn from the actor's ability scores post-cast. Only wizard /
  // elf profiles have `canSpellburn: true` in the lib — for cleric
  // the commitment is dropped by `buildSpellCheckModifiers`.
  if (options.spellburn && typeof options.spellburn === 'object') {
    const burn = options.spellburn
    const str = Number(burn.str) || 0
    const agl = Number(burn.agl) || 0
    const sta = Number(burn.sta) || 0
    if (str > 0 || agl > 0 || sta > 0) {
      input.spellburn = { str, agl, sta }
    }
  }

  // D3a — patron-taint plumbing for wizard / elf.
  // `patronTaintChance`: parsed from `system.class.patronTaintChance`
  //   (stored on the actor as a percent string like "3%"; defaults to 1
  //   when absent or unparseable).
  // `isPatronSpell`: derived from the Foundry item's legacy-patron
  //   detection — name prefix "Patron" OR a configured
  //   `system.associatedPatron` string. Matches the detection
  //   `processSpellCheck` uses at `module/dcc.js:609`.
  if (profile.type === 'wizard' || profile.type === 'elf') {
    const chanceStr = actor.system.class?.patronTaintChance
    const parsedChance = parseInt(chanceStr, 10)
    input.patronTaintChance = Number.isFinite(parsedChance) && parsedChance >= 1
      ? parsedChance
      : 1

    const spellName = spellItem?.name || ''
    const associatedPatron = spellItem?.system?.associatedPatron || ''
    input.isPatronSpell = spellName.includes('Patron') || !!associatedPatron
  }

  return { character, input, profile, abilityId }
}

/**
 * Walk a Foundry `RollTable`'s results list, producing `[min, max,
 * source]` triples for any entry with a valid numeric range.
 * Shared by `toLibSimpleTable` + `toLibMercurialTable` — the only
 * difference between the two is the per-entry projection.
 */
function foundryTableEntries (foundryTable, project) {
  const results = foundryTable?.results
  if (!results) return null
  const entries = []
  for (const entry of results) {
    const [min, max] = Array.isArray(entry.range) ? entry.range : [0, 0]
    if (!Number.isFinite(min) || !Number.isFinite(max)) continue
    entries.push(project(entry, min, max))
  }
  if (entries.length === 0) return null
  return entries
}

/**
 * Convert a Foundry `RollTable` document to a lib `SimpleTable`. The
 * lib's `lookupSimple` indexes entries by `[min, max]` ranges, so
 * each Foundry `TableResult` maps to one entry.
 */
function toLibSimpleTable (foundryTable) {
  const entries = foundryTableEntries(foundryTable, (entry, min, max) => ({
    min,
    max,
    text: entry.description || entry.text || entry.name || ''
  }))
  if (!entries) return null
  return {
    id: foundryTable.id || foundryTable.name || 'foundry-table',
    name: foundryTable.name || '',
    entries
  }
}

/**
 * Convert a Foundry `RollTable` document to a lib `MercurialTable`.
 * Per-entry shape carries `summary` + `description` + `displayOnCast`
 * so the lib's `MercurialEffect` lookup (see `spells/mercurial.js`)
 * builds a complete effect. Summary is the first sentence of the
 * Foundry row description (mirrors `DCCItem.rollMercurialMagic:583`
 * which splits on `.` for the item's stored summary).
 */
function toLibMercurialTable (foundryTable) {
  const entries = foundryTableEntries(foundryTable, (entry, min, max) => {
    const text = entry.description || entry.text || entry.name || ''
    const summary = text.split('.')[0] || text
    return {
      min,
      max,
      summary,
      description: text,
      displayOnCast: true
    }
  })
  if (!entries) return null
  return {
    id: foundryTable.id || foundryTable.name || 'foundry-table',
    name: foundryTable.name || '',
    entries
  }
}

/**
 * Load the actor's configured disapproval table and convert it to
 * the lib's `SimpleTable` shape. Reads from the compendium pack
 * registry (`CONFIG.DCC.disapprovalPacks`) first, then falls back
 * to world tables — mirrors the resolution order the legacy
 * `_onRollDisapproval` walks (`actor.js:2858-2886`).
 *
 * Returns `null` when no table is resolvable (no pack configured,
 * table missing, or running under the Vitest mock environment with
 * no `CONFIG.DCC.disapprovalPacks` registry). Callers drop the
 * `input.disapprovalTable` field; the lib's `handleClericDisapproval`
 * then detects the triggered natural roll but skips the table-driven
 * sub-roll (which is the legacy behavior when the table is missing).
 *
 * Sessions 4–5 (corruption, patron taint, spellburn, mercurial) will
 * reuse the same Foundry-RollTable → lib-SimpleTable adapter via
 * `toLibSimpleTable`. Extract a shared loader then if the lookup
 * logic stays identical.
 *
 * @param {Object} actor - DCCActor (reads `system.class.disapprovalTable`).
 * @returns {Promise<Object|null>}
 */
export async function loadDisapprovalTable (actor) {
  const tableName = actor?.system?.class?.disapprovalTable
  if (!tableName) return null

  const packManager = (typeof CONFIG !== 'undefined' && CONFIG?.DCC?.disapprovalPacks) || null
  const packs = packManager?.packs || []

  for (const packName of packs) {
    if (!packName) continue
    const pack = game.packs?.get?.(packName)
    if (!pack) continue
    const entry = pack.index?.find?.((e) => `${packName}.${e.name}` === tableName)
    if (!entry) continue
    let doc
    try {
      doc = await pack.getDocument(entry._id)
    } catch (err) {
      // Corrupted pack entry, permission error, or socket failure —
      // continue the walk so the world-table fallback (and, failing
      // that, the null return) can take over instead of crashing the
      // cast with an unhandled rejection.
      console.warn('[DCC adapter] loadDisapprovalTable: pack.getDocument rejected', { packName, entryId: entry._id, err })
      continue
    }
    const libTable = toLibSimpleTable(doc)
    if (libTable) return libTable
  }

  // Fall back to world tables — same resolution pattern as the legacy
  // `_onRollDisapproval` walk: strip the pack prefix if present and
  // match by name.
  const worldTableName = tableName.includes('.')
    ? tableName.split('.').pop()
    : tableName
  const worldTable = game.tables?.find?.((t) => t.name === worldTableName)
  if (worldTable) {
    const libTable = toLibSimpleTable(worldTable)
    if (libTable) return libTable
  }

  return null
}

/**
 * Load the configured mercurial magic table and convert it to the
 * lib's `MercurialTable` shape. Reads `CONFIG.DCC.mercurialMagicTable`
 * (wired from the `dcc.mercurialMagicTable` world setting in
 * `module/dcc.js:503-507`) using the same pack-then-world resolution
 * the legacy `DCCItem.rollMercurialMagic:531-558` walks.
 *
 * Returns `null` when no table is resolvable (setting unset, pack
 * missing, unit-test env). Callers should skip mercurial pre-rolling
 * in that case — matches legacy "fall back to just displaying the
 * roll" behavior at `DCCItem.rollMercurialMagic:564`.
 *
 * @returns {Promise<Object|null>}
 */
export async function loadMercurialMagicTable () {
  const tableName = (typeof CONFIG !== 'undefined' && CONFIG?.DCC?.mercurialMagicTable) || null
  if (!tableName) return null

  // Compendium lookup — `packId.collectionName.tableName` (3 parts).
  const parts = tableName.split('.')
  if (parts.length === 3) {
    const pack = game.packs?.get?.(`${parts[0]}.${parts[1]}`)
    if (pack) {
      const entry = pack.index?.find?.((e) => e.name === parts[2])
      if (entry) {
        let doc
        try {
          doc = await pack.getDocument(entry._id)
        } catch (err) {
          // Fall through to the world-table branch rather than crash
          // the cast on a corrupted pack / permission / socket error.
          console.warn('[DCC adapter] loadMercurialMagicTable: pack.getDocument rejected', { pack: `${parts[0]}.${parts[1]}`, entryId: entry._id, err })
        }
        if (doc) {
          const libTable = toLibMercurialTable(doc)
          if (libTable) return libTable
        }
      }
    }
  }

  // World-table fallback — strip the pack prefix if present.
  const worldTableName = parts.length === 3 ? parts[2] : tableName
  const worldTable = game.tables?.getName?.(worldTableName)
  if (worldTable) {
    const libTable = toLibMercurialTable(worldTable)
    if (libTable) return libTable
  }

  return null
}
