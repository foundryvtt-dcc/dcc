/* global CONFIG, FormApplication, game */

let index = 0

class RollModifierDialog extends FormApplication {
  static instanceId = 0

  constructor (resolve, reject, roll, options = {}) {
    super()
    this._roll = roll
    this._resolve = resolve
    this._reject = reject
    Object.assign(this.options, options)
  }

  static get defaultOptions () {
    const options = super.defaultOptions
    options.id = `dcc-roll-modifier-${RollModifierDialog.instanceId++}`
    options.width = 600
    options.height = 250
    options.template = CONFIG.DCC.templates.rollModifierDialog
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
   * The roll object being edited
   * @type {Roll}
   */
  get roll () {
    return this._roll
  }

  /* -------------------------------------------- */

  /**
   * Construct and return the data object used to render the HTML template for this form application.
   * @return {Object}
   */
  getData () {
    const data = {}
    data.user = game.user
    data.roll = this.roll
    data.options = this.options
    data.terms = this._extractTerms(this.roll)
    return data
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners (html) {
    super.activateListeners(html)

    html.find('button.cancel').click(this._onCancel.bind(this))
    html.find('button.dice-chain').click(this._modifyDie.bind(this))
    html.find('button.bonus').click(this._modifyBonus.bind(this))
  }

  /**
   * This method is called upon form submission after form data is validated
   * @param event {Event}       The initial triggering submission event
   * @param formData {Object}   The object of validated form data with which to update the object
   * @private
   */
  async _updateObject (event, formData) {
    event.preventDefault()

    // Build a new roll from the collected terms
    let formula = ''
    this.element.find('input.term-field').each((index, element) => {
      formula += element.value
    })
    this._roll = new Roll(formula)

    // Need to wait for this to close to prevent overlapping instances
    await super.close()

    this._resolve(this.roll)
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
   * Modify a Die term
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
   * Modify a non-Die term
   * @param event {Event}  The originating click event
   * @private
   */
  async _modifyBonus (event) {
    event.preventDefault()
    const index = event.currentTarget.dataset.term
    const mod = event.currentTarget.dataset.mod
    const formField = this.element.find('#term-' + index)
    let termFormula = (parseInt(formField.val()) + parseInt(mod)).toString()
    if (termFormula[0] !== '-') {
      // Always add a sign
      termFormula = '+' + termFormula
    }
    formField.val(termFormula)
  }

  /** @override */
  async close (options = {}) {
    super.close(options)
    this._reject(null)
  }

  /**
   * Extract the terms from a roll into Dice and Modifiers and add any extra terms
   * @private
   */
  _extractTerms () {
    // State
    const terms = []
    const validNumber = /[+-]*\d+/
    let termAccumulator = ''
    let index = 0
    let anyModifierTerms = false

    // Helper functions
    var addDieTerm = function (term) {
      terms.push({
        type: 'Die',
        label: game.i18n.localize('DCC.RollModifierDieTerm'),
        partial: 'systems/dcc/templates/roll-modifier-partial-die.html',
        index: index++,
        formula: term.formula.replace(' ', '')
      })
      termAccumulator = ''
    }
    var addModifierTerm = function () {
      // Remove duplicate operator terms and other unexpected things
      if (termAccumulator.match(validNumber)) {
        terms.push({
          type: 'Modifiers',
          label: game.i18n.localize('DCC.RollModifierModifierTerm'),
          partial: 'systems/dcc/templates/roll-modifier-partial-modifiers.html',
          index: index++,
          formula: termAccumulator.replace(/\+\+/g, '+').replace(/--/g, '+').replace(/\+-/g, '-').replace(/-\+/g, '-')
        })
        anyModifierTerms = true
      }
      termAccumulator = ''
    }
    var addCustomTerm = function (data) {
      terms.push(Object.assign(data, {
        index: index++
      }))
      termAccumulator = ''
    }
    var accumulateTerm = function (term) {
      termAccumulator += term.formula.replace(/\s+/g, '')
    }
  
    // Extract terms from the Roll
    for (const term of this.roll.terms) {
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

    // Add any extra terms from the options
    if (this.options.extraTerms) {
      for (const key in this.options.extraTerms) {
        addCustomTerm(this.options.extraTerms[key])
      }
    }

    return terms
  }
}

async function showRollModifier (roll, options) {
  return new Promise((resolve, reject) => {
    new RollModifierDialog(resolve, reject, roll, options).render(true)
  })
}

export default showRollModifier
