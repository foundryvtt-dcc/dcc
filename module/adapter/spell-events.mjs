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
 *   - Session 2 (current): `onSpellLost` drives wizard spell loss
 *     (replaces the `actor.loseSpell(item)` call in `processSpellCheck`).
 *   - Session 3: `onDisapprovalIncreased` drives cleric disapproval.
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
 * @param {Object} params.actor - The DCCActor casting the spell. Kept
 *   in the closure for future sessions (session 3 needs it for
 *   disapproval-range updates; session 4 for patron taint; session 5
 *   for spellburn ability updates).
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

  return events
}
