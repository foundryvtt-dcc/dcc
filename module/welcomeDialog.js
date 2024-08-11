/* global FormApplication, TextEditor, game */

import { pubConstants } from './settings.js'

class WelcomeDialog extends FormApplication {
  constructor (options = {}) {
    super()
    this._importContentHook = options.importContentHook
  }

  static get defaultOptions () {
    const options = super.defaultOptions
    options.id = `${pubConstants.name}-welcome-dialog`
    options.width = 600
    options.height = 800
    options.template = `${pubConstants.templates}dialog-welcome.html`
    return options
  }

  /* -------------------------------------------- */

  /**
   * Title
   * @type {String}
   */
  get title () {
    return game.i18n.localize(`${pubConstants.langRoot}.Welcome.Title`)
  }

  /* -------------------------------------------- */

  /**
   * Construct and return the data object used to render the HTML template for this form application.
   * @return {Object}
   */
  async getData () {
    const data = {}
    data.user = game.user
    data.copyright = await TextEditor.enrichHTML(game.i18n.localize(`${pubConstants.langRoot}.Welcome.Copyright`))
    data.credits = await TextEditor.enrichHTML(game.i18n.localize(`${pubConstants.langRoot}.Welcome.Credits`))
    data.doNotShow = await TextEditor.enrichHTML(game.i18n.localize(`${pubConstants.langRoot}.Welcome.DoNotShow`))
    data.heading = await TextEditor.enrichHTML(game.i18n.localize(`${pubConstants.langRoot}.Welcome.Heading`))
    data.importContentLabel = await TextEditor.enrichHTML(game.i18n.localize(`${pubConstants.langRoot}.Welcome.ImportContentLabel`))
    data.info = await TextEditor.enrichHTML(game.i18n.localize(`${pubConstants.langRoot}.Welcome.Info`))
    data.logoAlt = await TextEditor.enrichHTML(game.i18n.localize(`${pubConstants.langRoot}.Welcome.LogoAlt`))
    data.logoURL = pubConstants.dccLogoPath
    data.name = pubConstants.name
    data.submitLabel = await TextEditor.enrichHTML(game.i18n.localize(`${pubConstants.langRoot}.Welcome.SubmitLabel`))
    return data
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners (html) {
    super.activateListeners(html)

    html.find('button.import-content').click(this._onImportContent.bind(this))
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
    game.settings.set(pubConstants.name, 'showWelcomeDialog', !formData['data.doNotShow'])
  }

  async _onImportContent () {
    // Did the user ask to import content?
    if (this._importContentHook) {
      this._importContentHook()
    }
  }
}

export default WelcomeDialog
