/* global CONFIG, game, TokenDocument, canvas, Hooks */

/** Preserve the effective v14 resource choices before enabling a derived Party bar. */
function registerPartyHealthBar () {
  const registry = CONFIG.Actor.trackableAttributes ??= {}
  const models = CONFIG.Actor.dataModels ?? {}
  const types = new Set([...Object.keys(game.model.Actor), ...Object.keys(models)])
  const empty = Object.keys(registry).length === 0
  const choices = new Map()
  for (const type of types) {
    const attributes = TokenDocument.getTrackedAttributes(empty ? (models[type] ?? game.model.Actor[type]) : type)
    choices.set(type, Object.fromEntries(['bar', 'value'].map(key => [key,
      [...new Set(attributes[key].map(path => path.join('.')))]
    ])))
  }
  // Do not mutate until every type's fallback has been captured.
  for (const [type, attributes] of choices) registry[type] ??= attributes
  const party = registry.Party ??= { bar: [], value: [] }
  party.bar = [...new Set([...party.bar, 'aggregate.hp'])]
}

/** Re-prepare cached bar data locally; never write the aggregate back to an Actor. */
function refreshPartyTokens (actor) {
  for (const document of canvas.scene?.tokens ?? []) {
    const party = document.actor
    if (party?.type !== 'Party') continue
    const members = party.flags?.dcc?.partyMembers ?? []
    if (party.id !== actor.id && !members.some(member => member.id === actor.id)) continue
    document.prepareData()
    const object = document.object
    object?.renderFlags.set({ refreshBars: true })
    if (object && canvas.hud?.token?.object === object) canvas.hud.token.render()
  }
}

function onMemberEffectChange (effect) {
  // v14 resets the parent before these document hooks, so HP is prepared.
  // Item-owned effects also contribute to their ancestor Actor.
  let actor = effect.parent
  while (actor && actor.documentName !== 'Actor') actor = actor.parent
  if (actor) refreshPartyTokens(actor)
}

export function registerPartyTokenHooks () {
  Hooks.once('setup', registerPartyHealthBar)
  Hooks.on('updateActor', refreshPartyTokens)
  Hooks.on('deleteActor', refreshPartyTokens)
  for (const hook of ['createActiveEffect', 'updateActiveEffect', 'deleteActiveEffect']) Hooks.on(hook, onMemberEffectChange)
}
