/* global game, renderTemplate, ChatMessage */

const {renderTemplate} = foundry.applications.handlebars

class ReleaseNotes {
  static async addChatCard () {
    const message = game.i18n.localize('DCC.ReleaseNotesMessage')
    const html = await (renderTemplate('systems/dcc/templates/chat-card-release-notes.html', {
      message
    }))
    // Add the message
    ChatMessage.create({
      whisper: [game.user.id],
      content: html
    })
  }
}

export default ReleaseNotes
