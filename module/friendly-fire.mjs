/* global game, Roll, ChatMessage, console */

/**
 * Friendly fire on a missed missile attack into melee (DCC core rulebook p. 96).
 *
 * When the `automateFriendlyFire` setting is on and a ranged attack against a
 * creature engaged in melee with the attacker's allies *misses*, there is a
 * 50% chance the stray shot is directed at a random ally. The endangered ally
 * is then attacked normally; on a hit it takes the weapon's damage.
 *
 * The **rule** lives in `dcc-core-lib` (`checkFiringIntoMelee` — the 50%
 * threshold, the random-ally selection, and the to-hit comparison); the
 * **dice** are all Foundry `Roll`s whose naturals are replayed into the lib via
 * a sequenced roller (the same translation pattern the attack/crit/fumble paths
 * use). Everything Foundry-specific — token/ally detection, the chat card, and
 * the privileged damage write — lives here.
 *
 * Gated by `qolHandlingCombat` so dcc-qol drives this while that module is
 * active, and off by default so existing worlds are unaffected until opt-in.
 * Fired once per attack from the weapon-attack dispatch (alongside
 * auto-apply-damage), so no de-duplication flag is needed.
 */

import { checkFiringIntoMelee } from './vendor/dcc-core-lib/index.js'
import { qolHandlingCombat } from './integrations.mjs'
import { getFirstTargetDoc, getAttackerTokenDoc, getAlliesInMeleeWithTarget } from './weapon-range.mjs'
import { attackHitsTarget, applyDamageViaGM } from './auto-apply-damage.mjs'

/**
 * Build the `1d20 + <to-hit>` formula for the stray shot against an ally,
 * matching the original weapon's bonus. The bonus is rolled inside Foundry
 * (so deed dice and other formula bonuses resolve naturally); the lib then
 * compares the rolled total against the ally's AC with a zero bonus of its own.
 *
 * @param {DCCActor} actor - the attacking actor
 * @param {DCCItem} weapon - the weapon fired
 * @returns {string} a Foundry roll formula
 */
export function buildAllyAttackFormula (actor, weapon) {
  const ab = actor?.system?.details?.attackBonus ?? 0
  const bonus = String(weapon?.system?.toHit ?? '0').replaceAll('@ab', String(ab)).trim()
  if (!bonus || bonus === '0' || bonus === '+0') return '1d20'
  return /^[+-]/.test(bonus) ? `1d20 ${bonus}` : `1d20 + ${bonus}`
}

/**
 * A sequenced roller (lib `DiceRoller`) that replays pre-evaluated Foundry
 * naturals in call order, throwing if the lib asks for more than were rolled
 * — failing loud beats silently feeding a stale value.
 */
function sequencedRoller (naturals) {
  let idx = 0
  return () => {
    if (idx >= naturals.length) {
      throw new Error(`[DCC] friendly-fire roller exhausted: lib requested ${idx + 1} rolls, ${naturals.length} available`)
    }
    return naturals[idx++]
  }
}

/**
 * Post the friendly-fire result chat card. Built as inline content (no
 * template/render-hook coupling) with the rolls attached for Dice So Nice.
 */
async function postFriendlyFireCard (actor, weapon, { d100Roll, allyAttackRoll, damageRoll, allyName, allyAC, hitAlly, allyWasHit }) {
  const lines = [`<p>${game.i18n.localize('DCC.FriendlyFireIntoMelee')}</p>`]
  lines.push(`<p>${game.i18n.localize('DCC.FriendlyFireCheckLabel')} ${d100Roll.toAnchor().outerHTML}</p>`)

  if (!hitAlly) {
    lines.push(`<p>${game.i18n.localize('DCC.FriendlyFireSafe')}</p>`)
  } else {
    lines.push(`<p>${game.i18n.format('DCC.FriendlyFireStrayShot', { target: allyName })}</p>`)
    const outcomeKey = allyWasHit ? 'DCC.FriendlyFireHits' : 'DCC.FriendlyFireMisses'
    lines.push(`<p>${allyAttackRoll.toAnchor().outerHTML} ${game.i18n.format(outcomeKey, { total: allyAttackRoll.total, ac: allyAC, target: allyName })}</p>`)
    if (allyWasHit && damageRoll) {
      lines.push(`<p>${game.i18n.format('DCC.FriendlyFireDamage', { damage: damageRoll.toAnchor().outerHTML, target: allyName })}</p>`)
    }
  }

  await ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: game.i18n.localize('DCC.FriendlyFireCheck'),
    flags: { 'dcc.isFriendlyFire': true },
    rolls: [d100Roll, allyAttackRoll, damageRoll].filter(Boolean),
    content: `<div class="dcc chat-card friendly-fire">${lines.join('')}</div>`
  })
}

/**
 * Resolve a friendly-fire check after a missed missile attack. No-op when
 * dcc-qol is active, the setting is off, the weapon is melee, the attack
 * actually hit, there is no single target, the tokens aren't on the canvas, or
 * no ally is engaged with the target. Errors are swallowed (logged) so a
 * friendly-fire failure never breaks the attack flow.
 *
 * @param {DCCActor} actor - the attacking actor
 * @param {object} options - the attack options (carries `targets`, `token`)
 * @param {object} attackRollResult - result from `rollToHit` (crit/fumble/hitsAc)
 * @param {DCCItem} weapon - the weapon fired
 */
export async function maybeFriendlyFire (actor, options, attackRollResult, weapon) {
  try {
    if (qolHandlingCombat()) return
    if (!game.settings.get('dcc', 'automateFriendlyFire')) return
    if (weapon?.system?.melee) return // missile attacks only

    const targetDoc = getFirstTargetDoc(options?.targets)
    const attackerDoc = getAttackerTokenDoc(actor, options)
    if (!targetDoc || !attackerDoc) return

    // Only a *missed* shot can stray into the melee (a fumble counts as a miss).
    if (attackHitsTarget(attackRollResult, targetDoc.actor)) return

    const allies = getAlliesInMeleeWithTarget(targetDoc, attackerDoc)
    if (allies.length === 0) return // nothing to fire into

    const allyACs = allies.map(doc => parseInt(doc.actor?.system?.attributes?.ac?.value) || 10)
    const rollData = actor.getRollData()

    // d100 first; only roll the ally selection + stray attack when it triggers
    // (so the chat card never shows unused dice).
    const d100Roll = new Roll('1d100', rollData)
    await d100Roll.evaluate()
    const naturals = [d100Roll.total]

    let allyAttackRoll
    if (d100Roll.total <= 50) {
      const allyIndexRoll = new Roll(`1d${allies.length}`, rollData)
      await allyIndexRoll.evaluate()
      allyAttackRoll = new Roll(buildAllyAttackFormula(actor, weapon), rollData)
      await allyAttackRoll.evaluate()
      naturals.push(allyIndexRoll.total, allyAttackRoll.total)
    }

    // Lib owns the rule: ≤50 triggers, picks the ally, compares the (already
    // bonus-inclusive) stray-attack total to that ally's AC with a 0 bonus.
    const result = checkFiringIntoMelee(allies.length, allyACs, 0, sequencedRoller(naturals))

    const struckAlly = result.hitAlly ? allies[result.allyIndex] : null
    const allyName = struckAlly?.name ?? struckAlly?.actor?.name ?? ''
    const allyAC = result.hitAlly ? allyACs[result.allyIndex] : null

    let damageRoll
    if (result.allyWasHit && struckAlly) {
      const damageFormula = weapon?.system?.damage || '1d4'
      damageRoll = new Roll(damageFormula, rollData)
      await damageRoll.evaluate()
      // Auto-apply to the struck ally only when the GM has opted into
      // auto-applying damage; otherwise the card shows the roll for manual use.
      if (game.settings.get('dcc', 'autoApplyDamage') && damageRoll.total > 0) {
        await applyDamageViaGM(struckAlly.actor?.uuid, damageRoll.total)
      }
    }

    await postFriendlyFireCard(actor, weapon, {
      d100Roll,
      allyAttackRoll,
      damageRoll,
      allyName,
      allyAC,
      hitAlly: result.hitAlly,
      allyWasHit: result.allyWasHit
    })
  } catch (err) {
    console.error('DCC | friendly fire resolution failed', err)
  }
}
