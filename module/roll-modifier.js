/* global Die, OperatorTerm, Roll, game, foundry */

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

/**
 * Clean a formula by stripping any spaces and duplicate signs
 * @param formula {Object}
 * @return {Object}
 */
function _cleanFormula (formula) {
  if (formula) {
    return formula.toString().replace(/\s+/g, '').replace(/\+\+/g, '+').replace(/--/g, '+').replace(/\+-/g, '-').replace(/-\+/g, '-').replace(/\+$/, '')
  }
  return ''
}

/**
 * Prepend a formula with a sign if one is not already present
 * @param formula {Object}
 * @return {Object}
 */
function _prependSign (formula) {
  const hasSignExpression = /^[+-]\d+$/
  if (!formula.toString().match(hasSignExpression)) {
    return '+' + formula
  }
  return formula
}

/**
 * Construct a DCC Die term object
 * @param options {Object}
 * @return {Object}
 */
function DCCDieTerm (options) {
  return [{
    apply: false,
    type: 'Die',
    label: game.i18n.localize('DCC.RollModifierDieTerm'),
    dieLabel: '',
    modifierLabel: '',
    partial: 'systems/dcc/templates/roll-modifier-partial-die.html',
    flavor: options.flavor,
    formula: _cleanFormula(options.formula),
    presets: options.presets || []
  }]
}

/**
 * Construct a DCC Disapproval Die term object
 * @param options {Object}
 * @return {Object}
 */
function DCCDisapprovalDieTerm (options) {
  return [{
    type: 'DisapprovalDie',
    label: game.i18n.localize('DCC.RollModifierDisapprovalDieTerm'),
    partial: 'systems/dcc/templates/roll-modifier-partial-disapproval-die.html',
    formula: _cleanFormula(options.formula)
  }]
}

/**
 * Construct a DCC Luck Die term object
 * @param options {Object}
 * @return {Object}
 */
function DCCLuckDieTerm (options) {
  return [{
    type: 'DisapprovalDie',
    label: game.i18n.localize('DCC.RollModifierLuckDieTerm'),
    partial: 'systems/dcc/templates/roll-modifier-partial-disapproval-die.html',
    formula: _cleanFormula(options.formula),
    maxCount: options.lck - 1,
    callback: options.callback
  }]
}

/**
 * Construct a DCC Modifier term object
 * @params options {Object}
 * @return {Object}
 */
function DCCModifierTerm (options) {
  return [{
    type: 'Modifier',
    label: game.i18n.localize('DCC.RollModifierModifierTerm'),
    partial: 'systems/dcc/templates/roll-modifier-partial-modifiers.html',
    formula: _prependSign(_cleanFormula(options.formula))
  }]
}

/**
 * Construct a DCC Check Penalty term object
 * @params options {Object}
 * @return {Object}
 */
function DCCCheckPenaltyTerm (options) {
  const formula = _prependSign(_cleanFormula(options.formula))
  return [{
    type: 'CheckPenalty',
    label: game.i18n.localize('DCC.RollModifierCheckPenaltyTerm'),
    partial: 'systems/dcc/templates/roll-modifier-partial-check-penalty.html',
    formula: options.apply ? formula : '-0',
    checkedFormula: formula,
    startsChecked: options.apply
  }]
}

/**
 * Construct a DCC Spellburn term object
 * @params options {Object}
 * @return {Object}
 */
function DCCSpellburnTerm (options) {
  return [{
    type: 'Spellburn',
    label: game.i18n.localize('DCC.RollModifierSpellburnTerm'),
    partial: 'systems/dcc/templates/roll-modifier-partial-spellburn.html',
    formula: _prependSign(_cleanFormula(options.formula)),
    str: options.str,
    agl: options.agl,
    sta: options.sta,
    callback: options.callback
  }]
}

/**
 * Construct a DCC Fleeting Luck term object
 * @params options {Object}
 * @return {Object}
 */
function DCCFleetingLuckTerm (options) {
  return [{
    type: 'Modifier',
    label: game.i18n.localize('DCC.FleetingLuckTerm'),
    partial: 'systems/dcc/templates/roll-modifier-partial-modifiers.html',
    formula: _prependSign(_cleanFormula(options.formula)),
    minAmount: Math.min(1, options.fleetingLuck),
    maxAmount: options.fleetingLuck
  }]
}

/**
 * Construct DCC term objects from a compound term
 * @params options {Object}
 * @return {Object}
 */
function DCCCompoundTerm (options) {
  const dieExpression = /^-?\d+d\d+(\[.+\])?$/
  const dieLabel = options.dieLabel || null
  const modifierExpression = /^-?\d+$/
  const modifierLabel = options.modifierLabel || null
  const variableExpression = /@(\w+)/
  const terms = []
  // Clean formula, then stick some duplicate pluses back in, so they can be used to split the formula neatly
  const inputTerms = _cleanFormula(options.formula).replace(/-/g, '+-').replace(/^\+/, '').split('+')
  let rawTerms = _cleanFormula(options.rawFormula).replace(/-/, '+-').replace(/^\+/, '').split('+')

  // If the raw and input terms arrays don't match fall back to just using inputTerms
  if (inputTerms.length !== rawTerms.length) {
    rawTerms = inputTerms
  }

  for (let index = 0; index < inputTerms.length; ++index) {
    const inputTerm = inputTerms[index]
    const rawTerm = rawTerms[index]
    if (inputTerm.match(dieExpression)) {
      for (const term of DCCDieTerm({ formula: inputTerm })) {
        if (rawTerm.match(variableExpression)) {
          term.label = rawTerm
        } else if (dieLabel) {
          term.label = dieLabel
        }
        if (options.flavor) {
          term.flavor = options.flavor
        }
        terms.push(term)
      }
    } else if (inputTerm.match(modifierExpression)) {
      for (const term of DCCModifierTerm({ formula: inputTerm })) {
        if (rawTerm.match(variableExpression)) {
          term.label = rawTerm
        } else if (modifierLabel) {
          term.label = modifierLabel
        }
        terms.push(term)
      }
    } else {
      terms.push({
        type: 'Compound',
        partial: 'systems/dcc/templates/roll-modifier-partial-none.html',
        formula: options.formula
      })
    }
  }
  return terms
}

// Array of constructors for DCC term objects by type
const DCCTerms = {
  Die: DCCDieTerm,
  DisapprovalDie: DCCDisapprovalDieTerm,
  LuckDie: DCCLuckDieTerm,
  Modifier: DCCModifierTerm,
  CheckPenalty: DCCCheckPenaltyTerm,
  Spellburn: DCCSpellburnTerm,
  Compound: DCCCompoundTerm,
  FleetingLuck: DCCFleetingLuckTerm
}

/**
 * Construct a DCC term of a specific type
 * @params type {String}     The type of term to construct
 * @params options {Object}  Parameters for the constructor
 * @return {Object}
 */
function constructDCCTerm (type, data = {}, options = {}) {
  if (type in DCCTerms) {
    // Use foundry's Roll class to apply any substitutions
    if (options.formula) {
      options.rawFormula = options.formula.toString()
      // Replace '-' with '+-' to avoid Roll performing arithmetic directly on substitutions
      const roll = new Roll(options.rawFormula.replace(/-/g, '+-'), data)
      options.formula = roll.formula
    }

    // Construct the term (or terms)
    const terms = DCCTerms[type].call(this, options) || []

    // Override labels if provided
    if (options.label) {
      for (const term of terms) {
        term.label = options.label
      }
    }

    return terms
  }
  return []
}

class RollModifierDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  /**
   * Construct a Roll Modifier Dialog
   * @params resolve {Function}     Function to resolve the promise
   * @params reject {Function}      Function to reject the promise
   * @params terms {Array}          Array of DCCTerm declarations, or a Foundry Roll object
   * @params options {Object}       Options
   * @return {Object}
   */
  constructor (resolve, reject, terms, options = {}) {
    super(options)
    this._resolve = resolve
    this._reject = reject
    if (terms instanceof Array) {
      this._terms = this._constructTermsFromArray(terms)
    } else {
      this._terms = this._constructTermsFromRoll(terms, options.rollData)
    }
    this._roll = this._constructRoll()

    // Handle damage terms if provided
    if (options.damageTerms) {
      this._damageTerms = this._constructTermsFromArray(options.damageTerms, 'damage-')
    } else {
      this._damageTerms = null
    }
  }

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ['dcc', 'sheet', 'roll-modifier'],
    tag: 'form',
    position: {
      width: 'auto',
      height: 'auto'
    },
    window: {
      resizable: true,
      title: 'DCC.RollModifierTitle'
    },
    form: {
      handler: RollModifierDialog.#onSubmitForm,
      submitOnChange: false,
      closeOnSubmit: false
    },
    actions: {
      cancel: RollModifierDialog.#onCancel,
      modifyDie: RollModifierDialog.#modifyDie,
      modifyDieCount: RollModifierDialog.#modifyDieCount,
      modifyBonus: RollModifierDialog.#modifyBonus,
      applyPreset: RollModifierDialog.#applyPreset,
      modifySpellburn: RollModifierDialog.#modifySpellburn,
      resetTerm: RollModifierDialog.#resetTerm,
      checkboxChange: RollModifierDialog.#checkboxChange
    }
  }

  /** @inheritDoc */
  static PARTS = {
    form: {
      template: 'systems/dcc/templates/dialog-roll-modifiers.html'
    }
  }

  /*
   * Title
   * @type {string}
   */
  get title () {
    return this.options.title || game.i18n.localize('DCC.RollModifierTitle')
  }

  /*
   * The roll object generated by the modifiers
   * @type {Roll}
   */
  get roll () {
    return this._roll
  }

  /*
   * The original terms of the expression being edited
   * @type {Array}
   */
  get terms () {
    return this._terms
  }

  /*
   * The damage terms (if any)
   * @type {Array|null}
   */
  get damageTerms () {
    return this._damageTerms
  }

  /**
   * Get a term by its index (handles both attack and damage terms)
   * @param {string|number} index - The term index (e.g., "0", "1", "damage-0")
   * @return {Object|undefined}
   */
  getTermByIndex (index) {
    const indexStr = String(index)
    if (indexStr.startsWith('damage-')) {
      const damageIndex = parseInt(indexStr.replace('damage-', ''))
      return this._damageTerms?.[damageIndex]
    }
    return this._terms[parseInt(indexStr)]
  }

  /* -------------------------------------------- */

  /**
   * Construct and return the data object used to render the HTML template for this form application.
   * @return {Object}
   */
  _prepareContext (options) {
    const data = {}
    data.user = game.user
    data.options = this.options
    data.terms = this._terms
    data.damageTerms = this._damageTerms
    data.rollLabel = this.options.rollLabel || game.i18n.localize('DCC.RollModifierRoll')
    data.cancelLabel = this.options.cancelLabel || game.i18n.localize('DCC.RollModifierCancel')
    return data
  }

  /* -------------------------------------------- */

  // activateListeners replaced by actions system in V2

  /**
   * Handle form submission
   * @this {RollModifierDialog}
   * @param {SubmitEvent} event - The form submission event
   * @param {HTMLFormElement} form - The form element
   * @param {FormDataExtended} formData - The processed form data
   * @private
   */
  static async #onSubmitForm (event, form, formData) {
    event.preventDefault()

    this._roll = this._constructRoll()
    // If damage terms exist, construct the damage formula and store it on the roll
    if (this._damageTerms) {
      const damageFormula = this._constructDamageFormula()
      foundry.utils.mergeObject(this._roll.options, { modifiedDamageFormula: damageFormula })
    }
    this._resolve(this.roll)
    await this.close()
  }

  /**
   * Construct a Foundry Roll object from the collected attack terms
   * @return {Object}
   * @private
   */
  _constructRoll () {
    // Helper to safely call the resolve method for a term
    const resolveTerm = function (formula, term) {
      if (term.callback) {
        term.callback(formula, term)
      }
    }
    // Build a new Roll object from the collected terms (excluding damage terms)
    let formula = ''
    let termIndex = 0
    if (this._state !== ApplicationV2.RENDER_STATES.NONE && this.element) {
      // Once the form is constructed extract data from the form fields
      // Only process attack terms (IDs that are numeric, not prefixed with 'damage-')
      for (const term of this.terms) {
        const element = this.element.querySelector(`#term-${term.index}`)
        if (element) {
          if (termIndex > 0) {
            formula += '+'
          }
          formula += element.value
          resolveTerm(element.value, term)
          termIndex++
        }
      }
    } else {
      // Otherwise extract data straight from the terms array
      for (const term of this.terms) {
        if (term.index > 0) {
          formula += '+'
        }
        formula += term.formula
        resolveTerm(term.formula, term)
      }
    }
    formula = _cleanFormula(formula)
    return new Roll(formula)
  }

  /**
   * Construct a damage formula from the collected damage terms
   * @return {String}
   * @private
   */
  _constructDamageFormula () {
    if (!this._damageTerms) return ''

    // Helper to safely call the resolve method for a term
    const resolveTerm = function (formula, term) {
      if (term.callback) {
        term.callback(formula, term)
      }
    }

    let formula = ''
    let termIndex = 0
    if (this._state !== ApplicationV2.RENDER_STATES.NONE && this.element) {
      // Extract data from the damage term form fields
      for (const term of this._damageTerms) {
        const element = this.element.querySelector(`#term-${term.index}`)
        if (element) {
          if (termIndex > 0) {
            formula += '+'
          }
          formula += element.value
          resolveTerm(element.value, term)
          termIndex++
        }
      }
    } else {
      // Extract data straight from the damage terms array
      for (let i = 0; i < this._damageTerms.length; i++) {
        const term = this._damageTerms[i]
        if (i > 0) {
          formula += '+'
        }
        formula += term.formula
        resolveTerm(term.formula, term)
      }
    }
    return _cleanFormula(formula)
  }

  /**
   * Handle the Cancel button
   * @this {RollModifierDialog}
   * @param {PointerEvent} event - The originating click event
   * @param {HTMLElement} target - The capturing HTML element which defined a [data-action]
   * @private
   */
  static async #onCancel (event, target) {
    event.preventDefault()
    this._reject(null)
    await this.close()
  }

  /**
   * Modify a Die term (via dice chain)
   * @this {RollModifierDialog}
   * @param {PointerEvent} event - The originating click event
   * @param {HTMLElement} target - The capturing HTML element which defined a [data-action]
   * @private
   */
  static async #modifyDie (event, target) {
    event.preventDefault()
    const index = target.dataset.term
    const mod = target.dataset.mod
    const formField = this.element.querySelector('#term-' + index)
    let termFormula = game.dcc.DiceChain.bumpDie(formField.value, parseInt(mod))
    if (index !== '0' && index !== 0) {
      // Add a sign if this isn't the first term in the expression
      termFormula = '+' + termFormula
    }
    formField.value = termFormula
  }

  /**
   * Modify a Die term (number of dice)
   * @this {RollModifierDialog}
   * @param {PointerEvent} event - The originating click event
   * @param {HTMLElement} target - The capturing HTML element which defined a [data-action]
   * @private
   */
  static async #modifyDieCount (event, target) {
    event.preventDefault()
    const index = target.dataset.term
    const mod = target.dataset.mod
    const term = this.getTermByIndex(index)
    const formField = this.element.querySelector('#term-' + index)
    let termFormula = game.dcc.DiceChain.bumpDieCount(formField.value, parseInt(mod), term.maxCount)
    if (index !== '0' && index !== 0) {
      // Add a sign if this isn't the first term in the expression
      termFormula = '+' + termFormula
    }

    formField.value = termFormula
  }

  /**
   * Modify a non-Die term
   * @this {RollModifierDialog}
   * @param {PointerEvent} event - The originating click event
   * @param {HTMLElement} target - The capturing HTML element which defined a [data-action]
   * @private
   */
  static async #modifyBonus (event, target) {
    event.preventDefault()
    const index = target.dataset.term
    const mod = target.dataset.mod
    const term = this.getTermByIndex(index)
    const formField = this.element.querySelector('#term-' + index)
    let termFormula = parseInt(formField.value) + parseInt(mod)
    if (term?.minAmount) {
      termFormula = Math.max(termFormula, parseInt(term.minAmount))
    }
    if (term?.maxAmount) {
      termFormula = Math.min(termFormula, parseInt(term.maxAmount))
    }
    termFormula = termFormula.toString()
    if (termFormula[0] !== '-') {
      // Always add a sign
      termFormula = '+' + termFormula
    }
    formField.value = termFormula
  }

  /**
   * Apply a preset
   * @this {RollModifierDialog}
   * @param {PointerEvent} event - The originating click event
   * @param {HTMLElement} target - The capturing HTML element which defined a [data-action]
   * @private
   */
  static async #applyPreset (event, target) {
    event.preventDefault()
    const index = target.dataset.term
    const formula = target.dataset.formula
    const formField = this.element.querySelector('#term-' + index)
    formField.value = formula
  }

  /**
   * Modify a spellburn term
   * @this {RollModifierDialog}
   * @param {PointerEvent} event - The originating click event
   * @param {HTMLElement} target - The capturing HTML element which defined a [data-action]
   * @private
   */
  static async #modifySpellburn (event, target) {
    event.preventDefault()
    const index = target.dataset.term
    const mod = parseInt(target.dataset.mod)
    const stat = target.dataset.stat
    const formField = this.element.querySelector('#term-' + index)
    const statField = this.element.querySelector('#' + stat)
    const statMax = parseInt(statField.dataset.max)
    const statValue = parseInt(statField.value)
    const newValue = parseInt(formField.value) + mod
    const newStat = statValue - mod
    if (newStat >= 0 && newStat <= statMax) {
      let termFormula = newValue.toString()
      if (termFormula[0] !== '-') {
        // Always add a sign
        termFormula = '+' + termFormula
      }
      formField.value = termFormula
      statField.value = newStat
      this.terms[index][stat] = newStat
    }
  }

  /**
   * Handle a checkbox change event
   * @this {RollModifierDialog}
   * @param {PointerEvent} event - The originating change event
   * @param {HTMLElement} target - The capturing HTML element which defined a [data-action]
   * @private
   */
  static async #checkboxChange (event, target) {
    const index = target.dataset.term
    const term = this.getTermByIndex(index)
    const formField = this.element.querySelector('#term-' + index)
    const checked = target.checked
    formField.value = checked ? term.checkedFormula : '+0'
  }

  /**
   * Reset a term
   * @this {RollModifierDialog}
   * @param {PointerEvent} event - The originating click event
   * @param {HTMLElement} target - The capturing HTML element which defined a [data-action]
   * @private
   */
  static async #resetTerm (event, target) {
    event.preventDefault()
    const index = target.dataset.term
    const formField = this.element.querySelector('#term-' + index)
    formField.value = this.getTermByIndex(index).formula
  }

  /** @override */
  async close (options = {}) {
    await super.close(options)
    this._reject(null)
  }

  /**
   * Construct the terms from an array
   * @param termConstructors {Object}
   * @param idPrefix {String}  Optional prefix for term IDs (e.g., 'damage-' for damage terms)
   * @private
   */
  _constructTermsFromArray (termConstructors, idPrefix = '') {
    const terms = []

    // Construct and number the terms
    let index = 0
    for (const constructor of termConstructors) {
      const constructedTerms = constructDCCTerm(constructor.type, this.options.rollData, constructor)
      for (const term of constructedTerms) {
        if (term) {
          term.index = idPrefix + index++
          terms.push(term)
        }
      }
    }

    return terms
  }

  /**
   * Construct the terms from a roll
   * @param formula {String}  Formula to extract terms from
   * @param data {Object}     Extra data for the roll
   * @private
   */
  _constructTermsFromRoll (formula, data) {
    // Let Foundry turn a roll into terms for us
    const roll = new Roll(formula, data)

    // State
    const terms = []
    const validNumber = /[+-]*\d+/
    let termAccumulator = ''
    let anyModifierTerms = false

    // Helper functions
    const addDieTerm = function (term) {
      Array.prototype.push.apply(terms, DCCDieTerm({ formula: term.formula }))
      termAccumulator = ''
    }
    const addModifierTerm = function () {
      // Remove duplicate operator terms and other unexpected things
      if (termAccumulator.match(validNumber)) {
        Array.prototype.push.apply(terms, DCCModifierTerm({ formula: termAccumulator }))
        anyModifierTerms = true
      }
      termAccumulator = ''
    }
    const accumulateTerm = function (term) {
      termAccumulator += term.formula.replace(/\s+/g, '')
    }

    // Extract terms from the Roll
    for (const term of roll.terms) {
      if (term instanceof Die) {
        // Isolate Die terms
        if (termAccumulator) {
          addModifierTerm()
        }
        addDieTerm(term)
      } else if (term instanceof OperatorTerm) {
        // If we hit an operator term output the current term and continue accumulating
        if (termAccumulator) {
          addModifierTerm()
        }
        accumulateTerm(term)
      } else {
        // Accumulate and concatenate non-die terms
        accumulateTerm(term)
      }
    }
    if (termAccumulator) {
      // Mop up any remaining modifiers
      addModifierTerm()
    }

    // Add a modifier term if none were present
    if (!anyModifierTerms) {
      termAccumulator = '+0'
      addModifierTerm()
    }

    // Number the terms
    let index = 0
    for (const term of terms) {
      term.index = index++
    }

    return terms
  }
}

async function showRollModifier (roll, options) {
  return new Promise((resolve, reject) => {
    new RollModifierDialog(resolve, reject, roll, options).render(true)
  })
}

function createRollFromTerms (terms, options) {
  return new RollModifierDialog(null, null, terms, options).roll
}

export {
  showRollModifier,
  createRollFromTerms
}
