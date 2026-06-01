/* global ChatMessage, Roll, game */

/**
 * Renders dcc-core-lib result objects into Foundry ChatMessages.
 *
 * The lib produces pure data (`SkillCheckResult` — see
 * dcc-core-lib/types/skills.d.ts). Foundry's chat pipeline wants a
 * `Roll` object + flags + flavor. This module bridges the two,
 * preserving the flag contract that downstream modules
 * (dcc-qol, token-action-hud-dcc) parse.
 *
 * Covers Phase 1-2 flows: ability check, save, skill, spell check,
 * disapproval roll, mercurial effect. Initiative has no renderer
 * here — Foundry's `Combat#rollInitiative` posts the init chat with
 * the `flags.core.initiativeRoll` the `emoteInitiativeRoll` handler
 * gates on; bypassing that would break the emote integration (see
 * `_getInitiativeRollViaAdapter`'s Path-A rationale in `actor.js`).
 */

/**
 * Build the shared `dcc.libResult` flag payload from a lib result.
 *
 * The ability / save / skill / spell renderers all persist the lib's
 * core roll outcome (`die`, `natural`, `total`, `formula`, `critical`,
 * `fumble`, `modifiers`) onto the ChatMessage as `flags.dcc.libResult`
 * for downstream consumers (dcc-qol, token-action-hud-dcc). Those four
 * payloads were byte-identical apart from the result-id field
 * (`skillId` for checks vs `spellId` for spell checks) and the three
 * spell-only extras (`tier`, `spellLost`, `corruptionTriggered`). This
 * helper owns the shared core; callers pass their type-specific fields
 * via `extras`.
 *
 * Key order in the returned object differs from the pre-extraction
 * literals (the core fields now precede the spread `extras`), but the
 * flag is consumed by key name — not position — so the on-message
 * contract is unchanged.
 *
 * @param {Object} result - The lib's SkillCheckResult / SpellCheckResult.
 * @param {Object} [extras] - Type-specific fields merged onto the core
 *   payload, e.g. `{ skillId }` for checks or `{ spellId, tier,
 *   spellLost, corruptionTriggered }` for spell checks.
 * @returns {Object} The `dcc.libResult` flag payload.
 */
export function buildLibResultFlag (result, extras = {}) {
  return {
    die: result.die,
    natural: result.natural,
    total: result.total,
    formula: result.formula,
    critical: result.critical,
    fumble: result.fumble,
    modifiers: result.modifiers,
    ...extras
  }
}

/**
 * Apply the FleetingLuck flag update in place, if the luck-tracking
 * class is available. The ability / save / skill / spell renderers all
 * carried this identical guarded block (Phase 7 session 10 extraction).
 * Guarded because test mocks may not expose `game.dcc.FleetingLuck`,
 * and a no-op when `foundryRoll` is absent — both conditions match the
 * pre-extraction inline behavior. Mutates `flags`.
 *
 * @param {Object} flags - The ChatMessage flags object to mutate.
 * @param {Roll} [foundryRoll] - The evaluated Foundry Roll; no-op when
 *   absent.
 */
export function applyFleetingLuck (flags, foundryRoll) {
  if (game.dcc?.FleetingLuck?.updateFlags && foundryRoll) {
    game.dcc.FleetingLuck.updateFlags(flags, foundryRoll)
  }
}

/**
 * Minimal HTML escape for values interpolated into the breakdown markup.
 * Origin labels and ids can originate from user-authored content (e.g.
 * an equipment item's name), so escape before injecting into chat HTML.
 */
function escapeHtml (value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Format a number as a signed string for the breakdown (`+3`, `-1`,
 * `+0`). Returns `null` for a non-finite input so the caller can skip
 * the row rather than render `+NaN`.
 */
function signedNumber (value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return null
  return num >= 0 ? `+${num}` : `${num}`
}

/**
 * Resolve a human-readable label for a tagged-union modifier's origin.
 * Prefers the lib-supplied `origin.label`; the lib documents a
 * renderer-synthesized `category: id` fallback when `label` is absent
 * (see dcc-core-lib/types/dice.d.ts ModifierOrigin).
 */
function resolveOriginLabel (origin) {
  if (!origin) return null
  if (origin.label) return origin.label
  if (origin.category && origin.id) return `${origin.category}: ${origin.id}`
  return origin.id || origin.category || null
}

/**
 * Normalize one modifier — either a tagged-union `RollModifier`
 * (ability / save / skill results) or a flat `LegacyRollModifier`
 * (spell results) — into a `{ label, value }` display row, or `null`
 * if it should not appear in the breakdown.
 *
 * Tagged-union handling: `applied === false` rows are dropped (the
 * evaluator marks modifiers that did not contribute). Only the variants
 * that have a natural "term under the formula" reading are rendered —
 * `add` / `display` (signed numeric) and `add-dice` (a `+1d3`-style
 * dice term). `set-die` / `bump-die` / `multiply` / `threat-shift`
 * reshape the die or threat range rather than adding a flat term, so
 * the simple breakdown skips them. `display` modifiers are
 * informational (e.g. a 0-value armor check penalty) and always render.
 *
 * @param {Object} mod - A RollModifier or LegacyRollModifier.
 * @returns {{label: string, value: string}|null}
 */
function modifierToDisplayRow (mod) {
  if (!mod || typeof mod !== 'object') return null

  // Tagged-union RollModifier — discriminated by `kind`.
  if (typeof mod.kind === 'string') {
    if (mod.applied === false) return null
    const label = resolveOriginLabel(mod.origin)
    if (!label) return null
    switch (mod.kind) {
      case 'add':
      case 'display': {
        const value = signedNumber(mod.value)
        return value === null ? null : { label, value }
      }
      case 'add-dice':
        return mod.dice ? { label, value: `+${mod.dice}` } : null
      default:
        return null
    }
  }

  // LegacyRollModifier — flat `{ source, value, label? }`.
  const label = mod.label || mod.source
  if (!label) return null
  const value = signedNumber(mod.value)
  return value === null ? null : { label, value }
}

/**
 * Build the per-modifier breakdown HTML that lists each contributing
 * modifier as `<label> <signed value>` under the rolled formula. The
 * lib captures rich per-modifier metadata on every check / save / spell
 * result and the adapter persists it as `flags.dcc.libResult.modifiers`,
 * but nothing rendered it — Foundry's native term tooltip is also
 * unlabelled because the adapter builds the Roll from the lib's flat
 * formula string. This restores the labelled-term UX the legacy
 * `roll-modifier.js` path surfaced (PR #720 resilience item).
 *
 * Pure — the localized heading is passed in by the caller (the four
 * renderers already hold `game.i18n`), keeping this helper free of
 * Foundry globals and unit-testable in isolation, mirroring
 * `buildLibResultFlag`.
 *
 * @param {Array} modifiers - `result.modifiers`; a `RollModifier[]`
 *   (ability / save / skill) or `LegacyRollModifier[]` (spell).
 * @param {string} [heading] - Localized breakdown heading; omitted from
 *   the markup when falsy.
 * @returns {string} The breakdown `<div>` HTML, or `''` when there is
 *   nothing displayable.
 */
export function buildModifierBreakdownHtml (modifiers, heading = '') {
  if (!Array.isArray(modifiers) || modifiers.length === 0) return ''

  const rows = []
  for (const mod of modifiers) {
    const row = modifierToDisplayRow(mod)
    if (row) rows.push(row)
  }
  if (rows.length === 0) return ''

  const headingHtml = heading
    ? `<span class="dcc-modifier-breakdown-heading">${escapeHtml(heading)}</span>`
    : ''
  const items = rows
    .map(r =>
      `<li class="dcc-modifier-row"><span class="dcc-modifier-label">${escapeHtml(r.label)}</span><span class="dcc-modifier-value">${escapeHtml(r.value)}</span></li>`
    )
    .join('')

  return `<div class="dcc-modifier-breakdown">${headingHtml}<ul class="dcc-modifier-list">${items}</ul></div>`
}

/**
 * Render an ability-check result as a Foundry ChatMessage.
 *
 * @param {Object} params
 * @param {Object} params.actor - The DCCActor that rolled
 * @param {string} params.abilityId - e.g. 'str', 'agl'
 * @param {string} params.abilityLabel - Localized label e.g. 'Strength'
 * @param {Object} params.result - The lib's SkillCheckResult
 * @param {Roll} params.foundryRoll - The Foundry Roll instance that
 *   produced the dice. Attached to the ChatMessage for DSN / breakdown.
 * @returns {Promise<ChatMessage>} The created ChatMessage.
 */
export async function renderAbilityCheck ({
  actor,
  abilityId,
  abilityLabel,
  result,
  foundryRoll
}) {
  const flavor = `${abilityLabel} ${game.i18n.localize('DCC.Check')}`

  // Lib structured result goes into flags (arbitrary JSON) rather than
  // system (which is schema-constrained and will drop unknown fields).
  const flags = {
    'dcc.RollType': 'AbilityCheck',
    'dcc.Ability': abilityId,
    'dcc.isAbilityCheck': true,
    'dcc.libResult': buildLibResultFlag(result, { skillId: result.skillId })
  }

  if (abilityId === 'str' || abilityId === 'agl') {
    flags.checkPenaltyCouldApply = true
  }

  applyFleetingLuck(flags, foundryRoll)

  const toMessageData = {
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor,
    flags,
    system: {
      checkPenaltyRollIndex: null
    }
  }

  const breakdownHtml = buildModifierBreakdownHtml(
    result.modifiers,
    game.i18n.localize('DCC.ModifierBreakdown')
  )
  if (breakdownHtml) {
    const rollHTML = await foundryRoll.render()
    toMessageData.content = `${rollHTML}${breakdownHtml}`
  }

  const messageData = await foundryRoll.toMessage(toMessageData, { create: false })

  return ChatMessage.create(messageData)
}

/**
 * Render a roll-under ability check (Luck checks) as a Foundry
 * ChatMessage.
 *
 * Roll-under is a naked d20 compared against the ability score — no
 * modifiers and no crit/fumble classification — so it does NOT carry
 * the `dcc.libResult` modifier breakdown the standard renderers emit,
 * and (matching the legacy path) it does NOT apply Fleeting Luck: a
 * natural 1 is a *success* under roll-under and a natural 20 a failure,
 * so the standard nat-20/nat-1 luck flags would be inverted. Instead it
 * tags the rolled die with `options.dcc.rollUnder` + thresholds so
 * `highlightCriticalSuccessFailure` (module/chat.js) swaps the
 * success/failure highlight classes (roll ≤ score = success).
 *
 * Reproduces the legacy `_rollAbilityCheckLegacy` roll-under branch's
 * flag + flavor contract exactly; only the producing code path changed.
 *
 * @param {Object} params
 * @param {Object} params.actor - The DCCActor that rolled.
 * @param {string} params.abilityId - The ability id (always 'lck' in
 *   practice — roll-under is Luck-only).
 * @param {string} params.abilityLabel - Localized label e.g. 'Luck'.
 * @param {Object} params.result - The lib's luck-check result
 *   (`{ roll, target, success, label }`). `target` is the score the
 *   lib classified against; the highlight thresholds derive from it so
 *   highlight and success stay consistent.
 * @param {Roll} params.foundryRoll - The evaluated Foundry Roll (1d20).
 * @returns {Promise<ChatMessage>} The created ChatMessage.
 */
export async function renderAbilityCheckRollUnder ({
  actor,
  abilityId,
  abilityLabel,
  result,
  foundryRoll
}) {
  const flavor = `${abilityLabel} ${game.i18n.localize('DCC.CheckRollUnder')}`

  // Tag the rolled die so the chat highlight hook treats it as
  // roll-under: ≤ target highlights as success (critical class),
  // ≥ target+1 as failure (fumble class).
  const primaryTerm = foundryRoll.terms?.[0]
  if (primaryTerm) {
    primaryTerm.options = primaryTerm.options ?? {}
    primaryTerm.options.dcc = {
      rollUnder: true,
      lowerThreshold: result.target,
      upperThreshold: result.target + 1
    }
  }

  const flags = {
    'dcc.RollType': 'AbilityCheckRollUnder',
    'dcc.Ability': abilityId,
    'dcc.isAbilityCheck': true
  }

  const messageData = await foundryRoll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor,
    flags,
    system: {
      checkPenaltyRollIndex: null
    }
  }, { create: false })

  return ChatMessage.create(messageData)
}

/**
 * Render a saving-throw result as a Foundry ChatMessage.
 *
 * @param {Object} params
 * @param {Object} params.actor - The DCCActor that rolled
 * @param {string} params.saveId - Foundry save id ('frt' / 'ref' / 'wil').
 *   Stored on the flag as-is so downstream consumers see the same
 *   shape the legacy path emitted.
 * @param {string} params.saveLabel - Localized label e.g. 'Fortitude'
 * @param {Object} params.result - The lib's SkillCheckResult
 * @param {Roll} params.foundryRoll - The Foundry Roll instance.
 * @param {Object} [params.options] - Original call options. Supports
 *   `dc` / `showDc` for the DC suffix the legacy path rendered.
 * @returns {Promise<ChatMessage>} The created ChatMessage.
 */
export async function renderSavingThrow ({
  actor,
  saveId,
  saveLabel,
  result,
  foundryRoll,
  options = {}
}) {
  let flavor = `${saveLabel} ${game.i18n.localize('DCC.Save')}`

  if (options.dc !== undefined) {
    const dc = parseInt(options.dc)
    if (Number.isFinite(dc)) {
      const success = foundryRoll.total >= dc
      const resultLabel = success
        ? game.i18n.localize('DCC.SaveSuccess')
        : game.i18n.localize('DCC.SaveFailure')
      if (options.showDc) {
        flavor += ` (${game.i18n.format('DCC.SaveDC', { dc })}) \u2014 ${resultLabel}`
      } else {
        flavor += ` \u2014 ${resultLabel}`
      }
    }
  }

  const flags = {
    'dcc.RollType': 'SavingThrow',
    'dcc.Save': saveId,
    'dcc.isSave': true,
    'dcc.libResult': buildLibResultFlag(result, { skillId: result.skillId })
  }

  applyFleetingLuck(flags, foundryRoll)

  const toMessageData = {
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor,
    flags
  }

  const breakdownHtml = buildModifierBreakdownHtml(
    result.modifiers,
    game.i18n.localize('DCC.ModifierBreakdown')
  )
  if (breakdownHtml) {
    const rollHTML = await foundryRoll.render()
    toMessageData.content = `${rollHTML}${breakdownHtml}`
  }

  const messageData = await foundryRoll.toMessage(toMessageData, { create: false })

  return ChatMessage.create(messageData)
}

/**
 * Render a skill-check result as a Foundry ChatMessage.
 *
 * Preserves the legacy flag contract — `dcc.RollType: 'SkillCheck'`,
 * `dcc.ItemId` and `dcc.SkillId` set to the skill id (both emitted
 * regardless of whether the skill is a built-in slot or a skill
 * item, matching the pre-migration behavior), `dcc.isSkillCheck:
 * true` — plus a structured `dcc.libResult` payload. When the
 * skill is backed by an item with a description, the item body is
 * appended to the rendered roll content.
 *
 * @param {Object} params
 * @param {Object} params.actor - The DCCActor that rolled.
 * @param {string} params.skillId - The skill id (e.g. 'sneakSilently'
 *   or a skill item's name).
 * @param {string} params.skillLabel - Localized label for flavor.
 * @param {string} [params.abilityId] - Ability id if the skill rolls
 *   against one (e.g. 'int').
 * @param {string} params.abilityLabel - Parenthesized ability suffix
 *   for flavor (e.g. ' (Intelligence)' or '').
 * @param {Object} [params.skillItem] - Optional skill item document.
 *   When present and carrying a description, it is appended to the
 *   rendered chat content.
 * @param {Object} params.result - The lib's SkillCheckResult.
 * @param {Roll} params.foundryRoll - The evaluated Foundry Roll.
 * @returns {Promise<ChatMessage>} The created ChatMessage.
 */
export async function renderSkillCheck ({
  actor,
  skillId,
  skillLabel,
  abilityId,
  abilityLabel,
  skillItem,
  result,
  foundryRoll
}) {
  const flavor = `${skillLabel}${abilityLabel}`

  const flags = {
    'dcc.RollType': 'SkillCheck',
    'dcc.ItemId': skillId,
    'dcc.SkillId': skillId,
    'dcc.isSkillCheck': true,
    'dcc.libResult': buildLibResultFlag(result, { skillId: result.skillId })
  }

  if (abilityId) {
    flags['dcc.Ability'] = abilityId
  }

  applyFleetingLuck(flags, foundryRoll)

  const systemData = { skillId }

  const toMessageData = {
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor,
    flags,
    system: systemData
  }

  const breakdownHtml = buildModifierBreakdownHtml(
    result.modifiers,
    game.i18n.localize('DCC.ModifierBreakdown')
  )
  const description = skillItem?.system.description?.value || ''
  if (description) {
    systemData.skillDescription = description
  }

  // Manual roll render when either the breakdown or the skill-item
  // description needs to ride under the rolled formula (matches the
  // pre-extraction skill-description path; the breakdown sits between
  // the roll and the description).
  if (breakdownHtml || description) {
    const rollHTML = await foundryRoll.render()
    const descriptionHtml = description
      ? `<div class="skill-description">${description}</div>`
      : ''
    toMessageData.content = `${rollHTML}${breakdownHtml}${descriptionHtml}`
  }

  const messageData = await foundryRoll.toMessage(toMessageData, { create: false })

  return ChatMessage.create(messageData)
}

/**
 * Render a spell-check result as a Foundry ChatMessage.
 *
 * Renders a lib `SpellCheckResult` for all currently-migrated casting
 * modes (generic / wizard / cleric / patron-bound wizard-elf) into a
 * Foundry chat message. Preserves the `dcc.RollType: 'SpellCheck'` /
 * `dcc.isSpellCheck` flag contract the legacy `processSpellCheck`
 * path emits (so downstream consumers keep working), plus a
 * structured `dcc.libResult` payload carrying the lib's spell-check
 * outcome. Side effects (spell loss, cleric disapproval, spellburn,
 * mercurial magic, patron taint) land via `createSpellEvents` in
 * `spell-events.mjs` and are not re-applied here. Patron taint is
 * RAW-aligned in the lib (D3a, 2026-04-24); this path no longer
 * runs a Foundry-side taint mechanic.
 *
 * @param {Object} params
 * @param {Object} params.actor - The DCCActor that cast.
 * @param {Object} [params.spellItem] - The spell item being cast.
 * @param {string} params.flavor - Chat flavor (typically the spell
 *   name plus the ability suffix).
 * @param {Object} params.result - The lib's SpellCheckResult
 *   (see dcc-core-lib/types/spells.d.ts).
 * @param {Roll} params.foundryRoll - The evaluated Foundry Roll.
 * @returns {Promise<ChatMessage>} The created ChatMessage.
 */
export async function renderSpellCheck ({
  actor,
  spellItem,
  flavor,
  result,
  foundryRoll
}) {
  const flags = {
    'dcc.RollType': 'SpellCheck',
    'dcc.isSpellCheck': true,
    'dcc.isSkillCheck': true,
    'dcc.ItemId': spellItem?.id,
    'dcc.libResult': buildLibResultFlag(result, {
      spellId: result.spellId,
      tier: result.tier,
      spellLost: result.spellLost,
      corruptionTriggered: result.corruptionTriggered
    })
  }

  applyFleetingLuck(flags, foundryRoll)

  // Naked spell-check chat indicator. Mirrors the legacy
  // `processSpellCheck:702-710` no-table emit (the four
  // `DCC.SpellCheck*NoTable` strings) — the chat content carries a
  // pass/fail/crit/fumble HTML emote so players see a verdict without
  // a result table. Item-bound casts (with a result table) skip this
  // and let the lib's `result.resultText` surface through the
  // downstream SpellResult.addChatMessage path that the item-aware
  // dispatchers use.
  const nakedHtml = !spellItem ? buildNakedSpellResultHtml(result) : null

  const toMessagePayload = {
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor,
    flags,
    system: { spellId: spellItem?.id }
  }

  if (nakedHtml) {
    flags['dcc.spellResult'] = nakedHtml
  }

  // Manual roll render when either the breakdown or the naked-cast
  // verdict needs to ride under the rolled formula. The breakdown sits
  // between the roll and the verdict emote. Spell results carry the
  // `LegacyRollModifier` shape; `buildModifierBreakdownHtml` handles it.
  const breakdownHtml = buildModifierBreakdownHtml(
    result.modifiers,
    game.i18n.localize('DCC.ModifierBreakdown')
  )
  if (breakdownHtml || nakedHtml) {
    const rollHTML = await foundryRoll.render()
    toMessagePayload.content = `${rollHTML}${breakdownHtml}${nakedHtml || ''}`
  }

  const messageData = await foundryRoll.toMessage(toMessagePayload, { create: false })

  return ChatMessage.create(messageData)
}

/**
 * Build the inline pass/fail/crit/fumble HTML for naked spell checks.
 * Mirrors the four `DCC.SpellCheck*NoTable` strings the legacy
 * `processSpellCheck` emits for item-less casts. The lib's tier
 * classification drives the verdict (tier from the default ladder
 * inside `determineSpellResult`); crit/fumble override the tier-based
 * pick.
 */
function buildNakedSpellResultHtml (result) {
  if (result.fumble) {
    return `<p class="emote-alert fumble">${game.i18n.localize('DCC.SpellCheckFumbleNoTable')}</p>`
  }
  if (result.critical) {
    return `<p class="emote-alert critical">${game.i18n.localize('DCC.SpellCheckCritNoTable')}</p>`
  }
  // Any tier above 'failure' / 'lost' is treated as success; mirrors
  // legacy threshold check `roll.total >= 10 + level * 2`. The lib's
  // default tier ladder (cast.ts:165) maps total ≥ 12 to
  // success-minor or higher for level-1 spells, which is the same
  // boundary.
  const successTiers = ['success', 'success-minor', 'success-major', 'success-critical']
  if (result.tier && successTiers.includes(result.tier)) {
    return `<p class="emote-alert critical">${game.i18n.localize('DCC.SpellCheckSuccessNoTable')}</p>`
  }
  return `<p class="emote-alert fumble">${game.i18n.localize('DCC.SpellCheckFailureNoTable')}</p>`
}

/**
 * Render a cleric disapproval roll as a Foundry ChatMessage. Mirrors
 * the legacy `_onRollDisapproval` chat (`actor.js:2852`) for the
 * table-found branch: one message carrying the 1d4 sub-roll + the
 * drawn table entry's description.
 *
 * The lib has already rolled (via the caster's sync roller, which the
 * adapter primes with a Foundry-evaluated 1d4 value — see
 * `_castViaCalculateSpellCheck`). This function builds a deterministic
 * `Roll` for the `disapprovalResult.roll` total so Foundry can render
 * it, then attaches the table text as the chat flavor.
 *
 * @param {Object} params
 * @param {Object} params.actor - The DCCActor that cast.
 * @param {Object} params.disapprovalResult - The lib's
 *   `DisapprovalResult` (from `spells/disapproval.js`).
 * @returns {Promise<ChatMessage>}
 */
export async function renderDisapprovalRoll ({ actor, disapprovalResult }) {
  const total = Number(disapprovalResult?.roll) || 0
  const description = disapprovalResult?.description || ''

  // Build a deterministic Roll that evaluates to the lib's rolled
  // value. `${total}d1` always totals `total` regardless of dice.
  // The flavor carries the description so chat displays the drawn
  // table entry like the legacy `RollTable.draw` path.
  const roll = new Roll(`${Math.max(1, total)}d1`)
  await roll.evaluate()

  const flavor = [game.i18n.localize('DCC.DisapprovalRoll'), description]
    .filter(Boolean)
    .join(' — ')

  const messageData = await roll.toMessage(
    {
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor,
      flags: {
        'dcc.RollType': 'Disapproval',
        'dcc.isDisapproval': true,
        'dcc.libDisapproval': {
          roll: disapprovalResult?.roll,
          description,
          disapprovalRange: disapprovalResult?.disapprovalRange
        }
      }
    },
    { create: false }
  )

  return ChatMessage.create(messageData)
}

/**
 * Render a mercurial magic effect as a Foundry ChatMessage. Mirrors
 * the session-3 `renderDisapprovalRoll` pattern — a deterministic
 * `${rollValue}d1` Roll carries the lib's rolled value through
 * Foundry's chat pipeline so DSN / highlighting work as expected.
 * Replaces the chat-card mercurial block that
 * `DCCItem.rollSpellCheck:382` threaded through
 * `game.dcc.processSpellCheck` on the legacy path.
 *
 * @param {Object} params
 * @param {Object} params.actor - The DCCActor casting.
 * @param {Object} [params.spellItem] - Spell item (used for speaker
 *   context + chat flag).
 * @param {Object} params.effect - The lib's `MercurialEffect`
 *   (see `dcc-core-lib/types/spells.d.ts`).
 * @returns {Promise<ChatMessage>}
 */
export async function renderMercurialEffect ({ actor, spellItem, effect }) {
  if (!effect) return
  const rollValue = Number(effect.rollValue) || 0
  const summary = effect.summary || ''
  const description = effect.description || ''

  // Deterministic roll mirroring the session-3 disapproval pattern.
  // `${N}d1` evaluates to `N`; callers use the flavor / content for
  // the descriptive text rather than the die formula.
  const roll = new Roll(`${Math.max(1, rollValue)}d1`)
  await roll.evaluate()

  const flavor = [game.i18n.localize('DCC.MercurialMagicRoll'), summary]
    .filter(Boolean)
    .join(' — ')

  const content = description ? `<p>${description}</p>` : undefined

  const toMessageData = {
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor,
    flags: {
      'dcc.RollType': 'MercurialMagic',
      'dcc.isMercurial': true,
      'dcc.ItemId': spellItem?.id,
      'dcc.libMercurial': {
        rollValue,
        summary,
        description,
        displayOnCast: effect.displayOnCast !== false
      }
    }
  }
  if (content !== undefined) toMessageData.content = content

  const messageData = await roll.toMessage(toMessageData, { create: false })

  return ChatMessage.create(messageData)
}
