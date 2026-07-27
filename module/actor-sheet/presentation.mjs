/**
 * Presentation-field preparers for the DCC actor sheet.
 *
 * Phase 7 (Appendix-A actor-sheet.js shrinkage): the four small context-field
 * helpers (`#prepareNotes` / `#prepareCorruption` / `#prepareImage` /
 * `#prepareCompendiumLinks`) were lifted out of `module/actor-sheet.js` into
 * this module as free functions. A sheet's `#private` methods cannot be
 * relocated to a mixin (private names are lexically class-scoped), so the
 * shrinkage shape here mirrors `actor-sheet/effects.mjs` and
 * `actor-sheet/items.mjs`: free functions taking the actor, which the sheet's
 * `_prepareContext` now calls directly.
 *
 * Each helper read only `this.options.document` (the actor) plus a Foundry
 * global — `TextEditor` (notes / corruption HTML enrichment), `EntityImages`
 * (default actor image), or `CONFIG.DCC` (compendium links). The globals are
 * injected via a `deps` parameter defaulting to the live ones, matching the
 * dependency-injection idiom in `actor-sheet/items.mjs` and `extension-api.mjs`,
 * so the helpers are directly unit-testable. All four were `#private` and had
 * no prior unit coverage; as free functions they do now.
 */

import EntityImages from '../entity-images.js'
import { actionDieLabel } from '../handlebars-helpers.mjs'
import { settingEnabled, getCombatantForActor, readActionDiceState, effectiveSpent } from '../action-dice-tracker.mjs'

/**
 * Enrich the actor's notes HTML for sheet display.
 * @param {Actor} actor - the sheet's `options.document`.
 * @param {object} [deps] - injectable Foundry globals (default to the live ones).
 * @param {object} [deps.TextEditor] - `foundry.applications.ux.TextEditor`.
 * @returns {Promise<string>} enriched notes HTML.
 */
export async function prepareNotes (actor, {
  TextEditor = globalThis.foundry?.applications?.ux?.TextEditor
} = {}) {
  const context = { relativeTo: actor, secrets: actor.isOwner }
  return await TextEditor.enrichHTML(actor.system.details.notes.value, context)
}

/**
 * Enrich the actor's corruption HTML for sheet display. Returns an empty string
 * for actors without a `class` block (e.g. NPCs).
 * @param {Actor} actor - the sheet's `options.document`.
 * @param {object} [deps] - injectable Foundry globals (default to the live ones).
 * @param {object} [deps.TextEditor] - `foundry.applications.ux.TextEditor`.
 * @returns {Promise<string>} enriched corruption HTML, or `''`.
 */
export async function prepareCorruption (actor, {
  TextEditor = globalThis.foundry?.applications?.ux?.TextEditor
} = {}) {
  if (actor.system.class) {
    const context = { relativeTo: actor, secrets: actor.isOwner }
    const corruption = actor.system.class.corruption || ''
    return await TextEditor.enrichHTML(corruption, context)
  }
  return ''
}

/**
 * Resolve the actor's display image, falling back to the type-default icon when
 * the actor has no image or still carries the mystery-man placeholder. This is a
 * display-only fallback for actors created before the `preCreateActor` hook set
 * default images; it never writes back to the actor (avoids creation races).
 * @param {Actor} actor - the sheet's `options.document`.
 * @param {object} [deps] - injectable Foundry globals (default to the live ones).
 * @param {(type: string) => string} [deps.imageForActor] - actor-type → icon path.
 * @returns {string} the image path to display.
 */
export function prepareImage (actor, {
  imageForActor = (type) => EntityImages.imageForActor(type)
} = {}) {
  if (!actor.img || actor.img === 'icons/svg/mystery-man.svg') {
    return imageForActor(actor.type)
  }
  return actor.img
}

/**
 * Return the equipment-tab compendium links from `CONFIG.DCC`, populated when the
 * dcc-core-book module is active (otherwise `null`/`undefined`).
 * @param {object} [config] - `CONFIG.DCC` (defaults to the live one).
 * @returns {object|null|undefined} compendium pack names keyed by section.
 */
export function prepareCompendiumLinks (config = globalThis.CONFIG?.DCC) {
  return config?.coreBookCompendiumLinks
}

/**
 * Action-dice sheet context for the multiple-action-dice feature.
 *
 * The derived `system.attributes.actionDice.list` is built in
 * `DCCActor#prepareDerivedData` only when the `multipleActionDice` master
 * setting is on (see docs/dev/MULTIPLE_ACTION_DICE_DESIGN.md). This helper
 * exposes a single `showActionDiceChips` boolean so the template can swap
 * the single text box for the chip row without doing length comparisons in
 * Handlebars. Chips appear only when the feature is on AND the actor has
 * 2+ dice — a single-die actor sees today's box unchanged either way
 * (§3: the per-die UI activates only for actors with multiple dice).
 * During an active combat with tracking on, the chips mirror the combat
 * tracker's pips (issue #834 §2): a spent chip greys out (the `spent` CSS
 * class), and — for the GM or the actor's owner — click-to-toggle via the
 * sheet's `toggleActionDie` action. Out of combat they stay a static listing
 * of the dice, with a tooltip pointing at where the live tracking happens.
 * @param {Actor} actor - the sheet's `options.document`.
 * @param {object} [deps] - injectable globals (default to the live ones).
 * @param {object} [deps.settings] - `game.settings` (for the master switch).
 * @param {object} [deps.i18n] - `game.i18n` (for chip tooltips).
 * @param {object} [deps.user] - `game.user` (owner/GM gate for toggling).
 * @param {Function} [deps.lookupCombatant] - actor → combatant in the active
 *        combat (defaults to the tracker's {@link getCombatantForActor}).
 * @param {object} [deps.combat] - the active combat (for the current round).
 * @returns {{multipleActionDice: boolean, actionDiceChips: Array, showActionDiceChips: boolean, actionDiceTracking: boolean, actionDiceInteractive: boolean}}
 */
export function prepareActionDiceContext (actor, {
  settings = globalThis.game?.settings,
  i18n = globalThis.game?.i18n,
  user = globalThis.game?.user,
  lookupCombatant = getCombatantForActor,
  combat = globalThis.game?.combat
} = {}) {
  const enabled = settingEnabled(settings, 'multipleActionDice')
  const list = actor?.system?.attributes?.actionDice?.list
  const slots = Array.isArray(list) ? list : []
  const localize = (key) => i18n?.localize ? i18n.localize(key) : key
  const useLabel = (use) => localize({
    spell: 'DCC.ActionDieUseSpell',
    attack: 'DCC.ActionDieUseAttack'
  }[use] || 'DCC.ActionDieUseAny')
  const format = i18n?.format
    ? (key, data) => i18n.format(key, data)
    : (key) => key

  // Live combat state: with tracking on and the actor in the active combat,
  // the chips show (and can toggle) the per-round spent state.
  const tracking = enabled && settingEnabled(settings, 'trackActionDiceInCombat')
  const combatant = (tracking && slots.length > 1) ? lookupCombatant(actor) : null
  const round = combat?.round ?? 0
  const spent = combatant ? effectiveSpent(readActionDiceState(combatant), round, slots.length) : null
  const interactive = !!combatant && !!(user?.isGM || actor?.isOwner)

  const actionDiceChips = slots.map((slot, index) => {
    const isSpent = spent ? !!spent[index] : false
    const cssClass = [
      'action-die-chip',
      slot.use && slot.use !== 'any' ? 'restricted' : '',
      combatant ? (isSpent ? 'spent' : 'ready') : '',
      interactive ? 'interactive' : ''
    ].filter(Boolean).join(' ')
    return {
      index,
      label: actionDieLabel(slot),
      use: slot.use || 'any',
      restricted: !!slot.use && slot.use !== 'any',
      spent: isSpent,
      cssClass,
      tooltip: combatant
        ? format(interactive ? 'DCC.ActionDiceChipToggleHint' : 'DCC.ActionDiceChipStateHint', {
          slot: (slot.slot ?? 0) + 1,
          use: useLabel(slot.use),
          state: localize(isSpent ? 'DCC.ActionDieStateSpent' : 'DCC.ActionDieStateReady')
        })
        : format('DCC.ActionDiceChipHint', {
          slot: (slot.slot ?? 0) + 1,
          use: useLabel(slot.use)
        })
    }
  })
  return {
    multipleActionDice: enabled,
    actionDiceChips,
    showActionDiceChips: enabled && actionDiceChips.length > 1,
    actionDiceTracking: !!combatant,
    actionDiceInteractive: interactive
  }
}
