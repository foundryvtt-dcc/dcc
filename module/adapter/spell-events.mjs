/* global ChatMessage, CONFIG, CONST, game */

/**
 * Foundry-flavored implementation of the lib's `SpellEvents` callback
 * surface (see `@moonloch/dcc-core-lib/spells/*`).
 *
 * The lib emits spell-casting events via callback injection. Each
 * handler bridges a pure lib event to the equivalent Foundry side
 * effect (`item.update`, chat-message creation, hook emission) while
 * the lib stays platform-agnostic.
 *
 * Phase 2 rollout (staged across sessions):
 *   - Session 2: `onSpellLost` drives wizard spell loss (replaces the
 *     `actor.loseSpell(item)` call in `processSpellCheck`).
 *   - Session 3 (current): `onDisapprovalIncreased` drives cleric
 *     disapproval (replaces `actor.applyDisapproval()`).
 *   - Session 4: `onPatronTaint` drives the d100 taint roll + chance bump.
 *   - Session 5: `onSpellburnApplied` / `onMercurialEffect`.
 *
 * Until later sessions wire them up, the other handlers are deliberately
 * absent: the lib only invokes callbacks that exist on the supplied
 * object, so omitting a handler is a no-op rather than a crash.
 */

/**
 * Build a SpellEvents object for a given cast. The returned handlers
 * close over the Foundry actor + spell item so the lib can invoke
 * them without knowing about Foundry documents.
 *
 * @param {Object} params
 * @param {Object} params.actor - The DCCActor casting the spell. Used
 *   by `onDisapprovalIncreased` to update `system.class.disapproval`
 *   and by future sessions for patron taint / spellburn side effects.
 * @param {Object} params.spellItem - The spell item being cast.
 * @returns {Object} Partial `SpellEvents` — only handlers wired for
 *   this session are attached.
 */
export function createSpellEvents ({ actor, spellItem }) {
  const events = {}

  if (spellItem) {
    /**
     * Lib reports the cast marked the spell as lost. Mirror it on the
     * Foundry item so the spell card and the wizard sheet's "lost" UI
     * update. Replaces the `actor.loseSpell(item)` side effect that
     * `processSpellCheck` performs on the legacy path.
     *
     * Fire-and-forget: the lib's callback protocol doesn't await the
     * returned promise. Errors bubble to the Foundry console.
     */
    events.onSpellLost = (_result) => {
      spellItem.update({ 'system.lost': true })
    }
  }

  if (actor) {
    /**
     * Lib triggered disapproval and is raising the range by 1. Mirror
     * the `actor.applyDisapproval()` side effect (`actor.js:2789`): update
     * `system.class.disapproval` to the new range and post the
     * "DCC.DisapprovalGained" EMOTE chat message. The disapproval roll
     * itself is posted by `renderDisapprovalRoll` after the lib returns —
     * the lib doesn't pass `disapprovalResult` to this callback.
     *
     * Fire-and-forget: matches the callback protocol. `_result` is the
     * partial spell-check result (carries `newDisapprovalRange` too but
     * we take the explicit `newRange` arg the lib passes).
     */
    events.onDisapprovalIncreased = (_result, newRange) => {
      // Mirror legacy `applyDisapproval` (`actor.js:2789`) — NPC
      // actors bail before updating or posting chat.
      if (actor.isNPC) return

      actor.update({ 'system.class.disapproval': newRange })

      // Chat rendering is skipped when the Foundry globals aren't
      // present (unit tests). The actor update is still asserted.
      if (typeof ChatMessage === 'undefined' || !CONFIG?.ChatMessage?.documentClass) return

      const messageData = {
        user: game.user?.id,
        speaker: ChatMessage.getSpeaker({ actor }),
        flags: { 'dcc.isDisapproval': true },
        style: CONST?.CHAT_MESSAGE_STYLES?.EMOTE,
        content: game.i18n.format('DCC.DisapprovalGained', { range: newRange }),
        sound: CONFIG.sounds?.notification
      }
      ChatMessage.applyMode?.(messageData, game.settings?.get?.('core', 'messageMode'))
      CONFIG.ChatMessage.documentClass.create(messageData)
    }
  }

  return events
}
