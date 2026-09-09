/* global console, game, ui */

import { logSpellburn } from './ability-score-log.js'

/**
 * Single owner of DCC spellburn (and its variant relabelings — MCC
 * glowburn, XCC's class-sheet burns).
 *
 * Issue #923: the burn used to be built and applied in three independent
 * places — `DCCItem.rollSpellCheck`'s inline term, the adapter's
 * `promptRollModifierDialog` descriptor plus its two apply sites, and
 * dependent modules rolling their own. Each re-derived the same three
 * things: the Roll Modifier dialog's `Spellburn` term, the conversion
 * between burn AMOUNTS and post-burn SCORES, and the `logSpellburn` call.
 * That is how #921's "also adjust hit points" row shipped complete on the
 * adapter path and entirely absent from the character sheet's cast button,
 * with a green unit suite and a full E2E run either side of it.
 *
 * Everything here is Foundry-flavored but adapter-agnostic: it reads the
 * actor document and calls `logSpellburn`, and knows nothing about the lib.
 *
 * `buildSpellburnTerm` and `applySpellburn` are published on `game.dcc`
 * (see `module/init-hook.mjs`) as the supported entry point for dependent
 * modules, so a module's burn logs, chats and heals like a core one.
 */

/** The three physical abilities DCC spellburn may draw from. */
export const SPELLBURN_ABILITIES = ['str', 'agl', 'sta']

/**
 * Read a Spellburn descriptor — the pre-burn physical ability scores plus
 * the caster level — off an actor.
 *
 * `level` scales the Stamina modifier-threshold hit point PREVIEW (#921);
 * supplying it at all is what makes the dialog offer the checkbox (see
 * `DCCSpellburnTerm`'s `isNaN` gate in `module/roll-modifier.js`). A caster
 * with no level recorded still gets a number — 0 is a real level, and the
 * applied amount is recomputed from the actor by `logSpellburn` anyway.
 *
 * @param {Object} actor  The casting actor
 * @returns {{str: number, agl: number, sta: number, level: number}}
 */
export function spellburnDescriptor (actor) {
  const descriptor = {
    level: parseInt(actor?.system?.details?.level?.value) || 0
  }
  for (const abilityId of SPELLBURN_ABILITIES) {
    descriptor[abilityId] = parseInt(actor?.system?.abilities?.[abilityId]?.value) || 0
  }
  return descriptor
}

/**
 * Convert burn AMOUNTS (what the lib's `SpellburnCommitment` carries) to
 * post-burn SCORES (what `logSpellburn` takes).
 *
 * An unburned ability keeps its current value — a no-op on the write side
 * that produces no log entry. Clamped at 0, not 1: per DCC RAW a physical
 * ability may be burned all the way to 0, and burning Stamina to 0 is
 * lethal (an intentional rules feature). The dialog's `#modifySpellburn`
 * already permits a resulting score of 0, so the input side is
 * floor-0-consistent; the clamp here only guards a malformed oversized
 * burn.
 *
 * @param {Object} actor    The casting actor
 * @param {Object} amounts  {str, agl, sta} points burned
 * @returns {{str: number, agl: number, sta: number}} post-burn scores
 */
export function scoresFromBurnAmounts (actor, amounts = {}) {
  const scores = {}
  for (const abilityId of SPELLBURN_ABILITIES) {
    const amount = Number(amounts[abilityId]) || 0
    const current = Number(actor?.system?.abilities?.[abilityId]?.value) || 0
    scores[abilityId] = amount > 0 ? Math.max(0, current - amount) : current
  }
  return scores
}

/**
 * Apply a spellburn: write the post-burn scores, record the ability score
 * log entries, and surface a failure to the player.
 *
 * The spell-check chat card is about to claim the burn was paid, so a
 * rejected update (permission error, a `preUpdateActor` veto) has to reach
 * the player rather than the console alone — otherwise the sheet silently
 * disagrees with the card. Always resolves, so a synchronous term callback
 * can fire-and-forget it without risking an unhandled rejection.
 *
 * @param {Object} actor    The casting actor
 * @param {Object} scores   {str, agl, sta} post-burn scores
 * @param {string} [source] Spell or patron name, for the log entries
 * @param {Object} [options]
 * @param {boolean} [options.adjustHP=false]  Apply the Stamina ΔHP alongside
 * @returns {Promise<void>}
 */
export async function applySpellburn (actor, scores, source = '', { adjustHP = false } = {}) {
  try {
    await logSpellburn(actor, scores, source, { adjustHP })
  } catch (err) {
    console.error('[DCC] spellburn apply rejected', { actor: actor?.name, source, err })
    ui.notifications?.error?.(game.i18n.localize('DCC.SpellburnApplyFailed'))
  }
}

/**
 * Build the Roll Modifier dialog's `Spellburn` term from a descriptor,
 * handing the player's commitment to `onCommit` when the dialog submits.
 *
 * The term applies nothing itself — the adapter path defers application to
 * the lib's `onSpellburnApplied` event, so the decision belongs to the
 * caller. `buildSpellburnTerm` is the applying wrapper for callers that
 * own the burn outright.
 *
 * The dialog mutates `term.str/agl/sta` in place as the +/- buttons are
 * clicked, so by callback time they hold the POST-burn scores.
 *
 * @param {{str: number, agl: number, sta: number, level: *}} descriptor
 * @param {function({str: number, agl: number, sta: number, adjustHP: boolean, total: number}): void} onCommit
 * @returns {Object} a `Spellburn` term descriptor for `DCCRoll.createRoll`
 */
export function spellburnTermFromDescriptor (descriptor, onCommit) {
  const original = {}
  for (const abilityId of SPELLBURN_ABILITIES) {
    original[abilityId] = Number(descriptor?.[abilityId]) || 0
  }

  // Passed through only when the caller supplied a finite level. `Number(x)
  // || 0` would turn an absent level into 0, which is a number, defeating
  // the `isNaN` gate in `DCCSpellburnTerm` that keeps the hit point row away
  // from callers who never wired up `adjustHP`.
  const rawLevel = descriptor?.level
  const level = Number.isFinite(Number(rawLevel)) && rawLevel !== null && rawLevel !== ''
    ? Number(rawLevel)
    : undefined

  return {
    type: 'Spellburn',
    formula: '+0',
    ...original,
    level,
    callback: (_formula, term) => {
      const commitment = { total: 0 }
      for (const abilityId of SPELLBURN_ABILITIES) {
        const post = Number(term?.[abilityId]) || 0
        commitment[abilityId] = post
        commitment.total += original[abilityId] - post
      }
      // `term.adjustHP` is the dialog's "also adjust hit points" checkbox.
      // It stays checked even while the row is hidden, which is harmless —
      // `logSpellburn` recomputes the delta and a burn that crosses no
      // threshold yields 0. Fail closed on anything but an explicit true: a
      // term that was never offered a checkbox must not silently opt in.
      commitment.adjustHP = term?.adjustHP === true
      onCommit(commitment)
    }
  }
}

/**
 * Build a `Spellburn` term that applies the burn itself when the dialog
 * submits. The entry point for the character sheet's cast button, and the
 * supported one for dependent modules (published as
 * `game.dcc.buildSpellburnTerm`).
 *
 * @param {Object} actor              The casting actor
 * @param {Object} [options]
 * @param {string} [options.source]   Spell or patron name, for the log entries
 * @param {function(number, Object): void} [options.onBurn]  Observer called
 *   with the total points burned (MCC glowburn's patron manifestation keys
 *   off the amount) and the full commitment.
 * @returns {Object} a `Spellburn` term descriptor for `DCCRoll.createRoll`
 */
export function buildSpellburnTerm (actor, { source = '', onBurn } = {}) {
  return spellburnTermFromDescriptor(spellburnDescriptor(actor), (commitment) => {
    onBurn?.(commitment.total, commitment)
    // The term callback is synchronous and the dialog does not await it, so
    // this cannot be awaited here; `applySpellburn` never rejects.
    applySpellburn(
      actor,
      { str: commitment.str, agl: commitment.agl, sta: commitment.sta },
      source,
      { adjustHP: commitment.adjustHP }
    )
  })
}
