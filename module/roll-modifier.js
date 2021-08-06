/* global CONFIG, FormApplication, game */

class RollModifierDialog extends FormApplication {
  constructor (options = {}) {
    super()
    this.options = options
  }

  static get defaultOptions () {
    const options = super.defaultOptions
    options.id = 'dcc-roll-modifier'
    options.width = 800
    options.height = 400
    options.template = CONFIG.DCC.templates.rollModifiers
    return options
  }

  /*
   * Title
   * @type {string}
   */
  get title () {
    return game.i18n.localize('DCC.DisapprovalRollFormula')
  }

  get roll () {
    return this.options.roll
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
    return data
  }

  /**
   * This method is called upon form submission after form data is validated
   * @param event {Event}       The initial triggering submission event
   * @param formData {Object}   The object of validated form data with which to update the object
   * @private
   */
  async _updateObject (event, formData) {
    event.preventDefault()

    // Set the showWelcomeDialog setting according to the form's checkbox
    game.settings.set('dcc-core-book', 'showWelcomeDialog', !formData['data.doNotShow'])
  }

  /**
   * Handle the XXX button
   * @param event {Event}       The originating click event
   * @private
   */
  async _onClickSomeButton () {
  }
}

async function showRollModifier (roll, options) {
  const html = await renderTemplate(CONFIG.DCC.templates.rollModifiers, {
    roll,
    options
  })
  return new Promise((resolve, reject) => {
    new Dialog({
      title: game.i18n.localize('DCC.DisapprovalRollFormula'),
      content: html,
      buttons: {
        yes: {
          icon: '<i class="fas fa-check"></i>',
          label: game.i18n.localize('DCC.RollModifierRoll'),
          callback: html => {
            const formula = html[0].querySelector('#modify-roll-form')[0].value
            resolve(_modifyRoll(roll, formula))
          }
        },
        no: {
          icon: '<i class="fas fa-times"></i>',
          label: game.i18n.localize('DCC.Cancel'),
          callback: () => {
            resolve(roll)
          }
        }
      },
      close: () => { resolve(roll) }
    }).render(true)
  })
}

function _modifyRoll (roll, formula) {
  return new Roll(formula)
}

export default showRollModifier
