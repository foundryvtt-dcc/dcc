/* global CONFIG, FormApplication, game */

class RollModifierDialog extends FormApplication {
  constructor (resolve, reject, roll, options = {}) {
    super()
    this._roll = roll
    this._resolve = resolve
    this._reject = reject
    Object.assign(this.options, options)
  }

  static get defaultOptions () {
    const options = super.defaultOptions
    options.id = 'dcc-roll-modifier'
    options.width = 400
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
    const formula = ''
    this.element.find('input.term-field').each((index, element) => {
      formula += element.val()
    })
    this._roll = new Roll(formula)

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
    const termFormula = formField.val()
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
    let termFormula = formField.val()
    termFormula = (parseInt(termFormula) + parseInt(mod)).toString()
    if (termFormula[0] !== '-') {
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
    let termAccumulator = ''
    let lastTerm = null
    let index = 0

    // Helper functions
    var addDieTerm = function (term) {
      terms.push({
        type: 'Die',
        label: term.options.flavor || game.i18n.localize('DCC.RollModifierDieTerm'),
        index: index++,
        isDie: true,
        formula: term.formula.replace(' ', '')
      })
      termAccumulator = ''
    }
    var addModifierTerm = function (term) {
      terms.push({
        type: 'Modifiers',
        label: term.options.flavor || game.i18n.localize('DCC.RollModifierModifierTerm'),
        index: index++,
        isDie: false,
        formula: termAccumulator.replace(/\+\+/g, '+').replace(/--/g, '+').replace(/\+-/g, '-').replace(/-\+/g, '-')
      })
      termAccumulator = ''
    }
    var accumulateTerm = function (term) {
      termAccumulator += term.formula.replace(/\s+/g, '')
      lastTerm = term
    }
  
    // Extract terms from the Roll
    for (const term of this.roll.terms) {
      if (term instanceof Die) {
        // Isolate Die terms
        if (termAccumulator) {
          addModifierTerm(term)
        }
        addDieTerm(term)
      } else {
        // Accumulate and concatenate non-die terms
        accumulateTerm(term)
      }
    }
    if (termAccumulator) {
      // Mop up any remaining modifiers
      addModifierTerm(lastTerm)
    }

    // Add any extra terms from the options
    if (this.options.extraTerms) {
      for (const key in this.options.extraTerms) {
        const term = this.options.extraTerms[key]
        terms.push(Object.assign(term, {
          index: index++
        }))
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
