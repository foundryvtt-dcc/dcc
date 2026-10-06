/* global game */

/**
 * Halfling two-weapon fumbles (#968).
 *
 * RAW, a halfling fighting with two weapons only fumbles when BOTH hands roll
 * a natural 1. Each hand is still rolled as its own attack, so a single
 * natural 1 can't be judged on its own card. Following the rules-automation
 * policy (docs/dev/RULES_AUTOMATION.md):
 *
 * - **Decide** when the other hand's card is known: same actor, same
 *   combatant, same round of the active combat, the opposite hand, and not
 *   already paired. Both 1s → the fumble rolls on the second card; one 1 →
 *   no fumble.
 * - **Offer** otherwise: the fumble is held behind a click-to-roll prompt
 *   ("if both hands rolled a natural 1").
 *
 * Pairing state lives on the chat message flags (`dcc.twoWeaponPair`), so
 * deleting a misclicked card removes it from pairing. The card's fumble state
 * is `dcc.twoWeaponFumble`: `held`, `cleared`, `confirmed`, or
 * `confirmedElsewhere` (the first card of a both-1s pair, whose fumble rolled
 * on the second card).
 */

export const TWO_WEAPON_FUMBLE_NOTE_KEYS = {
  held: 'DCC.HalflingTwoWeaponFumbleNote',
  cleared: 'DCC.HalflingTwoWeaponFumbleCleared',
  confirmed: 'DCC.HalflingTwoWeaponFumbleConfirmed',
  confirmedElsewhere: 'DCC.HalflingTwoWeaponFumbleConfirmedElsewhere'
}

/**
 * The weapon's two-weapon hand, or `null` when it isn't set up for two-weapon
 * fighting. Primary wins if both flags are (mis)configured.
 * @param {Item|{system:object}} weapon
 * @returns {'primary'|'secondary'|null}
 */
function twoWeaponRole (weapon) {
  if (weapon?.system?.twoWeaponPrimary) return 'primary'
  if (weapon?.system?.twoWeaponSecondary) return 'secondary'
  return null
}

/**
 * Whether this attack falls under the halfling both-1s fumble rule.
 * @param {Actor} actor
 * @param {Item} weapon
 * @returns {boolean}
 */
export function isHalflingTwoWeaponAttack (actor, weapon) {
  return actor?.classId === 'halfling' && twoWeaponRole(weapon) !== null
}

/**
 * The pairing key for this attack: the active combat, its round, the actor's
 * combatant, and the hand. `null` outside a started combat or when the actor
 * has no combatant — the rule then stays at the Offer tier.
 * @param {Actor} actor
 * @param {Item} weapon
 * @returns {{combatId:string, round:number, combatantId:string, actorId:string, role:string}|null}
 */
export function twoWeaponPairContext (actor, weapon) {
  const role = twoWeaponRole(weapon)
  const combat = globalThis.game?.combat
  if (!role || !actor || !combat?.started || !(combat.round >= 1)) return null
  let combatant = null
  for (const c of combat.combatants) {
    if (c.actor?.id === actor.id) { combatant = c; break }
  }
  if (!combatant) return null
  return { combatId: combat.id, round: combat.round, combatantId: combatant.id, actorId: actor.id, role }
}

/**
 * The other hand's attack card for this context, or `null`. A candidate must
 * match combat, round, combatant and actor, hold the opposite hand, and not be
 * paired already (by its own flag, or by another card pointing at it). The
 * newest match wins.
 * @param {object} context - from {@link twoWeaponPairContext}
 * @param {Iterable<ChatMessage>} [messages]
 * @returns {ChatMessage|null}
 */
export function findTwoWeaponPartner (context, messages = game.messages) {
  if (!context || !messages) return null
  const list = Array.from(messages)
  const pairOf = message => message?.flags?.dcc?.twoWeaponPair
  const taken = new Set(list.map(m => pairOf(m)?.pairedWith).filter(Boolean))
  for (let i = list.length - 1; i >= 0; i--) {
    const message = list[i]
    const pair = pairOf(message)
    if (!pair) continue
    if (pair.combatId !== context.combatId || pair.round !== context.round) continue
    if (pair.combatantId !== context.combatantId || pair.actorId !== context.actorId) continue
    if (pair.role === context.role) continue
    if (pair.pairedWith || taken.has(message.id)) continue
    return message
  }
  return null
}

/**
 * Decide the fumble for this card and what the partner card should become.
 * @param {boolean} fumbled - this attack rolled a fumble (a natural 1)
 * @param {ChatMessage|null} partner - from {@link findTwoWeaponPartner}
 * @returns {{state:string|null, partnerState:string|null}} `state` is this
 *   card's `dcc.twoWeaponFumble` (null: nothing to say); `partnerState` is the
 *   partner's new state (null: leave it).
 */
export function resolveTwoWeaponFumble (fumbled, partner) {
  const partnerFumbled = !!partner?.flags?.dcc?.twoWeaponPair?.fumbled
  if (!partner) return { state: fumbled ? 'held' : null, partnerState: null }
  if (fumbled && partnerFumbled) return { state: 'confirmed', partnerState: 'confirmedElsewhere' }
  if (fumbled) return { state: 'cleared', partnerState: null }
  if (partnerFumbled) return { state: null, partnerState: 'cleared' }
  return { state: null, partnerState: null }
}

/**
 * The card note for a fumble state, or `''`.
 * @param {string|null} state
 * @returns {string}
 */
export function twoWeaponFumbleNote (state) {
  const key = TWO_WEAPON_FUMBLE_NOTE_KEYS[state]
  return key ? game.i18n.localize(key) : ''
}

/**
 * Mark the partner card paired with `messageId` and, when it changes state,
 * replace its note and drop its held fumble prompt. The plain card's content
 * is rendered at creation, so `renderContent` re-renders it from the updated
 * system data. Skipped when this user can't update the partner — it then
 * keeps its Offer-tier prompt. Errors are logged, never thrown.
 * @param {ChatMessage} partner
 * @param {string} messageId - the new card's id
 * @param {string|null} partnerState
 * @param {(system:object) => Promise<string>} renderContent
 */
export async function settleTwoWeaponPartner (partner, messageId, partnerState, renderContent) {
  try {
    if (!partner || !messageId) return
    if (partner.canUserModify && !partner.canUserModify(game.user, 'update')) return
    const update = { 'flags.dcc.twoWeaponPair.pairedWith': messageId }
    if (partnerState) {
      const system = {
        ...partner.system,
        twoWeaponNote: twoWeaponFumbleNote(partnerState),
        fumbleInlineRoll: '',
        fumblePrompt: '',
        fumbleRollFormula: ''
      }
      update['flags.dcc.twoWeaponFumble'] = partnerState
      update['system.twoWeaponNote'] = system.twoWeaponNote
      update['system.fumbleInlineRoll'] = ''
      update['system.fumblePrompt'] = ''
      update['system.fumbleRollFormula'] = ''
      update.content = await renderContent(system)
    }
    await partner.update(update)
  } catch (error) {
    console.error('DCC | Failed to update the paired two-weapon attack card', error)
  }
}
