/* global game, document, HTMLElement, fromUuid */

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

import { resetActionDice, isActionDiceStateCurrent, spendActionDie, nextActionDie, actionMatchesUse } from './vendor/dcc-core-lib/index.js'
import { actionDieLabel } from './handlebars-helpers.mjs'
import { executeAsGM, registerSocketHandler } from './socket.mjs'

const FLAG_SCOPE = 'dcc'
const FLAG_KEY = 'actionDice'

/** Socket action: write a combatant's action-dice state on the active GM. */
export const WRITE_ACTION_DICE = 'dcc.writeActionDice'

/**
 * Persist a combatant's per-round action-dice state, routing through the active
 * GM when this client can't update the combatant itself. A player owns their
 * actor but usually not the combatant, so a direct `setFlag` is rejected and the
 * pip never moves (the Phase-3 limitation); routing the write to the GM fixes
 * that. The GM and combatant owners write directly (and without a GM, an owner's
 * direct write still works). The computed `state` is sent verbatim — the GM-side
 * handler authorizes it against actor ownership before writing.
 * @param {Combatant} combatant
 * @param {{round:number, spent:boolean[]}} state
 * @returns {Promise<void>}
 */
async function writeActionDiceState (combatant, state) {
  if (game.user?.isGM || combatant?.isOwner) {
    try {
      await combatant.setFlag(FLAG_SCOPE, FLAG_KEY, state)
      return
    } catch (_e) {
      // Optimistic ownership but the update was rejected — fall through to the GM.
    }
  }
  await executeAsGM(WRITE_ACTION_DICE, { combatantUuid: combatant?.uuid, state })
}

/**
 * GM-side socket handler for {@link WRITE_ACTION_DICE}: resolve the combatant and
 * write the requested state, but only after confirming the requesting user owns
 * the combatant's actor (the `userId` is a client claim — see socket.mjs — so it
 * is paired with this ownership check; a player can only spend their own dice).
 * @param {{combatantUuid:string, state:object}} payload
 * @param {string} userId - the requesting user's id (from the socket envelope)
 * @returns {Promise<void>}
 */
export async function writeActionDiceHandler ({ combatantUuid, state }, userId) {
  if (!combatantUuid || !state || typeof state.round !== 'number' || !Array.isArray(state.spent)) return
  const combatant = await fromUuid(combatantUuid)
  if (!combatant) return
  const user = game.users?.get(userId)
  if (user && combatant.actor && !combatant.actor.testUserPermission(user, 'OWNER')) return
  await combatant.setFlag(FLAG_SCOPE, FLAG_KEY, state)
}

/** Register the GM-side action-dice write handler. Call once at ready. */
export function registerActionDiceSocketHandler () {
  registerSocketHandler(WRITE_ACTION_DICE, writeActionDiceHandler)
}

/**
 * Defensive boolean read of a DCC world setting against a given settings
 * source — absent/unregistered/throwing ⇒ false, the safe incumbent path
 * (settings may not be registered in early init or a stripped test harness).
 * The settings source is a parameter so callers that already inject Foundry
 * globals for testability (e.g. the sheet's `prepareActionDiceContext`) share
 * this one defensive implementation rather than re-rolling the try/catch.
 * @param {{get?: Function}} settings - a `game.settings`-like object
 * @param {string} key
 * @returns {boolean}
 */
export function settingEnabled (settings, key) {
  try {
    return settings?.get('dcc', key) === true
  } catch (_e) {
    return false
  }
}

/**
 * Defensive boolean read of a DCC world setting against the live `game.settings`.
 * @param {string} key
 * @returns {boolean}
 */
function settingOn (key) {
  return settingEnabled(game?.settings, key)
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
 * all-ready), flips `spent[index]`, and persists via {@link writeActionDiceState}
 * (which routes through the GM when this client can't update the combatant).
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
  await writeActionDiceState(combatant, { round, spent })
}

/**
 * Mark the indexed slot spent (Phase 3 auto-spend). Persists a current-round
 * state, resetting a stale one first, via {@link writeActionDiceState} — so a
 * player rolling their own attack advances the pip even when they can't update
 * the combatant directly (the write is routed to the active GM).
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
  await writeActionDiceState(combatant, spendActionDie(base, index))
}

// --- Phase 3: roll-path auto-spend --------------------------------------

/**
 * The combatant in the active combat whose actor is `actor`, or `null`. Matches
 * the first combatant by actor id (a linked actor may drive several tokens; the
 * action-die budget is per-combatant, so the first match is the sane default for
 * auto-spend).
 * @param {Actor} actor
 * @returns {Combatant|null}
 */
export function getCombatantForActor (actor) {
  const combat = game?.combat
  if (!combat || !actor) return null
  for (const combatant of combat.combatants) {
    if (combatant.actor?.id === actor.id) return combatant
  }
  return null
}

/**
 * The roll formula for a planned slot, including its own per-die rider when it
 * carries one — `"1d14"`, or `"1d20+4"` for a slot with `modifier: 4` (the D2
 * `1d20+4` case). The rider rides slot 0 in practice (the high-level
 * `1d20+4, 1d20, 1d16` line), and slot 0 is never the weapon-path die override,
 * so the modifier surfaces in the "Action N of M" chat line — matching the die
 * the incumbent path actually rolls from `attributes.actionDice.value` — rather
 * than being silently dropped. Extra slots carry no rider in real data, so this
 * is a pure display improvement there.
 */
export function slotRollFormula (slot) {
  if (!slot?.die) return ''
  const mod = Number(slot.modifier) || 0
  if (!mod) return `1${slot.die}`
  return `1${slot.die}${mod > 0 ? '+' : ''}${mod}`
}

/**
 * Plan the action-die spend for `actor` taking `action` (`'attack'`, `'spell'`,
 * `'check'`). Returns `null` — the off-path signal — when the feature is off,
 * the actor is not in the active combat, or it has no action-die budget; the
 * caller then keeps today's single-die behavior. Otherwise returns the next
 * eligible slot (`choice`, or `null` when over budget / no eligible die remains)
 * plus the counts the "Action N of M" chat line needs. Pure read — it computes
 * the would-be-reset state for a stale round but never writes; the write happens
 * in {@link spendPlannedActionDie} after the roll resolves.
 * @param {Actor} actor
 * @param {string} action
 * @returns {{combatant:Combatant, round:number, choice:{slot:object,index:number}|null, count:number, spentCount:number}|null}
 */
export function planActionDie (actor, action) {
  if (!multipleActionDiceEnabled()) return null
  const combatant = getCombatantForActor(actor)
  if (!combatant) return null
  const slots = getCombatantSlots(combatant)
  if (slots.length < 1) return null
  const round = game.combat.round
  const stored = readActionDiceState(combatant)
  const state = (stored && isActionDiceStateCurrent(stored, round))
    ? stored
    : resetActionDice(slots, round)
  const choice = nextActionDie(slots, state, action)
  const spentCount = (state.spent || []).filter(Boolean).length
  // The dice that are still unspent but cannot take `action` because their
  // `use` tag restricts them (a wizard's spells-only die for a weapon attack —
  // Sim 3 / D1). When `choice` is null and this is non-empty, the actor is not
  // over budget — it has dice left, just none eligible — so the soft filter
  // warns rather than reading "over budget".
  const restrictedUnspentDice = slots
    .filter((slot, i) => !((state.spent || [])[i] ?? false) && !actionMatchesUse(slot.use, action))
    .map(slot => slotRollFormula(slot))
  return { combatant, round, choice, count: slots.length, spentCount, restrictedUnspentDice }
}

/**
 * Spend the planned slot (when one is available) and return the descriptor for
 * the "Action N of M" chat line. When over budget (`choice` is `null`) nothing
 * is written and the descriptor flags it. Returns `null` when there is no plan
 * (off-path), so the caller renders no line.
 * @param {object|null} plan - from {@link planActionDie}
 * @returns {Promise<{actionNumber:number,count:number,overBudget:boolean,die:string}|null>}
 */
export async function spendPlannedActionDie (plan) {
  if (!plan) return null
  const { combatant, round, choice, count, spentCount, restrictedUnspentDice = [] } = plan
  if (choice) {
    await spendCombatantActionDie(combatant, choice.index, round)
  }
  return {
    actionNumber: spentCount + 1,
    count,
    overBudget: !choice,
    // No eligible die *despite* having dice left: the remaining unspent dice are
    // restricted to other uses (Sim 3 / D1). Distinct from plain over-budget so
    // the chat line and the soft-filter warning read correctly.
    noEligibleDie: !choice && restrictedUnspentDice.length > 0,
    die: choice ? slotRollFormula(choice.slot) : ''
  }
}

/**
 * The localized "Action N of M" chat line for a spend descriptor, or `''` when
 * there is nothing to show (no descriptor ⇒ off-path).
 * @param {object|null} descriptor - from {@link spendPlannedActionDie}
 * @returns {string}
 */
export function formatActionDiceChatLine (descriptor) {
  if (!descriptor) return ''
  const { actionNumber, count, overBudget, noEligibleDie, die } = descriptor
  if (overBudget) {
    if (noEligibleDie) {
      return game.i18n.format('DCC.ActionDiceChatLineNoEligibleDie', { n: actionNumber, m: count })
    }
    return game.i18n.format('DCC.ActionDiceChatLineOverBudget', { n: actionNumber, m: count })
  }
  return game.i18n.format('DCC.ActionDiceChatLine', { n: actionNumber, m: count, die })
}

/**
 * The localized i18n key for an action type, used to name the action in the
 * soft-filter warning ("No action die available for an attack …").
 * @param {string} action - `'attack'` / `'spell'` / `'check'`
 * @returns {string}
 */
function actionLabelKey (action) {
  return {
    attack: 'DCC.Attack',
    spell: 'DCC.SpellCheck',
    check: 'DCC.Check'
  }[action] || 'DCC.Check'
}

/**
 * The soft spells-only warning (D1) for a plan whose only remaining dice are
 * restricted to other uses — e.g. a wizard attacking when just the spells-only
 * die is left. Returns the localized string, or `null` when the plan has an
 * eligible die (or is off-path / over budget with nothing left). The roll path
 * surfaces this via `ui.notifications.warn` but never blocks the roll (the soft
 * filter trusts the judge; D1a).
 * @param {object|null} plan - from {@link planActionDie}
 * @param {string} action
 * @returns {string|null}
 */
export function noEligibleActionDieWarning (plan, action) {
  const restricted = plan?.restrictedUnspentDice
  if (!plan || plan.choice || !restricted || restricted.length === 0) return null
  return game.i18n.format('DCC.ActionDiceNoEligibleWarning', {
    action: game.i18n.localize(actionLabelKey(action)),
    dice: restricted.join(', ')
  })
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
