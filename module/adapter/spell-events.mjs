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
 *   - Session 3: `onDisapprovalIncreased` drives cleric disapproval
 *     (replaces `actor.applyDisapproval()`).
 *   - Session 4 / D3a (2026-04-24): patron-taint routed fully through
 *     the lib's RAW pipeline. The `onPatronTaint` event posts a chat
 *     EMOTE announcing the acquisition; the updated
 *     `patronTaintChance` is persisted back to
 *     `system.class.patronTaintChance` by
 *     `_castViaCalculateSpellCheck` from `result.newPatronTaintChance`.
 *   - Session 5 (current): `onSpellburnApplied` subtracts the burn
 *     commitment from the actor's physical abilities. Mercurial
 *     display chat is posted directly by `_castViaCalculateSpellCheck`
 *     from `result.mercurialEffect` (mirrors session-3's
 *     `renderDisapprovalRoll` pattern) so the adapter can await the
 *     render before returning — the lib's `onMercurialEffect` callback
 *     fires twice (formula + evaluate passes) and isn't awaitable, so
 *     using it for rendering would double-post and race with the
 *     main spell-check chat.
 *
 * The lib only invokes callbacks that exist on the supplied object,
 * so omitting a handler is a no-op rather than a crash. Handlers that
 * require missing context (no actor for spellburn) are omitted below
 * for the same reason.
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
     * returned promise. Attach a `.catch` so a rejection (permission
     * error, validation failure in a `preUpdateItem` hook) is logged
     * instead of silently creating a chat-vs-item divergence.
     */
    events.onSpellLost = (_result) => {
      Promise.resolve(spellItem.update({ 'system.lost': true })).catch((err) => {
        console.error('[DCC adapter] onSpellLost: spellItem.update rejected', { spell: spellItem?.name, err })
      })
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

      Promise.resolve(actor.update({ 'system.class.disapproval': newRange })).catch((err) => {
        console.error('[DCC adapter] onDisapprovalIncreased: actor.update rejected', { actor: actor?.name, newRange, err })
      })

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
      Promise.resolve(CONFIG.ChatMessage.documentClass.create(messageData)).catch((err) => {
        console.error('[DCC adapter] onDisapprovalIncreased: ChatMessage.create rejected', { err })
      })
    }

    /**
     * Lib reports spellburn was applied for this cast. Mirror the
     * legacy roll-modifier `Spellburn` term callback
     * (`module/item.js:329-336`): for each physical ability, subtract
     * the burn from `system.abilities.<id>.value`, clamped at 1. NPC
     * actors bail (consistent with the disapproval handler and the
     * legacy spellburn-dialog flow, which is PC-only in practice).
     *
     * The lib passes the `SpellburnCommitment` ({ str, agl, sta })
     * directly — these are burn AMOUNTS, not post-burn scores. The
     * bridge converts them to post-burn scores here.
     */
    events.onSpellburnApplied = (burn) => {
      if (actor.isNPC) return
      if (!burn) return

      const updates = {}
      for (const abilityId of ['str', 'agl', 'sta']) {
        const amount = Number(burn[abilityId]) || 0
        if (amount <= 0) continue
        const current = Number(actor.system?.abilities?.[abilityId]?.value) || 0
        updates[`system.abilities.${abilityId}.value`] = Math.max(1, current - amount)
      }

      if (Object.keys(updates).length > 0) {
        Promise.resolve(actor.update(updates)).catch((err) => {
          console.error('[DCC adapter] onSpellburnApplied: actor.update rejected', { actor: actor?.name, updates, err })
        })
      }
    }

    /**
     * Lib reports patron taint was acquired for this cast — either via
     * creeping-chance (d100 <= patronTaintChance) or a patron-spell
     * result-table entry tagged with patron taint. Post an EMOTE chat
     * indicating the acquisition. The manifestation, when the lib
     * rolled one on a supplied `patronTaintTable`, is included in the
     * chat text.
     *
     * The `patronTaintChance` reset to 1 is persisted by
     * `_castViaCalculateSpellCheck` reading `result.newPatronTaintChance`.
     * That flow runs for every patron-based cast; this event fires only
     * on acquisition. NPC actors bail — the legacy `processSpellCheck`
     * mechanic was PC-only.
     */
    events.onPatronTaint = (_result, taint) => {
      if (actor.isNPC) return
      if (typeof ChatMessage === 'undefined' || !CONFIG?.ChatMessage?.documentClass) return

      const manifestation = taint?.description || ''
      const content = manifestation
        ? `<strong>${game.i18n.localize('DCC.PatronTaintChance')}!</strong> ${manifestation}`
        : `<strong>${game.i18n.localize('DCC.PatronTaintChance')}!</strong>`

      const messageData = {
        user: game.user?.id,
        speaker: ChatMessage.getSpeaker({ actor }),
        flags: { 'dcc.isPatronTaint': true },
        style: CONST?.CHAT_MESSAGE_STYLES?.EMOTE,
        content
      }
      ChatMessage.applyMode?.(messageData, game.settings?.get?.('core', 'messageMode'))
      Promise.resolve(CONFIG.ChatMessage.documentClass.create(messageData)).catch((err) => {
        console.error('[DCC adapter] onPatronTaint: ChatMessage.create rejected', { err })
      })
    }
  }

  return events
}
