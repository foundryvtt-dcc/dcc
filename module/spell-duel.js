/* global canvas, CONFIG, CONST, fromUuid, game, Hooks, foundry, ui, Roll */

import { resolveCounterspellExchange } from './vendor/dcc-core-lib/index.js'
import { spellCheckSucceeded } from './spell-check-success.mjs'

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

/**
 * Counterspell Power Table (Table 4-6)
 * Full descriptions come from dcc-core-book RollTables; keys are fallback labels
 */
const COUNTERSPELL_POWER_TABLE = {
  defenderHigh: {
    1: { key: 'DCC.SpellDuelEffectMitigate' },
    2: { key: 'DCC.SpellDuelEffectMitigate' },
    3: { key: 'DCC.SpellDuelEffectMitigate' },
    4: { key: 'DCC.SpellDuelEffectMutualMitigation' },
    5: { key: 'DCC.SpellDuelEffectMutualCancellation' },
    6: { key: 'DCC.SpellDuelEffectPushThrough' },
    7: { key: 'DCC.SpellDuelEffectPushThrough' },
    8: { key: 'DCC.SpellDuelEffectOverwhelm' },
    9: { key: 'DCC.SpellDuelEffectReflect' },
    10: { key: 'DCC.SpellDuelEffectReflectAndOverwhelm' }
  },
  attackerHigh: {
    1: { key: 'DCC.SpellDuelEffectPushThrough' },
    2: { key: 'DCC.SpellDuelEffectPushThrough' },
    3: { key: 'DCC.SpellDuelEffectOverwhelm' },
    4: { key: 'DCC.SpellDuelEffectOverwhelm' },
    5: { key: 'DCC.SpellDuelEffectOverwhelm' },
    6: { key: 'DCC.SpellDuelEffectOverwhelmAndReflect' },
    7: { key: 'DCC.SpellDuelEffectOverwhelmAndReflect' },
    8: { key: 'DCC.SpellDuelEffectOverwhelmAndReflect' },
    9: { key: 'DCC.SpellDuelEffectOverwhelmAndReflect' },
    10: { key: 'DCC.SpellDuelEffectReflectAndOverwhelm' }
  }
}

/**
 * RollTable references for dcc-core-book integration
 *
 * Tables are found by `_id` in the pack, then by any of `names` (in the pack or
 * the world). Table 4-7 was renamed to fix a typo, so both spellings are kept
 * for older dcc-core-book installs.
 */
const SPELL_DUEL_TABLES = {
  spellDuelCheckComparison: {
    pack: 'dcc-core-book.dcc-core-tables',
    id: 'b8Eh0tUvRsYo5Zax',
    names: ['Table 4-5: Spell Duel Check Comparison'],
    page: 100
  },
  counterspellDefenderHigh: {
    pack: 'dcc-core-book.dcc-core-tables',
    id: 'd6Cf8sRtPqWn3Xyz',
    names: ['Table 4-6: Counterspell Power (Defender High)'],
    page: 101
  },
  counterspellAttackerHigh: {
    pack: 'dcc-core-book.dcc-core-tables',
    id: 'a7Dg9sTuQrXn4Yzw',
    names: ['Table 4-6: Counterspell Power (Attacker High)'],
    page: 101
  },
  phlogistonDisturbance: {
    pack: 'dcc-core-book.dcc-core-tables',
    id: 'EehqfTN3QVUZSf6l',
    names: ['Table 4-7: Phlogiston Disturbance', 'Table 4-7: Phologiston Disturbance'],
    page: 103
  }
}

/**
 * Phlogiston Disturbance Table (Table 4-7)
 * Full descriptions come from dcc-core-book RollTables; keys are fallback labels
 */
const PHLOGISTON_DISTURBANCE_TABLE = {
  1: { key: 'DCC.SpellDuelPhlogistonEffectPocketDimension' },
  2: { key: 'DCC.SpellDuelPhlogistonEffectAlignmentRift' },
  3: { key: 'DCC.SpellDuelPhlogistonEffectTimeAccelerates' },
  4: { key: 'DCC.SpellDuelPhlogistonEffectTimeSlows' },
  5: { key: 'DCC.SpellDuelPhlogistonEffectBackwardLoop' },
  6: { key: 'DCC.SpellDuelPhlogistonEffectSpellsMerge' },
  7: { key: 'DCC.SpellDuelPhlogistonEffectSupernaturalInfluence' },
  8: { key: 'DCC.SpellDuelPhlogistonEffectSupernaturalSummoning' },
  9: { key: 'DCC.SpellDuelPhlogistonEffectDemonicInvasion' },
  10: { key: 'DCC.SpellDuelPhlogistonEffectMutualCorruption' }
}

/**
 * Check if dcc-core-book module is active
 * @returns {boolean}
 */
function isDccCoreBookActive () {
  return game.modules.get('dcc-core-book')?.active ?? false
}

/**
 * Get a RollTable from dcc-core-book
 * @param {string} tableKey - Key from SPELL_DUEL_TABLES
 * @returns {Promise<RollTable|null>}
 */
async function getSpellDuelTable (tableKey) {
  const tableInfo = SPELL_DUEL_TABLES[tableKey]
  if (!tableInfo) return null

  // Try compendium pack first
  if (isDccCoreBookActive()) {
    try {
      const pack = game.packs.get(tableInfo.pack)
      if (pack) {
        const entry = pack.index.get(tableInfo.id) ?? pack.index.find(e => tableInfo.names.includes(e.name))
        if (entry) {
          return await pack.getDocument(entry._id)
        }
      }
    } catch (err) {
      console.warn('dcc | Failed to load spell duel table from compendium:', err)
    }
  }

  // Fall back to searching world tables by name
  for (const name of tableInfo.names) {
    const table = game.tables.getName(name)
    if (table) return table
  }
  return null
}

/**
 * Get result text from a RollTable for a given roll value
 * @param {RollTable} table - The RollTable to look up
 * @param {number} rollValue - The roll result to look up
 * @returns {string|null} - The result text or null if not found
 */
function getTableResultText (table, rollValue) {
  if (!table) return null

  const results = table.getResultsForRoll(rollValue)
  if (results && results.length > 0) {
    // Use description (v13+) with fallback to text for older versions
    return results[0].description ?? results[0].text
  }
  return null
}

/**
 * Result text for a table row: the dcc-core-book RollTable text when available,
 * otherwise the fallback label with a rulebook page reference
 * @param {RollTable|null} table
 * @param {number} value
 * @param {string} key - Fallback label key
 * @param {number} page
 * @returns {string}
 */
function rowText (table, value, key, page) {
  return getTableResultText(table, value) ?? game.i18n.format('DCC.SpellDuelResultWithPageRef', {
    effect: game.i18n.localize(key),
    page
  })
}

/**
 * Table 4-6 and Table 4-7 in the lib's shape (`SpellDuelTables`)
 *
 * The chat card shows only each row's `effect` text, so the lib's structured
 * fields (spell effectiveness, check modifiers, who is affected) are left
 * neutral rather than encoded here.
 * @param {Function} getComparisonDie - Table 4-5 lookup
 * @returns {Promise<Object>}
 */
async function buildLibTables (getComparisonDie) {
  const powerColumn = async (column, tableKey) => {
    const table = await getSpellDuelTable(tableKey)
    const { page } = SPELL_DUEL_TABLES[tableKey]
    return Object.entries(COUNTERSPELL_POWER_TABLE[column]).map(([value, { key }]) => {
      const n = Number(value)
      return {
        min: n,
        max: n === 10 ? Infinity : n, // the "10+" row
        effect: rowText(table, n, key, page),
        attackerSpellEffective: true,
        defenderSpellEffective: true,
        attackerCheckModifier: 0,
        defenderCheckModifier: 0,
        simultaneousEffect: true
      }
    })
  }

  const phlogistonTable = await getSpellDuelTable('phlogistonDisturbance')
  const { page } = SPELL_DUEL_TABLES.phlogistonDisturbance
  // Rows cover 1-10 exactly: the lib sizes the die to the highest `max`
  const phlogistonDisturbance = Object.entries(PHLOGISTON_DISTURBANCE_TABLE).map(([value, { key }]) => {
    const n = Number(value)
    return {
      min: n,
      max: n,
      effect: rowText(phlogistonTable, n, key, page),
      affectsAttacker: true,
      affectsDefender: true,
      affectsBystanders: false
    }
  })

  return {
    getComparisonDie,
    counterspellPower: {
      attackerHigh: await powerColumn('attackerHigh', 'counterspellAttackerHigh'),
      defenderHigh: await powerColumn('defenderHigh', 'counterspellDefenderHigh')
    },
    phlogistonDisturbance
  }
}

/**
 * Clamp a spell check to the Table 4-5 range
 * @param {number} check
 * @returns {number}
 */
function clampToComparisonTable (check) {
  return Math.max(12, Math.min(28, check))
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
      default: '{"participants":[]}'
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
        participants: SpellDuel.participants
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
    } catch {
      SpellDuel.participants = []
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
          <label>${game.i18n.localize('DCC.SpellDuelAttackerSpellLevel')}</label>
          <input type="number" name="attackerLevel" value="1" min="1" max="5"/>
        </div>
        <div class="form-group">
          <label>${game.i18n.localize('DCC.SpellDuelDefender')}</label>
          <select name="defenderId">${defenderOptions}</select>
        </div>
        <div class="form-group">
          <label>${game.i18n.localize('DCC.SpellDuelDefenderCheck')}</label>
          <input type="number" name="defenderCheck" value="" min="1" max="40"/>
        </div>
        <div class="form-group">
          <label>${game.i18n.localize('DCC.SpellDuelDefenderSpellLevel')}</label>
          <input type="number" name="defenderLevel" value="1" min="1" max="5"/>
        </div>
        <div class="form-group">
          <label>${game.i18n.localize('DCC.SpellDuelSamePatron')}</label>
          <input type="checkbox" name="samePatron"/>
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

            await SpellDuel.resolveExchange(attackerId, attackerCheck, defenderId, defenderCheck, {
              attackerLevel: parseInt(form.attackerLevel.value) || 1,
              defenderLevel: parseInt(form.defenderLevel.value) || 1,
              samePatron: form.samePatron.checked
            })
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
   *
   * The rules are the lib's `resolveCounterspellExchange`: both checks must
   * succeed, invocations of the same patron cancel, the high roller gains 1
   * momentum, and the Table 4-6 roll is modified by the winner's momentum minus
   * the loser's. Tables 4-5 to 4-7 come from dcc-core-book.
   * @param {String} attackerId
   * @param {Number} attackerCheck
   * @param {String} defenderId
   * @param {Number} defenderCheck
   * @param {Object} [options]
   * @param {Number} [options.attackerLevel=1] - Level of the attacker's spell
   * @param {Number} [options.defenderLevel=1] - Level of the defender's spell
   * @param {Boolean} [options.samePatron=false] - Both cast invoke patron for the same patron
   */
  static async resolveExchange (attackerId, attackerCheck, defenderId, defenderCheck, { attackerLevel = 1, defenderLevel = 1, samePatron = false } = {}) {
    const attacker = SpellDuel.participants.find(p => p.actorId === attackerId)
    const defender = SpellDuel.participants.find(p => p.actorId === defenderId)

    if (!attacker || !defender) {
      ui.notifications.error(game.i18n.localize('DCC.SpellDuelParticipantNotFound'))
      return
    }

    // Table 4-5 needs dcc-core-book. Without it, a tie still resolves (as a
    // Phlogiston Disturbance) and anything else asks for a manual lookup.
    const bookDie = await SpellDuel.getSpellDuelDie(attackerCheck, defenderCheck)
    const tied = clampToComparisonTable(attackerCheck) === clampToComparisonTable(defenderCheck)
    const tables = await buildLibTables(() => bookDie ?? (tied ? 'PD' : 'd3'))

    const spell = (level) => samePatron
      ? { name: 'invoke-patron', level, category: 'invoke-patron', patron: 'same' }
      : { name: 'spell', level, category: 'same-spell' }
    const check = (casterId, total, level) => ({
      casterId,
      spell: spell(level),
      naturalRoll: total,
      total,
      succeeded: spellCheckSucceeded({ total, level }),
      spellLost: false
    })
    const attackerSpellCheck = check(attackerId, attackerCheck, attackerLevel)
    const defenderSpellCheck = check(defenderId, defenderCheck, defenderLevel)
    const state = {
      participants: [attacker, defender].map(p => ({ id: p.actorId, name: p.name, casterType: 'wizard', momentum: p.momentum, initiative: 0 })),
      exchanges: [],
      active: true
    }
    const resolve = (roller) => resolveCounterspellExchange(state, attackerId, defenderId, attackerSpellCheck, defenderSpellCheck, { tables, roller })

    // The lib rolls through a synchronous roller, so a first pass finds the
    // die it needs; Foundry rolls that die into chat and a second pass uses it.
    const formulas = []
    const firstPass = resolve((formula) => { formulas.push(formula); return 1 })
    const manualLookup = !bookDie && Boolean(firstPass.counterspellPower)

    attacker.momentum = firstPass.newAttackerMomentum
    defender.momentum = firstPass.newDefenderMomentum
    await SpellDuel.saveState()

    const winner = firstPass.comparison.attackerHigh ? attacker : defender
    const names = { attacker: attacker.name, attackerCheck, defender: defender.name, defenderCheck }

    if (!attackerSpellCheck.succeeded || !defenderSpellCheck.succeeded) {
      const failed = [attackerSpellCheck.succeeded ? null : attacker.name, defenderSpellCheck.succeeded ? null : defender.name].filter(Boolean)
      await SpellDuel.addChatMessage(game.i18n.format('DCC.SpellDuelCheckFailed', { ...names, failed: failed.join(', ') }))
    } else if (firstPass.samePatronCancellation) {
      await SpellDuel.addChatMessage(game.i18n.format('DCC.SpellDuelSamePatronCancelled', names))
    } else if (manualLookup) {
      await SpellDuel.addChatMessage(game.i18n.format('DCC.SpellDuelManualLookup', {
        ...names,
        winner: winner.name,
        page: SPELL_DUEL_TABLES.spellDuelCheckComparison.page
      }))
    } else {
      const flavor = firstPass.phlogistonDisturbance
        ? game.i18n.localize('DCC.SpellDuelPhlogistonRoll')
        : game.i18n.format('DCC.SpellDuelCounterspellRoll', { die: firstPass.comparison.comparisonDie })
      const totals = {}
      for (const formula of formulas) {
        const roll = await new Roll(formula).evaluate()
        await roll.toMessage({ flavor, speaker: { alias: game.i18n.localize('DCC.SpellDuel') } })
        totals[formula] = roll.total
      }
      const result = resolve((formula) => totals[formula])

      if (result.phlogistonDisturbance) {
        await SpellDuel.addChatMessage(game.i18n.format('DCC.SpellDuelPhlogistonMessage', {
          attacker: attacker.name,
          defender: defender.name,
          result: result.phlogistonDisturbance.effect
        }))
      } else {
        const power = result.counterspellPower
        await SpellDuel.addChatMessage(game.i18n.format('DCC.SpellDuelExchangeResult', {
          ...names,
          winner: winner.name,
          die: result.comparison.comparisonDie,
          roll: power.roll,
          modifier: power.momentumModifier >= 0 ? `+${power.momentumModifier}` : power.momentumModifier,
          finalRoll: power.modifiedResult,
          result: power.effect
        }))
      }
    }

    await SpellDuel.refresh()
  }

  /**
   * Look up die type from spell duel check comparison table (Table 4-5)
   * Uses RollTable from dcc-core-book if available
   * @param {Number} attackerCheck
   * @param {Number} defenderCheck
   * @returns {Promise<String|null>} Die type (e.g., 'd6') or null if table not available
   */
  static async getSpellDuelDie (attackerCheck, defenderCheck) {
    // Clamp values to table boundaries
    const attackerLookup = clampToComparisonTable(attackerCheck)
    const defenderLookup = clampToComparisonTable(defenderCheck)

    // Try to get the comparison table from dcc-core-book
    const comparisonTable = await getSpellDuelTable('spellDuelCheckComparison')
    if (!comparisonTable) return null

    // Look up the row by defender's check
    const resultText = getTableResultText(comparisonTable, defenderLookup)
    if (!resultText) return null

    // Parse the result text to find the attacker's die
    // Format: "<strong>Defender 12:</strong> 12: PD, 13: d3, 14: d3, ..."
    const dieMatch = resultText.match(new RegExp(`\\b${attackerLookup}:\\s*(d\\d+|PD)`, 'i'))
    if (dieMatch) {
      return dieMatch[1]
    }

    return null
  }

  /**
   * End the current spell duel
   */
  static async endDuel () {
    if (SpellDuel.participants.length > 0) {
      await SpellDuel.addChatMessage(game.i18n.localize('DCC.SpellDuelEnded'))
    }
    SpellDuel.participants = []
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
      style: CONST.CHAT_MESSAGE_STYLES.EMOTE,
      content,
      sound: CONFIG.sounds.notification
    }
    return CONFIG.ChatMessage.documentClass.create(messageData)
  }
}

SpellDuel.dialog = null
SpellDuel.participants = []
SpellDuel._addingParticipant = false

export default SpellDuel
