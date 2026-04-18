/**
 * Foundry → dcc-core-lib `SpellCastInput` builder.
 *
 * Translates a Foundry DCCActor + spell item + call options into the
 * input shape the lib's `castSpell` / `calculateSpellCheck` expect
 * (see `@moonloch/dcc-core-lib/spells/cast.ts` and `spell-check.ts`).
 *
 * Phase 2 scope (session 1 — scaffold for generic casts only):
 *   - Session 1: handles the generic-castingMode path. No spellbook
 *     lookup, no caster-profile lookup — we synthesize a minimal
 *     `casterProfile` with all side-effect flags off
 *     (`usesCorruption` / `usesDisapproval` / `canSpellburn` /
 *     `usesMercurial` = `false`). The lib's castSpell treats the
 *     input as a side-effect-free cast, matching the
 *     "generic" semantics the Foundry config exposes at
 *     `module/config.js:188` — `generic` / `wizard` / `cleric`.
 *   - Session 2+: when wizard / cleric paths migrate, this module
 *     grows to look up the real caster profile via
 *     `getCasterProfile(classId)` from the lib, and to pull a
 *     spellbook entry from the actor's data model (wizard / cleric
 *     spellbook bridging lives here).
 */

/**
 * Caster types the synthesized generic spell declares itself castable by.
 * Liberal superset — the session-1 adapter does not gate on caster type
 * (it uses `castSpell` directly, bypassing `calculateSpellCheck`'s
 * caster-type check). Future sessions tighten this.
 */
const DEFAULT_SPELL_CASTER_TYPES = Object.freeze(['wizard', 'cleric', 'elf'])

/**
 * Normalize a Foundry die expression ('1d20', '1d14', 'd20', etc.) to
 * the lib's die shape ('d20', 'd14'). Falls back to 'd20' on anything
 * unparseable.
 */
function normalizeLibDie (die) {
  if (!die) return 'd20'
  const s = String(die).trim().toLowerCase()
  const match = /d(\d+)/.exec(s)
  return match ? `d${match[1]}` : 'd20'
}

/**
 * Build a lib `SpellCastInput` from a Foundry actor + spell item.
 *
 * @param {Object} actor - The DCCActor casting the spell.
 * @param {Object|null} spellItem - The DCCItem representing the spell.
 *   For the session-1 generic path this is non-null (the adapter gate
 *   requires a spell item). Null indicates a naked / synthetic cast,
 *   which the adapter does not currently handle.
 * @param {Object} [options] - Call-site options. Reads:
 *   - `abilityId` — spell-check ability override. Falls back to the
 *     actor's `system.class.spellCheckAbility`, then 'int'.
 * @returns {Object} A lib `SpellCastInput` suitable for
 *   `castSpell(input, { mode, roller }, events)`. Shape:
 *     `{ spell, spellbookEntry, casterProfile, casterLevel,
 *        abilityScore, abilityModifier, actionDie }`.
 */
export function buildSpellCastInput (actor, spellItem, options = {}) {
  const abilityId = options.abilityId || actor.system.class?.spellCheckAbility || 'int'
  const ability = actor.system.abilities?.[abilityId] || {}
  const abilityScore = Number(ability.value) || 10
  const abilityModifier = Number(ability.mod) || 0
  const casterLevel = Number(actor.system.details?.level?.value ?? 0)
  const spellLevel = Number(spellItem?.system?.level ?? 1)

  const spellId = spellItem?.id || spellItem?.name || 'generic-spell-check'
  const spellName = spellItem?.name || ''

  const casterProfile = {
    type: 'generic',
    spellCheckAbility: abilityId,
    usesMercurial: false,
    usesCorruption: false,
    usesDisapproval: false,
    canSpellburn: false,
    lostSpellRecovery: 'rest'
  }

  const spellbookEntry = {
    spellId,
    known: true,
    prepared: true,
    lost: false,
    timesPreparedOrCast: 0
  }

  const actionDie = normalizeLibDie(
    spellItem?.system?.spellCheck?.die ||
    actor.system.class?.spellCheckOverrideDie ||
    actor.system.attributes?.actionDice?.value
  )

  return {
    spell: {
      id: spellId,
      name: spellName,
      level: spellLevel,
      description: '',
      range: '',
      duration: '',
      castingTime: '',
      save: '',
      casterTypes: DEFAULT_SPELL_CASTER_TYPES,
      results: []
    },
    spellbookEntry,
    casterProfile,
    casterLevel,
    abilityScore,
    abilityModifier,
    actionDie
  }
}
