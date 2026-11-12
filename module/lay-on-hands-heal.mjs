/* global console, fromUuid, game, Roll */

/**
 * Lay on Hands: heal the targeted creature from the result card (#966).
 *
 * Offer tier (docs/dev/RULES_AUTOMATION.md). When a cleric lays on hands with
 * exactly one token targeted, the card records that target: its alignment, hit
 * die and hit dice (`flags.dcc.layOnHands`). The card then offers a button
 * that states what it relies on, e.g. "Heal Bob: same alignment, 3 dice
 * capped at 2 HD, 2d8". Nothing heals until someone clicks. The other
 * alignment columns stay available as smaller buttons for when the judge
 * rules the relationship differently.
 *
 * The dice counts come from the active Lay on Hands table (the
 * `layOnHandsTable` setting can replace it), read from the drawn result's
 * three alignment rows. A result that can't be read leaves the card as it
 * was: the table text, and no button. So do no target, more than one target,
 * a target without a readable hit die, or the `layOnHandsHealButton` setting
 * being off.
 *
 * The rule itself mirrors the lib's `layOnHands` (`cleric/lay-on-hands.js`):
 * the alignment relationship picks the column, the healing dice match the
 * subject's hit die, and the dice count is capped at the subject's hit dice
 * (class level for a PC).
 *
 * Healing is a privileged write (the cleric's player rarely owns the
 * subject), so it runs on the active GM through the system socket, like
 * auto-applied damage. The GM rolls the dice, posts the roll, marks the card
 * healed so it applies only once, and applies the healing through
 * `DCCActor#applyDamage`.
 */

import { canApplyCardDamage } from './auto-apply-damage.mjs'
import { executeAsGM, registerSocketHandler } from './socket.mjs'

export const LAY_ON_HANDS_HEAL_ACTION = 'dcc.layOnHandsHeal'

/** Alignment relationships, in the order the table lists them. */
export const LAY_ON_HANDS_RELATIONS = ['same', 'adjacent', 'opposed']

const RELATION_LABELS = {
  same: 'DCC.LayOnHandsRelationSame',
  adjacent: 'DCC.LayOnHandsRelationAdjacent',
  opposed: 'DCC.LayOnHandsRelationOpposed'
}

/** Cards the GM is healing from right now (double-click guard). */
const cardsHealing = new Set()

/**
 * The cleric–subject alignment relationship (lib `LayOnHandsAlignment`):
 * same alignment, opposed (lawful vs chaotic), or adjacent (one step apart).
 * @param {string} clericAlignment - 'l', 'n' or 'c'
 * @param {string} subjectAlignment - 'l', 'n' or 'c'
 * @returns {'same'|'adjacent'|'opposed'|null} null when either is unknown
 */
export function alignmentRelation (clericAlignment, subjectAlignment) {
  const a = String(clericAlignment ?? '').trim().charAt(0).toLowerCase()
  const b = String(subjectAlignment ?? '').trim().charAt(0).toLowerCase()
  const valid = ['l', 'n', 'c']
  if (!valid.includes(a) || !valid.includes(b)) return null
  if (a === b) return 'same'
  if (a !== 'n' && b !== 'n') return 'opposed'
  return 'adjacent'
}

/**
 * Read the dice counts from a Lay on Hands table result. The result text is a
 * table with one row per alignment relationship, in the order same, adjacent,
 * opposed, each giving a dice count ("3 dice", "1 die") or a failure (no
 * number). Only the order and the numbers are read, so translated tables work.
 * @param {string} html - the drawn result's description
 * @returns {{same: number, adjacent: number, opposed: number}|null} null when
 *   the text isn't three such rows
 */
export function parseLayOnHandsDice (html) {
  const rows = [...String(html ?? '').matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map(m => m[1])
    .filter(row => /<td/i.test(row))
  if (rows.length !== LAY_ON_HANDS_RELATIONS.length) return null
  const dice = {}
  rows.forEach((row, i) => {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
    const text = (cells.at(-1)?.[1] ?? '').replace(/<[^>]*>/g, ' ')
    dice[LAY_ON_HANDS_RELATIONS[i]] = parseInt(text.match(/\d+/)?.[0] ?? '0') || 0
  })
  return dice
}

/**
 * The subject's hit die and hit dice: the die type rolled to heal it, and the
 * count that caps the healing dice. A PC's hit die field holds its class die
 * ("1d8"), so the count is its level (at least 1); an NPC's holds its full
 * hit dice ("3d8+6"). A fractional HD ("½d8") counts as 1.
 * @param {Actor} actor
 * @returns {{hitDie: string, hitDice: number}|null} null when unreadable
 */
export function subjectHitDice (actor) {
  if (actor?.type !== 'Player' && actor?.type !== 'NPC') return null
  const formula = String(actor.system?.attributes?.hitDice?.value ?? '').trim()
  const fractional = /^(½|¼|1\s*[/⁄]\s*[24])/.test(formula)
  const match = formula.replace(/^(½|¼|1\s*[/⁄]\s*[24])/, '1').match(/(\d*)\s*d\s*(\d+)/i)
  if (!match) return null
  const hitDie = `d${match[2]}`
  let hitDice = fractional ? 1 : (parseInt(match[1]) || 1)
  if (actor.type === 'Player') {
    hitDice = Math.max(1, parseInt(actor.system?.details?.level?.value) || 0)
  }
  return { hitDie, hitDice }
}

/**
 * Whether the heal offer is on in this world.
 * @returns {boolean}
 */
function healButtonEnabled () {
  try {
    return !!game.settings.get('dcc', 'layOnHandsHealButton')
  } catch {
    return false
  }
}

/**
 * The text of the first drawn table result.
 * @param {Array<TableResult>|null} tableResult
 * @returns {string}
 */
function resultText (tableResult) {
  const result = Array.isArray(tableResult) ? tableResult[0] : tableResult
  return result?.description ?? result?.text ?? ''
}

/**
 * Build the `flags.dcc.layOnHands` record for a Lay on Hands card, or null
 * to leave the card note-only.
 * @param {Actor} cleric - the actor laying on hands
 * @param {Array<TableResult>} tableResult - the drawn result
 * @param {Set<Token>|Array<Token>} [targets] - the user's targeted tokens
 * @returns {Object|null}
 */
export function buildLayOnHandsHealFlag (cleric, tableResult, targets = game.user?.targets) {
  if (!healButtonEnabled()) return null
  const tokens = targets ? [...targets] : []
  if (tokens.length !== 1) return null
  const token = tokens[0]
  const actor = token?.actor
  const hd = subjectHitDice(actor)
  if (!actor?.uuid || !hd) return null
  const dice = parseLayOnHandsDice(resultText(tableResult))
  if (!dice) return null
  return {
    targetUuid: actor.uuid,
    targetName: token.name ?? actor.name ?? '',
    relation: alignmentRelation(cleric?.system?.details?.alignment, actor.system?.details?.alignment),
    hitDie: hd.hitDie,
    hitDice: hd.hitDice,
    dice
  }
}

/**
 * The dice to update a card's record with after the judge moved its result
 * up or down the table, or null when the card has no record (or already
 * healed).
 * @param {ChatMessage} message
 * @param {TableResult} newResult
 * @returns {{same: number, adjacent: number, opposed: number}|null}
 */
export function adjustedLayOnHandsDice (message, newResult) {
  const record = message?.getFlag?.('dcc', 'layOnHands')
  if (!record || record.healed) return null
  return parseLayOnHandsDice(resultText(newResult)) ?? { same: 0, adjacent: 0, opposed: 0 }
}

/**
 * The healing for one alignment column: the table's dice count, capped at
 * the subject's hit dice, rolled with its hit die.
 * @param {Object} record - `flags.dcc.layOnHands`
 * @param {string} relation
 * @returns {{raw: number, count: number, capped: boolean, formula: string}|null}
 *   null when the column grants no dice
 */
export function healingDice (record, relation) {
  const raw = parseInt(record?.dice?.[relation]) || 0
  const hitDice = parseInt(record?.hitDice) || 0
  const count = Math.min(raw, hitDice)
  if (count <= 0 || !record?.hitDie) return null
  return { raw, count, capped: count < raw, formula: `${count}${record.hitDie}` }
}

/**
 * Escape text for HTML.
 * @param {string} text
 * @returns {string}
 */
function escapeHtml (text) {
  return String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

/**
 * Localized alignment relationship phrase ("same alignment").
 * @param {string} relation
 * @returns {string}
 */
function relationLabel (relation) {
  return game.i18n.localize(RELATION_LABELS[relation])
}

/**
 * The heal section's HTML for a card record: the buttons, or the outcome once
 * healed. Empty when no column grants dice.
 * @param {Object} record - `flags.dcc.layOnHands`
 * @returns {string}
 */
export function layOnHandsHealHtml (record) {
  const target = escapeHtml(record.targetName)
  if (record.healed) {
    const text = game.i18n.format('DCC.LayOnHandsHealed', {
      target,
      hp: record.healed.hp,
      relation: relationLabel(record.healed.relation)
    })
    return `<div class="dcc-lay-on-hands-heal"><p class="healed">${text}</p></div>`
  }

  const buttons = []
  const ordered = record.relation
    ? [record.relation, ...LAY_ON_HANDS_RELATIONS.filter(r => r !== record.relation)]
    : LAY_ON_HANDS_RELATIONS
  for (const relation of ordered) {
    const heal = healingDice(record, relation)
    if (!heal) continue
    const relationText = relationLabel(relation)
    let label
    if (relation === record.relation) {
      label = heal.capped
        ? game.i18n.format('DCC.LayOnHandsHealCapped', { target, relation: relationText, raw: heal.raw, hd: record.hitDice, formula: heal.formula })
        : game.i18n.format('DCC.LayOnHandsHeal', { target, relation: relationText, formula: heal.formula })
    } else {
      label = game.i18n.format('DCC.LayOnHandsHealAs', { relation: relationText, formula: heal.formula })
    }
    const cls = relation === record.relation ? 'lay-on-hands-heal primary' : 'lay-on-hands-heal alternate'
    buttons.push(`<button type="button" class="${cls}" data-action="layOnHandsHeal" data-relation="${relation}">${label}</button>`)
  }
  if (!buttons.length) return ''

  const prompt = record.relation
    ? ''
    : `<p class="hint">${game.i18n.format('DCC.LayOnHandsHealPrompt', { target })}</p>`
  return `<div class="dcc-lay-on-hands-heal">${prompt}${buttons.join('')}</div>`
}

/**
 * `renderChatMessageHTML` handler: add the heal section to a Lay on Hands card
 * with a target record, and wire its buttons. Buttons are disabled for users
 * who may not act for the card.
 * @param {ChatMessage} message
 * @param {HTMLElement} html
 */
export function onRenderChatMessageHTMLForLayOnHands (message, html) {
  const record = message?.getFlag?.('dcc', 'layOnHands')
  if (!record || !message.isContentVisible) return
  if (!record.healed && !healButtonEnabled()) return
  const markup = layOnHandsHealHtml(record)
  if (!markup) return
  const container = html?.querySelector?.('.message-content')
  if (!container) return
  container.querySelector('.dcc-lay-on-hands-heal')?.remove()
  container.insertAdjacentHTML('beforeend', markup)

  const allowed = canApplyCardDamage(message, game.user)
  for (const button of container.querySelectorAll('button[data-action="layOnHandsHeal"]')) {
    if (!allowed) {
      button.disabled = true
      continue
    }
    button.addEventListener('click', async event => {
      event.preventDefault()
      event.stopPropagation()
      button.disabled = true
      await requestLayOnHandsHeal(message, button.dataset.relation)
    })
  }
}

/**
 * Ask the active GM to heal the card's target using one alignment column.
 * @param {ChatMessage} message
 * @param {string} relation
 * @returns {Promise<void>}
 */
export async function requestLayOnHandsHeal (message, relation) {
  try {
    await executeAsGM(LAY_ON_HANDS_HEAL_ACTION, { messageId: message.id, relation })
  } catch (err) {
    console.error('DCC | Lay on Hands healing failed', err)
  }
}

/**
 * GM-side socket handler: roll the healing dice for the chosen column, post
 * the roll, mark the card healed, and heal the target. Applies once per card.
 * @param {{messageId: string, relation: string}} payload
 * @param {string} [userId] - requesting user id, stamped by the server
 */
export async function layOnHandsHealHandler ({ messageId, relation } = {}, userId) {
  const message = game.messages?.get(messageId)
  const record = message?.getFlag?.('dcc', 'layOnHands')
  if (!record || record.healed || !LAY_ON_HANDS_RELATIONS.includes(relation)) return
  const sender = userId ? game.users?.get(userId) : null
  if (!canApplyCardDamage(message, sender)) return
  const heal = healingDice(record, relation)
  if (!heal) return
  if (cardsHealing.has(messageId)) return
  cardsHealing.add(messageId)
  try {
    const doc = await fromUuid(record.targetUuid)
    const target = doc?.documentName === 'Actor' ? doc : doc?.actor
    if (typeof target?.applyDamage !== 'function') {
      console.warn(`DCC | Lay on Hands card ${messageId}: target ${record.targetUuid} no longer exists; not healed`)
      return
    }
    const roll = new Roll(heal.formula)
    await roll.evaluate()
    await message.update({ 'flags.dcc.layOnHands.healed': { relation, hp: roll.total, formula: heal.formula } })
    await roll.toMessage({
      speaker: message.speaker,
      flavor: game.i18n.format('DCC.LayOnHandsHealFlavor', { target: escapeHtml(record.targetName), relation: relationLabel(relation) }),
      flags: { 'dcc.RollType': 'LayOnHandsHeal' }
    })
    await target.applyDamage(roll.total, -1)
  } catch (err) {
    console.error('DCC | Lay on Hands healing failed', err)
  } finally {
    cardsHealing.delete(messageId)
  }
}

/** Register the GM-side heal handler. Call once at ready. */
export function registerLayOnHandsHealHandler () {
  registerSocketHandler(LAY_ON_HANDS_HEAL_ACTION, layOnHandsHealHandler)
}
