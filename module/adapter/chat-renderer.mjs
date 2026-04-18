/* global ChatMessage, game */

/**
 * Renders dcc-core-lib result objects into Foundry ChatMessages.
 *
 * The lib produces pure data (`SkillCheckResult` — see
 * dcc-core-lib/types/skills.d.ts). Foundry's chat pipeline wants a
 * `Roll` object + flags + flavor. This module bridges the two,
 * preserving the flag contract that downstream modules
 * (dcc-qol, token-action-hud-dcc) parse.
 *
 * Phase 1 scope: ability checks. Save / skill / init renderers follow
 * the same shape and will land as they migrate.
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

  const flags = {
    'dcc.RollType': 'AbilityCheck',
    'dcc.Ability': abilityId,
    'dcc.isAbilityCheck': true
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
        checkPenaltyRollIndex: null,
        // The lib-side breakdown is included for downstream consumers
        // that want structured modifier info. Non-load-bearing for
        // rendering.
        libResult: {
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
    },
    { create: false }
  )

  return ChatMessage.create(messageData)
}
