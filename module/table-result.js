/* global game, foundry, ui */

import { getCritTableResult, getFumbleTableResult, getNPCFumbleTableResult, addDamageFlavorToRolls } from './utilities.js'

const { TextEditor } = foundry.applications.ux

/**
 * Handles navigation of crit and fumble table results in chat messages
 * Similar to SpellResult but for attack roll crits/fumbles
 */
class TableResult {
  /**
   * Process an incoming chat message and add navigation hooks for crit/fumble results
   * @param {Object} message  The ChatMessage entity
   * @param {Object} html     The HTML content of the message
   */
  static async processChatMessage (message, html) {
    // Check if this message has navigable crit or fumble containers
    // This handles both attack rolls (with isToHit flag) and manual rolls (from lookupCriticalRoll/lookupFumbleRoll)
    const hasCritContainer = html.querySelector('.crit-result')
    const hasFumbleContainer = html.querySelector('.fumble-result')

    if (!hasCritContainer && !hasFumbleContainer) { return }

    // Only GMs can navigate results - hide arrows from non-GMs
    if (!game.user.isGM) {
      html.querySelectorAll('.crit-shift-up, .crit-shift-down, .fumble-shift-up, .fumble-shift-down').forEach(el => {
        el.remove()
      })
      return
    }

    // Attach crit navigation handlers
    if (hasCritContainer) {
      html.querySelectorAll('.crit-shift-up').forEach(el => {
        el.addEventListener('click', TableResult._onNextCritResult.bind(message))
      })
      html.querySelectorAll('.crit-shift-down').forEach(el => {
        el.addEventListener('click', TableResult._onPreviousCritResult.bind(message))
      })
    }

    // Attach fumble navigation handlers
    if (hasFumbleContainer) {
      html.querySelectorAll('.fumble-shift-up').forEach(el => {
        el.addEventListener('click', TableResult._onNextFumbleResult.bind(message))
      })
      html.querySelectorAll('.fumble-shift-down').forEach(el => {
        el.addEventListener('click', TableResult._onPreviousFumbleResult.bind(message))
      })
    }
  }

  /**
   * Event handler for adjusting a crit result up
   * @param {Object} event The originating click event
   */
  static _onNextCritResult (event) {
    TableResult._adjustCritResult.bind(this)(event, +1)
  }

  /**
   * Event handler for adjusting a crit result down
   * @param {Object} event The originating click event
   */
  static _onPreviousCritResult (event) {
    TableResult._adjustCritResult.bind(this)(event, -1)
  }

  /**
   * Event handler for adjusting a fumble result up
   * @param {Object} event The originating click event
   */
  static _onNextFumbleResult (event) {
    TableResult._adjustFumbleResult.bind(this)(event, +1)
  }

  /**
   * Event handler for adjusting a fumble result down
   * @param {Object} event The originating click event
   */
  static _onPreviousFumbleResult (event) {
    TableResult._adjustFumbleResult.bind(this)(event, -1)
  }

  /**
   * Adjust a crit result by moving up or down the table
   * @param {Object} event The originating click event
   * @param {number} direction Adjust up (+1) or down (-1)
   */
  static async _adjustCritResult (event, direction) {
    // Get the container element with table data
    const container = event.target.closest('.crit-result')
    if (!container) { return }

    const tableName = container.getAttribute('data-table-name')
    const currentRoll = parseInt(container.getAttribute('data-current-roll'))

    if (!tableName || isNaN(currentRoll)) { return }

    // Calculate the new roll value
    const newRoll = currentRoll + direction

    // Create a mock roll object for table lookup
    // Set _evaluated: true to skip the evaluate() call in getCritTableResult
    const mockRoll = { total: newRoll, _evaluated: true }
    const newResult = await getCritTableResult(mockRoll, tableName)

    if (!newResult || !newResult.description) {
      ui.notifications.warn(game.i18n.localize('DCC.TableResultOutOfBounds'))
      return
    }

    // Enrich the new result text with damage flavor for inline rolls
    const enrichedResult = await TextEditor.enrichHTML(addDamageFlavorToRolls(newResult.description))

    // Update the result text in the DOM
    const resultText = container.querySelector('.result-text')
    if (resultText) {
      resultText.innerHTML = enrichedResult
    }

    // Update the current roll attribute in the DOM
    container.setAttribute('data-current-roll', newRoll)

    // Update the message content AND system data
    // System data must be updated so emote functions use the new values on re-render
    const messageContent = this.content
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = messageContent

    const existingContainer = tempDiv.querySelector('.crit-result')
    if (existingContainer) {
      existingContainer.setAttribute('data-current-roll', newRoll)
      const existingResultText = existingContainer.querySelector('.result-text')
      if (existingResultText) {
        existingResultText.innerHTML = enrichedResult
      }
    }

    await this.update({
      content: tempDiv.innerHTML,
      'system.critResult': enrichedResult,
      'system.critRollTotal': newRoll
    })
  }

  /**
   * Adjust a fumble result by moving up or down the table
   * @param {Object} event The originating click event
   * @param {number} direction Adjust up (+1) or down (-1)
   */
  static async _adjustFumbleResult (event, direction) {
    // Get the container element with table data
    const container = event.target.closest('.fumble-result')
    if (!container) { return }

    const tableName = container.getAttribute('data-table-name')
    const isNPC = container.getAttribute('data-is-npc') === 'true'
    const currentRoll = parseInt(container.getAttribute('data-current-roll'))

    if (!tableName || isNaN(currentRoll)) { return }

    // Calculate the new roll value
    const newRoll = currentRoll + direction

    // Create a mock roll object for table lookup
    // Set _evaluated: true to skip the evaluate() call in getFumbleTableResult
    const mockRoll = { total: newRoll, _evaluated: true }
    let newResult

    if (isNPC) {
      newResult = await getNPCFumbleTableResult(mockRoll, tableName)
    } else {
      newResult = await getFumbleTableResult(mockRoll)
    }

    if (!newResult || !newResult.description) {
      ui.notifications.warn(game.i18n.localize('DCC.TableResultOutOfBounds'))
      return
    }

    // Enrich the new result text with damage flavor for inline rolls
    const enrichedResult = await TextEditor.enrichHTML(addDamageFlavorToRolls(newResult.description))

    // Update the result text in the DOM
    const resultText = container.querySelector('.result-text')
    if (resultText) {
      resultText.innerHTML = enrichedResult
    }

    // Update the current roll attribute in the DOM
    container.setAttribute('data-current-roll', newRoll)

    // Update the message content AND system data
    // System data must be updated so emote functions use the new values on re-render
    const messageContent = this.content
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = messageContent

    const existingContainer = tempDiv.querySelector('.fumble-result')
    if (existingContainer) {
      existingContainer.setAttribute('data-current-roll', newRoll)
      const existingResultText = existingContainer.querySelector('.result-text')
      if (existingResultText) {
        existingResultText.innerHTML = enrichedResult
      }
    }

    await this.update({
      content: tempDiv.innerHTML,
      'system.fumbleResult': enrichedResult,
      'system.fumbleRollTotal': newRoll
    })
  }
}

export default TableResult
