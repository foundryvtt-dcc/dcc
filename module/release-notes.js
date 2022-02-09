/* global game, renderTemplate, ChatMessage */

class ReleaseNotes {
  static async addChatCard () {
    // Render the Release Notes chat message HTML
    const header = game.i18n.format('DCC.ReleaseNotesHeader', {
      version: game.system.data.version
    })
    const message = game.i18n.localize('DCC.ReleaseNotesMessage')
    const html = await (renderTemplate('systems/dcc/templates/chat-card-release-notes.html', {
      header,
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
