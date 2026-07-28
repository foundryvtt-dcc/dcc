/* global ChatMessage, console, game */

/**
 * Death Clock (issue #843, phase 1) — the DCC death & dying countdown.
 *
 * Per the death and dying rules, a 1st+ level PC reduced to 0 HP bleeds out
 * and can be saved if healed within (level) rounds; 0-level characters die
 * immediately. The rules math lives in dcc-core-lib
 * (`combat/death-and-dying.js`); this module is the Foundry adapter:
 *
 * - `updateActor`: when a Player's HP drops to 0 or below, auto-start the
 *   clock — a "Dying" Active Effect carrying the countdown in
 *   `flags.dcc.deathClock` (the lib's bleed-out state shape). 0-level PCs
 *   get the dead status immediately. Healing above 0 clears the clock.
 * - `updateCombat`: on round advance, tick each dying combatant's clock;
 *   at zero the PC gets the dead status and a chat announcement.
 * - `renderCombatTracker`: a rounds-remaining badge on dying combatants'
 *   rows (same injection pattern as the action-dice pips).
 *
 * The countdown deliberately lives in an effect flag rather than
 * `duration.rounds`: the system's generic round-based effect expiry
 * (chat-and-hook-wiring.mjs `onUpdateCombat`) deletes expired effects with
 * only a notification, which would race the dead-status handling here.
 *
 * Everything is gated on the `dcc.enableDeathClock` world setting (Enhanced
 * Combat settings group, off by default) and runs on the active GM only.
 * `tickDeathClock` is exported for the phase-2 sidebar tool's manual
 * out-of-combat tick.
 */

import { advanceBleedOutRound, getBleedOutRounds } from './vendor/dcc-core-lib/combat/death-and-dying.js'
import { markActorDefeated } from './defeated.mjs'
import { isActiveGM } from './socket.mjs'

/** The status id carried by the Dying Active Effect. */
export const DYING_STATUS_ID = 'dying'

/** Flag scope key: `flags.dcc.deathClock` = `{ roundsRemaining }`. */
const CLOCK_FLAG = 'deathClock'

/**
 * Whether the death clock feature is enabled in this world.
 */
function deathClockEnabled () {
  try {
    return game.settings.get('dcc', 'enableDeathClock')
  } catch (e) {
    return false
  }
}

/**
 * Find the Dying effect on an actor, if any.
 *
 * @param {Actor|null} actor
 * @returns {ActiveEffect|undefined}
 */
export function getDyingEffect (actor) {
  return [...(actor?.effects ?? [])].find(e => e.statuses?.has?.(DYING_STATUS_ID))
}

/**
 * Rounds remaining on an actor's death clock. Falls back to the full
 * (level)-round window when the effect carries no clock state — e.g. a GM
 * toggled the Dying status manually from the token HUD.
 *
 * @param {Actor} actor
 * @param {ActiveEffect} [effect] - the Dying effect, if already located
 * @returns {number}
 */
export function getDeathClockRemaining (actor, effect = getDyingEffect(actor)) {
  const state = effect?.getFlag?.('dcc', CLOCK_FLAG)
  return state?.roundsRemaining ?? getBleedOutRounds(actor?.system?.details?.level?.value ?? 0)
}

/**
 * Post a public death-clock chat announcement for an actor.
 *
 * @param {string} key - i18n key formatted with `{ name, ...data }`
 * @param {Actor} actor
 * @param {object} [data] - extra format data (e.g. `{ rounds }`)
 */
async function postDeathClockCard (key, actor, data = {}) {
  await ChatMessage.create({
    content: game.i18n.format(key, { name: actor.name, ...data }),
    speaker: ChatMessage.getSpeaker({ actor })
  })
}

/**
 * `updateActor` handler. Starts the death clock when a Player's HP drops to
 * 0 or below (0-level: dead immediately), and clears it when healing brings
 * HP back above 0.
 *
 * @param {Actor} actor - the updated actor
 * @param {object} changes - the update diff
 */
export async function onUpdateActorForDeathClock (actor, changes) {
  try {
    if (!deathClockEnabled()) return
    if (!isActiveGM()) return
    if (actor?.type !== 'Player') return

    // Only when this update changed HP.
    const newHp = changes?.system?.attributes?.hp?.value
    if (newHp === undefined) return

    const dying = getDyingEffect(actor)

    // Healed above 0: the clock stops.
    if (newHp > 0) {
      if (dying) {
        await dying.delete()
        await postDeathClockCard('DCC.DeathClockStopped', actor)
      }
      return
    }

    // At or below 0 with a clock already running (or already dead): no-op.
    if (dying) return
    const hasDeadEffect = [...(actor.effects ?? [])].some(e => e.statuses?.has?.('dead'))
    if (actor.statuses?.has('dead') || hasDeadEffect) return

    const level = actor.system?.details?.level?.value ?? 0
    const rounds = getBleedOutRounds(level)

    // 0-level characters die immediately.
    if (rounds <= 0) {
      await markActorDefeated(actor)
      await postDeathClockCard('DCC.DeathClockInstantDeath', actor)
      return
    }

    await actor.createEmbeddedDocuments('ActiveEffect', [{
      name: game.i18n.localize('DCC.StatusDying'),
      img: 'icons/svg/blood.svg',
      statuses: [DYING_STATUS_ID],
      flags: { dcc: { [CLOCK_FLAG]: { roundsRemaining: rounds } } }
    }])
    await postDeathClockCard('DCC.DeathClockStarted', actor, { rounds })
  } catch (err) {
    console.error('DCC | death clock update failed', err)
  }
}

/**
 * Advance an actor's death clock by one round. At zero the Dying effect is
 * removed, the dead status applied, and the death announced. Exported for
 * the phase-2 sidebar tool's manual out-of-combat tick.
 *
 * @param {Actor} actor
 * @param {ActiveEffect} [effect] - the Dying effect, if already located
 */
export async function tickDeathClock (actor, effect = getDyingEffect(actor)) {
  if (!effect) return
  const next = advanceBleedOutRound({ roundsRemaining: getDeathClockRemaining(actor, effect) })
  if (next === undefined) {
    await effect.delete()
    await markActorDefeated(actor)
    await postDeathClockCard('DCC.DeathClockExpired', actor)
  } else {
    await effect.setFlag('dcc', CLOCK_FLAG, next)
  }
}

/**
 * `updateCombat` handler. On round advance, tick the death clock of every
 * dying Player combatant in the encounter.
 *
 * @param {Combat} combat
 * @param {object} changed - the update diff
 */
export async function onUpdateCombatForDeathClock (combat, changed) {
  try {
    if (!deathClockEnabled()) return
    if (!isActiveGM()) return
    if (!('round' in changed)) return

    for (const combatant of combat.combatants) {
      const actor = combatant.actor
      if (!actor || actor.type !== 'Player') continue
      const dying = getDyingEffect(actor)
      if (!dying) continue
      await tickDeathClock(actor, dying)
    }
  } catch (err) {
    console.error('DCC | death clock round advance failed', err)
  }
}

/**
 * `renderCombatTracker` handler. Appends a rounds-remaining badge to each
 * dying combatant's row (the action-dice pip injection pattern).
 *
 * @param {Application} app - the combat tracker application
 * @param {HTMLElement|jQuery} html - the rendered tracker HTML
 */
export function onRenderCombatTrackerForDeathClock (app, html) {
  try {
    if (!deathClockEnabled()) return
    // Duck-typed rather than `instanceof HTMLElement` so the handler also
    // runs under the node unit-test environment (v14 passes an HTMLElement;
    // the jQuery-wrapped shape is legacy).
    const root = html?.querySelectorAll ? html : html?.[0]
    const combat = app?.viewed ?? game.combat
    if (!root?.querySelectorAll || !combat) return

    for (const li of root.querySelectorAll('li.combatant[data-combatant-id]')) {
      const combatant = combat.combatants.get(li.dataset.combatantId)
      const actor = combatant?.actor
      const effect = getDyingEffect(actor)
      if (!effect) continue

      const remaining = getDeathClockRemaining(actor, effect)
      const badge = document.createElement('span')
      badge.classList.add('dcc-death-clock')
      badge.dataset.tooltip = game.i18n.format('DCC.DeathClockTooltip', { rounds: remaining })
      const icon = document.createElement('i')
      icon.className = 'fas fa-heart-pulse'
      icon.inert = true
      badge.append(icon, String(remaining))

      // Sit at the right end of the action-dice pip row when there is one
      // (the composed renderCombatTracker handler renders pips first);
      // otherwise fall back to the name block.
      const host = li.querySelector('.dcc-action-dice-pips') ?? li.querySelector('.token-name') ?? li
      host.appendChild(badge)
    }
  } catch (err) {
    console.error('DCC | death clock tracker badge failed', err)
  }
}
