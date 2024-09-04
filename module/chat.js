/* global canvas, game, TextEditor */

import { getCritTableResult, getFumbleTableResult } from './utilities.js'

/**
 * Highlight critical success or failure on d20 rolls
 */
export const highlightCriticalSuccessFailure = function (message, html, data) {
  if (!message.rolls || !message.isContentVisible) return

  // Highlight rolls where the first part is a d20 roll
  const rolls = message.rolls
  rolls.forEach((roll) => {
    if (!roll.dice.length) return
    const d = roll.dice[0]

    // Ensure it is a d20 roll or a custom roll
    const rollData = d.options.dcc
    const needsHighlight = ((d.faces === 20) && (d.results.length === 1)) || rollData
    if (!needsHighlight) return

    // Default highlight settings for a d20
    let upperThreshold = 20
    let lowerThreshold = 1

    let upperClass = 'critical'
    let lowerClass = 'fumble'

    // Apply DCC specific highlighting settings
    if (rollData) {
      // Highlight max result on any die if requested
      if (rollData.highlightMax) {
        upperThreshold = d.faces
        // Otherwise apply upper threshold if provided
      } else if (rollData.upperThreshold) {
        upperThreshold = rollData.upperThreshold
      }

      // Apply a lower threshold if provided
      if (rollData.lowerThreshold) {
        lowerThreshold = rollData.lowerThreshold
      }

      // Swap class for rolls above or below the threshold if rolling under
      if (rollData.rollUnder) {
        upperClass = 'fumble'
        lowerClass = 'critical'
      }
    }

    // Apply highlights
    if (d.total >= upperThreshold) {
      html.find('.dice-total').addClass(upperClass)
    } else if (d.total <= lowerThreshold) {
      html.find('.dice-total').addClass(lowerClass)
    }
  })
}

/* -------------------------------------------- */

/**
 * This function is used to hook into the Chat Log context menu to add additional options to each message
 * These options make it easy to conveniently apply damage to controlled tokens based on the value of a Roll
 *
 * @param {HTMLElement} html    The Chat Message being rendered
 * @param {Array} options       The Array of Context Menu options
 *
 * @return {Array}              The extended options Array including new context choices
 */
export const addChatMessageContextOptions = function (html, options) {
  const canApply = function (li) {
    if (canvas.tokens.controlled.length === 0) return false
    if (li.find('.damage-applyable').length) return true
    if (li.find('.dice-total').length) return true
  }

  options.push(
    {
      name: game.i18n.localize('DCC.ChatContextDamage'),
      icon: '<i class="fas fa-user-minus"></i>',
      condition: canApply,
      callback: li => applyChatCardDamage(li, 1)
    }
  )
  options.push(
    {
      name: game.i18n.localize('DCC.ChatContextHealing'),
      icon: '<i class="fas fa-user-plus"></i>',
      condition: canApply,
      callback: li => applyChatCardDamage(li, -1)
    }
  )
  return options
}

/* -------------------------------------------- */

/**
 * Apply rolled dice damage to the token or tokens which are currently controlled.
 * This allows for damage to be scaled by a multiplier to account for healing, critical hits, or resistance
 *
 * @param {HTMLElement} roll    The chat entry which contains the roll data
 * @param {Number} multiplier   A damage multiplier to apply to the rolled damage.
 * @return {Promise}
 */
function applyChatCardDamage (roll, multiplier) {
  const amount = roll.find('.damage-applyable').attr('data-damage') ||
    roll.find('.dice-total').text()
  return Promise.all(canvas.tokens.controlled.map(t => {
    const a = t.actor
    return a.applyDamage(amount, multiplier)
  }))
}

/**
 * Change attack rolls into emotes
 * @param message
 * @param html
 * @param data
 * @returns {Promise<void>}
 */
export const emoteAttackRoll = function (message, html, data) {
  if (!message.rolls || !message.isContentVisible || !message.flags?.dcc?.isToHit) return

  let deedRollHTML = ''
  if (message.system.deedDieRollResult) {
    const critical = message.system.deedSucceed ? ' critical' : ''
    const iconClass = 'fa-dice-d4'
    const deedDieHTML = `<a class="inline-roll${critical}"><i class="fas ${iconClass}"></i>${message.system.deedDieRollResult}</a>`
    deedRollHTML = game.i18n.format('DCC.AttackRollDeedEmoteSegment', { deed: deedDieHTML })
  }

  const attackEmote = game.i18n.format('DCC.AttackRollEmote', {
    actorName: message.alias,
    weaponName: message.system.weaponName,
    rollHTML: message.rolls[0].toAnchor('Roll Damage'),
    deedRollHTML,
    damageRollHTML: message.system.damageInlineRoll,
    crit: '',
    fumble: ''
  })
  html.find('.message-content').html(attackEmote)
  html.find('header').remove()
}

/**
 * Change crit rolls into emotes
 * @param message
 * @param html
 * @param data
 * @returns {Promise<void>}
 */
export const emoteCritRoll = async function (message, html, data) {
  if (!message.rolls || !message.isContentVisible || !message.flavor.includes('Critical')) return
  const tableName = message.flavor.replace('Critical (', '').replace(')', '')

  const critResult = await getCritTableResult(message.rolls[0], tableName)
  const critText = await TextEditor.enrichHTML(critResult.results[0].text)

  const critRollEmote = game.i18n.format(
    'DCC.RolledCritEmote',
    {
      actorName: data.alias,
      critInlineRollHTML: message.rolls[0].toAnchor().outerHTML,
      critTableName: tableName,
      critResult: critText ? `:<br>${critText}` : '.'
    }
  )

  html.find('.message-content').html(critRollEmote)
  html.find('header').remove()
}

/**
 * Change damage rolls into emotes
 * @param message
 * @param html
 * @param data
 * @returns {Promise<void>}
 */
export const emoteDamageRoll = function (message, html, data) {
  if (!message.rolls || !message.isContentVisible || !message.flavor.includes('Damage')) return

  const damageRollEmote = game.i18n.format(
    'DCC.RolledDamageEmote',
    {
      actorName: data.alias,
      damageInlineRollHTML: message.rolls[0].toAnchor('Roll Damage').outerHTML
    }
  )
  html.find('.message-content').html(damageRollEmote)
  html.find('header').remove()
}

/**
 * Change fumble rolls into emotes
 * @param message
 * @param html
 * @param data
 * @returns {Promise<void>}
 */
export const emoteFumbleRoll = async function (message, html, data) {
  if (!message.rolls || !message.isContentVisible || !message.flavor.includes('Fumble')) return
  if (game.settings.get('dcc', 'emoteRolls') === false) return

  const fumbleResult = await getFumbleTableResult(message.rolls[0])
  const fumbleText = await TextEditor.enrichHTML(fumbleResult.results[0].text)

  const fumbleRollEmote = game.i18n.format(
    'DCC.RolledFumbleEmote',
    {
      actorName: data.alias,
      fumbleInlineRollHTML: message.rolls[0].toAnchor().outerHTML,
      fumbleResult: fumbleText ? `:<br>${fumbleText}` : '.'
    }
  )

  html.find('.message-content').html(fumbleRollEmote)
  html.find('header').remove()
}

/**
 * Change initiative rolls into emotes
 * @param message
 * @param html
 * @param data
 * @returns {Promise<void>}
 */
export const emoteInitiativeRoll = function (message, html, data) {
  if (!message.rolls || !message.isContentVisible || !message.flags?.core?.initiativeRoll) return

  const initiativeRollEmote = game.i18n.format(
    'DCC.RolledInitiativeEmote',
    {
      actorName: data.alias,
      initiativeInlineRollHTML: message.rolls[0].toAnchor().outerHTML
    }
  )
  html.find('.message-content').html(initiativeRollEmote)
  html.find('header').remove()
}

/**
 * Look up a critical hit roll in the crit table specified in the flavor
 * @param message
 * @param html
 * @param data
 * @returns {Promise<void>}
 */
export const lookupCriticalRoll = async function (message, html, data) {
  if (!message.rolls || !message.isContentVisible || !message.flavor.includes('Critical')) return
  const tableName = message.flavor.replace('Critical (', '').replace(')', '')

  const critResult = await getCritTableResult(message.rolls[0], tableName)
  const critText = await TextEditor.enrichHTML(critResult.results[0].text)
  html.find('.message-content').html(`<strong>${message.rolls[0].total}</strong> - ${critText}`)
}

/**
 * Look up a fumble roll
 * @param message
 * @param html
 * @param data
 * @returns {Promise<void>}
 */
export const lookupFumbleRoll = async function (message, html, data) {
  if (!message.rolls || !message.isContentVisible || !message.flavor.includes('Fumble')) return

  const fumbleResult = await getFumbleTableResult(message.rolls[0])
  const fumbleText = await TextEditor.enrichHTML(fumbleResult.results[0].text)
  html.find('.message-content').html(`<strong>${message.rolls[0].total}</strong> - ${fumbleText}`)
}

/**
 * Re-render the chat once settings are available
 */
// Hooks.on('dcc.ready', (dcc) => {
//   const messages = game.messages.contents
//
//   // Iterate over each message
//   for (let message of messages) {
//     Hooks.call('renderChatMessage', (message, message.getHTML(), message.system))
//   }
// })
