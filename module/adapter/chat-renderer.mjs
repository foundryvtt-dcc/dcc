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
 * Phase 1 scope: ability checks + saving throws. Skill / init
 * renderers follow the same shape and will land as they migrate.
 */

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
    'dcc.libResult': {
      skillId: result.skillId,
      die: result.die,
      natural: result.natural,
      total: result.total,
      formula: result.formula,
      critical: result.critical,
      fumble: result.fumble,
      modifiers: result.modifiers
    }
  }

  if (abilityId === 'str' || abilityId === 'agl') {
    flags.checkPenaltyCouldApply = true
  }

  // FleetingLuck flag update — preserves existing luck-tracking
  // behavior. Guarded because test mocks may not expose the class.
  if (game.dcc?.FleetingLuck?.updateFlags && foundryRoll) {
    game.dcc.FleetingLuck.updateFlags(flags, foundryRoll)
  }

  const messageData = await foundryRoll.toMessage(
    {
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor,
      flags,
      system: {
        checkPenaltyRollIndex: null
      }
    },
    { create: false }
  )

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
    'dcc.libResult': {
      skillId: result.skillId,
      die: result.die,
      natural: result.natural,
      total: result.total,
      formula: result.formula,
      critical: result.critical,
      fumble: result.fumble,
      modifiers: result.modifiers
    }
  }

  if (game.dcc?.FleetingLuck?.updateFlags && foundryRoll) {
    game.dcc.FleetingLuck.updateFlags(flags, foundryRoll)
  }

  const messageData = await foundryRoll.toMessage(
    {
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor,
      flags
    },
    { create: false }
  )

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
    'dcc.libResult': {
      skillId: result.skillId,
      die: result.die,
      natural: result.natural,
      total: result.total,
      formula: result.formula,
      critical: result.critical,
      fumble: result.fumble,
      modifiers: result.modifiers
    }
  }

  if (abilityId) {
    flags['dcc.Ability'] = abilityId
  }

  if (game.dcc?.FleetingLuck?.updateFlags && foundryRoll) {
    game.dcc.FleetingLuck.updateFlags(flags, foundryRoll)
  }

  const systemData = { skillId }

  const toMessageData = {
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor,
    flags,
    system: systemData
  }

  if (skillItem && skillItem.system.description?.value) {
    systemData.skillDescription = skillItem.system.description.value
    const rollHTML = await foundryRoll.render()
    toMessageData.content = `${rollHTML}<div class="skill-description">${skillItem.system.description.value}</div>`
  }

  const messageData = await foundryRoll.toMessage(toMessageData, { create: false })

  return ChatMessage.create(messageData)
}

/**
 * Render a spell-check result as a Foundry ChatMessage.
 *
 * Phase 2 session-1 scaffold: minimal rendering for the generic
 * casting path. Preserves the `dcc.RollType: 'SpellCheck'` /
 * `dcc.isSpellCheck` flag contract the legacy `processSpellCheck`
 * path emits (so downstream consumers keep working), plus a
 * structured `dcc.libResult` payload carrying the lib's spell-check
 * outcome. Side effects (spell loss, disapproval, patron taint,
 * mercurial magic) are NOT applied here — they live on the legacy
 * path this session and migrate into `spell-events.mjs` in later
 * sessions.
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
    'dcc.libResult': {
      spellId: result.spellId,
      die: result.die,
      natural: result.natural,
      total: result.total,
      formula: result.formula,
      critical: result.critical,
      fumble: result.fumble,
      tier: result.tier,
      spellLost: result.spellLost,
      corruptionTriggered: result.corruptionTriggered,
      modifiers: result.modifiers
    }
  }

  if (game.dcc?.FleetingLuck?.updateFlags && foundryRoll) {
    game.dcc.FleetingLuck.updateFlags(flags, foundryRoll)
  }

  const messageData = await foundryRoll.toMessage(
    {
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor,
      flags,
      system: { spellId: spellItem?.id }
    },
    { create: false }
  )

  return ChatMessage.create(messageData)
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
