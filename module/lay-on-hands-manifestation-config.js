/* global game, CONFIG, foundry */

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api
const { TextEditor } = foundry.applications.ux

/**
 * Editor dialog for the Lay on Hands Spell Manifestation (#426).
 *
 * Lay on Hands is a built-in cleric ability (an actor skill at
 * `system.skills.layOnHands`), not a spell item, so it has no item sheet
 * tab to hold a manifestation. This small ApplicationV2 form provides the
 * same editor surface (roll value + display-in-chat + rich-text
 * description) the spell item's Manifestation tab offers, writing back to
 * `system.skills.layOnHands.manifestation`.
 */
class LayOnHandsManifestationConfig extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    id: 'lay-on-hands-manifestation-config',
    classes: ['dcc', 'sheet', 'lay-on-hands-manifestation-config'],
    position: {
      width: 460,
      height: 'fit-content'
    },
    tag: 'form',
    form: {
      handler: LayOnHandsManifestationConfig.#onSubmitForm,
      closeOnSubmit: true
    },
    actor: {
      type: 'Player'
    },
    window: {
      resizable: true,
      title: 'DCC.LayOnHandsManifestationTitle'
    }
  }

  static PARTS = {
    form: {
      template: 'systems/dcc/templates/dialog-lay-on-hands-manifestation.html'
    }
  }

  /* -------------------------------------------- */

  /**
   * Construct and return the data object used to render the HTML template.
   * @return {Object}
   */
  async _prepareContext (options = {}) {
    const context = await super._prepareContext(options)
    const actor = this.options.document
    context.actor = actor
    context.system = actor.system
    context.user = game.user
    context.config = CONFIG.DCC
    context.editable = actor.isOwner
    context.manifestationHTML = await TextEditor.enrichHTML(
      actor.system?.skills?.layOnHands?.manifestation?.description || '',
      { relativeTo: actor, secrets: actor.isOwner }
    )
    return context
  }

  /* -------------------------------------------- */

  /**
   * Called upon form submission after form data is validated.
   * @param event {Event}              The triggering submission event
   * @param form {HTMLFormElement}     The submitted HTML form element
   * @param formData {FormDataExtended}  The validated form data
   */
  static async #onSubmitForm (event, form, formData) {
    event.preventDefault()
    await this.options.document.update(formData.object)
    // Re-draw the updated sheet
    await this.options.document.sheet.render(true)
  }
}

export default LayOnHandsManifestationConfig
