/* global Dialog, game, expandObject ui, $ */

import DCCActor from './actor.js'
import parsePC from './pc-parser.js'
import parseNPC from './npc-parser.js'

/**
 * Hook to create the Actor Directory buttons for quick import
 * @param {object} app
 * @param {object}   html
 * @return {Promise}
 */
function onRenderActorDirectory (app, html) {
  if (!game.user.isGM) {
    return
  }
  const playerButton = $(`<button class="create-actor-player"><i class="fas fa-user"></i> ${game.i18n.localize('DCC.ActorImportPlayer')}</button>`)
  const npcButton = $(`<button class="create-actor-npc"><i class="fas fa-user"></i> ${game.i18n.localize('DCC.ActorImportNPC')}</button>`)
  playerButton.on('click', () => {
    _onImportActor('Player')
  })
  npcButton.on('click', () => {
    _onImportActor('NPC')
  })
  let footer = html.find('.directory-footer')
  if (footer.length === 0) {
    footer = $('<footer class="directory-footer"></footer>')
    html.append(footer)
  }
  footer.append(playerButton)
  footer.append(npcButton)
}

/**
 * Import actor dialog
 * @param {string} type - Player or NPC entity?
 * @return {Promise}
 */
function _onImportActor (type) {
  const psgLinkHtml = (type === 'Player') ? `<p><a href="https://purplesorcerer.com/create.php?oc=rulebook&mode=3d6&stats=&abLow=Any&abHigh=Any&hp=normal&at=toggle&display=text&sc=4">${game.i18n.localize('DCC.PurpleSorcererPCLink')}</a></p>` : ''
  const html = `<form id="stat-block-form">
                  ${psgLinkHtml}
                  <textarea name="statblock"></textarea>
                </form>`
  new Dialog({
    title: game.i18n.localize('DCC.PasteBlock'),
    content: html,
    buttons: {
      yes: {
        icon: '<i class="fas fa-check"></i>',
        label: 'Import Stats',
        callback: (html) => {
          const actorData = html[0].querySelector('#stat-block-form')[0].value
          _createActor(type, actorData)
        }
      },
      no: {
        icon: '<i class="fas fa-times"></i>',
        label: 'Cancel'
      }
    }
  }).render(true)
}

/**
 * Create and import an actor from PSG text, JSON, or a DCC statline
 * @param {string} type      - Player or NPC entity?
 * @param {string} actorData - Actor data (PSG text or JSON for Players, or a DCC statline for NPCs)
 * @return {Promise}
 */
async function _createActor (type, actorData) {
  // Process the statblock
  let parsedCharacter
  try {
    parsedCharacter = (type === 'Player') ? parsePC(actorData) : parseNPC(actorData)
  } catch (e) {
    if (type === 'Player') {
      return ui.notifications.warn(game.i18n.localize('DCC.ParsePlayerWarning'))
    } else {
      return ui.notifications.warn(game.i18n.localize('DCC.ParseNPCWarning'))
    }
  }

  // Separate out owned items
  const items = parsedCharacter.items
  delete parsedCharacter.items

  // Figure out the name
  let name = game.i18n.format('DCC.NewActorName', { type })
  const nameParts = []
  // If there's a name (from NPCs or Player imports with a name added) then use it
  if (parsedCharacter.name) {
    name = parsedCharacter.name
  } else {
    // Otherwise combine the occupation and class if available to come up with something descriptive
    if (parsedCharacter['data.details.occupation.value']) {
      nameParts.push(parsedCharacter['data.details.occupation.value'])
    }
    if (parsedCharacter['data.class.className']) {
      nameParts.push(parsedCharacter['data.class.className'])
    }
    name = nameParts.join(' ')
  }

  // Create the actor
  await DCCActor.create({
    name,
    type,
    data: expandObject(parsedCharacter).data,
    items
  })
}

export default { onRenderActorDirectory }
