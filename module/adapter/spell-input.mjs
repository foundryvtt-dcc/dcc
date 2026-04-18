/**
 * Foundry → dcc-core-lib spell input builders.
 *
 * Two adapter paths:
 *   - `buildSpellCastInput(actor, spellItem, options)` — returns a
 *     lib `SpellCastInput` for `castSpell`. Session 1's
 *     generic-castingMode path. Uses `syntheticGenericProfile()` so
 *     the lib sees a side-effect-free caster.
 *   - `buildSpellCheckArgs(actor, spellItem, options)` — returns
 *     `{ character, input, profile }` for `calculateSpellCheck`.
 *     Session 2's wizard-castingMode path. Looks up the real caster
 *     profile via `getCasterProfile(classId)`, builds a lib
 *     `SpellbookEntry` from the Foundry spell item, and populates
 *     `character.state.classState.<type>.spellbook` so the lib's
 *     orchestration finds the entry. Returns `null` when the actor's
 *     class has no lib-side caster profile — callers should fall
 *     back to the legacy path.
 *
 * Session 2 (wizard spell loss) scope. Cleric disapproval is
 * session 3; patron taint / spellburn / mercurial migrate in
 * sessions 4–5.
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

  const character = {
    ...base,
    identity: {
      ...base.identity,
      startingLuck,
      birthAugur: { multiplier: 1 }
    },
    state: {
      ...base.state,
      classState: {
        ...(base.state?.classState || {}),
        [profile.type]: {
          spellbook: { spells: [spellbookEntry] }
        }
      }
    }
  }

  const actionDie = deriveActionDie(actor, spellItem)
  const abilityId = options.abilityId || profile.spellCheckAbility

  const input = {
    spell,
    actionDie
  }

  return { character, input, profile, abilityId }
}
