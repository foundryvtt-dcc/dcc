/* global ChatMessage, CONFIG, console, fromUuid, game, Roll, ui */

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
 *   get the dead status immediately. Healing above 0 clears the clock, and
 *   revives a dead PC (dead overlay + combatant.defeated removed).
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

import { advanceBleedOutRound, attemptBodyRecovery, getBleedOutRounds, stabilizeCharacter } from './vendor/dcc-core-lib/combat/death-and-dying.js'
import { logAbilityChange } from './ability-score-log.js'
import { isActorDefeated, markActorDefeated, markActorRecovered } from './defeated.mjs'
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
 * @param {object} [options]
 * @param {boolean} [options.rollTheBody] - include the Roll the Body button
 * @param {Roll[]} [options.rolls] - dice to attach to the message
 */
async function postDeathClockCard (key, actor, data = {}, { rollTheBody = false, rolls = [] } = {}) {
  let content = game.i18n.format(key, { name: actor.name, ...data })
  if (rollTheBody) {
    content += `<div class="dcc-death-clock-actions"><button type="button" data-action="rollTheBody" data-actor-uuid="${actor.uuid}">` +
      `${game.i18n.localize('DCC.RollTheBody')}</button></div>`
  }
  await ChatMessage.create({
    content,
    rolls,
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

    // Healed above 0: a running clock stops; a dead PC is revived — the
    // full inverse of the tracker skull button (status overlay removed,
    // combatant.defeated cleared).
    if (newHp > 0) {
      if (dying) {
        const remaining = getDeathClockRemaining(actor, dying)
        await dying.delete()
        // DCC: anyone saved from bleeding out suffers a permanent loss of
        // 1 Stamina and gains a terrible scar. stabilizeCharacter carries
        // the rule (and rolls the scar); the ability score log records the
        // loss with its reason.
        const saved = stabilizeCharacter({ roundsRemaining: remaining }, newHp)
        if (saved.saved && saved.staminaLoss) {
          await logAbilityChange(actor, {
            ability: 'sta',
            change: -1,
            maxChange: -1,
            type: 'otherPermanent',
            source: game.i18n.localize('DCC.DeathClockTraumaSource')
          }, { announce: false })
          await postDeathClockCard('DCC.DeathClockSaved', actor, { scar: saved.scar })
        } else {
          await postDeathClockCard('DCC.DeathClockStopped', actor)
        }
      }
      if (isActorDefeated(actor)) {
        await markActorRecovered(actor)
        await postDeathClockCard('DCC.DeathClockRevived', actor)
      }
      return
    }

    // At or below 0 with a clock already running (or already dead): no-op.
    if (dying) return
    const hasDeadEffect = [...(actor.effects ?? [])].some(e => e.statuses?.has?.('dead'))
    if (actor.statuses?.has('dead') || hasDeadEffect) return

    const level = actor.system?.details?.level?.value ?? 0
    const rounds = getBleedOutRounds(level)

    // 0-level characters die immediately (body recovery is still possible).
    if (rounds <= 0) {
      await markActorDefeated(actor)
      await postDeathClockCard('DCC.DeathClockInstantDeath', actor, {}, { rollTheBody: true })
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
    await postDeathClockCard('DCC.DeathClockExpired', actor, {}, { rollTheBody: true })
  } else {
    await effect.setFlag('dcc', CLOCK_FLAG, next)
  }
}

/**
 * Roll the Body (DCC "Recovering the body"): a dead character whose body is
 * reached within an hour makes a roll-under Luck check. On a success they
 * were merely knocked out — they awaken at 1 HP, groggy for the next hour
 * (-4 to all rolls), with a permanent -1 to a random physical ability
 * (Strength / Agility / Stamina). On a failure they are truly dead. The
 * one-hour window is the judge's call — the button just adjudicates the
 * check. Rules math from dcc-core-lib `attemptBodyRecovery`.
 *
 * @param {Actor} actor - the dead actor
 */
export async function rollTheBody (actor) {
  if (!isActorDefeated(actor)) {
    ui.notifications.warn(game.i18n.format('DCC.RollTheBodyNotDead', { name: actor.name }))
    return
  }

  const luck = parseInt(actor.system?.abilities?.lck?.value) || 0

  // Pre-roll the lib's dice with Foundry Rolls so they surface in chat
  // (and Dice So Nice); the queue feeds attemptBodyRecovery's sync roller.
  const luckDie = new Roll('1d20')
  await luckDie.evaluate()
  const abilityDie = new Roll('1d3')
  await abilityDie.evaluate()
  const queue = [luckDie.total, abilityDie.total]
  const recovery = attemptBodyRecovery(luck, () => queue.shift())

  if (!recovery.success) {
    await postDeathClockCard('DCC.DeathClockBodyLost', actor,
      { roll: recovery.luckRoll, target: luck }, { rolls: [luckDie] })
    return
  }

  // Recover before setting HP so the heal branch doesn't also fire a
  // revival card for an already-recovered actor.
  await markActorRecovered(actor)
  await actor.update({ 'system.attributes.hp.value': recovery.newHP })
  await actor.createEmbeddedDocuments('ActiveEffect', [{
    name: game.i18n.localize('DCC.DeathClockGroggy'),
    img: 'icons/svg/daze.svg',
    duration: { seconds: 3600 }
  }])

  const penaltyAbility = recovery.permanentPenalty?.ability ?? 'sta'
  await logAbilityChange(actor, {
    ability: penaltyAbility,
    change: -1,
    maxChange: -1,
    type: 'otherPermanent',
    source: game.i18n.localize('DCC.DeathClockRecoverySource')
  }, { announce: false })

  await postDeathClockCard('DCC.DeathClockBodyRecovered', actor, {
    ability: game.i18n.localize(CONFIG.DCC.abilities[penaltyAbility] ?? penaltyAbility),
    roll: recovery.luckRoll,
    target: luck
  }, { rolls: [luckDie, abilityDie] })
}

/**
 * `renderChatMessageHTML` handler. Wires the Roll the Body button on death
 * announcements — judge-only adjudication, so the button is disabled for
 * everyone else.
 *
 * @param {ChatMessage} message
 * @param {HTMLElement} html - the rendered message HTML
 */
export function onRenderChatMessageHTMLForDeathClock (message, html) {
  try {
    const root = html?.querySelector ? html : html?.[0]
    const button = root?.querySelector?.('button[data-action="rollTheBody"]')
    if (!button) return
    if (!game.user.isGM) {
      button.disabled = true
      return
    }
    button.addEventListener('click', async () => {
      const actor = await fromUuid(button.dataset.actorUuid)
      if (actor) await rollTheBody(actor)
    })
  } catch (err) {
    console.error('DCC | death clock chat button wiring failed', err)
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
      // 0 remaining is the final-chance round (lib contract since the
      // bleed-out window fix), not death — say so instead of "0 rounds".
      badge.dataset.tooltip = remaining === 0
        ? game.i18n.localize('DCC.DeathClockTooltipLastChance')
        : game.i18n.format('DCC.DeathClockTooltip', { rounds: remaining })
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
