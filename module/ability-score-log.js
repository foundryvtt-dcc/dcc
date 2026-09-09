/* global ChatMessage, CONFIG, foundry, game, Hooks */

/**
 * Ability Score Change Log
 *
 * Optional (world-setting gated) tracking of ability score changes with a
 * reason, a per-actor history log, recovery expectations, and one-click Heal.
 * The log lives in system.abilityLog (see data/actor/base-actor.mjs); reason
 * types and recovery classes are defined in CONFIG.DCC.abilityLogTypes and
 * CONFIG.DCC.abilityLogRecoveryClasses.
 */

// Resolved defensively so this module stays importable in bare unit-test
// contexts (pure mixin/wiring tests import it transitively before any
// foundry global exists); at runtime in Foundry the real classes are used.
const applicationsApi = globalThis.foundry?.applications?.api ?? {}
const ApplicationV2 = applicationsApi.ApplicationV2 ?? class {}
const HandlebarsApplicationMixin = applicationsApi.HandlebarsApplicationMixin ?? ((Base) => Base)

const CHAT_CARD_TEMPLATE = 'systems/dcc/templates/chat-card-ability-change.html'

/**
 * Is the ability score log enabled in this world?
 * @returns {boolean}
 */
export function abilityScoreLogEnabled () {
  try {
    return !!game.settings.get('dcc', 'enableAbilityScoreLog')
  } catch {
    return false
  }
}

/**
 * Derive the recovery class for a log entry type
 * Luck spends regenerate for thieves and halflings and are permanent for
 * everyone else - derived at call time so class changes stay correct
 * @param {string} type     Log entry type (key into CONFIG.DCC.abilityLogTypes)
 * @param {Object} actor    The actor the entry belongs to
 * @returns {string}        rest, luckRegen, permanent, none, or unknown
 */
export function getRecoveryClass (type, actor) {
  const recoveryClass = CONFIG.DCC.abilityLogRecoveryClasses[type] ?? 'unknown'
  if (recoveryClass === 'luckRegen') {
    // Prefer the canonical lowercase classId getter; fall back to the raw
    // sheetClass field for plain objects (unit test fixtures)
    const classId = (typeof actor.classId === 'string' && actor.classId) ||
      actor.system.details?.sheetClass?.toLowerCase?.() || null
    if (classId !== 'thief' && classId !== 'halfling') {
      return 'permanent'
    }
  }
  return recoveryClass
}

/**
 * Localized recovery expectation text for a log entry
 * @param {Object} entry    The log entry (or {type, change} subset)
 * @param {Object} actor    The actor the entry belongs to
 * @returns {string}
 */
export function getRecoveryText (entry, actor) {
  const recoveryClass = getRecoveryClass(entry.type, actor)
  switch (recoveryClass) {
    case 'rest':
      return game.i18n.localize('DCC.AbilityLogRecoveryRest')
    case 'luckRegen':
      return game.i18n.format('DCC.AbilityLogRecoveryLuckRegen', {
        level: Math.max(1, parseInt(actor.system.details?.level?.value) || 0)
      })
    case 'permanent':
      if (entry.type === 'luckSpend') {
        return game.i18n.localize('DCC.AbilityLogRecoveryPermanentLuck')
      }
      return game.i18n.localize('DCC.AbilityLogRecoveryPermanent')
    case 'none':
      return game.i18n.localize('DCC.AbilityLogRecoveryNone')
    default:
      return game.i18n.localize('DCC.AbilityLogRecoveryUnknown')
  }
}

/**
 * Does this reason type require a source/note explaining the change?
 * @param {string} type    Log entry type
 * @returns {boolean}
 */
export function requiresNote (type) {
  return type === 'otherTemporary' || type === 'otherPermanent'
}

/**
 * Compute the hit point adjustment for a Stamina modifier threshold crossing
 * ΔHP = (newMod − oldMod) × max(1, level)
 *
 * Deliberately base-score arithmetic: both endpoints are BASE Stamina values
 * (the log dialog only ever edits the base), so a transient Active Effect
 * `otherMod` (#801) does not shift either endpoint. HP adjustments are
 * persistent, so they track permanent base-mod crossings — a temporary +2
 * Stamina effect should neither grant nor mask a persistent HP change.
 * @param {Object} actor      The actor being edited
 * @param {number} oldValue   Stamina value before the change
 * @param {number} newValue   Stamina value after the change
 * @returns {Object}          {hpChange, oldMod, newMod}
 */
export function staminaHpDelta (actor, oldValue, newValue) {
  return staminaHpDeltaForLevel(actor.system.details?.level?.value, oldValue, newValue)
}

/**
 * The same ΔHP arithmetic keyed off a bare level rather than an actor
 *
 * The roll modifier dialog previews a spellburn's hit point cost while the
 * player is still clicking the Sta +/- buttons (#921) - it holds the level
 * the term was built with, not the actor document, so the formula lives here
 * once and both callers share it.
 *
 * Both endpoints must be BASE Stamina, as in `staminaHpDelta` - a transient
 * Active Effect `otherMod` (#801) must neither grant nor mask a persistent
 * hit point change. This is now the shared contract, so the requirement lives
 * on both entry points.
 * @param {number|string} level   The character's level
 * @param {number} oldValue       Stamina value before the change
 * @param {number} newValue       Stamina value after the change
 * @returns {Object}              {hpChange, oldMod, newMod}
 */
export function staminaHpDeltaForLevel (level, oldValue, newValue) {
  const oldMod = abilityMod(oldValue)
  const newMod = abilityMod(newValue)
  return {
    hpChange: (newMod - oldMod) * Math.max(1, parseInt(level) || 0),
    oldMod,
    newMod
  }
}

/**
 * Ability modifier for a score, clamped into the table's domain
 *
 * `CONFIG.DCC.abilityModifiers` only spans 0-24, and a bare `[score] || 0`
 * lookup reads an out-of-table score as modifier 0 - which is a real value in
 * the 9-12 band, so the miss is indistinguishable from a hit. That made a
 * Stamina 25 -> 23 burn compute a *positive* ΔHP (0 -> +5), handing the
 * character hit points for burning. Clamping to the table edges mirrors
 * `computeAbilityModifiers` (actor/derived-stats-mixin.mjs), so the log agrees
 * with the modifier shown on the sheet.
 * @param {number} score   The ability score to look up
 * @returns {number}       The modifier
 */
function abilityMod (score) {
  const table = CONFIG.DCC?.abilityModifiers
  if (!table) return 0
  if (table[score] !== undefined) return table[score]
  const keys = Object.keys(table).map(Number)
  return table[Math.max(Math.min(score, Math.max(...keys)), Math.min(...keys))] ?? 0
}

/**
 * Fold a Stamina-threshold hit point adjustment into a pending actor update
 *
 * Both endpoints move: current HP tracks the change so a burn hurts (or a
 * restored point heals) immediately, and max HP follows so the character's
 * ceiling matches their Stamina modifier.
 *
 * The DELTA is clamped, not the endpoints, and the clamped amount is returned
 * so callers can record what actually happened. Clamping the endpoints
 * independently let the two diverge: a character at 3 hit points losing 10
 * dropped to 0 (only 3 lost) while the log entry still recorded -10, so the
 * Heal button handed all 10 back and the character finished a spellburn with
 * more hit points than they started with. Moving current and max by the same
 * clamped amount keeps the round trip exact. In every case where the character
 * has the hit points to lose - which is every case short of dying - the result
 * is identical to moving both by the full amount.
 *
 * The floor on max is max(1, level): a level-1 character can lose Stamina
 * without their maximum going to 0.
 * @param {Object} actor      The actor being updated
 * @param {Object} update     The update object being assembled (mutated)
 * @param {number} hpChange   Signed hit point delta to apply
 * @returns {number}          The delta actually applied (0 if none)
 */
function applyHpChange (actor, update, hpChange) {
  const hp = actor.system?.attributes?.hp
  if (!hp) {
    // The ability change itself still lands; only the hit point leg is lost
    console.error('[DCC] cannot apply Stamina hit point adjustment - actor has no attributes.hp', { actor: actor?.name, hpChange })
    return 0
  }
  const minMax = Math.max(1, parseInt(actor.system.details?.level?.value) || 0)
  const oldValue = parseInt(hp.value) || 0
  const oldMax = parseInt(hp.max) || 0

  let applied = hpChange
  if (applied < 0) {
    applied = -Math.min(-applied, Math.max(0, oldValue), Math.max(0, oldMax - minMax))
  }
  if (!applied) return 0

  update['system.attributes.hp.value'] = oldValue + applied
  update['system.attributes.hp.max'] = oldMax + applied
  return applied
}

/**
 * Can this log entry still be healed with the Heal button?
 * Permanent-class and positive (gain) entries cannot
 * @param {Object} entry    The log entry
 * @param {Object} actor    The actor the entry belongs to
 * @returns {boolean}
 */
export function isHealable (entry, actor) {
  if (entry.change >= 0) return false
  const recoveryClass = getRecoveryClass(entry.type, actor)
  if (recoveryClass !== 'rest' && recoveryClass !== 'luckRegen') return false
  return (entry.healedAmount ?? 0) < Math.abs(entry.change)
}

/**
 * Build a complete log entry from partial data
 * @param {Object} actor    The actor the entry belongs to
 * @param {Object} data     {ability, change, type, source, maxChange, hpChange, newValue}
 * @returns {Object}        The full entry
 */
function buildLogEntry (actor, data) {
  const currentValue = parseInt(actor.system.abilities[data.ability]?.value) || 0
  return {
    id: foundry.utils.randomID(),
    timestamp: Date.now(),
    ability: data.ability,
    change: data.change,
    maxChange: data.maxChange ?? 0,
    type: data.type ?? 'manual',
    source: data.source ?? '',
    newValue: data.newValue ?? (currentValue + data.change),
    hpChange: data.hpChange ?? 0,
    healedAmount: 0,
    healedTimestamp: null
  }
}

/**
 * Emit a chat card for an ability score change
 * @param {Object} actor    The actor the entry belongs to
 * @param {Object} entry    The log entry
 * @returns {Promise}
 */
async function announceAbilityChange (actor, entry) {
  const ability = game.i18n.localize(CONFIG.DCC.abilities[entry.ability] ?? entry.ability)
  const points = Math.abs(entry.change)
  const headlineKey = entry.change < 0 ? 'DCC.AbilityLogChatLoses' : 'DCC.AbilityLogChatGains'
  const typeLabel = game.i18n.localize(CONFIG.DCC.abilityLogTypes[entry.type] ?? entry.type)
  const cardData = {
    headline: game.i18n.format(headlineKey, { points, ability }),
    reason: entry.source ? `${typeLabel} — ${entry.source}` : typeLabel,
    recovery: entry.change < 0 ? getRecoveryText(entry, actor) : '',
    hpNote: entry.hpChange ? game.i18n.format('DCC.AbilityLogChatHPAdjusted', { hp: signed(entry.hpChange) }) : ''
  }
  return createAbilityChangeMessage(actor, cardData)
}

/**
 * Emit a chat card for a Heal button restore
 * @param {Object} actor    The actor the entry belongs to
 * @param {Object} entry    The log entry after the heal was applied
 * @param {number} points   Points restored by this heal
 * @param {number} hpDelta  Hit points restored alongside (Stamina threshold)
 * @returns {Promise}
 */
async function announceAbilityHeal (actor, entry, points, hpDelta = 0) {
  const ability = game.i18n.localize(CONFIG.DCC.abilities[entry.ability] ?? entry.ability)
  const typeLabel = game.i18n.localize(CONFIG.DCC.abilityLogTypes[entry.type] ?? entry.type)
  const cardData = {
    headline: game.i18n.format('DCC.AbilityLogChatRecovers', { points, ability }),
    reason: entry.source ? `${typeLabel} — ${entry.source}` : typeLabel,
    recovery: game.i18n.format('DCC.AbilityLogChatHealProgress', {
      healed: entry.healedAmount,
      total: Math.abs(entry.change)
    }),
    hpNote: hpDelta ? game.i18n.format('DCC.AbilityLogChatHPAdjusted', { hp: signed(hpDelta) }) : ''
  }
  return createAbilityChangeMessage(actor, cardData)
}

/**
 * Render and create the ability change chat message
 * @param {Object} actor       The actor speaking the card
 * @param {Object} cardData    Template data
 * @returns {Promise}
 */
async function createAbilityChangeMessage (actor, cardData) {
  const content = await foundry.applications.handlebars.renderTemplate(CHAT_CARD_TEMPLATE, cardData)
  return CONFIG.ChatMessage.documentClass.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    flags: { 'dcc.isAbilityScoreLog': true }
  })
}

/**
 * Format a number with an explicit sign
 * @param {number} value
 * @returns {string}
 */
function signed (value) {
  return value > 0 ? `+${value}` : `${value}`
}

/**
 * Apply an ability score change and record it in the ability score log
 *
 * Performs a single actor.update() carrying the value change, any max or hit
 * point adjustment, and the appended log entry, flagged with
 * options.dcc.abilityLogged so the fallback hook does not double-log.
 * When the world setting is disabled this just applies the value change.
 *
 * Exported on game.dcc for dependent modules (MCC glowburn, plastic surgery, ...)
 *
 * @param {Object} actor      The actor to modify
 * @param {Object} entryData  {ability, change, type, source, maxChange, hpChange}
 * @param {Object} options    {announce} - emit a chat card (default true)
 * @returns {Promise<Object|null>}  The log entry written, or null
 */
export async function logAbilityChange (actor, entryData, { announce = true } = {}) {
  const abilityId = entryData.ability
  const change = parseInt(entryData.change) || 0
  const ability = actor.system.abilities[abilityId]
  if (!ability || !change) return null

  const currentValue = parseInt(ability.value) || 0
  const newValue = Math.max(0, currentValue + change)
  const update = {
    [`system.abilities.${abilityId}.value`]: newValue
  }

  if (!abilityScoreLogEnabled()) {
    await actor.update(update)
    return null
  }

  const entry = buildLogEntry(actor, { ...entryData, change, newValue })

  if (entry.maxChange) {
    update[`system.abilities.${abilityId}.max`] = (parseInt(ability.max) || 0) + entry.maxChange
  }

  if (entry.hpChange) {
    // Record what was actually applied, so healing restores exactly that
    entry.hpChange = applyHpChange(actor, update, entry.hpChange)
  }

  update['system.abilityLog'] = [...(actor.system.abilityLog ?? []), entry]

  await actor.update(update, { dcc: { abilityLogged: true } })

  if (announce) {
    await announceAbilityChange(actor, entry)
  }

  return entry
}

/**
 * Apply spellburn (or MCC glowburn) and log one entry per burned ability
 *
 * Replaces the plain actor.update() in the spellburn apply sites - one
 * update carrying the new values and the log entries. Only abilities whose
 * value actually changed are written (and logged); when the setting is
 * disabled the same update is applied with no log entries (still carrying the
 * Stamina ΔHP when `adjustHP` is set).
 *
 * When `adjustHP` is set the Stamina leg also carries the modifier-threshold
 * hit point cost (#921) - the same ΔHP the Ability Score Log dialog offers for
 * a manual Stamina loss. It is opt-in from the spellburn dialog's checkbox and
 * independent of the log setting: with logging off the hit points still move,
 * there is simply no entry to heal them back from. A chat card is still posted
 * in that case, because an unexplained hit point drop is worse than no record.
 *
 * @param {Object} actor        The actor burning ability points
 * @param {Object} burned       {str, agl, sta} - new values after the burn
 * @param {string} source       Spell or patron name for the log entries
 * @param {Object} [options]
 * @param {boolean} [options.adjustHP=false]  Apply the Stamina ΔHP alongside
 * @returns {Promise}
 */
export async function logSpellburn (actor, burned, source = '', { adjustHP = false } = {}) {
  const enabled = abilityScoreLogEnabled()
  const update = {}
  const burns = []
  let hpChange = 0

  for (const abilityId of ['str', 'agl', 'sta']) {
    const newValue = parseInt(burned[abilityId])
    if (isNaN(newValue)) continue
    const currentValue = parseInt(actor.system.abilities[abilityId]?.value) || 0
    const change = newValue - currentValue
    if (!change) continue
    update[`system.abilities.${abilityId}.value`] = newValue
    burns.push({ ability: abilityId, change, newValue })
    if (adjustHP && abilityId === 'sta') {
      hpChange = staminaHpDelta(actor, currentValue, newValue).hpChange
    }
  }

  if (burns.length === 0) return

  // Applied before the entries are built: a character without the hit points
  // to lose takes less than the computed amount, and the entry has to record
  // what actually happened or healing it back invents hit points
  const appliedHp = hpChange ? applyHpChange(actor, update, hpChange) : 0

  if (!enabled) {
    await actor.update(update)
    // No entry means no Heal button, but the player still needs to see what
    // the burn cost them - the Stamina leg carries the hit point note
    if (appliedHp) {
      const sta = burns.find(b => b.ability === 'sta')
      await announceAbilityChange(actor, buildLogEntry(actor, {
        ...sta, type: 'spellburn', source, hpChange: appliedHp
      }))
    }
    return
  }

  const entries = burns.map(burn => buildLogEntry(actor, {
    ...burn,
    type: 'spellburn',
    source,
    // Only the Stamina entry owns the HP delta, so healing that entry
    // back is what restores the hit points
    hpChange: burn.ability === 'sta' ? appliedHp : 0
  }))

  update['system.abilityLog'] = [...(actor.system.abilityLog ?? []), ...entries]

  await actor.update(update, { dcc: { abilityLogged: true } })

  for (const entry of entries) {
    await announceAbilityChange(actor, entry)
  }
}

/**
 * Heal points from a log entry via the Heal button
 *
 * Each step restores one ability point (clamped to the ability's max) and
 * increments healedAmount. Stamina heals are symmetric per step: when a
 * single point crosses a modifier threshold back, the same ΔHP formula
 * restores hit points, accumulating into the entry's hpChange (which trends
 * back toward 0). Healing never deletes the entry.
 *
 * @param {Object} actor      The actor to heal
 * @param {string} entryId    The id of the log entry to heal
 * @param {Object} options    {healAll} - heal the full remainder (shift-click)
 * @returns {Promise<Object|null>}  The updated entry, or null if not healable
 */
export async function healAbilityLogEntry (actor, entryId, { healAll = false } = {}) {
  const log = actor.system.abilityLog ?? []
  const index = log.findIndex(e => e.id === entryId)
  if (index === -1) return null
  const entry = log[index]
  if (!isHealable(entry, actor)) return null

  const total = Math.abs(entry.change)
  const remaining = total - (entry.healedAmount ?? 0)
  const steps = healAll ? remaining : 1

  const ability = actor.system.abilities[entry.ability]
  const max = parseInt(ability.max) || 0
  const level = parseInt(actor.system.details?.level?.value) || 0
  let value = parseInt(ability.value) || 0
  let hpDelta = 0
  // HP still owed back from the original change (positive amount)
  let hpRemaining = Math.max(0, -(entry.hpChange ?? 0))

  for (let i = 0; i < steps; i++) {
    const oldValue = value
    value = Math.min(max, value + 1)
    if (hpRemaining > 0) {
      const oldMod = abilityMod(oldValue)
      const newMod = abilityMod(value)
      const delta = (newMod - oldMod) * Math.max(1, level)
      if (delta > 0) {
        const applied = Math.min(delta, hpRemaining)
        hpDelta += applied
        hpRemaining -= applied
      }
    }
  }

  const updatedEntry = {
    ...entry,
    healedAmount: (entry.healedAmount ?? 0) + steps,
    healedTimestamp: Date.now(),
    hpChange: (entry.hpChange ?? 0) + hpDelta
  }
  const newLog = [...log]
  newLog[index] = updatedEntry

  const update = {
    [`system.abilities.${entry.ability}.value`]: value,
    'system.abilityLog': newLog
  }
  if (hpDelta) {
    const hp = actor.system.attributes.hp
    update['system.attributes.hp.value'] = (parseInt(hp.value) || 0) + hpDelta
    update['system.attributes.hp.max'] = (parseInt(hp.max) || 0) + hpDelta
  }

  await actor.update(update, { dcc: { abilityLogged: true } })
  await announceAbilityHeal(actor, updatedEntry, steps, hpDelta)

  return updatedEntry
}

/**
 * Delete a log entry (GM only, for bookkeeping mistakes)
 * Does not change the ability score
 * @param {Object} actor      The actor to modify
 * @param {string} entryId    The id of the log entry to delete
 * @returns {Promise}
 */
export async function deleteAbilityLogEntry (actor, entryId) {
  if (!game.user.isGM) return
  const log = actor.system.abilityLog ?? []
  const newLog = log.filter(e => e.id !== entryId)
  if (newLog.length === log.length) return
  await actor.update({ 'system.abilityLog': newLog }, { dcc: { abilityLogged: true } })
}

/**
 * preUpdateActor fallback logger
 *
 * Catches direct ability value edits that bypass the edit dialog (macros,
 * modules, GM bar edits) and records them as type 'manual' entries by
 * injecting the appended log into the same update. Skipped when the update
 * already carries the dcc.abilityLogged flag. Manual entries do not emit
 * chat cards.
 *
 * Registered in dcc.js; exported separately for unit testing.
 *
 * @param {Object} actor      The actor being updated
 * @param {Object} changes    The update delta (mutated to add log entries)
 * @param {Object} options    Update options
 * @param {string} userId     The id of the user making the change
 */
export function abilityLogPreUpdateActor (actor, changes, options, userId) {
  if (userId !== game.user.id) return
  if (options?.dcc?.abilityLogged) return
  if (actor.type !== 'Player') return
  if (!abilityScoreLogEnabled()) return

  const expanded = foundry.utils.expandObject(changes ?? {})
  const abilities = expanded?.system?.abilities
  if (!abilities) return

  const entries = []
  for (const abilityId of Object.keys(CONFIG.DCC.abilities)) {
    const newValue = abilities[abilityId]?.value
    if (newValue === undefined || newValue === null) continue
    const oldValue = parseInt(actor.system.abilities[abilityId]?.value) || 0
    const change = parseInt(newValue) - oldValue
    if (!change || isNaN(change)) continue
    entries.push(buildLogEntry(actor, { ability: abilityId, change, type: 'manual', newValue: parseInt(newValue) }))
  }

  if (entries.length) {
    foundry.utils.setProperty(changes, 'system.abilityLog', [...(actor.system.abilityLog ?? []), ...entries])
  }
}

/**
 * The Ability Score Log viewer dialog
 * Shows the actor's change history newest-first with Heal and delete actions
 * @extends {ApplicationV2}
 */
export class AbilityScoreLogDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ['dcc', 'sheet', 'ability-score-log'],
    position: {
      width: 640,
      height: 'auto'
    },
    window: {
      title: 'DCC.AbilityLogTitle',
      resizable: true
    },
    actions: {
      healEntry: AbilityScoreLogDialog.#onHealEntry,
      deleteEntry: AbilityScoreLogDialog.#onDeleteEntry
    }
  }

  /** @inheritDoc */
  static PARTS = {
    log: {
      template: 'systems/dcc/templates/dialog-ability-score-log.html'
    }
  }

  #updateActorHookId = null

  /**
   * The actor whose log is displayed
   * @returns {Object}
   */
  get actor () {
    return this.options.document
  }

  /** @inheritDoc */
  get title () {
    return `${game.i18n.localize('DCC.AbilityLogTitle')} — ${this.actor.name}`
  }

  /** @inheritDoc */
  async _prepareContext (options = {}) {
    const context = await super._prepareContext(options)
    const actor = this.actor
    const log = actor.system.abilityLog ?? []

    context.actor = actor
    context.isGM = game.user.isGM
    context.entries = [...log]
      .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
      .map(entry => {
        const total = Math.abs(entry.change)
        const healedAmount = entry.healedAmount ?? 0
        const fullyHealed = entry.change < 0 && healedAmount >= total
        return {
          id: entry.id,
          date: entry.timestamp ? new Date(entry.timestamp).toLocaleDateString() : '',
          abilityLabel: game.i18n.localize(`${CONFIG.DCC.abilities[entry.ability] ?? entry.ability}Short`),
          change: signed(entry.change),
          changeClass: entry.change < 0 ? 'loss' : 'gain',
          typeLabel: game.i18n.localize(CONFIG.DCC.abilityLogTypes[entry.type] ?? entry.type),
          source: entry.source,
          recovery: entry.change < 0 ? getRecoveryText(entry, actor) : '',
          healable: isHealable(entry, actor),
          fullyHealed,
          healedDate: fullyHealed && entry.healedTimestamp
            ? game.i18n.format('DCC.AbilityLogHealedOn', { date: new Date(entry.healedTimestamp).toLocaleDateString() })
            : '',
          healedProgress: healedAmount > 0 && !fullyHealed
            ? game.i18n.format('DCC.AbilityLogHealedProgress', { healed: healedAmount, total })
            : ''
        }
      })

    return context
  }

  /** @inheritDoc */
  _onFirstRender (context, options) {
    super._onFirstRender?.(context, options)
    // Refresh when the actor changes (heals, edits, deletions from anywhere)
    this.#updateActorHookId = Hooks.on('updateActor', (document) => {
      if (document.id === this.actor.id) this.render(false)
    })
  }

  /** @inheritDoc */
  async close (options = {}) {
    if (this.#updateActorHookId !== null) {
      Hooks.off('updateActor', this.#updateActorHookId)
      this.#updateActorHookId = null
    }
    return super.close(options)
  }

  /**
   * Heal one point from a log entry (shift-click heals the full remainder)
   * @this {AbilityScoreLogDialog}
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   */
  static async #onHealEntry (event, target) {
    await healAbilityLogEntry(this.actor, target.dataset.entryId, { healAll: event.shiftKey })
    this.render(false)
  }

  /**
   * Delete a log entry (GM only)
   * @this {AbilityScoreLogDialog}
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   */
  static async #onDeleteEntry (event, target) {
    await deleteAbilityLogEntry(this.actor, target.dataset.entryId)
    this.render(false)
  }
}

export default AbilityScoreLogDialog
