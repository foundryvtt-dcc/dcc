/* global ChatMessage, console, foundry, fromUuid, game, ui */

/**
 * Morale checks from the combat tracker and the half-HP prompt (#972).
 *
 * The roll itself is `DCCActor#rollMoraleCheck` (lib `makeMoraleCheck`).
 * This module adds:
 *   - the combatant menu (`getCombatTrackerContextOptions`): roll morale
 *     for that NPC
 *   - the encounter menu (`getCombatContextOptions`): roll morale for
 *     every NPC combatant that isn't defeated, one card each
 *   - the half-HP prompt (`preUpdateActor` + `updateActor`): when damage
 *     takes an NPC to half its hit points or below (lib
 *     `checkCreatureMoraleTrigger`), whisper the GM a card with a
 *     Roll morale button. Offer tier: nothing rolls until the GM clicks.
 *     Its Don't Ask Again button ticks the NPC's "Never checks morale"
 *     (`system.config.moraleImmune`).
 *
 * An NPC that never checks morale gets no prompt and is skipped by the
 * encounter roll. A direct roll (sheet, combatant entry) still rolls: the
 * judge asked for it.
 *
 * Foundry collects both menus once, at the tracker's first render, so the
 * hooks are registered at import time and each entry decides at click
 * time through `visible`.
 *
 * Rolls for a hidden combatant or token go to the GM only, so a morale
 * card can't reveal an NPC the players haven't seen.
 */

import { checkCreatureMoraleTrigger } from './vendor/dcc-core-lib/index.js'
import { isActiveGM } from './socket.mjs'
import { wantsModifierDialog } from './utilities.js'

/** Update option carrying the pre-update HP to every client's `updateActor`. */
const HP_BEFORE_OPTION = 'dccMoraleHpBefore'

/**
 * The NPC actor behind a combatant, or null.
 * @param {Combatant|undefined} combatant
 * @returns {Actor|null}
 */
function npcActor (combatant) {
  const actor = combatant?.actor
  return actor?.type === 'NPC' ? actor : null
}

/**
 * Chat message mode for a morale roll: GM-only when the combatant or its
 * token is hidden, otherwise the core setting.
 * @param {Combatant|undefined} combatant
 * @param {Actor} [actor]
 * @returns {string|undefined}
 */
function moraleMessageMode (combatant, actor = combatant?.actor) {
  const hidden = combatant?.hidden || combatant?.token?.hidden || actor?.token?.hidden
  return hidden ? 'gm' : undefined
}

/**
 * Whether an NPC is marked as never checking morale.
 * @param {Actor} actor
 * @returns {boolean}
 */
function neverChecksMorale (actor) {
  return !!actor?.system?.config?.moraleImmune
}

/**
 * NPC combatants in a combat that can still check morale (not defeated,
 * not marked as never checking morale), one per actor so a linked actor
 * with several combatants rolls once.
 * @param {Combat|undefined} combat
 * @returns {Combatant[]}
 */
export function moraleEligibleCombatants (combat) {
  if (!combat) return []
  const seen = new Set()
  return combat.combatants.filter(c => {
    const actor = !c.isDefeated && npcActor(c)
    if (!actor || neverChecksMorale(actor) || seen.has(actor.uuid)) return false
    seen.add(actor.uuid)
    return true
  })
}

/**
 * Add "Morale Check" to the combatant context menu.
 * @param {CombatTracker} app
 * @param {Array<Object>} options - The menu entries (mutated)
 */
export function onGetCombatTrackerContextOptions (app, options) {
  const getCombatant = li => app.viewed?.combatants.get(li.dataset.combatantId)
  options.push({
    label: 'DCC.MoraleCheck',
    icon: 'fa-solid fa-person-running',
    visible: li => game.user.isGM && !!npcActor(getCombatant(li)),
    onClick: (event, li) => {
      const combatant = getCombatant(li)
      return npcActor(combatant)?.rollMoraleCheck({
        showModifierDialog: wantsModifierDialog(event),
        messageMode: moraleMessageMode(combatant)
      })
    }
  })
}

/**
 * Add "Morale Check (NPCs)" to the encounter context menu.
 * @param {CombatTracker} app
 * @param {Array<Object>} options - The menu entries (mutated)
 */
export function onGetCombatContextOptions (app, options) {
  options.push({
    label: 'DCC.MoraleCheckNPCs',
    icon: 'fa-solid fa-person-running',
    visible: () => game.user.isGM && moraleEligibleCombatants(app.viewed).length > 0,
    onClick: async () => {
      for (const combatant of moraleEligibleCombatants(app.viewed)) {
        try {
          await combatant.actor.rollMoraleCheck({ messageMode: moraleMessageMode(combatant) })
        } catch (err) {
          // The roll's error boundary already notified; roll the rest.
          console.error(`DCC | morale check failed for ${combatant.name}`, err)
        }
      }
    }
  })
}

/**
 * `preUpdateActor` handler. Records an NPC's HP before an HP change on the
 * update options, which Foundry passes on to `updateActor` on every client.
 *
 * @param {Actor} actor
 * @param {object} changes - the update diff
 * @param {object} options - the update options (mutated)
 */
export function onPreUpdateActorForMorale (actor, changes, options) {
  if (actor?.type !== 'NPC') return
  if (changes?.system?.attributes?.hp?.value === undefined) return
  options[HP_BEFORE_OPTION] = Number(actor.system.attributes.hp.value)
}

/**
 * `updateActor` handler. When this update took an NPC from above half its
 * hit points to half or below, the active GM gets the morale prompt. An
 * NPC dropped to 0 or below gets no prompt: it's down, not wavering.
 *
 * @param {Actor} actor
 * @param {object} changes - the update diff
 * @param {object} options - the update options
 */
export async function onUpdateActorForMorale (actor, changes, options) {
  try {
    if (!game.settings.get('dcc', 'moraleHalfHpPrompt')) return
    if (!isActiveGM()) return
    if (actor?.type !== 'NPC' || neverChecksMorale(actor)) return

    const before = options?.[HP_BEFORE_OPTION]
    const after = Number(changes?.system?.attributes?.hp?.value)
    if (!Number.isFinite(before) || !Number.isFinite(after) || after <= 0) return

    const state = { maxHP: Number(actor.system.attributes.hp.max) || 0, currentHP: before, halfHPChecked: false }
    if (!checkCreatureMoraleTrigger(state, before - after)) return

    await postHalfHpPrompt(actor)
  } catch (err) {
    console.error('DCC | morale half-HP prompt failed', err)
  }
}

/**
 * Whisper the GMs a "below half HP" card with Roll Morale and Don't Ask
 * Again buttons.
 * @param {Actor} actor
 */
async function postHalfHpPrompt (actor) {
  // The card is raw HTML; the actor name is user-controlled data.
  const name = foundry.utils.escapeHTML(actor.name)
  const content = `<p>${game.i18n.format('DCC.MoraleHalfHpPrompt', { name })}</p>` +
    '<div class="dcc-morale-actions">' +
    `<button type="button" data-action="rollMoraleHalfHp" data-actor-uuid="${actor.uuid}">` +
    `${game.i18n.localize('DCC.MoraleRollButton')}</button>` +
    `<button type="button" data-action="moraleNeverAsk" data-actor-uuid="${actor.uuid}">` +
    `${game.i18n.localize('DCC.MoraleNeverAskButton')}</button></div>`
  await ChatMessage.create({
    content,
    speaker: ChatMessage.getSpeaker({ actor }),
    whisper: ChatMessage.getWhisperRecipients('GM').map(user => user.id),
    flags: { dcc: { moraleHalfHpPrompt: true } }
  })
}

/**
 * Mark an NPC as never checking morale. An unlinked token's actor is a copy
 * of the world actor, so the mark goes on the world actor: every token of
 * that creature stops prompting, not just the one that was hit.
 * @param {Actor} actor
 */
export async function markNeverChecksMorale (actor) {
  const target = actor.isToken ? (game.actors.get(actor.id) ?? actor) : actor
  await target.update({ 'system.config.moraleImmune': true })
  ui.notifications.info(game.i18n.format('DCC.MoraleNeverAskDone', { name: target.name }))
}

/**
 * `renderChatMessageHTML` handler. Wires the Roll Morale and Don't Ask
 * Again buttons on the half-HP prompt card; disabled for anyone but a GM.
 *
 * @param {ChatMessage} message
 * @param {HTMLElement} html - the rendered message HTML
 */
export function onRenderChatMessageHTMLForMorale (message, html) {
  if (!message?.getFlag?.('dcc', 'moraleHalfHpPrompt')) return
  const handlers = {
    rollMoraleHalfHp: (actor, event) => actor.rollMoraleCheck({
      trigger: 'half-hp-lost',
      showModifierDialog: wantsModifierDialog(event),
      messageMode: moraleMessageMode(undefined, actor)
    }),
    moraleNeverAsk: actor => markNeverChecksMorale(actor)
  }
  for (const [action, handler] of Object.entries(handlers)) {
    for (const button of html?.querySelectorAll?.(`button[data-action="${action}"]`) ?? []) {
      if (!game.user.isGM) {
        button.disabled = true
        continue
      }
      button.addEventListener('click', async event => {
        const actor = await fromUuid(button.dataset.actorUuid)
        if (actor) await handler(actor, event)
      })
    }
  }
}
