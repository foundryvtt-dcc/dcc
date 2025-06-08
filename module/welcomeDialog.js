/* global FormApplication, TextEditor, game */

import { pubConstants } from './settings.js'

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api
const { TextEditor } = foundry.applications.ux
const { ApplicationTabsConfiguration } = foundry.applications.types

class WelcomeDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor (options = {}) {
    super()
    this._importContentHook = options.importContentHook
  }

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    id: `${pubConstants.name}-welcome-dialog`,
    classes: ['dcc', 'welcome-dialog', 'themed', 'theme-light'],
    tag: "aside",
    position: {
      width: 600,
      height: "auto"
    },
    window: {
      resizable: true,
      minimizable: false
    },
    actions: {
      importContent: this.#importContent,
      doNotShow: this.#doNotShow
    }
  }

  static PARTS = {
    content: {
      template: `${pubConstants.templates}dialog-welcome.html`,
      scrollable: [''],
    }
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
  async _prepareContext (options = {}) {
    const data = {}
    data.user = game.user
    data.closeLabel = await TextEditor.enrichHTML(game.i18n.localize(`${pubConstants.langRoot}.Welcome.CloseLabel`))
    data.copyright = await TextEditor.enrichHTML(game.i18n.localize(`${pubConstants.langRoot}.Welcome.Copyright`))
    data.credits = await TextEditor.enrichHTML(game.i18n.localize(`${pubConstants.langRoot}.Welcome.Credits`))
    data.heading = await TextEditor.enrichHTML(game.i18n.localize(`${pubConstants.langRoot}.Welcome.Heading`))
    data.importContentLabel = await TextEditor.enrichHTML(game.i18n.localize(`${pubConstants.langRoot}.Welcome.ImportContentLabel`))
    data.info = await TextEditor.enrichHTML(game.i18n.localize(`${pubConstants.langRoot}.Welcome.Info`))
    data.logoAlt = await TextEditor.enrichHTML(game.i18n.localize(`${pubConstants.langRoot}.Welcome.LogoAlt`))
    data.logoURL = pubConstants.dccLogoPath
    data.name = pubConstants.name
    data.showWelcomeDialog = game.settings.get(pubConstants.name, 'showWelcomeDialog')
    data.showWelcomeDialogLabel = await TextEditor.enrichHTML(game.i18n.localize(`${pubConstants.langRoot}.Welcome.ShowWelcomeDialogLabel`))
    data.showWelcomeDialogHint = await TextEditor.enrichHTML(game.i18n.localize(`${pubConstants.langRoot}.Welcome.ShowWelcomeDialogHint`))
    data.submitLabel = await TextEditor.enrichHTML(game.i18n.localize(`${pubConstants.langRoot}.Welcome.SubmitLabel`))
    return data
  }

  /* -------------------------------------------- */

  /**
   * Handle the do not show checkbox
   * @this {WelcomeDialog}
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @returns {Promise<void>}
   */
  static async #doNotShow (event, target) {
    game.settings.set(pubConstants.name, 'showWelcomeDialog', target.checked)
  }

  /**
   * Handle the import content button
   * @this {WelcomeDialog}
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @returns {Promise<void>}
   */
  static async #importContent (event, target) {
    // Did the user ask to import content?
    if (this._importContentHook) {
      this._importContentHook()
    }
  }
}

export default WelcomeDialog
