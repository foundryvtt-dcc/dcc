/* global game, document, HTMLElement */

/**
 * Combat-tracker action-dice pips — Phase 2 of the multiple-action-dice
 * feature (see docs/dev/MULTIPLE_ACTION_DICE_DESIGN.md §§5–6, §9).
 *
 * Each combatant shows one pip per action die its actor has: ● ready, ○ spent,
 * and a spells-only die carries a ⊛ mark. The per-round spend state lives on the
 * combatant (`flags.dcc.actionDice = { round, spent[] }`) so it is scoped to the
 * encounter, not the actor (RAW: the budget is per-round, and D4 — there is no
 * out-of-combat budget because there is no reset signal). Foundry's
 * `combatTurn` / `combatRound` hooks drive the auto-reset; clicking a pip
 * toggles it by hand for off-turn reactions and judge overrides.
 *
 * The whole surface is gated behind the `multipleActionDice` master setting and
 * its Phase-2 sub-settings (`trackActionDiceInCombat`, `autoResetActionDice`,
 * `hideSingleActionDiePips`). With the master off — or in a world that never
 * opts in — none of these handlers do anything, and the tracker renders exactly
 * as it does today.
 *
 * The *mechanics* (reset / spend / currentness) are pure functions owned by
 * `@moonloch/dcc-core-lib`; only the Foundry-specific pieces (flag I/O, hook
 * wiring, DOM injection) live here.
 */

import { resetActionDice, isActionDiceStateCurrent, spendActionDie } from './vendor/dcc-core-lib/index.js'
import { actionDieLabel } from './handlebars-helpers.mjs'

const FLAG_SCOPE = 'dcc'
const FLAG_KEY = 'actionDice'

/**
 * Defensive boolean read of a DCC world setting — absent/unregistered ⇒ false,
 * the safe incumbent path (settings may not be registered in early init or a
 * stripped test harness).
 * @param {string} key
 * @returns {boolean}
 */
function settingOn (key) {
  try {
    return game.settings.get('dcc', key) === true
  } catch (_e) {
    return false
  }
}

/** The master switch. */
export function multipleActionDiceEnabled () {
  return settingOn('multipleActionDice')
}

/** Master + the combat-tracker sub-option. */
export function trackInCombatEnabled () {
  return multipleActionDiceEnabled() && settingOn('trackActionDiceInCombat')
}

/** Master + the auto-reset sub-option. */
export function autoResetEnabled () {
  return multipleActionDiceEnabled() && settingOn('autoResetActionDice')
}

/** The declutter sub-option (only meaningful when tracking is on). */
export function hideSingleDiePips () {
  return settingOn('hideSingleActionDiePips')
}

/**
 * The derived action-die slots for a combatant's actor, or `[]`. The list is
 * built in `DCCActor#prepareDerivedData` only when the master setting is on, so
 * this is empty for non-opted-in worlds.
 * @param {Combatant} combatant
 * @returns {import('./vendor/dcc-core-lib/types/combat.js').ActionDieSlot[]}
 */
export function getCombatantSlots (combatant) {
  const list = combatant?.actor?.system?.attributes?.actionDice?.list
  return Array.isArray(list) ? list : []
}

/**
 * The persisted per-round state for a combatant, or `null` if none.
 * @param {Combatant} combatant
 * @returns {import('./vendor/dcc-core-lib/types/combat.js').ActionDiceState|null}
 */
export function readActionDiceState (combatant) {
  const state = combatant?.getFlag?.(FLAG_SCOPE, FLAG_KEY) ?? combatant?.flags?.[FLAG_SCOPE]?.[FLAG_KEY]
  return state ?? null
}

/**
 * The spend flags to *display* for `round`: the persisted ones when the state
 * belongs to this round, otherwise all-unspent. Rendering never trusts a stale
 * state, so a combatant looks ready at the top of a new round even before the
 * auto-reset has written a fresh flag.
 * @param {object|null} state
 * @param {number} round
 * @param {number} count - number of slots
 * @returns {boolean[]}
 */
export function effectiveSpent (state, round, count) {
  if (state && isActionDiceStateCurrent(state, round) && Array.isArray(state.spent)) {
    return Array.from({ length: count }, (_v, i) => !!state.spent[i])
  }
  return new Array(count).fill(false)
}

/**
 * Build the pip view-models for a combatant — pure, so the mapping is unit
 * testable without a live tracker. One entry per slot, in budget order.
 * @param {import('./vendor/dcc-core-lib/types/combat.js').ActionDieSlot[]} slots
 * @param {object|null} state
 * @param {number} round
 * @returns {Array<{index:number,use:string,restricted:boolean,spent:boolean,label:string}>}
 */
export function buildActionDicePips (slots, state, round) {
  const spent = effectiveSpent(state, round, slots.length)
  return slots.map((slot, i) => ({
    index: i,
    use: slot.use || 'any',
    restricted: !!slot.use && slot.use !== 'any',
    spent: !!spent[i],
    label: actionDieLabel(slot)
  }))
}

/**
 * Whether a combatant's pips should be shown at all: tracking on, the actor has
 * action dice, and — unless the declutter option hides them — more than one.
 * @param {Combatant} combatant
 * @returns {boolean}
 */
export function shouldShowPips (combatant) {
  if (!trackInCombatEnabled()) return false
  const count = getCombatantSlots(combatant).length
  if (count < 1) return false
  if (count === 1 && hideSingleDiePips()) return false
  return true
}

/**
 * Persist a fresh all-unspent state for the active combatant at the start of
 * its turn, when its stored state is stale (a new round). GM-only so the write
 * happens once. No-op when auto-reset is off or the combatant has no dice.
 * @param {Combat} combat
 * @returns {Promise<void>}
 */
export async function resetActiveCombatantActionDice (combat) {
  if (!game.user?.isGM) return
  if (!autoResetEnabled()) return
  const combatant = combat?.combatant
  if (!combatant) return
  const slots = getCombatantSlots(combatant)
  if (slots.length < 1) return
  const state = readActionDiceState(combatant)
  if (state && isActionDiceStateCurrent(state, combat.round)) return
  await combatant.setFlag(FLAG_SCOPE, FLAG_KEY, resetActionDice(slots, combat.round))
}

/**
 * Toggle a single pip by hand (off-turn reaction / judge override). Reads the
 * current-round state (resetting a stale one first so a fresh round starts
 * all-ready), flips `spent[index]`, and persists. Requires permission to update
 * the combatant; Foundry rejects otherwise and the catch swallows it.
 * @param {Combatant} combatant
 * @param {number} index
 * @param {number} round
 * @returns {Promise<void>}
 */
export async function toggleActionDiePip (combatant, index, round) {
  const slots = getCombatantSlots(combatant)
  if (index < 0 || index >= slots.length) return
  const stored = readActionDiceState(combatant)
  const base = (stored && isActionDiceStateCurrent(stored, round))
    ? stored
    : resetActionDice(slots, round)
  // spendActionDie sets spent=true; to toggle, rebuild the array directly.
  const spent = effectiveSpent(base, round, slots.length)
  spent[index] = !spent[index]
  try {
    await combatant.setFlag(FLAG_SCOPE, FLAG_KEY, { round, spent })
  } catch (_e) {
    // No permission to update this combatant — silently ignore.
  }
}

/**
 * Mark the first unspent slot matching `index` spent — used by Phase 3
 * auto-spend (exported now so the contract is fixed). Persists a current-round
 * state, resetting a stale one first.
 * @param {Combatant} combatant
 * @param {number} index
 * @param {number} round
 * @returns {Promise<void>}
 */
export async function spendCombatantActionDie (combatant, index, round) {
  const slots = getCombatantSlots(combatant)
  if (index < 0 || index >= slots.length) return
  const stored = readActionDiceState(combatant)
  const base = (stored && isActionDiceStateCurrent(stored, round))
    ? stored
    : resetActionDice(slots, round)
  try {
    await combatant.setFlag(FLAG_SCOPE, FLAG_KEY, spendActionDie(base, index))
  } catch (_e) {
    // No permission — ignore.
  }
}

// --- Hook handlers ------------------------------------------------------

/** `combatTurn` — reset the now-active combatant's budget if it's a new round. */
export async function onCombatTurnForActionDice (combat) {
  if (!trackInCombatEnabled()) return
  await resetActiveCombatantActionDice(combat)
}

/** `combatRound` — same reset on the round-boundary combatant. */
export async function onCombatRoundForActionDice (combat) {
  if (!trackInCombatEnabled()) return
  await resetActiveCombatantActionDice(combat)
}

/**
 * The DOM element a render hook handed us, normalized to a real element
 * (ApplicationV2 passes an HTMLElement; tolerate a jQuery-like wrapper too).
 * @param {HTMLElement|{0?:HTMLElement}} html
 * @returns {HTMLElement|null}
 */
function asElement (html) {
  if (!html) return null
  if (html instanceof HTMLElement) return html
  if (html[0] instanceof HTMLElement) return html[0]
  return null
}

/**
 * Build the pip row DOM for a combatant, or `null` if nothing to show.
 * @param {Combatant} combatant
 * @param {number} round
 * @returns {HTMLElement|null}
 */
export function renderPipRow (combatant, round) {
  if (!shouldShowPips(combatant)) return null
  const slots = getCombatantSlots(combatant)
  const pips = buildActionDicePips(slots, readActionDiceState(combatant), round)
  const canToggle = !!(game.user?.isGM || combatant?.actor?.isOwner)

  const row = document.createElement('div')
  row.className = 'dcc-action-dice-pips'
  if (canToggle) row.classList.add('interactive')

  for (const pip of pips) {
    const el = document.createElement('span')
    el.className = 'dcc-action-die-pip'
    el.classList.add(pip.spent ? 'spent' : 'ready')
    if (pip.restricted) el.classList.add('restricted')
    el.dataset.slotIndex = String(pip.index)
    const useLabel = game.i18n.localize({
      spell: 'DCC.ActionDieUseSpell',
      attack: 'DCC.ActionDieUseAttack'
    }[pip.use] || 'DCC.ActionDieUseAny')
    el.setAttribute('data-tooltip', game.i18n.format('DCC.ActionDiceChipHint', {
      slot: pip.index + 1,
      use: `${pip.label} · ${useLabel}`
    }))
    el.textContent = pip.restricted ? '⊛' : (pip.spent ? '○' : '●')
    row.appendChild(el)
  }
  return row
}

/**
 * `renderCombatTracker` — inject a pip row into each combatant `<li>` and wire
 * click-to-toggle. No-op when tracking is off or the DOM/combat is unavailable.
 * @param {Application} app - the combat tracker application
 * @param {HTMLElement} html - the rendered tracker element (v14: HTMLElement)
 */
export function onRenderCombatTrackerForActionDice (app, html) {
  if (!trackInCombatEnabled()) return
  const root = asElement(html)
  if (!root) return
  const combat = app?.viewed ?? game.combat
  if (!combat) return
  const round = combat.round

  for (const li of root.querySelectorAll('li.combatant[data-combatant-id]')) {
    const combatant = combat.combatants.get(li.dataset.combatantId)
    if (!combatant) continue
    const pipRow = renderPipRow(combatant, round)
    if (!pipRow) continue

    if (pipRow.classList.contains('interactive')) {
      pipRow.addEventListener('click', async (event) => {
        const pip = event.target.closest('.dcc-action-die-pip')
        if (!pip) return
        event.preventDefault()
        event.stopPropagation() // don't also activate the combatant
        await toggleActionDiePip(combatant, Number(pip.dataset.slotIndex), round)
        app.render()
      })
    }

    const nameEl = li.querySelector('.token-name')
    if (nameEl) nameEl.appendChild(pipRow)
    else li.appendChild(pipRow)
  }
}
