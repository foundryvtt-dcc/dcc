/* global CONFIG, foundry, game, ui */

import { getRecoveryClass, getRecoveryText, logAbilityChange, requiresNote, staminaHpDelta } from './ability-score-log.js'

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

/**
 * A dialog for editing an ability score with a logged reason
 * Opened by clicking an ability value when the Ability Score Log is enabled
 * @extends {ApplicationV2}
 */
class AbilityScoreConfig extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ['dcc', 'sheet', 'ability-score-config'],
    tag: 'form',
    position: {
      width: 340,
      height: 'auto'
    },
    window: {
      title: 'DCC.AbilityLogTitle',
      resizable: false
    },
    form: {
      handler: AbilityScoreConfig.#onSubmitForm,
      submitOnChange: false,
      closeOnSubmit: true
    }
  }

  /** @inheritDoc */
  static PARTS = {
    form: {
      template: 'systems/dcc/templates/dialog-ability-score-config.html'
    }
  }

  /**
   * The actor being edited
   * @returns {Object}
   */
  get actor () {
    return this.options.document
  }

  /**
   * The ability being edited (str, agl, sta, per, int, lck)
   * @returns {string}
   */
  get abilityId () {
    return this.options.abilityId
  }

  /** @inheritDoc */
  get title () {
    return `${game.i18n.localize(CONFIG.DCC.abilities[this.abilityId])} — ${this.actor.name}`
  }

  /**
   * Reason types applicable to this ability
   * @returns {Array<string>}
   */
  #reasonsForAbility () {
    return Object.keys(CONFIG.DCC.abilityLogTypes).filter(key => {
      if (key === 'manual') return false
      if (key === 'luckSpend') return this.abilityId === 'lck'
      if (key === 'bleedOut') return this.abilityId === 'sta'
      if (key === 'spellburn') return ['str', 'agl', 'sta'].includes(this.abilityId)
      return true
    })
  }

  /**
   * The default reason preselected for this ability
   * @returns {string}
   */
  #defaultReason () {
    switch (this.abilityId) {
      case 'lck': return 'luckSpend'
      case 'sta': return 'bleedOut'
      case 'str':
      case 'agl': return 'spellburn'
      default: return 'damage'
    }
  }

  /** @inheritDoc */
  async _prepareContext (options = {}) {
    const context = await super._prepareContext(options)
    const ability = this.actor.system.abilities[this.abilityId]
    const defaultReason = this.#defaultReason()

    context.actor = this.actor
    context.abilityId = this.abilityId
    context.currentValue = parseInt(ability.value) || 0
    context.maxValue = parseInt(ability.max) || 0
    context.reasons = this.#reasonsForAbility().map(key => ({
      key,
      label: game.i18n.localize(CONFIG.DCC.abilityLogTypes[key]),
      checked: key === defaultReason,
      noteRequired: requiresNote(key)
    }))

    return context
  }

  /** @inheritDoc */
  _onRender (context, options) {
    super._onRender(context, options)

    const newValueInput = this.element.querySelector('input[name="newValue"]')
    newValueInput?.addEventListener('input', () => this.#refresh())
    this.element.querySelector('input[name="note"]')?.addEventListener('input', () => this.#refresh())
    for (const radio of this.element.querySelectorAll('input[name="reason"]')) {
      radio.addEventListener('change', () => this.#refresh(true))
    }

    this.#refresh(true)

    if (newValueInput) {
      newValueInput.focus()
      newValueInput.select()
    }
  }

  /**
   * Read the current form state
   * @returns {Object}
   */
  #formState () {
    const ability = this.actor.system.abilities[this.abilityId]
    const currentValue = parseInt(ability.value) || 0
    const rawValue = this.element.querySelector('input[name="newValue"]')?.value
    const newValue = parseInt(rawValue)
    const reason = this.element.querySelector('input[name="reason"]:checked')?.value
    const note = (this.element.querySelector('input[name="note"]')?.value ?? '').trim()
    return {
      currentValue,
      newValue,
      change: isNaN(newValue) ? 0 : newValue - currentValue,
      reason,
      note
    }
  }

  /**
   * Update the dynamic parts of the dialog: change display, recovery hint,
   * gain-only Max checkbox, Stamina HP checkbox, and Apply disabled state
   * @param {boolean} reasonChanged   Reset the Max checkbox default for the new reason
   */
  #refresh (reasonChanged = false) {
    const state = this.#formState()
    const noteRequired = requiresNote(state.reason)

    // Change display
    const changeDisplay = this.element.querySelector('.change-display')
    if (changeDisplay) {
      changeDisplay.textContent = state.change
        ? `(${game.i18n.localize('DCC.AbilityLogChange')}: ${state.change > 0 ? '+' : ''}${state.change})`
        : ''
    }

    // Recovery hint follows the selected reason
    const recoveryHint = this.element.querySelector('.recovery-hint')
    if (recoveryHint && state.reason) {
      const recovery = getRecoveryText({ type: state.reason }, this.actor)
      recoveryHint.textContent = `${game.i18n.localize('DCC.AbilityLogRecovery')}: ${recovery}`
    }

    // "Also adjust Max" appears for gains only - default checked for permanent reasons
    const adjustMaxRow = this.element.querySelector('.adjust-max-row')
    if (adjustMaxRow) {
      adjustMaxRow.classList.toggle('hidden', state.change <= 0)
      if (reasonChanged && state.reason) {
        const checkbox = adjustMaxRow.querySelector('input[name="adjustMax"]')
        if (checkbox) checkbox.checked = getRecoveryClass(state.reason, this.actor) === 'permanent'
      }
    }

    // Stamina modifier threshold crossing offers an HP adjustment
    const adjustHpRow = this.element.querySelector('.adjust-hp-row')
    if (adjustHpRow) {
      let showHp = false
      if (this.abilityId === 'sta' && state.change) {
        const { hpChange, oldMod, newMod } = staminaHpDelta(this.actor, state.currentValue, state.newValue)
        if (hpChange) {
          showHp = true
          const label = adjustHpRow.querySelector('.adjust-hp-label')
          if (label) {
            label.textContent = game.i18n.format('DCC.AbilityLogAdjustHP', {
              hpChange: hpChange > 0 ? `+${hpChange}` : `${hpChange}`,
              oldMod: oldMod > 0 ? `+${oldMod}` : `${oldMod}`,
              newMod: newMod > 0 ? `+${newMod}` : `${newMod}`,
              level: Math.max(1, parseInt(this.actor.system.details?.level?.value) || 0)
            })
          }
        }
      }
      adjustHpRow.classList.toggle('hidden', !showHp)
    }

    // Apply requires a change and, for the generic reasons, a note
    const applyButton = this.element.querySelector('button[type="submit"]')
    if (applyButton) {
      applyButton.disabled = !state.change || !state.reason || (noteRequired && !state.note)
    }
  }

  /**
   * Handle form submission - applies the change and writes the log entry
   * in a single update, then emits a chat card
   * @this {AbilityScoreConfig}
   * @param {SubmitEvent} event - The form submission event
   * @param {HTMLFormElement} form - The form element
   * @param {FormDataExtended} formData - The processed form data
   * @private
   */
  static async #onSubmitForm (event, form, formData) {
    event.preventDefault()
    const data = formData.object
    const ability = this.actor.system.abilities[this.abilityId]
    const currentValue = parseInt(ability.value) || 0
    const newValue = parseInt(data.newValue)
    if (isNaN(newValue)) return

    const change = newValue - currentValue
    if (!change) return

    const type = data.reason
    const note = (data.note ?? '').trim()
    if (requiresNote(type) && !note) {
      ui.notifications.warn(game.i18n.localize('DCC.AbilityLogNoteRequired'))
      throw new Error(game.i18n.localize('DCC.AbilityLogNoteRequired'))
    }

    const maxChange = (change > 0 && data.adjustMax) ? change : 0

    let hpChange = 0
    if (this.abilityId === 'sta' && data.adjustHP) {
      hpChange = staminaHpDelta(this.actor, currentValue, newValue).hpChange
    }

    await logAbilityChange(this.actor, {
      ability: this.abilityId,
      change,
      type,
      source: note,
      maxChange,
      hpChange
    }, { announce: true })

    // Call the optional callback if provided
    if (typeof this.options.callback === 'function') {
      this.options.callback()
    }
  }
}

export default AbilityScoreConfig
