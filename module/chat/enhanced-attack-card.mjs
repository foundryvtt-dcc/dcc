/* global game, foundry, ChatMessage, console */

/**
 * Enhanced attack chat cards (DCC QoL integration).
 *
 * Renders a redesigned attack card — hit/miss banner versus the selected
 * target, weapon image/name (click to toggle the weapon description), separate
 * Roll Damage / Crit / Fumble buttons, and a weapon-properties footer — in
 * place of the plain card, when the client's `enhancedAttackCards` setting is
 * on. It runs in the `renderChatMessageHTML` hook and replaces the rendered
 * `.message-content`, so it is **mutually exclusive with the emote-roll rewrite
 * for attack cards** (the wiring skips the attack emote path when this renders).
 *
 * The damage/crit/fumble buttons appear only when `automateDamageFumblesCrits`
 * is off (otherwise the rolls are already resolved and shown inline). Clicking a
 * button rolls via `DCCRoll.createRoll` (honoring the modifier dialog) and posts
 * a standalone roll message — the system's existing crit/fumble table lookup
 * renders the result on that message — then marks the originating card so the
 * button disables for non-GM viewers on re-render. The clicked-state flag is
 * written by the message author / GM directly, or routed through the GM socket
 * (`dcc.updateMessageFlags`) when the clicker owns neither.
 *
 * Inert while the dcc-qol module is active (it drives its own enhanced cards).
 */

import { qolHandlingCombat } from '../integrations.mjs'
import { executeAsGM, registerSocketHandler } from '../socket.mjs'

const UPDATE_FLAGS_ACTION = 'dcc.updateMessageFlags'
const TEMPLATE = 'systems/dcc/templates/chat-card-attack-enhanced.html'

/**
 * Whether this message should render as an enhanced attack card on this client:
 * the setting is on, the message is a weapon attack, and dcc-qol isn't driving.
 */
export function shouldRenderEnhancedAttackCard (message) {
  try {
    if (qolHandlingCombat()) return false
    if (!message?.getFlag?.('dcc', 'isToHit')) return false
    return game.settings.get('dcc', 'enhancedAttackCards') === true
  } catch {
    return false
  }
}

/**
 * Resolve the attacking actor for a message — token speaker first (so unlinked
 * tokens use their own data), then the generic speaker actor, then the stored
 * `system.actorId`.
 */
export function resolveAttackActor (message) {
  const speaker = message.speaker ?? {}
  if (speaker.scene && speaker.token) {
    const tokenActor = game.scenes?.get(speaker.scene)?.tokens?.get(speaker.token)?.actor
    if (tokenActor) return tokenActor
  }
  const speakerActor = ChatMessage.getSpeakerActor?.(speaker)
  if (speakerActor) return speakerActor
  return game.actors?.get(message.system?.actorId) ?? null
}

/**
 * Weapon-properties footer tags: damage formula, range (missile only), and a
 * backstab marker. Raw weapon values — no i18n churn.
 */
export function getWeaponProperties (weapon, { isBackstab } = {}) {
  if (!weapon) return []
  const tags = []
  const damage = weapon.system?.damage
  if (damage) tags.push(String(damage))
  if (weapon.system?.melee === false && weapon.system?.range) tags.push(String(weapon.system.range))
  if (isBackstab && weapon.system?.backstabDamage) tags.push(game.i18n.localize('DCC.Backstab'))
  return tags
}

/**
 * Assemble the Handlebars context for the enhanced card from the message flags
 * and stored system data, plus the resolved actor/weapon.
 */
export async function buildEnhancedCardData (message, actor, weapon) {
  const sys = message.system ?? {}
  const flag = (key) => message.getFlag('dcc', key)

  const isPC = actor?.type === 'Player'
  const isBackstab = !!flag('isBackstab')
  const isCrit = !!flag('isCrit')
  const isFumble = !!flag('isFumble')
  const hasTarget = !!flag('hasTarget')
  const hitsTarget = !!flag('hitsTarget')

  let automated = false
  try {
    automated = game.settings.get('dcc', 'automateDamageFumblesCrits') === true
  } catch { automated = false }

  let showHitMiss = true
  try {
    showHitMiss = game.settings.get('dcc', 'showHitMissOnCard') !== false
  } catch { showHitMiss = true }

  const compact = (() => {
    try { return game.settings.get('dcc', 'attackCardFormat') === 'compact' } catch { return false }
  })()

  const attackRoll = message.rolls?.[0]
  const diceHTML = attackRoll
    ? (compact ? attackRoll.toAnchor().outerHTML : await attackRoll.render())
    : ''

  const weaponDescription = isPC ? (weapon?.system?.description?.value ?? '') : ''
  const flavorText = game.i18n.format(isBackstab ? 'DCC.BackstabsWith' : 'DCC.AttacksWith', { weapon: weapon?.name ?? sys.weaponName ?? '' })

  return {
    compact,
    isPC,
    isBackstab,
    isCrit,
    isFumble,
    hasTarget,
    hitsTarget,
    showHitMiss,
    automated,
    suppressDamage: hasTarget && !hitsTarget && !isCrit,
    targetName: flag('targetName') ?? '',
    hitsAc: sys.hitsAc,
    actorName: actor?.name ?? '',
    actorImg: actor?.img ?? '',
    weaponName: weapon?.name ?? sys.weaponName ?? '',
    weaponImg: weapon?.img ?? '',
    flavorText,
    hasDescription: !!weaponDescription,
    weaponDescription,
    diceHTML,
    deedDieRollResult: sys.deedDieRollResult,
    deedRollSuccess: sys.deedRollSuccess,
    deedPromptHTML: game.dcc?.buildMightyDeedPrompt?.(message) ?? '',
    damageInlineRoll: sys.damageInlineRoll,
    damagePrompt: sys.damagePrompt,
    damageRollFormula: sys.damageRollFormula,
    damageButtonClicked: !!flag('damageButtonClicked'),
    critInlineRoll: sys.critInlineRoll,
    critPrompt: sys.critPrompt,
    critResult: sys.critResult,
    critTableName: sys.critTableName,
    critRollTotal: sys.critRollTotal,
    critTableLookupHint: sys.critTableLookupHint,
    critButtonClicked: !!flag('critButtonClicked'),
    fumbleInlineRoll: sys.fumbleInlineRoll,
    fumblePrompt: sys.fumblePrompt,
    fumbleResult: sys.fumbleResult,
    originalFumbleTableName: sys.originalFumbleTableName,
    fumbleRollTotal: sys.fumbleRollTotal,
    isNPCFumble: sys.isNPCFumble,
    fumbleButtonClicked: !!flag('fumbleButtonClicked'),
    twoWeaponNote: sys.twoWeaponNote,
    properties: getWeaponProperties(weapon, { isBackstab }),
    canUserModify: !!actor?.canUserModify?.(game.user, 'update'),
    isGM: !!game.user?.isGM
  }
}

/** The only flags a client may ask the GM to set on a card — button-clicked state. */
const CLICKED_FLAGS = new Set(['damageButtonClicked', 'critButtonClicked', 'fumbleButtonClicked'])

/** Write a clicked-state flag on the card — directly if owned, else via the GM. */
async function markButtonClicked (message, key) {
  if (game.user?.isGM || message.isAuthor) {
    await message.setFlag('dcc', key, true)
  } else {
    await executeAsGM(UPDATE_FLAGS_ACTION, { messageId: message.id, key })
  }
}

/** Should the modifier dialog show for this click? (default XOR ctrl/meta). */
function wantsModifierDialog (event) {
  let dflt = false
  try { dflt = game.settings.get('dcc', 'showRollModifierByDefault') } catch { dflt = false }
  return !!(dflt ^ (event.ctrlKey || event.metaKey))
}

/**
 * Roll one of the card's manual rolls (damage / crit / fumble) via the system
 * roller, post it as a standalone message (the system renders crit/fumble
 * tables on it), and disable the button on re-render.
 */
async function rollCardButton (message, actor, kind, event) {
  event?.preventDefault?.()
  const sys = message.system ?? {}
  const spec = {
    damage: { formula: sys.damageRollFormula, label: 'DCC.RollDamage', title: 'DCC.Damage', rollType: 'Damage', flag: 'damageButtonClicked' },
    crit: { formula: sys.critRollFormula, label: 'DCC.RollCritical', title: 'DCC.Critical', rollType: 'Crit', flag: 'critButtonClicked' },
    fumble: { formula: sys.fumbleRollFormula, label: 'DCC.RollFumble', title: 'DCC.Fumble', rollType: 'Fumble', flag: 'fumbleButtonClicked' }
  }[kind]
  if (!spec?.formula || !actor) return

  const roll = await game.dcc.DCCRoll.createRoll(
    [{ type: 'Compound', formula: spec.formula }],
    actor.getRollData(),
    { showModifierDialog: wantsModifierDialog(event), rollLabel: game.i18n.localize(spec.label), title: game.i18n.localize(spec.title) }
  )
  await roll.evaluate()
  if (kind === 'damage' && roll.total < 1) roll._total = 1 // match auto-roll minimum-1

  const flavor = buildButtonFlavor(kind, message)
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor,
    flags: { 'dcc.RollType': spec.rollType }
  })

  await markButtonClicked(message, spec.flag)
}

/**
 * Flavor for a button's standalone roll message. Crit/fumble flavors embed the
 * table name in the `(...)` form the system's lookup parses.
 */
function buildButtonFlavor (kind, message) {
  const sys = message.system ?? {}
  if (kind === 'crit') {
    return `${game.i18n.localize('DCC.Critical')} (${game.i18n.localize('DCC.CritTable')} ${sys.critTableName ?? ''})`
  }
  if (kind === 'fumble') {
    return `${game.i18n.localize('DCC.Fumble')} (${sys.originalFumbleTableName ?? 'Table 4-2: Fumbles'})`
  }
  return game.i18n.format('DCC.RollsDamageWith', { weapon: sys.weaponName ?? '' })
}

/**
 * Render the enhanced card into the message HTML, replacing `.message-content`,
 * and attach its listeners (description toggle + roll buttons). Returns true
 * when it rendered, false if it bailed (no actor, no content node).
 *
 * @param {ChatMessage} message
 * @param {HTMLElement} html
 * @returns {Promise<boolean>}
 */
export async function renderEnhancedAttackCard (message, html) {
  const messageContent = html.querySelector('.message-content')
  if (!messageContent) return false
  const actor = resolveAttackActor(message)
  if (!actor) return false
  const weapon = actor.items?.get?.(message.system?.weaponId) ?? null

  const data = await buildEnhancedCardData(message, actor, weapon)
  messageContent.innerHTML = await foundry.applications.handlebars.renderTemplate(TEMPLATE, data)

  const card = messageContent.querySelector('.dcc-enhanced-card')
  if (!card) return true

  card.querySelectorAll('[data-action="toggle-weapon-description"]').forEach(el => {
    el.addEventListener('click', () => card.querySelector('.weapon-description')?.classList.toggle('dcc-hidden'))
  })

  const wireButton = (action, kind) => {
    const btn = card.querySelector(`[data-action="${action}"]`)
    if (!btn || btn.classList.contains('disabled')) return
    btn.addEventListener('click', (event) => {
      rollCardButton(message, actor, kind, event).catch(err => console.error('DCC | enhanced card roll failed', err))
    })
  }
  wireButton('roll-damage', 'damage')
  wireButton('roll-crit', 'crit')
  wireButton('roll-fumble', 'fumble')

  return true
}

/**
 * GM-side handler: mark a card's button as clicked on behalf of the requester.
 * Hardened against a crafted socket payload — only the three known
 * button-clicked flags may be set (never an arbitrary key/value), the message
 * must exist, and the requesting user must be a GM or own that message.
 *
 * @param {{messageId: string, key: string}} payload
 * @param {string} [userId] requesting user id (client-supplied; verified here)
 */
async function updateMessageFlagsHandler ({ messageId, key } = {}, userId) {
  if (!CLICKED_FLAGS.has(key)) return
  const message = game.messages?.get(messageId)
  if (!message) return
  const sender = userId ? game.users?.get(userId) : null
  if (!sender) return
  if (!sender.isGM && !message.testUserPermission?.(sender, 'OWNER')) return
  await message.setFlag('dcc', key, true)
}

/** Register the GM-side message-flag socket handler. Call once at ready. */
export function registerEnhancedCardSocket () {
  registerSocketHandler(UPDATE_FLAGS_ACTION, updateMessageFlagsHandler)
}
