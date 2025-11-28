/* global canvas, CONFIG, CONST, fromUuid, game, Hooks, foundry, ui, Roll */

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

/**
 * Spell Duel Check Comparison Table (Table 4-5)
 * Cross-references attacker's spell check (columns) against defender's spell check (rows)
 * Returns the die type to roll on the Counterspell Power table
 */
const SPELL_DUEL_CHECK_COMPARISON = {
  12: {
    12: 'PD',
    13: 'd3',
    14: 'd3',
    15: 'd4',
    16: 'd5',
    17: 'd5',
    18: 'd6',
    19: 'd6',
    20: 'd7',
    21: 'd7',
    22: 'd8',
    23: 'd8',
    24: 'd10',
    25: 'd10',
    26: 'd12',
    27: 'd12',
    28: 'd14'
  },
  13: {
    12: 'd3',
    13: 'PD',
    14: 'd3',
    15: 'd4',
    16: 'd5',
    17: 'd5',
    18: 'd6',
    19: 'd6',
    20: 'd7',
    21: 'd7',
    22: 'd8',
    23: 'd8',
    24: 'd10',
    25: 'd10',
    26: 'd12',
    27: 'd12',
    28: 'd14'
  },
  14: {
    12: 'd4',
    13: 'd3',
    14: 'PD',
    15: 'd3',
    16: 'd4',
    17: 'd5',
    18: 'd5',
    19: 'd6',
    20: 'd6',
    21: 'd7',
    22: 'd7',
    23: 'd8',
    24: 'd8',
    25: 'd10',
    26: 'd10',
    27: 'd12',
    28: 'd12'
  },
  15: {
    12: 'd5',
    13: 'd4',
    14: 'd3',
    15: 'PD',
    16: 'd3',
    17: 'd4',
    18: 'd5',
    19: 'd5',
    20: 'd6',
    21: 'd6',
    22: 'd7',
    23: 'd7',
    24: 'd8',
    25: 'd8',
    26: 'd10',
    27: 'd10',
    28: 'd12'
  },
  16: {
    12: 'd5',
    13: 'd5',
    14: 'd4',
    15: 'd3',
    16: 'PD',
    17: 'd3',
    18: 'd4',
    19: 'd5',
    20: 'd5',
    21: 'd6',
    22: 'd6',
    23: 'd7',
    24: 'd7',
    25: 'd8',
    26: 'd8',
    27: 'd10',
    28: 'd10'
  },
  17: {
    12: 'd6',
    13: 'd5',
    14: 'd5',
    15: 'd4',
    16: 'd3',
    17: 'PD',
    18: 'd3',
    19: 'd4',
    20: 'd5',
    21: 'd5',
    22: 'd6',
    23: 'd6',
    24: 'd7',
    25: 'd7',
    26: 'd8',
    27: 'd8',
    28: 'd10'
  },
  18: {
    12: 'd6',
    13: 'd6',
    14: 'd5',
    15: 'd5',
    16: 'd4',
    17: 'd3',
    18: 'PD',
    19: 'd3',
    20: 'd4',
    21: 'd5',
    22: 'd5',
    23: 'd6',
    24: 'd6',
    25: 'd7',
    26: 'd7',
    27: 'd8',
    28: 'd8'
  },
  19: {
    12: 'd7',
    13: 'd6',
    14: 'd6',
    15: 'd5',
    16: 'd5',
    17: 'd4',
    18: 'd3',
    19: 'PD',
    20: 'd3',
    21: 'd4',
    22: 'd5',
    23: 'd5',
    24: 'd6',
    25: 'd6',
    26: 'd7',
    27: 'd7',
    28: 'd8'
  },
  20: {
    12: 'd7',
    13: 'd7',
    14: 'd6',
    15: 'd6',
    16: 'd5',
    17: 'd5',
    18: 'd4',
    19: 'd3',
    20: 'PD',
    21: 'd3',
    22: 'd4',
    23: 'd5',
    24: 'd5',
    25: 'd6',
    26: 'd6',
    27: 'd7',
    28: 'd7'
  },
  21: {
    12: 'd8',
    13: 'd7',
    14: 'd7',
    15: 'd6',
    16: 'd6',
    17: 'd5',
    18: 'd5',
    19: 'd4',
    20: 'd3',
    21: 'PD',
    22: 'd3',
    23: 'd4',
    24: 'd5',
    25: 'd5',
    26: 'd6',
    27: 'd6',
    28: 'd7'
  },
  22: {
    12: 'd8',
    13: 'd8',
    14: 'd7',
    15: 'd7',
    16: 'd6',
    17: 'd6',
    18: 'd5',
    19: 'd5',
    20: 'd4',
    21: 'd3',
    22: 'PD',
    23: 'd3',
    24: 'd4',
    25: 'd5',
    26: 'd5',
    27: 'd6',
    28: 'd6'
  },
  23: {
    12: 'd10',
    13: 'd8',
    14: 'd8',
    15: 'd7',
    16: 'd7',
    17: 'd6',
    18: 'd6',
    19: 'd5',
    20: 'd5',
    21: 'd4',
    22: 'd3',
    23: 'PD',
    24: 'd3',
    25: 'd4',
    26: 'd5',
    27: 'd5',
    28: 'd6'
  },
  24: {
    12: 'd10',
    13: 'd10',
    14: 'd8',
    15: 'd8',
    16: 'd7',
    17: 'd7',
    18: 'd6',
    19: 'd6',
    20: 'd5',
    21: 'd5',
    22: 'd4',
    23: 'd3',
    24: 'PD',
    25: 'd3',
    26: 'd4',
    27: 'd5',
    28: 'd5'
  },
  25: {
    12: 'd12',
    13: 'd10',
    14: 'd10',
    15: 'd8',
    16: 'd8',
    17: 'd7',
    18: 'd7',
    19: 'd6',
    20: 'd6',
    21: 'd5',
    22: 'd5',
    23: 'd4',
    24: 'd3',
    25: 'PD',
    26: 'd3',
    27: 'd4',
    28: 'd5'
  },
  26: {
    12: 'd12',
    13: 'd12',
    14: 'd10',
    15: 'd10',
    16: 'd8',
    17: 'd8',
    18: 'd7',
    19: 'd7',
    20: 'd6',
    21: 'd6',
    22: 'd5',
    23: 'd5',
    24: 'd4',
    25: 'd3',
    26: 'PD',
    27: 'd3',
    28: 'd4'
  },
  27: {
    12: 'd14',
    13: 'd12',
    14: 'd12',
    15: 'd10',
    16: 'd10',
    17: 'd8',
    18: 'd8',
    19: 'd7',
    20: 'd7',
    21: 'd6',
    22: 'd6',
    23: 'd5',
    24: 'd5',
    25: 'd4',
    26: 'd3',
    27: 'PD',
    28: 'd3'
  },
  28: {
    12: 'd16',
    13: 'd14',
    14: 'd12',
    15: 'd12',
    16: 'd10',
    17: 'd10',
    18: 'd8',
    19: 'd8',
    20: 'd7',
    21: 'd7',
    22: 'd6',
    23: 'd6',
    24: 'd5',
    25: 'd5',
    26: 'd4',
    27: 'd3',
    28: 'PD'
  }
}

/**
 * Counterspell Power Table (Table 4-6)
 */
const COUNTERSPELL_POWER_TABLE = {
  defenderHigh: {
    1: { effect: 'mitigate', die: 'd4', key: 'DCC.SpellDuelMitigateD4' },
    2: { effect: 'mitigate', die: 'd6', key: 'DCC.SpellDuelMitigateD6' },
    3: { effect: 'mitigate', die: 'd8', key: 'DCC.SpellDuelMitigateD8' },
    4: { effect: 'mutual_mitigation', die: 'd10', key: 'DCC.SpellDuelMutualMitigationD10' },
    5: { effect: 'mutual_cancellation', key: 'DCC.SpellDuelMutualCancellation' },
    6: { effect: 'push_through', die: 'd6', key: 'DCC.SpellDuelPushThroughD6' },
    7: { effect: 'push_through', die: 'd4', key: 'DCC.SpellDuelPushThroughD4' },
    8: { effect: 'overwhelm', key: 'DCC.SpellDuelOverwhelmDefender' },
    9: { effect: 'reflect', key: 'DCC.SpellDuelReflect' },
    10: { effect: 'reflect_and_overwhelm', key: 'DCC.SpellDuelReflectAndOverwhelmDefender' }
  },
  attackerHigh: {
    1: { effect: 'push_through', die: 'd4', key: 'DCC.SpellDuelPushThroughAttackerD4' },
    2: { effect: 'push_through', die: 'd8', key: 'DCC.SpellDuelPushThroughAttackerD8' },
    3: { effect: 'overwhelm', key: 'DCC.SpellDuelOverwhelmAttacker' },
    4: { effect: 'overwhelm', key: 'DCC.SpellDuelOverwhelmAttacker' },
    5: { effect: 'overwhelm', key: 'DCC.SpellDuelOverwhelmAttacker' },
    6: { effect: 'overwhelm_and_reflect', die: 'd8', key: 'DCC.SpellDuelOverwhelmAndReflectD8' },
    7: { effect: 'overwhelm_and_reflect', die: 'd8', key: 'DCC.SpellDuelOverwhelmAndReflectD8' },
    8: { effect: 'overwhelm_and_reflect', die: 'd6', key: 'DCC.SpellDuelOverwhelmAndReflectD6' },
    9: { effect: 'overwhelm_and_reflect', die: 'd4', key: 'DCC.SpellDuelOverwhelmAndReflectD4' },
    10: { effect: 'reflect_and_overwhelm', key: 'DCC.SpellDuelReflectAndOverwhelmAttacker' }
  }
}

/**
 * Phlogiston Disturbance Table (Table 4-7)
 */
const PHLOGISTON_DISTURBANCE_TABLE = {
  1: { effect: 'pocket_dimension', key: 'DCC.SpellDuelPhlogistonPocketDimension' },
  2: { effect: 'alignment_rift', key: 'DCC.SpellDuelPhlogistonAlignmentRift' },
  3: { effect: 'time_accelerates', key: 'DCC.SpellDuelPhlogistonTimeAccelerates' },
  4: { effect: 'time_slows', key: 'DCC.SpellDuelPhlogistonTimeSlows' },
  5: { effect: 'backward_loop', key: 'DCC.SpellDuelPhlogistonBackwardLoop' },
  6: { effect: 'spells_merge', key: 'DCC.SpellDuelPhlogistonSpellsMerge' },
  7: { effect: 'supernatural_influence', key: 'DCC.SpellDuelPhlogistonSupernaturalInfluence' },
  8: { effect: 'supernatural_summoning', key: 'DCC.SpellDuelPhlogistonSupernaturalSummoning' },
  9: { effect: 'demonic_invasion', key: 'DCC.SpellDuelPhlogistonDemonicInvasion' },
  10: { effect: 'mutual_corruption', key: 'DCC.SpellDuelPhlogistonMutualCorruption' }
}

class SpellDuelDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    id: 'spell-duel',
    classes: ['dcc', 'sheet', 'spell-duel'],
    tag: 'form',
    position: {
      width: 500,
      height: 'auto'
    },
    actions: {
      addParticipant: this.#onAddParticipant,
      adjustMomentum: this.#onAdjustMomentum,
      clearLog: this.#onClearLog,
      endDuel: this.#onEndDuel,
      openRulesReference: this.#openRulesReference,
      removeParticipant: this.#onRemoveParticipant,
      resetMomentum: this.#onResetMomentum,
      resolveExchange: this.#onResolveExchange
    },
    window: {
      resizable: true,
      title: 'DCC.SpellDuelTracker'
    }
  }

  static PARTS = {
    element: {
      template: 'systems/dcc/templates/dialog-spell-duel.html'
    }
  }

  /**
   * Add header control buttons
   * @override
   */
  _getHeaderControls () {
    const controls = super._getHeaderControls()

    // Add link to spell duel rules if dcc-core-book module is installed
    if (game.modules.get('dcc-core-book')?.active) {
      controls.unshift({
        icon: 'fas fa-book-open',
        label: 'DCC.SpellDuelRulesReference',
        action: 'openRulesReference'
      })
    }

    return controls
  }

  /**
   * Open the spell duel rules reference from dcc-core-book
   * @this {DCCActorSheet}
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static async #openRulesReference () {
    const doc = await fromUuid('JournalEntry.L2cXV0lJD7GJTYiA.JournalEntryPage.YlewlXa8GeJ0ELXI')
    doc?.parent?.sheet?.render(true, { pageId: doc.id, anchor: 'spell-duels' })
  }

  /**
   * Configure drag and drop handling
   * @override
   */
  _onRender (context, options) {
    super._onRender(context, options)

    // Only set up drag and drop once to prevent duplicate listeners
    if (!this._dropListenersAttached) {
      const dropZone = this.element
      dropZone.addEventListener('dragover', this._onDragOver.bind(this))
      dropZone.addEventListener('drop', this._onDrop.bind(this))
      this._dropListenersAttached = true
    }
  }

  /**
   * Handle dragover event
   * @param {DragEvent} event
   */
  _onDragOver (event) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }

  /**
   * Handle drop event for adding participants
   * @param {DragEvent} event
   */
  async _onDrop (event) {
    event.preventDefault()

    // Try to extract drop data
    let data
    try {
      data = JSON.parse(event.dataTransfer.getData('text/plain'))
    } catch {
      return
    }

    // Handle Actor drops
    if (data.type === 'Actor') {
      const actor = await fromUuid(data.uuid)
      if (actor) {
        await SpellDuel.addParticipant(actor)
      }
    }

    // Handle Token drops (from canvas)
    if (data.type === 'Token') {
      const token = await fromUuid(data.uuid)
      if (token?.actor) {
        await SpellDuel.addParticipant(token.actor)
      }
    }
  }

  /**
   * Construct and return the data object used to render the HTML template
   * @return {Object}
   */
  async _prepareContext (options = {}) {
    const data = {}
    data.cssClass = 'dcc'
    data.user = game.user
    data.config = CONFIG.DCC
    data.participants = SpellDuel.getParticipants()
    data.log = SpellDuel.getLog()
    data.hasParticipants = data.participants.length > 0
    data.canResolve = data.participants.length >= 2
    return data
  }

  /**
   * Add a participant to the spell duel
   */
  static async #onAddParticipant (event, target) {
    // Get selected tokens or prompt for actor selection
    const tokens = canvas.tokens.controlled
    if (tokens.length === 0) {
      ui.notifications.warn(game.i18n.localize('DCC.SpellDuelSelectToken'))
      return
    }

    for (const token of tokens) {
      if (token.actor) {
        await SpellDuel.addParticipant(token.actor)
      }
    }
  }

  /**
   * Remove a participant from the spell duel
   */
  static async #onRemoveParticipant (event, target) {
    const actorId = target.dataset.actorId
    await SpellDuel.removeParticipant(actorId)
  }

  /**
   * Adjust momentum for a participant
   */
  static async #onAdjustMomentum (event, target) {
    const actorId = target.dataset.actorId
    const adjustment = parseInt(target.dataset.adjustment)
    await SpellDuel.adjustMomentum(actorId, adjustment)
  }

  /**
   * Reset momentum for a participant to 10
   */
  static async #onResetMomentum (event, target) {
    const actorId = target.dataset.actorId
    await SpellDuel.resetMomentum(actorId)
  }

  /**
   * Resolve a spell duel exchange
   */
  static async #onResolveExchange (event, target) {
    await SpellDuel.promptResolveExchange()
  }

  /**
   * End the current spell duel
   */
  static async #onEndDuel (event, target) {
    await SpellDuel.endDuel()
  }

  /**
   * Clear the duel log
   */
  static async #onClearLog (event, target) {
    await SpellDuel.clearLog()
  }

  /** @override */
  async close (options = {}) {
    SpellDuel.dialog = null
    return super.close()
  }
}

class SpellDuel {
  /**
   * Initialise the Spell Duel subsystem
   */
  static init () {
    // Register setting for state persistence (using String type for reliability)
    game.settings.register('dcc', 'spellDuelState', {
      name: 'Spell Duel State',
      scope: 'world',
      config: false,
      type: String,
      default: '{"participants":[],"log":[]}'
    })

    // Load saved state
    SpellDuel.loadState()

    // Register hooks for spell duel management
    Hooks.on('updateActor', (doc, change) => {
      if (SpellDuel.isParticipant(doc.id)) {
        SpellDuel.refresh()
      }
    })
  }

  /**
   * Save the current spell duel state
   */
  static async saveState () {
    if (game.user.isGM) {
      const state = JSON.stringify({
        participants: SpellDuel.participants,
        log: SpellDuel.log
      })
      await game.settings.set('dcc', 'spellDuelState', state)
    }
  }

  /**
   * Load the spell duel state from settings
   */
  static loadState () {
    try {
      const stateStr = game.settings.get('dcc', 'spellDuelState')
      // Handle both string (new format) and object (old format)
      const state = typeof stateStr === 'string' ? JSON.parse(stateStr) : stateStr
      SpellDuel.participants = state?.participants || []
      SpellDuel.log = state?.log || []
    } catch {
      SpellDuel.participants = []
      SpellDuel.log = []
    }
  }

  /**
   * Toggle the Spell Duel dialog
   */
  static async show () {
    if (SpellDuel.dialog) {
      await SpellDuel.dialog.close()
      delete SpellDuel.dialog
      SpellDuel.dialog = null
    } else {
      SpellDuel.dialog = new SpellDuelDialog()
      SpellDuel.dialog.render(true)
    }
  }

  /**
   * Refresh the dialog if open
   * @returns {Promise}
   */
  static async refresh () {
    if (SpellDuel.dialog) {
      return await SpellDuel.dialog.render(false)
    }
  }

  /**
   * Get all participants
   * @returns {Array}
   */
  static getParticipants () {
    return SpellDuel.participants
  }

  /**
   * Check if an actor is a participant
   * @param {String} actorId
   * @returns {Boolean}
   */
  static isParticipant (actorId) {
    return SpellDuel.participants.some(p => p.actorId === actorId)
  }

  /**
   * Add a participant to the spell duel
   * @param {Actor} actor
   * @returns {Promise}
   */
  static async addParticipant (actor) {
    // Prevent race conditions from multiple simultaneous calls
    if (SpellDuel._addingParticipant) return
    SpellDuel._addingParticipant = true

    try {
      if (SpellDuel.isParticipant(actor.id)) {
        ui.notifications.warn(game.i18n.format('DCC.SpellDuelAlreadyParticipant', { name: actor.name }))
        return
      }

      const participant = {
        actorId: actor.id,
        name: actor.name,
        img: actor.img,
        momentum: 10
      }

      SpellDuel.participants.push(participant)
      await SpellDuel.saveState()
      await SpellDuel.addChatMessage(game.i18n.format('DCC.SpellDuelJoined', { name: actor.name }))
      return await SpellDuel.refresh()
    } finally {
      SpellDuel._addingParticipant = false
    }
  }

  /**
   * Remove a participant from the spell duel
   * @param {String} actorId
   * @returns {Promise}
   */
  static async removeParticipant (actorId) {
    const index = SpellDuel.participants.findIndex(p => p.actorId === actorId)
    if (index !== -1) {
      const participant = SpellDuel.participants[index]
      SpellDuel.participants.splice(index, 1)
      await SpellDuel.saveState()
      await SpellDuel.addChatMessage(game.i18n.format('DCC.SpellDuelLeft', { name: participant.name }))
    }
    return await SpellDuel.refresh()
  }

  /**
   * Adjust momentum for a participant
   * @param {String} actorId
   * @param {Number} adjustment
   * @returns {Promise}
   */
  static async adjustMomentum (actorId, adjustment) {
    const participant = SpellDuel.participants.find(p => p.actorId === actorId)
    if (participant) {
      participant.momentum = Math.max(1, participant.momentum + adjustment)
      await SpellDuel.saveState()
    }
    return await SpellDuel.refresh()
  }

  /**
   * Reset momentum for a participant
   * @param {String} actorId
   * @returns {Promise}
   */
  static async resetMomentum (actorId) {
    const participant = SpellDuel.participants.find(p => p.actorId === actorId)
    if (participant) {
      participant.momentum = 10
      await SpellDuel.saveState()
    }
    return await SpellDuel.refresh()
  }

  /**
   * Get the duel log
   * @returns {Array}
   */
  static getLog () {
    return SpellDuel.log
  }

  /**
   * Clear the duel log
   * @returns {Promise}
   */
  static async clearLog () {
    SpellDuel.log = []
    await SpellDuel.saveState()
    return await SpellDuel.refresh()
  }

  /**
   * Add an entry to the duel log
   * @param {String} message
   */
  static addLogEntry (message) {
    SpellDuel.log.push({
      timestamp: new Date().toLocaleTimeString(),
      message
    })
  }

  /**
   * Prompt to resolve a spell duel exchange
   */
  static async promptResolveExchange () {
    if (SpellDuel.participants.length < 2) {
      ui.notifications.warn(game.i18n.localize('DCC.SpellDuelNeedTwoParticipants'))
      return
    }

    // Build participant options - attacker defaults to first, defender to second
    const attackerOptions = SpellDuel.participants.map((p, index) =>
      `<option value="${p.actorId}"${index === 0 ? ' selected' : ''}>${p.name} (${game.i18n.localize('DCC.SpellDuelMomentum')}: ${p.momentum})</option>`
    ).join('')

    const defenderOptions = SpellDuel.participants.map((p, index) =>
      `<option value="${p.actorId}"${index === 1 ? ' selected' : ''}>${p.name} (${game.i18n.localize('DCC.SpellDuelMomentum')}: ${p.momentum})</option>`
    ).join('')

    const content = `
      <form>
        <p class="notes">${game.i18n.localize('DCC.SpellDuelResolveInstructions')}</p>
        <div class="form-group">
          <label>${game.i18n.localize('DCC.SpellDuelAttacker')}</label>
          <select name="attackerId">${attackerOptions}</select>
        </div>
        <div class="form-group">
          <label>${game.i18n.localize('DCC.SpellDuelAttackerCheck')}</label>
          <input type="number" name="attackerCheck" value="" min="1" max="40"/>
        </div>
        <div class="form-group">
          <label>${game.i18n.localize('DCC.SpellDuelDefender')}</label>
          <select name="defenderId">${defenderOptions}</select>
        </div>
        <div class="form-group">
          <label>${game.i18n.localize('DCC.SpellDuelDefenderCheck')}</label>
          <input type="number" name="defenderCheck" value="" min="1" max="40"/>
        </div>
      </form>
    `

    const dialog = new foundry.applications.api.DialogV2({
      window: { title: game.i18n.localize('DCC.SpellDuelResolveExchange') },
      position: { width: 400 },
      content,
      buttons: [
        {
          action: 'resolve',
          label: game.i18n.localize('DCC.SpellDuelResolve'),
          default: true,
          callback: async (event, button, dialog) => {
            const form = button.form
            const attackerId = form.attackerId.value
            const defenderId = form.defenderId.value
            const attackerCheck = parseInt(form.attackerCheck.value)
            const defenderCheck = parseInt(form.defenderCheck.value)

            if (attackerId === defenderId) {
              ui.notifications.warn(game.i18n.localize('DCC.SpellDuelSameParticipant'))
              return
            }

            if (isNaN(attackerCheck) || isNaN(defenderCheck)) {
              ui.notifications.warn(game.i18n.localize('DCC.SpellDuelEnterBothChecks'))
              return
            }

            await SpellDuel.resolveExchange(attackerId, attackerCheck, defenderId, defenderCheck)
          }
        },
        {
          action: 'cancel',
          label: game.i18n.localize('Cancel')
        }
      ],
      rejectClose: false,
      modal: false
    })

    await dialog.render(true)
  }

  /**
   * Resolve a spell duel exchange
   * @param {String} attackerId
   * @param {Number} attackerCheck
   * @param {String} defenderId
   * @param {Number} defenderCheck
   */
  static async resolveExchange (attackerId, attackerCheck, defenderId, defenderCheck) {
    const attacker = SpellDuel.participants.find(p => p.actorId === attackerId)
    const defender = SpellDuel.participants.find(p => p.actorId === defenderId)

    if (!attacker || !defender) {
      ui.notifications.error(game.i18n.localize('DCC.SpellDuelParticipantNotFound'))
      return
    }

    // Log the exchange start
    SpellDuel.addLogEntry(game.i18n.format('DCC.SpellDuelExchangeStart', {
      attacker: attacker.name,
      attackerCheck,
      defender: defender.name,
      defenderCheck
    }))

    // Determine winner and update momentum
    const attackerWins = attackerCheck > defenderCheck
    const winner = attackerWins ? attacker : defender
    winner.momentum += 1
    await SpellDuel.saveState()

    SpellDuel.addLogEntry(game.i18n.format('DCC.SpellDuelMomentumGain', {
      name: winner.name,
      momentum: winner.momentum
    }))

    // Handle identical spell checks (Phlogiston Disturbance)
    if (attackerCheck === defenderCheck) {
      const roll = await new Roll('1d10').evaluate()
      await roll.toMessage({
        flavor: game.i18n.localize('DCC.SpellDuelPhlogistonRoll'),
        speaker: { alias: game.i18n.localize('DCC.SpellDuel') }
      })

      const result = PHLOGISTON_DISTURBANCE_TABLE[roll.total]
      const resultText = game.i18n.localize(result.key)

      SpellDuel.addLogEntry(game.i18n.format('DCC.SpellDuelPhlogistonResult', {
        roll: roll.total,
        result: resultText
      }))

      await SpellDuel.addChatMessage(game.i18n.format('DCC.SpellDuelPhlogistonMessage', {
        attacker: attacker.name,
        defender: defender.name,
        result: resultText
      }))

      await SpellDuel.refresh()
      return
    }

    // Look up die type from comparison table
    const dieType = SpellDuel.getSpellDuelDie(attackerCheck, defenderCheck)

    SpellDuel.addLogEntry(game.i18n.format('DCC.SpellDuelTableResult', {
      die: dieType
    }))

    // Roll the die
    const dieRoll = await new Roll(`1${dieType}`).evaluate()
    await dieRoll.toMessage({
      flavor: game.i18n.format('DCC.SpellDuelCounterspellRoll', { die: dieType }),
      speaker: { alias: game.i18n.localize('DCC.SpellDuel') }
    })

    // Calculate momentum difference (winner's perspective)
    const momentumDiff = attacker.momentum - defender.momentum

    // Apply momentum modifier to roll
    const modifiedRoll = Math.max(1, Math.min(10, dieRoll.total + momentumDiff))

    SpellDuel.addLogEntry(game.i18n.format('DCC.SpellDuelModifiedRoll', {
      roll: dieRoll.total,
      modifier: momentumDiff >= 0 ? `+${momentumDiff}` : momentumDiff,
      result: modifiedRoll
    }))

    // Get result from counterspell power table
    const column = attackerWins ? 'attackerHigh' : 'defenderHigh'
    const result = COUNTERSPELL_POWER_TABLE[column][modifiedRoll]
    const resultText = game.i18n.localize(result.key)

    SpellDuel.addLogEntry(game.i18n.format('DCC.SpellDuelResolution', {
      result: resultText
    }))

    // Send chat message with full result
    await SpellDuel.addChatMessage(game.i18n.format('DCC.SpellDuelExchangeResult', {
      attacker: attacker.name,
      attackerCheck,
      defender: defender.name,
      defenderCheck,
      winner: winner.name,
      die: dieType,
      roll: dieRoll.total,
      modifier: momentumDiff >= 0 ? `+${momentumDiff}` : momentumDiff,
      finalRoll: modifiedRoll,
      result: resultText
    }))

    await SpellDuel.refresh()
  }

  /**
   * Look up die type from spell duel check comparison table
   * @param {Number} attackerCheck
   * @param {Number} defenderCheck
   * @returns {String}
   */
  static getSpellDuelDie (attackerCheck, defenderCheck) {
    // Clamp values to table boundaries
    const attackerLookup = Math.max(12, Math.min(28, attackerCheck))
    const defenderLookup = Math.max(12, Math.min(28, defenderCheck))

    const row = SPELL_DUEL_CHECK_COMPARISON[defenderLookup]
    if (!row) return 'PD'

    return row[attackerLookup] || 'PD'
  }

  /**
   * End the current spell duel
   */
  static async endDuel () {
    if (SpellDuel.participants.length > 0) {
      await SpellDuel.addChatMessage(game.i18n.localize('DCC.SpellDuelEnded'))
    }
    SpellDuel.participants = []
    SpellDuel.log = []
    await SpellDuel.saveState()
    return await SpellDuel.refresh()
  }

  /**
   * Send a chat message
   * @param {String} content
   * @return {Promise}
   */
  static async addChatMessage (content) {
    const messageData = {
      user: game.user.id,
      type: CONST.CHAT_MESSAGE_STYLES.EMOTE,
      content,
      sound: CONFIG.sounds.notification
    }
    return CONFIG.ChatMessage.documentClass.create(messageData)
  }
}

SpellDuel.dialog = null
SpellDuel.participants = []
SpellDuel.log = []
SpellDuel._addingParticipant = false

export default SpellDuel
