/* global canvas, foundry, game, ui */
// noinspection DuplicatedCode

import { getCritTableResult, getFumbleTableResult, getNPCFumbleTableResult, addDamageFlavorToRolls } from './utilities.js'

const { TextEditor } = foundry.applications.ux

/**
 * Highlight critical success or failure on d20 rolls
 * @param message
 * @param html
 */
export const highlightCriticalSuccessFailure = function (message, html) {
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
    const diceTotal = html.querySelector('.dice-total')
    if (diceTotal) {
      if (d.total >= upperThreshold) {
        diceTotal.classList.add(upperClass)
      } else if (d.total <= lowerThreshold) {
        diceTotal.classList.add(lowerClass)
      }
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
    if (li.querySelector('.damage-applyable')) return true
    if (li.querySelector('.dice-total')) return true
  }

  options.push(
    {
      name: 'DCC.ChatContextDamage',
      icon: '<i class="fas fa-user-minus"></i>',
      condition: canApply,
      callback: li => applyChatCardDamage(li, 1)
    }
  )
  options.push(
    {
      name: 'DCC.ChatContextHealing',
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
  const damageApplyable = roll.querySelector('.damage-applyable')

  // Check if this is an attack roll message - if so, only use damage-applyable to avoid
  // accidentally applying the attack roll as damage when damage hasn't been rolled yet
  const messageId = roll.closest('[data-message-id]')?.dataset.messageId
  const message = messageId ? game.messages.get(messageId) : null
  const isAttackRoll = message?.getFlag('dcc', 'isToHit')

  let amount
  if (damageApplyable) {
    amount = damageApplyable.getAttribute('data-damage')
  } else if (!isAttackRoll) {
    // Only fall back to dice-total for non-attack rolls (e.g., standalone damage rolls)
    const diceTotal = roll.querySelector('.dice-total')
    amount = diceTotal?.textContent
  }

  if (!amount) {
    ui.notifications.warn(game.i18n.localize('DCC.ApplyDamageNoRoll'))
    return Promise.resolve()
  }

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
 */
export const emoteAbilityRoll = function (message, html, data) {
  if (!message.rolls || !message.isContentVisible || !message.getFlag('dcc', 'isAbilityCheck')) return

  let checkPenaltyNote = ''
  if (message.system?.checkPenaltyRollIndex !== null && message.system?.checkPenaltyRollIndex !== undefined) {
    const checkPenaltyRoll = message.rolls[message.system.checkPenaltyRollIndex]
    if (checkPenaltyRoll) {
      const checkPenaltyRollHTML = checkPenaltyRoll.toAnchor().outerHTML
      const formattedNote = game.i18n.format('DCC.AbilityCheckPenaltyNote', { total: checkPenaltyRollHTML })
      if (formattedNote) {
        checkPenaltyNote = ' ' + formattedNote
      }
    }
  }

  const abilityRollEmote = game.i18n.format(
    'DCC.RolledAbilityEmote',
    {
      actorName: data.alias,
      abilityInlineRollHTML: message.rolls[0].toAnchor().outerHTML,
      abilityName: message.flavor
    }
  ) + checkPenaltyNote

  const messageContent = html.querySelector('.message-content')
  if (messageContent) {
    messageContent.innerHTML = abilityRollEmote
  }
  const header = html.querySelector('header')
  if (header) {
    header.remove()
  }
}

/**
 * Change attack rolls into emotes
 * @param message
 * @param html
 * @param data
 */
export const emoteApplyDamageRoll = function (message, html, data) {
  if (!message.rolls || !message.isContentVisible || !message.getFlag('dcc', 'isApplyDamage')) return

  message.content = message.content.replace('T', 't') // Lowercase message

  const applyDamageEmote = game.i18n.format(
    'DCC.ApplyDamageEmote',
    {
      targetName: data.alias,
      damageInline: message.content
    }
  )
  message.rolls = []
  const messageContent = html.querySelector('.message-content')
  if (messageContent) {
    messageContent.innerHTML = applyDamageEmote
  }
  const header = html.querySelector('header')
  if (header) {
    header.remove()
  }
}

/**
 * Change attack rolls into emotes
 * @param message
 * @param html
 */
export const emoteAttackRoll = function (message, html) {
  if (!message.rolls || !message.isContentVisible || !message.getFlag('dcc', 'isToHit')) return

  let deedRollHTML = ''
  if (message.system.deedDieRollResult) {
    const critical = message.system.deedSucceed ? ' critical' : ''
    let iconClass = 'fa-dice-d4'
    if (message.system?.deedDieFormula.includes('d6') || message.system?.deedDieFormula.includes('d7')) {
      iconClass = 'fa-dice-d6'
    }
    if (message.system?.deedDieFormula.includes('d8')) {
      iconClass = 'fa-dice-d8'
    }
    if (message.system?.deedDieFormula.includes('d10')) {
      iconClass = 'fa-dice-d10'
    }
    // Get the deed die roll from the rolls array by index
    let deedDieHTML
    const deedDieRollIndex = message.system.deedDieRollIndex
    if (deedDieRollIndex !== null && deedDieRollIndex !== undefined && message.rolls[deedDieRollIndex]) {
      // If we have the roll in the rolls array, create a proper inline roll using toAnchor
      const deedDieRoll = message.rolls[deedDieRollIndex]
      deedDieHTML = `<span class="inline-roll inline-result${critical}" title="${message.system?.deedDieFormula}">${deedDieRoll.toAnchor({ classes: ['inline-dsn-hidden'] }).outerHTML}</span>`
    } else {
      // Fallback to non-clickable display if roll data is missing
      deedDieHTML = `<span class="inline-roll${critical}" title="${message.system?.deedDieFormula}"><i class="fas ${iconClass}"></i>${message.system.deedDieRollResult}</span>`
    }
    deedRollHTML = game.i18n.format('DCC.AttackRollDeedEmoteSegment', { deed: deedDieHTML })
  }

  let crit = ''
  if (message.getFlag('dcc', 'isCrit')) {
    crit = `<p class="emote-alert critical">${message.system.critPrompt}!</p> ${message.system.critInlineRoll}`
    // Add navigable crit result if available
    if (message.system.critResult) {
      const critShiftDownTooltip = game.i18n.localize('DCC.CritShiftDown')
      const critShiftUpTooltip = game.i18n.localize('DCC.CritShiftUp')
      crit += `
        <div class="table-draw crit-result" data-table-name="${message.system.critTableName}" data-current-roll="${message.system.critRollTotal}">
          <ol class="table-results"><li class="table-result">
            <div class="result-range">
              <i class="fas fa-sort-up crit-shift-down" data-tooltip="${critShiftDownTooltip}"></i>
              <i class="fas fa-sort-down crit-shift-up" data-tooltip="${critShiftUpTooltip}"></i>
            </div>
            <div class="result-text">${message.system.critResult}</div>
          </li></ol>
        </div>`
    }
  }

  let fumble = ''
  if (message.getFlag('dcc', 'isFumble')) {
    fumble = `<p class="emote-alert fumble">${message.system.fumblePrompt}!</p>${message.system.fumbleInlineRoll}`
    // Add navigable fumble result if available
    if (message.system.fumbleResult) {
      const fumbleShiftDownTooltip = game.i18n.localize('DCC.FumbleShiftDown')
      const fumbleShiftUpTooltip = game.i18n.localize('DCC.FumbleShiftUp')
      fumble += `
        <div class="table-draw fumble-result" data-table-name="${message.system.originalFumbleTableName}" data-current-roll="${message.system.fumbleRollTotal}" data-is-npc="${message.system.isNPCFumble}">
          <ol class="table-results"><li class="table-result">
            <div class="result-range">
              <i class="fas fa-sort-up fumble-shift-down" data-tooltip="${fumbleShiftDownTooltip}"></i>
              <i class="fas fa-sort-down fumble-shift-up" data-tooltip="${fumbleShiftUpTooltip}"></i>
            </div>
            <div class="result-text">${message.system.fumbleResult}</div>
          </li></ol>
        </div>`
    }
  }

  let twoWeaponNote = ''
  if (message.system.twoWeaponNote) {
    twoWeaponNote = `<p class="emote-note"><em>${message.system.twoWeaponNote}</em></p>`
  }

  const damageInlineRoll = message.system.damageInlineRoll.replaceAll('@ab', message.system.deedDieRollResult)

  const attackEmote = game.i18n.format('DCC.AttackRollEmote', {
    actionName: message.getFlag('dcc', 'isBackstab') ? 'backstabs' : 'attacks',
    actorName: message.alias,
    weaponName: message.system.weaponName,
    rollHTML: message.rolls[0].toAnchor().outerHTML,
    deedRollHTML,
    damageRollHTML: damageInlineRoll,
    crit,
    fumble,
    twoWeaponNote
  })
  const messageContent = html.querySelector('.message-content')
  if (messageContent) {
    messageContent.innerHTML = attackEmote
  }
  const header = html.querySelector('header')
  if (header) {
    header.remove()
  }
}

/**
 * Change crit rolls into emotes
 * @param message
 * @param html
 * @param data
 */
export const emoteCritRoll = function (message, html, data) {
  if (!message.rolls || !message.isContentVisible || !message.getFlag('dcc', 'isCrit') || message.getFlag('dcc', 'isToHit')) return

  // Build navigable crit result with arrows if result is available
  let critResultHTML = '.'
  if (message.system.critResult && message.system.critRollTotal) {
    const critShiftDownTooltip = game.i18n.localize('DCC.CritShiftDown')
    const critShiftUpTooltip = game.i18n.localize('DCC.CritShiftUp')
    // Use just the table name suffix (e.g., "II") to match emoteAttackRoll format
    critResultHTML = `
      <div class="table-draw crit-result" data-table-name="${message.system.critTableName}" data-current-roll="${message.system.critRollTotal}">
        <ol class="table-results"><li class="table-result">
          <div class="result-range">
            <i class="fas fa-sort-up crit-shift-down" data-tooltip="${critShiftDownTooltip}"></i>
            <i class="fas fa-sort-down crit-shift-up" data-tooltip="${critShiftUpTooltip}"></i>
          </div>
          <div class="result-text">${message.system.critResult}</div>
        </li></ol>
      </div>`
  }

  const critRollEmote = game.i18n.format(
    'DCC.RolledCritEmote',
    {
      actorName: data.alias,
      critInlineRollHTML: message.rolls[0].toAnchor().outerHTML,
      critTableName: message.system.critTableName,
      critResult: message.system.critResult ? `:${critResultHTML}` : '.'
    }
  )

  const messageContent = html.querySelector('.message-content')
  if (messageContent) {
    messageContent.innerHTML = critRollEmote
  }
  const header = html.querySelector('header')
  if (header) {
    header.remove()
  }
}

/**
 * Change damage rolls into emotes
 * @param message
 * @param html
 * @param data
 * @returns {Promise<void>}
 */
export const emoteDamageRoll = function (message, html, data) {
  if (!message.rolls || !message.isContentVisible || !message.flavor.includes(game.i18n.localize('DCC.Damage'))) return

  const damageRoll = message.rolls[0]

  const damageRollEmote = game.i18n.format(
    'DCC.RolledDamageEmote',
    {
      actorName: data.alias,
      damageInlineRollHTML: damageRoll.toAnchor({ classes: ['damage-applyable'], dataset: { damage: damageRoll.total } }).outerHTML
    }
  )
  const messageContent = html.querySelector('.message-content')
  if (messageContent) {
    messageContent.innerHTML = damageRollEmote
  }
  const header = html.querySelector('header')
  if (header) {
    header.remove()
  }
}

/**
 * Change fumble rolls into emotes
 * @param message
 * @param html
 * @param data
 * @returns {Promise<void>}
 */
export const emoteFumbleRoll = async function (message, html, data) {
  if (!message.rolls || !message.isContentVisible || !message.flavor.includes(game.i18n.localize('DCC.Fumble'))) return
  if (game.settings.get('dcc', 'emoteRolls') === false) return

  let fumbleResult
  const pcFumbleTableIdentifier = 'Table 4-2: Fumbles'

  if (message.system?.fumbleTableName && !message.system.fumbleTableName.includes(pcFumbleTableIdentifier)) {
    fumbleResult = await getNPCFumbleTableResult(message.rolls[0], message.system.fumbleTableName)
  } else {
    fumbleResult = await getFumbleTableResult(message.rolls[0])
  }

  let fumbleText
  if (fumbleResult && typeof fumbleResult === 'object' && fumbleResult.description) {
    fumbleText = await TextEditor.enrichHTML(addDamageFlavorToRolls(fumbleResult.description))
  } else if (typeof fumbleResult === 'string') {
    fumbleText = fumbleResult
  } else {
    // No fumble table available or no result found
    fumbleText = game.i18n.localize('DCC.FumbleTableUnavailable')
  }

  const rollHTML = await message.rolls[0].render()
  const messageContent = html.querySelector('.message-content')
  if (messageContent) {
    messageContent.innerHTML = `${rollHTML}<br>${fumbleText}`
  }
}

/**
 * Change saving throw rolls into emotes
 * @param message
 * @param html
 * @param data
 * @returns {Promise<void>}
 */
export const emoteSavingThrowRoll = function (message, html, data) {
  if (!message.rolls || !message.isContentVisible || !message.getFlag('dcc', 'isSave')) return

  const saveRollEmote = game.i18n.format(
    'DCC.RolledSavingThrowEmote',
    {
      actorName: data.alias,
      type: message.flavor,
      saveInlineRollHTML: message.rolls[0].toAnchor('Roll Save').outerHTML
    }
  )
  const messageContent = html.querySelector('.message-content')
  if (messageContent) {
    messageContent.innerHTML = saveRollEmote
  }
  const header = html.querySelector('header')
  if (header) {
    header.remove()
  }
}

/**
 * Change initiative rolls into emotes
 * @param message
 * @param html
 * @param data
 * @returns {Promise<void>}
 */
export const emoteInitiativeRoll = function (message, html, data) {
  if (!message.rolls || !message.isContentVisible || !message.getFlag('core', 'initiativeRoll')) return

  const initiativeRollEmote = game.i18n.format(
    'DCC.RolledInitiativeEmote',
    {
      actorName: data.alias,
      initiativeInlineRollHTML: message.rolls[0].toAnchor().outerHTML
    }
  )
  const messageContent = html.querySelector('.message-content')
  if (messageContent) {
    messageContent.innerHTML = initiativeRollEmote
  }
  const header = html.querySelector('header')
  if (header) {
    header.remove()
  }
}

/**
 * Change skill check rolls into emotes
 * @param message
 * @param html
 * @param data
 * @returns {Promise<void>}
 */
export const emoteSkillCheckRoll = function (message, html, data) {
  if (!message.rolls || !message.isContentVisible || !message.getFlag('dcc', 'isSkillCheck')) return

  const skillCheckRoll = message.rolls[0]

  const skillCheckRollEmote = game.i18n.format(
    'DCC.RolledSkillCheckEmote',
    {
      actorName: data.alias,
      skillCheckInlineRollHTML: skillCheckRoll.toAnchor({ classes: ['damage-applyable'], dataset: { damage: skillCheckRoll.total } }).outerHTML,
      skillName: message.flavor
    }
  )
  const messageContent = html.querySelector('.message-content')
  if (messageContent) {
    messageContent.innerHTML = skillCheckRollEmote
  }
  const header = html.querySelector('header')
  if (header) {
    header.remove()
  }
}

/**
 * Look up a critical hit roll in the crit table specified in the flavor
 * @param message
 * @param html
 * @returns {Promise<void>}
 */
export const lookupCriticalRoll = async function (message, html) {
  if (!message.rolls || !message.isContentVisible || message.getFlag('dcc', 'isToHit')) return

  // Only process messages that are specifically critical table rolls, not attack rolls with crits
  const hasCriticalInFlavor = message.flavor && message.flavor.includes(game.i18n.localize('DCC.Critical'))
  const hasCritTableInSystem = message.system?.critTableName

  // Don't process attack rolls - those are handled by emoteAttackRoll
  if (message.getFlag('dcc', 'isToHit')) return

  // Only process if this is specifically a critical table roll
  if (!hasCriticalInFlavor && !hasCritTableInSystem) return

  // Try to get the table name from system data first (more reliable),
  // then fall back to parsing from flavor
  let tableName
  if (message.system?.critTableName) {
    tableName = message.system.critTableName
  } else {
    const criticalText = game.i18n.localize('DCC.Critical')
    // Parse "Critical (Crit Table II)" to get "Crit Table II"
    const match = message.flavor.match(/\(([^)]+)\)/)
    if (match && match[1]) {
      tableName = match[1]
    } else {
      tableName = message.flavor.replace(`${criticalText} (`, '').replace(')', '')
    }
  }

  // Get the localized "Crit Table" prefix
  const critTablePrefix = game.i18n.localize('DCC.CritTable')

  // If tableName already starts with the localized prefix, use it as-is, otherwise prepend it
  const fullTableName = tableName.startsWith(critTablePrefix) ? tableName : `${critTablePrefix} ${tableName}`

  const messageContent = html.querySelector('.message-content')
  if (!messageContent) return

  // Use stored result if available (from previous lookup or navigation),
  // otherwise do a fresh lookup
  let critText
  let rollTotal
  if (message.system?.critResult && message.system?.critRollTotal) {
    // Use the stored result - this preserves navigation state on re-render
    critText = message.system.critResult
    rollTotal = message.system.critRollTotal
  } else {
    // Fresh lookup using the original roll
    const critResult = await getCritTableResult(message.rolls[0], fullTableName)

    // Check if we got a result from the table lookup
    if (!critResult || !critResult.description) {
      // No table available or no result found - just append the unavailable message
      messageContent.innerHTML += `<br>${game.i18n.localize('DCC.CritTableUnavailable')}`
      return
    }

    critText = await TextEditor.enrichHTML(addDamageFlavorToRolls(critResult.description))
    rollTotal = message.rolls[0].total
  }

  // Wrap in navigable container with data attributes for arrow navigation
  const critShiftDownTooltip = game.i18n.localize('DCC.CritShiftDown')
  const critShiftUpTooltip = game.i18n.localize('DCC.CritShiftUp')
  const navigableResult = `
    <div class="table-draw crit-result" data-table-name="${fullTableName}" data-current-roll="${rollTotal}">
      <ol class="table-results"><li class="table-result">
        <div class="result-range">
          <i class="fas fa-sort-up crit-shift-down" data-tooltip="${critShiftDownTooltip}"></i>
          <i class="fas fa-sort-down crit-shift-up" data-tooltip="${critShiftUpTooltip}"></i>
        </div>
        <div class="result-text">${critText}</div>
      </li></ol>
    </div>`
  messageContent.innerHTML += `<br>${navigableResult}`
}

/**
 * Look up a fumble roll
 * @param message
 * @param html
 * @param data
 * @returns {Promise<void>}
 */
export const lookupFumbleRoll = async function (message, html, data) {
  if (!message.rolls || !message.isContentVisible || !message.flavor.includes(game.i18n.localize('DCC.Fumble'))) return

  const pcFumbleTableIdentifier = '(Table 4-2: Fumbles).'
  let tableToUse = null
  let isNPCFumble = false

  if (message.system && message.system.fumbleTableName) {
    tableToUse = message.system.fumbleTableName
  } else if (message.flavor) { // Fallback in case the fumble table is not set
    const match = message.flavor.match(/\((Fumble Table [A-Z0-9\s]+|Crit\/Fumble Table EL)\)/)
    if (match && match[1]) {
      tableToUse = match[1]
    }
  }

  if (tableToUse && tableToUse !== pcFumbleTableIdentifier) {
    isNPCFumble = true
  } else {
    tableToUse = 'Table 4-2: Fumbles'
  }

  // Use stored result if available (from previous lookup or navigation),
  // otherwise do a fresh lookup
  let fumbleText
  let rollTotal
  if (message.system?.fumbleResult && message.system?.fumbleRollTotal) {
    // Use the stored result - this preserves navigation state on re-render
    fumbleText = message.system.fumbleResult
    rollTotal = message.system.fumbleRollTotal
  } else {
    // Fresh lookup using the original roll
    let fumbleResult
    if (isNPCFumble) {
      fumbleResult = await getNPCFumbleTableResult(message.rolls[0], tableToUse)
    } else {
      fumbleResult = await getFumbleTableResult(message.rolls[0])
    }

    if (fumbleResult && typeof fumbleResult === 'object' && fumbleResult.description) {
      fumbleText = await TextEditor.enrichHTML(addDamageFlavorToRolls(fumbleResult.description))
    } else if (typeof fumbleResult === 'string') {
      fumbleText = fumbleResult
    } else {
      // No fumble table available or no result found
      fumbleText = game.i18n.localize('DCC.FumbleTableUnavailable')
    }
    rollTotal = message.rolls[0].total
  }

  const rollHTML = await message.rolls[0].render()
  const messageContent = html.querySelector('.message-content')
  if (messageContent) {
    // Wrap in navigable container with data attributes for arrow navigation
    const fumbleShiftDownTooltip = game.i18n.localize('DCC.FumbleShiftDown')
    const fumbleShiftUpTooltip = game.i18n.localize('DCC.FumbleShiftUp')
    const navigableResult = `
      <div class="table-draw fumble-result" data-table-name="${tableToUse}" data-current-roll="${rollTotal}" data-is-npc="${isNPCFumble}">
        <ol class="table-results"><li class="table-result">
          <div class="result-range">
            <i class="fas fa-sort-up fumble-shift-down" data-tooltip="${fumbleShiftDownTooltip}"></i>
            <i class="fas fa-sort-down fumble-shift-up" data-tooltip="${fumbleShiftUpTooltip}"></i>
          </div>
          <div class="result-text">${fumbleText}</div>
        </li></ol>
      </div>`
    messageContent.innerHTML = `${rollHTML}<br>${navigableResult}`
  }
}
