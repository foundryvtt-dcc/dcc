/* global ChatMessage, CONFIG, console, foundry, fromUuid, game, Roll, ui */

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
 *   get the dead status immediately. Healing above 0 while dying saves the
 *   character with the bleed-out trauma (permanent -1 Stamina + scar), and
 *   healing a dead PC revives them (dead overlay + combatant.defeated
 *   removed).
 * - `updateCombat`: on round advance, tick each dying combatant's clock —
 *   0 remaining is the final-chance round (chat warning); one more round
 *   and the PC gets the dead status and a chat announcement.
 * - `renderCombatTracker`: a rounds-remaining badge on dying combatants'
 *   rows (same injection pattern as the action-dice pips).
 * - `renderChatMessageHTML`: judge-only card buttons — Roll the Body (the
 *   recovering-the-body Luck check; success revives at 1 HP + groggy) and
 *   the follow-up Roll Ability Loss d3 (permanent -1 Str/Agl/Sta).
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

import { advanceBleedOutRound, getBleedOutRounds, stabilizeCharacter } from './vendor/dcc-core-lib/combat/death-and-dying.js'
import { rollLuckCheckSimple } from './vendor/dcc-core-lib/checks/luck-check.js'
import { logAbilityChange, staminaHpDelta } from './ability-score-log.js'
import { renderAbilityCheckRollUnder } from './adapter/chat-renderer.mjs'
import { isActorDefeated, markActorDefeated, markActorRecovered } from './defeated.mjs'
import { isActiveGM } from './socket.mjs'

/** The status id carried by the Dying Active Effect. */
export const DYING_STATUS_ID = 'dying'

/** Flag scope key: `flags.dcc.deathClock` = `{ roundsRemaining }`. */
const CLOCK_FLAG = 'deathClock'

/** Actor flag set between a Roll the Body success and its 1d3 ability roll. */
const PENDING_ABILITY_LOSS_FLAG = 'pendingAbilityLoss'

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
 * Reentrancy latch: while a permanent loss is being applied, its HP
 * cascade (a Stamina modifier-threshold crossing lowers current HP too)
 * can drive a freshly-saved PC back to 0 — the resulting `updateActor`
 * must not start a brand-new clock mid-save.
 */
let applyingPermanentLoss = false

/**
 * Apply a permanent -1 from the death & dying rules through the ability
 * score log, using its dedicated `bleedOut` / `rollTheBody` entry types.
 * A Stamina loss that crosses an ability-modifier threshold also carries
 * the max-HP delta (level × modifier change), same as a manual Stamina
 * edit in the log dialog — and if that cascade drops the survivor's
 * current HP to 0, it is clamped back to 1: they survived, the lasting
 * cost is the reduced maximum.
 *
 * @param {Actor} actor
 * @param {string} ability - 'str' | 'agl' | 'sta'
 * @param {string} type - 'bleedOut' | 'rollTheBody'
 */
async function applyPermanentLoss (actor, ability, type) {
  const entry = { ability, change: -1, maxChange: -1, type }
  if (ability === 'sta') {
    const current = parseInt(actor.system?.abilities?.sta?.value) || 0
    const { hpChange } = staminaHpDelta(actor, current, current - 1)
    if (hpChange) entry.hpChange = hpChange
  }

  applyingPermanentLoss = true
  try {
    await logAbilityChange(actor, entry, { announce: false })
    if ((parseInt(actor.system?.attributes?.hp?.value) || 0) <= 0) {
      await actor.update({ 'system.attributes.hp.value': 1 })
    }
  } finally {
    applyingPermanentLoss = false
  }
}

/**
 * Post a public death-clock chat announcement for an actor.
 *
 * @param {string} key - i18n key formatted with `{ name, ...data }`
 * @param {Actor} actor
 * @param {object} [data] - extra format data (e.g. `{ rounds }`)
 * @param {object} [options]
 * @param {string} [options.button] - action name of a card button to include
 *   (`rollTheBody` or `rollAbilityLoss`)
 * @param {Roll[]} [options.rolls] - dice to attach to the message
 */
async function postDeathClockCard (key, actor, data = {}, { button = null, rolls = [] } = {}) {
  const buttonLabels = {
    rollTheBody: 'DCC.RollTheBody',
    rollAbilityLoss: 'DCC.RollAbilityLoss'
  }
  // The card is raw HTML; the actor name is player-controlled data.
  let content = game.i18n.format(key, { name: foundry.utils.escapeHTML(actor.name), ...data })
  if (button) {
    content += `<div class="dcc-death-clock-actions"><button type="button" data-action="${button}" data-actor-uuid="${actor.uuid}">` +
      `${game.i18n.localize(buttonLabels[button])}</button></div>`
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
    if (applyingPermanentLoss) return
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
          await applyPermanentLoss(actor, 'sta', 'bleedOut')
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
    if (isActorDefeated(actor)) return

    const level = actor.system?.details?.level?.value ?? 0
    const rounds = getBleedOutRounds(level)

    // 0-level characters die immediately (body recovery is still possible).
    if (rounds <= 0) {
      await markActorDefeated(actor)
      await postDeathClockCard('DCC.DeathClockInstantDeath', actor, {}, { button: 'rollTheBody' })
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
    await expireDeathClock(actor, effect)
  } else {
    await effect.setFlag('dcc', CLOCK_FLAG, next)
    // Entering the final-chance round: warn the table in chat.
    if (next.roundsRemaining === 0) {
      await postDeathClockCard('DCC.DeathClockLastChance', actor)
    }
  }
}

/**
 * Adjust an actor's death clock by a number of rounds (judge tool control),
 * clamped at 0 (the final-chance round).
 *
 * @param {Actor} actor
 * @param {number} delta - rounds to add (positive) or remove (negative)
 */
export async function adjustDeathClock (actor, delta) {
  const effect = getDyingEffect(actor)
  if (!effect) return
  const next = Math.max(0, getDeathClockRemaining(actor, effect) + delta)
  await effect.setFlag('dcc', CLOCK_FLAG, { roundsRemaining: next })
}

/**
 * Stop an actor's death clock without penalty (judge override — the
 * rules-priced save is the normal heal-above-0 path).
 *
 * @param {Actor} actor
 */
export async function stabilizeDeathClock (actor) {
  const effect = getDyingEffect(actor)
  if (!effect) return
  await effect.delete()
  await postDeathClockCard('DCC.DeathClockStopped', actor)
}

/**
 * Resolve an actor's death clock as death: remove the clock, apply the
 * dead status like the tracker skull button, and announce with the Roll
 * the Body prompt. Shared by clock expiry and the tracker's judge control.
 *
 * @param {Actor} actor
 * @param {ActiveEffect} [effect] - the Dying effect, if already located
 */
export async function expireDeathClock (actor, effect = getDyingEffect(actor)) {
  if (effect) await effect.delete()
  await markActorDefeated(actor)
  await postDeathClockCard('DCC.DeathClockExpired', actor, {}, { button: 'rollTheBody' })
}

/**
 * Roll the Body (DCC "Recovering the body"): a dead character whose body is
 * reached within an hour makes a roll-under Luck check. On a success they
 * were merely knocked out — they awaken at 1 HP, groggy for the next hour
 * (-4 to all rolls); the success card then prompts the judge to roll the
 * 1d3 for the permanent -1 to a random physical ability (see
 * {@link rollAbilityLoss}). On a failure they are truly dead. The one-hour
 * window is the judge's call — the button just adjudicates the check.
 *
 * @param {Actor} actor - the dead actor
 */
export async function rollTheBody (actor) {
  if (!isActorDefeated(actor)) {
    ui.notifications.warn(game.i18n.format('DCC.RollTheBodyNotDead', { name: actor.name }))
    return
  }

  const luck = parseInt(actor.system?.abilities?.lck?.value) || 0

  // The recovery check is a real roll-under Luck check: the same die,
  // lib classification, and chat card as clicking Luck on the sheet.
  // Deliberately not routed through actor.rollAbilityCheck — a dead
  // character spends no action dice, and the dispatcher doesn't return
  // the success flag this adjudication needs.
  const luckDie = new Roll('1d20')
  await luckDie.evaluate()
  const natural = luckDie.dice?.[0]?.total ?? luckDie.total
  const abilityLabel = game.i18n.localize(CONFIG.DCC.abilities.lck)
  const check = rollLuckCheckSimple(luck, () => natural, abilityLabel)
  await renderAbilityCheckRollUnder({
    actor,
    abilityId: 'lck',
    abilityLabel,
    result: check,
    foundryRoll: luckDie
  })

  if (!check.success) {
    await postDeathClockCard('DCC.DeathClockBodyLost', actor,
      { roll: check.roll, target: luck })
    return
  }

  // Recover before setting HP so the heal branch doesn't also fire a
  // revival card for an already-recovered actor.
  await markActorRecovered(actor)
  await actor.update({ 'system.attributes.hp.value': 1 })
  await actor.createEmbeddedDocuments('ActiveEffect', [{
    name: game.i18n.localize('DCC.DeathClockGroggy'),
    img: 'icons/svg/daze.svg',
    statuses: ['groggy'],
    duration: { seconds: 3600 }
  }])

  // The permanent -1 is rolled separately from the success card's prompt;
  // the pending flag keeps the button single-use.
  await actor.setFlag('dcc', PENDING_ABILITY_LOSS_FLAG, true)
  await postDeathClockCard('DCC.DeathClockBodyRecovered', actor,
    { roll: check.roll, target: luck }, { button: 'rollAbilityLoss' })
}

/**
 * Roll the 1d3 for the permanent -1 a body-recovered character sustains
 * (1 Strength, 2 Agility, 3 Stamina — the lib's d3 mapping), apply it via
 * the ability score log, and announce the result. Prompted by the Roll the
 * Body success card; single-use via the pending flag.
 *
 * @param {Actor} actor - the just-recovered actor
 */
export async function rollAbilityLoss (actor) {
  if (!actor.getFlag('dcc', PENDING_ABILITY_LOSS_FLAG)) {
    ui.notifications.warn(game.i18n.format('DCC.RollAbilityLossNotPending', { name: actor.name }))
    return
  }

  const abilityDie = new Roll('1d3')
  await abilityDie.evaluate()
  const abilities = ['str', 'agl', 'sta']
  const rolledIndex = (abilityDie.total - 1) % 3
  const penaltyAbility = abilities[rolledIndex] ?? 'sta'

  await applyPermanentLoss(actor, penaltyAbility, 'rollTheBody')
  await actor.unsetFlag('dcc', PENDING_ABILITY_LOSS_FLAG)

  // Build the card ourselves: the rendered die, the 1-3 chart with the
  // rolled row highlighted, then the result line. The Roll is embedded in
  // the content rather than attached via `rolls`, which would displace the
  // card body and show only a bare d3.
  const rollHtml = await abilityDie.render()
  const chartRows = abilities.map((key, index) =>
    `<tr class="${index === rolledIndex ? 'rolled' : ''}"><td>${index + 1}</td>` +
    `<td>${game.i18n.localize(CONFIG.DCC.abilities[key] ?? key)}</td></tr>`
  ).join('')
  const resultText = game.i18n.format('DCC.DeathClockAbilityLoss', {
    name: foundry.utils.escapeHTML(actor.name),
    ability: game.i18n.localize(CONFIG.DCC.abilities[penaltyAbility] ?? penaltyAbility)
  })
  await ChatMessage.create({
    content: `${rollHtml}<table class="dcc-ability-loss-chart"><tbody>${chartRows}</tbody></table><p>${resultText}</p>`,
    speaker: ChatMessage.getSpeaker({ actor })
  })
}

/**
 * `renderChatMessageHTML` handler. Wires the Roll the Body / Roll Ability
 * Loss buttons on death-clock cards — judge-only adjudication, so the
 * buttons are disabled for everyone else.
 *
 * @param {ChatMessage} message
 * @param {HTMLElement} html - the rendered message HTML
 */
export function onRenderChatMessageHTMLForDeathClock (message, html) {
  try {
    const handlers = { rollTheBody, rollAbilityLoss }
    const root = html?.querySelectorAll ? html : html?.[0]
    for (const action of Object.keys(handlers)) {
      for (const button of root?.querySelectorAll?.(`button[data-action="${action}"]`) ?? []) {
        if (!game.user.isGM) {
          button.disabled = true
          continue
        }
        button.addEventListener('click', async () => {
          // Disable synchronously: the single-use guards inside the
          // handlers sit behind awaits, so a double-click could otherwise
          // pass both times.
          button.disabled = true
          const actor = await fromUuid(button.dataset.actorUuid)
          if (actor) await handlers[action](actor)
        })
      }
    }
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

    // Only a forward round advance burns the clock: a GM rewinding a
    // misclicked round must not tick (or kill on) it, and starting the
    // combat (round 0 → 1) is not an elapsed round for a clock that began
    // before initiative.
    const previousRound = combat.previous?.round ?? 0
    if (previousRound === 0 || changed.round <= previousRound) return

    // Dedupe by actor: a Player with several tokens in the encounter must
    // lose one round per round, not one per combatant.
    const ticked = new Set()
    for (const combatant of combat.combatants) {
      const actor = combatant.actor
      if (!actor || actor.type !== 'Player' || ticked.has(actor)) continue
      ticked.add(actor)
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
