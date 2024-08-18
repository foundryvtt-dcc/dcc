/* global Application, CONFIG, Die, FormApplication, OperatorTerm, Roll, game */

/**
 * Clean a formula by stripping any spaces and duplicate signs
 * @param formula {Object}
 * @return {Object}
 */
function _cleanFormula (formula) {
  return formula.toString().replace(/\s+/g, '').replace(/\+\+/g, '+').replace(/--/g, '+').replace(/\+-/g, '-').replace(/-\+/g, '-')
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
    type: 'Die',
    label: game.i18n.localize('DCC.RollModifierDieTerm'),
    partial: 'systems/dcc/templates/roll-modifier-partial-die.html',
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
  const dieExpression = /^-?\d+d\d+$/
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

class RollModifierDialog extends FormApplication {
  /**
   * Construct a Roll Modifier Dialog
   * @params resolve {Function}     Function to resolve the promise
   * @params reject {Function}      Function to reject the promise
   * @params terms {Array}          Array of DCCTerm declarations, or a Foundry Roll object
   * @params options {Object}       Options
   * @return {Object}
   */
  constructor (resolve, reject, terms, options = {}) {
    super()
    this._resolve = resolve
    this._reject = reject
    Object.assign(this.options, options)
    if (terms instanceof Array) {
      this._terms = this._constructTermsFromArray(terms)
    } else {
      this._terms = this._constructTermsFromRoll(terms, options.rollData)
    }
    this._roll = this._constructRoll()
  }

  /** @override */
  static get defaultOptions () {
    const options = super.defaultOptions
    options.template = CONFIG.DCC.templates.rollModifierDialog
    options.width = 500
    return options
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

  /* -------------------------------------------- */

  /**
   * Construct and return the data object used to render the HTML template for this form application.
   * @return {Object}
   */
  getData () {
    const data = {}
    data.user = game.user
    data.options = this.options
    data.terms = this._terms
    data.rollLabel = this.options.rollLabel || game.i18n.localize('DCC.RollModifierRoll')
    data.cancelLabel = this.options.cancelLabel || game.i18n.localize('DCC.RollModifierCancel')
    return data
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners (html) {
    super.activateListeners(html)

    html.find('button.cancel').click(this._onCancel.bind(this))

    html.find('button.dice-chain').click(this._modifyDie.bind(this))
    html.find('button.dice-count').click(this._modifyDieCount.bind(this))
    html.find('button.bonus').click(this._modifyBonus.bind(this))
    html.find('button.term-preset').click(this._applyPreset.bind(this))
    html.find('button.spellburn').click(this._modifySpellburn.bind(this))

    html.find('button.reset').click(this._resetTerm.bind(this))

    html.find('input.checkbox').change(this._checkboxChange.bind(this))
  }

  /**
   * This method is called upon form submission after form data is validated
   * @param event {Event}       The initial triggering submission event
   * @param formData {Object}   The object of validated form data with which to update the object
   * @private
   */
  async _updateObject (event, formData) {
    event.preventDefault()

    this._roll = this._constructRoll()
    this._resolve(this.roll)
    super.close()
  }

  /**
   * Construct a Foundry Roll object from the collected terms
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
    // Build a new Roll object from the collected terms
    let formula = ''
    if (this._state !== Application.RENDER_STATES.NONE) {
      // Once the form is constructed extract data from the form fields
      this.element.find('input.term-field').each((index, element) => {
        if (index > 0) {
          formula += '+'
        }
        formula += element.value
        resolveTerm(element.value, this.terms[index])
      })
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
   * Handle the Cancel button
   * @param event {Event}       The originating click event
   * @private
   */
  async _onCancel (event) {
    event.preventDefault()
    this._reject(null)
    super.close()
  }

  /**
   * Modify a Die term (via dice chain)
   * @param event {Event}  The originating click event
   * @private
   */
  async _modifyDie (event) {
    event.preventDefault()
    const index = event.currentTarget.dataset.term
    const mod = event.currentTarget.dataset.mod
    const formField = this.element.find('#term-' + index)
    let termFormula = game.dcc.DiceChain.bumpDie(formField.val(), parseInt(mod))
    if (index > 0) {
      // Add a sign if this isn't the first term in the expression
      termFormula = '+' + termFormula
    }
    formField.val(termFormula)
  }

  /**
   * Modify a Die term (number of dice)
   * @param event {Event}  The originating click event
   * @private
   */
  async _modifyDieCount (event) {
    event.preventDefault()
    const index = event.currentTarget.dataset.term
    const mod = event.currentTarget.dataset.mod
    const term = this.terms[index]
    const formField = this.element.find('#term-' + index)
    let termFormula = game.dcc.DiceChain.bumpDieCount(formField.val(), parseInt(mod), term.maxCount)
    if (index > 0) {
      // Add a sign if this isn't the first term in the expression
      termFormula = '+' + termFormula
    }

    formField.val(termFormula)
  }

  /**
   * Modify a non-Die term
   * @param event {Event}  The originating click event
   * @private
   */
  async _modifyBonus (event) {
    event.preventDefault()
    const index = event.currentTarget.dataset.term
    const mod = event.currentTarget.dataset.mod
    const term = this.terms[index]
    const formField = this.element.find('#term-' + index)
    let termFormula = parseInt(formField.val()) + parseInt(mod)
    if (term.minAmount) {
      termFormula = Math.max(termFormula, parseInt(term.minAmount))
    }
    if (term.maxAmount) {
      termFormula = Math.min(termFormula, parseInt(term.maxAmount))
    }
    termFormula = termFormula.toString()
    if (termFormula[0] !== '-') {
      // Always add a sign
      termFormula = '+' + termFormula
    }
    formField.val(termFormula)
  }

  /**
   * Apply a preset
   * @param event {Event}  The originating click event
   * @private
   */
  async _applyPreset (event) {
    event.preventDefault()
    const index = event.currentTarget.dataset.term
    const formula = event.currentTarget.dataset.formula
    const formField = this.element.find('#term-' + index)
    formField.val(formula)
  }

  /**
   * Modify a spellburn term
   * @param event {Event}  The originating click event
   * @private
   */
  async _modifySpellburn (event) {
    event.preventDefault()
    const index = event.currentTarget.dataset.term
    const mod = parseInt(event.currentTarget.dataset.mod)
    const stat = event.currentTarget.dataset.stat
    const formField = this.element.find('#term-' + index)
    const statField = this.element.find('#' + stat)
    const statMax = parseInt(statField.data('max'))
    const statValue = parseInt(statField.val())
    const newValue = parseInt(formField.val()) + mod
    const newStat = statValue - mod
    if (newStat >= 0 && newStat <= statMax) {
      let termFormula = newValue.toString()
      if (termFormula[0] !== '-') {
        // Always add a sign
        termFormula = '+' + termFormula
      }
      formField.val(termFormula)
      statField.val(newStat)
      this.terms[index][stat] = newStat
    }
  }

  /**
   * Handle a checkbox change event
   * @param event {Event}  The originating click event
   * @private
   */
  async _checkboxChange (event) {
    event.preventDefault()
    const index = event.currentTarget.dataset.term
    const term = this.terms[index]
    const formField = this.element.find('#term-' + index)
    const checked = event.currentTarget.checked
    formField.val(checked ? term.checkedFormula : '+0')
  }

  /**
   * Reset a term
   * @param event {Event}  The originating click event
   * @private
   */
  async _resetTerm (event) {
    event.preventDefault()
    const index = event.currentTarget.dataset.term
    const formField = this.element.find('#term-' + index)
    formField.val(this.terms[index].formula)
  }

  /** @override */
  async close (options = {}) {
    super.close(options)
    this._reject(null)
  }

  /**
   * Construct the terms from an array
   * @param termConstructors {Object}
   * @private
   */
  _constructTermsFromArray (termConstructors) {
    const terms = []

    // Construct and number the terms
    let index = 0
    for (const constructor of termConstructors) {
      const constructedTerms = constructDCCTerm(constructor.type, this.options.rollData, constructor)
      for (const term of constructedTerms) {
        if (term) {
          term.index = index++
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
