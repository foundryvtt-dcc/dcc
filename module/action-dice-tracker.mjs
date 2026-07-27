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
  // `setFlag` MERGES objects, so dropping the two-weapon pending-pair keys
  // from `state` does not remove them from the stored flag — a consumed (or
  // round-expired) marker must be cleared with explicit nulls. Only added
  // when a stored marker is actually being dropped, so every other write
  // stays byte-identical to today.
  const existing = readActionDiceState(combatant)
  if (existing?.twoWeaponPendingRole && !state?.twoWeaponPendingRole) {
    state = {
      ...state,
      twoWeaponPendingRole: null,
      twoWeaponPendingSlot: null,
      twoWeaponPendingAction: null
    }
  }
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
  // Fail closed: `userId` is a client claim (see socket.mjs), so an
  // unresolvable user or an actor-less combatant must be REJECTED, not allowed
  // through. Only a writer that resolves to a real user owning the combatant's
  // actor may set the per-round state.
  const user = game.users?.get(userId)
  if (!user) return
  if (!combatant.actor || !combatant.actor.testUserPermission(user, 'OWNER')) return
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
  // Via writeActionDiceState so a pending two-weapon marker from the old
  // round is explicitly cleared (setFlag merges — see writeActionDiceState).
  await writeActionDiceState(combatant, resetActionDice(slots, combat.round))
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
  const base = currentRoundState(combatant, round)
  // spendActionDie sets spent=true; to toggle, rebuild the array directly.
  const spent = effectiveSpent(base, round, slots.length)
  spent[index] = !spent[index]
  await writeActionDiceState(combatant, { round, spent, ...carryTwoWeaponPending(base) })
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
  const base = currentRoundState(combatant, round)
  await writeActionDiceState(combatant, { ...spendActionDie(base, index), ...carryTwoWeaponPending(base) })
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
 * The two-weapon-fighting role of a weapon, from the flags the item sheet
 * sets: `'primary'`, `'secondary'`, or `null` for a normal weapon. Primary
 * wins if both flags are (mis)configured on one item.
 * @param {Item|{system:object}} weapon
 * @returns {'primary'|'secondary'|null}
 */
export function twoWeaponRoleForWeapon (weapon) {
  if (weapon?.system?.twoWeaponPrimary) return 'primary'
  if (weapon?.system?.twoWeaponSecondary) return 'secondary'
  return null
}

/**
 * The other half of a two-weapon pair. `null` in ⇒ `null` out.
 * @param {'primary'|'secondary'|null} role
 * @returns {'primary'|'secondary'|null}
 */
export function companionTwoWeaponRole (role) {
  if (role === 'primary') return 'secondary'
  if (role === 'secondary') return 'primary'
  return null
}

/**
 * The combatant's stored state when it belongs to `round`, otherwise a fresh
 * all-unspent reset — the shared "what is the live per-round state right now"
 * read used by every spend/toggle path.
 * @param {Combatant} combatant
 * @param {number} round
 * @returns {import('./vendor/dcc-core-lib/types/combat.js').ActionDiceState}
 */
function currentRoundState (combatant, round) {
  const stored = readActionDiceState(combatant)
  return (stored && isActionDiceStateCurrent(stored, round))
    ? stored
    : resetActionDice(getCombatantSlots(combatant), round)
}

/**
 * The two-weapon pending-pair fields of a state, for spreading into a rewrite
 * that must not eat an outstanding free off-hand attack (an unrelated spend or
 * a manual pip toggle). `{}` when no pair is pending, so states without a
 * marker stay byte-identical to today.
 * @param {object} state
 * @returns {object}
 */
function carryTwoWeaponPending (state) {
  if (!state?.twoWeaponPendingRole) return {}
  return {
    twoWeaponPendingRole: state.twoWeaponPendingRole,
    twoWeaponPendingSlot: state.twoWeaponPendingSlot,
    twoWeaponPendingAction: state.twoWeaponPendingAction
  }
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
 *
 * Two-weapon fighting (#834): a primary + off-hand pair is ONE action, so the
 * pair consumes one die. Pass the weapon's `twoWeaponRole`; the first half
 * spends a die and records the companion role as pending on the state, and the
 * matching companion attack in the same round is planned as a free
 * `twoWeaponCompanion` — same slot, nothing further spent.
 * @param {Actor} actor
 * @param {string} action
 * @param {object} [opts]
 * @param {'primary'|'secondary'|null} [opts.twoWeaponRole] - the attacking
 *        weapon's two-weapon role, from {@link twoWeaponRoleForWeapon}.
 * @returns {{combatant:Combatant, round:number, choice:{slot:object,index:number}|null, count:number, spentCount:number, twoWeaponRole:string|null, twoWeaponCompanion:boolean}|null}
 */
export function planActionDie (actor, action, { twoWeaponRole = null } = {}) {
  if (!multipleActionDiceEnabled()) return null
  const combatant = getCombatantForActor(actor)
  if (!combatant) return null
  const slots = getCombatantSlots(combatant)
  if (slots.length < 1) return null
  const round = game.combat.round
  const state = currentRoundState(combatant, round)
  const spentCountSoFar = (state.spent || []).filter(Boolean).length
  // The free half of a two-weapon pair: an earlier attack this round with the
  // companion weapon already spent a die and marked this role pending. Plan
  // the SAME slot (so the die override matches the pair's base die) and flag
  // it so the spend step consumes the marker instead of another die.
  if (action === 'attack' && twoWeaponRole && state.twoWeaponPendingRole === twoWeaponRole) {
    const pairIndex = Number.isInteger(state.twoWeaponPendingSlot) ? state.twoWeaponPendingSlot : 0
    const slot = slots[pairIndex] ?? slots[0]
    return {
      combatant,
      round,
      choice: { slot, index: pairIndex },
      count: slots.length,
      spentCount: spentCountSoFar,
      restrictedUnspentDice: [],
      twoWeaponRole,
      twoWeaponCompanion: true,
      pairActionNumber: Number.isInteger(state.twoWeaponPendingAction) ? state.twoWeaponPendingAction : null
    }
  }
  const choice = nextActionDie(slots, state, action)
  // The dice that are still unspent but cannot take `action` because their
  // `use` tag restricts them (a wizard's spells-only die for a weapon attack —
  // Sim 3 / D1). When `choice` is null and this is non-empty, the actor is not
  // over budget — it has dice left, just none eligible — so the soft filter
  // warns rather than reading "over budget".
  const restrictedUnspentDice = slots
    .filter((slot, i) => !((state.spent || [])[i] ?? false) && !actionMatchesUse(slot.use, action))
    .map(slot => slotRollFormula(slot))
  return {
    combatant,
    round,
    choice,
    count: slots.length,
    spentCount: spentCountSoFar,
    restrictedUnspentDice,
    twoWeaponRole: action === 'attack' ? twoWeaponRole : null,
    twoWeaponCompanion: false
  }
}

/**
 * Spend the planned slot (when one is available) and return the descriptor for
 * the "Action N of M" chat line. When over budget (`choice` is `null`) nothing
 * is written and the descriptor flags it. Returns `null` when there is no plan
 * (off-path), so the caller renders no line.
 *
 * Two-weapon fighting (#834): the first half of a pair also records the
 * companion role + slot as pending on the persisted state; the companion half
 * spends nothing — it only consumes that marker — and its descriptor carries
 * `twoWeapon: true` so the chat line reads "same action". A pending marker
 * survives unrelated spends (a spell between the two swings doesn't cost the
 * off-hand its free attack) and dies with the round (the reset drops it).
 * @param {object|null} plan - from {@link planActionDie}
 * @returns {Promise<{actionNumber:number,count:number,overBudget:boolean,die:string}|null>}
 */
export async function spendPlannedActionDie (plan) {
  if (!plan) return null
  const { combatant, round, choice, count, spentCount, restrictedUnspentDice = [], twoWeaponRole = null, twoWeaponCompanion = false } = plan
  if (twoWeaponCompanion && choice) {
    // Free half of the pair: clear the pending marker, spend nothing. The
    // written state intentionally omits the two-weapon fields.
    const base = currentRoundState(combatant, round)
    await writeActionDiceState(combatant, { round, spent: effectiveSpent(base, round, count) })
    return {
      // The pair is one action: this half shares the action number recorded
      // when its companion's spend set the marker (falling back to the spent
      // count if a judge hand-edited the flag in between).
      actionNumber: plan.pairActionNumber ?? Math.max(spentCount, 1),
      count,
      overBudget: false,
      noEligibleDie: false,
      twoWeapon: true,
      die: slotRollFormula(choice.slot)
    }
  }
  if (choice) {
    const base = currentRoundState(combatant, round)
    // An unrelated spend must not eat a pending off-hand attack; the first
    // half of a pair replaces any marker with its own (the companion attack
    // this round is covered by the die spent here).
    const state = { ...spendActionDie(base, choice.index), ...carryTwoWeaponPending(base) }
    if (twoWeaponRole) {
      state.twoWeaponPendingRole = companionTwoWeaponRole(twoWeaponRole)
      state.twoWeaponPendingSlot = choice.index
      state.twoWeaponPendingAction = spentCount + 1
    }
    await writeActionDiceState(combatant, state)
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
  const { actionNumber, count, overBudget, noEligibleDie, twoWeapon, die } = descriptor
  if (overBudget) {
    if (noEligibleDie) {
      return game.i18n.format('DCC.ActionDiceChatLineNoEligibleDie', { n: actionNumber, m: count })
    }
    return game.i18n.format('DCC.ActionDiceChatLineOverBudget', { n: actionNumber, m: count })
  }
  if (twoWeapon) {
    return game.i18n.format('DCC.ActionDiceChatLineTwoWeapon', { n: actionNumber, m: count, die })
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
