/* global CONFIG, game, TokenDocument, canvas, Hooks, foundry */

/** Session-local safety latch for incomplete rollbacks; not a recovery mechanism. */
export const blockedPartyIds = new Set()

/** All started, still-present encounters in the supplied scene, not just the active tracker. */
export function isTokenInRunningCombat (token, scene) {
  return [...(game.combats ?? [])].some(combat => combat.scene?.id === scene.id && combat.started && !combat.ended &&
    [...combat.combatants].some(combatant => combatant.tokenId === token.id))
}

/** Resolve documents in the explicit scene. A foreign-only selection is never a fallback to all. */
export function resolveGatherTokens (party, scene, selection = []) {
  const members = new Set((party.flags?.dcc?.partyMembers ?? []).map(member => member.id))
  const selected = selection.length
    ? new Set(selection.map(token => {
      const document = token.document ?? token
      return document.parent?.id === scene.id ? document.id : null
    }))
    : null
  return [...scene.tokens].filter(token => (!selected || selected.has(token.id)) && token.actorLink &&
    members.has(token.actorId) && !isTokenInRunningCombat(token, scene))
}

/** Preserve ambiguity for the caller's chooser instead of silently picking a Party. */
export function findPartyCandidates (scene, selection) {
  return [...game.actors].filter(party => party.type === 'Party' && resolveGatherTokens(party, scene, selection).length)
}

/** Sheet gathering may use one member; the future multi-token HUD requires two. */
export function isGatherHudEligible (party, scene, selection) {
  return selection.length >= 2 && resolveGatherTokens(party, scene, selection).length >= 2
}

function assertPartyAvailable (party) {
  if (blockedPartyIds.has(party.id)) throw new Error('party-blocked')
}

function assertNoOpenSnapshot (party) {
  if (party.flags?.dcc?.partyTokenSnapshots != null) throw new Error('snapshot-open')
}

/** Match the world actor ID, never a synthetic actor's flags, and inspect all scene levels. */
function resolvePartyToken (party, scene, partyTokenId) {
  const tokens = [...scene.tokens].filter(token => token.actorId === party.id)
  if (tokens.some(token => !token.actorLink)) throw new Error('unlinked-party-token')
  let token
  if (partyTokenId != null) {
    token = tokens.find(token => token.id === partyTokenId)
    if (!token) throw new Error('missing-party-token')
  } else {
    if (tokens.length > 1) throw new Error('ambiguous-party-token')
    token = tokens[0] ?? null
  }
  if (token && isTokenInRunningCombat(token, scene)) throw new Error('party-token-in-combat')
  return token
}

/** Read-only preflight. Call again immediately before future gather mutations. */
export function resolveGatherContext (party, scene, { selection = [], levelId, partyTokenId } = {}) {
  assertPartyAvailable(party)
  assertNoOpenSnapshot(party)
  const partyToken = resolvePartyToken(party, scene, partyTokenId)
  const tokens = resolveGatherTokens(party, scene, selection)
  if (!scene.levels.has(levelId) || tokens.some(token => token.level !== levelId) ||
    (partyToken && partyToken.level !== levelId)) throw new Error('invalid-gather-level')
  if (!partyToken && !party.prototypeToken.actorLink) throw new Error('unlinked-party-prototype')
  return { tokens, partyToken }
}

/** Build the flag payload only; persistence and token deletion belong to the gather task. */
export function createPartyTokenSnapshot (party, scene, tokens) {
  assertPartyAvailable(party)
  assertNoOpenSnapshot(party)
  return { sceneId: scene.id, members: tokens.map(token => ({ actorId: token.actorId, tokenData: token.toObject() })) }
}

/** Internal workflow only. Persistence is confirmed from documents, not API promises alone. */
export async function gatherPartyTokens ({ party, scene, levelId, tokenIds = [], partyTokenId }) {
  let context
  try {
    if (party?.isToken || party?.pack) throw new Error('invalid-party')
    party = game.actors.get(party?.id)
    scene = game.scenes.get(scene?.id)
    if (party?.type !== 'Party') throw new Error('invalid-party')
    if (!scene) throw new Error('missing-scene')
    // Keep missing selected IDs in the selection: never fall back to all members.
    const selection = tokenIds.map(id => ({ id, parent: scene }))
    context = resolveGatherContext(party, scene, { selection, levelId, partyTokenId })
  } catch (error) {
    error.code ??= error.message
    throw error
  }
  const { tokens } = context
  const members = new Set((party.flags?.dcc?.partyMembers ?? []).map(member => member.id))
  const skippedCombatTokenIds = [...scene.tokens].filter(token => token.actorLink && members.has(token.actorId) &&
    (!tokenIds.length || tokenIds.includes(token.id)) && isTokenInRunningCombat(token, scene)).map(token => token.id)
  if (!tokens.length) return { gathered: 0, skippedCombatTokenIds }

  const snapshot = createPartyTokenSnapshot(party, scene, tokens)
  const originalIds = tokens.map(token => token.id)
  const newPartyIds = []
  let uncertainPartyCreation = false
  let confirmedSave = false
  let memberDeleteStarted = false
  let code = 'snapshot-save-failed'
  try {
    await party.setFlag('dcc', 'partyTokenSnapshots', snapshot)
    if (!foundry.utils.equals(party.getFlag('dcc', 'partyTokenSnapshots'), snapshot)) throw new Error(code)
    confirmedSave = true

    let partyToken = context.partyToken
    if (!partyToken) {
      code = 'party-create-failed'
      const centers = tokens.map(token => token.getCenterPoint())
      const center = centers.reduce((sum, point) => ({ x: sum.x + point.x / tokens.length, y: sum.y + point.y / tokens.length }), { x: 0, y: 0 })
      const document = await party.getTokenDocument({ ...center, level: levelId }, { parent: scene })
      if (!document.actorLink || document.actorId !== party.id) throw new Error(code)
      const pivot = document.getCenterPoint({ x: 0, y: 0 })
      document.updateSource(document.getSnappedPosition({ x: center.x - pivot.x, y: center.y - pivot.y }))
      const before = new Set([...scene.tokens].map(token => token.id))
      let created
      try {
        created = await scene.createEmbeddedDocuments('Token', [document.toObject()])
      } finally {
        // Only returned documents establish ownership. Even a unique scene
        // addition could belong to another caller while our creation aborted.
        const returnedIds = new Set((created ?? []).map(token => token.id))
        const additions = [...scene.tokens].filter(token => !before.has(token.id))
        const candidates = additions.filter(token => token.actorId === party.id)
        if (returnedIds.size) newPartyIds.push(...additions.filter(token => returnedIds.has(token.id)).map(token => token.id))
        else if (candidates.length) uncertainPartyCreation = true
      }
      partyToken = created?.length === 1 ? scene.tokens.get(created[0]?.id) : null
      if (!partyToken?.actorLink || partyToken.actorId !== party.id || partyToken.level !== levelId ||
        newPartyIds.length !== 1 || newPartyIds[0] !== partyToken.id) throw new Error(code)
    }
    // No original can be removed until both the snapshot and replacement exist.
    code = 'gather-context-changed'
    const currentTokens = resolveGatherTokens(party, scene, tokenIds.map(id => ({ id, parent: scene })))
    if (currentTokens.length !== tokens.length || currentTokens.some(token => !originalIds.includes(token.id)) ||
      snapshot.members.some(member => !foundry.utils.equals(scene.tokens.get(member.tokenData._id)?.toObject(), member.tokenData)) ||
      !foundry.utils.equals(party.getFlag('dcc', 'partyTokenSnapshots'), snapshot)) throw new Error(code)
    if (resolvePartyToken(party, scene, partyToken.id) !== partyToken || partyToken.level !== levelId) throw new Error(code)
    code = 'member-delete-failed'
    if (!scene.tokens.get(partyToken.id)?.actorLink) throw new Error(code)
    memberDeleteStarted = true
    await scene.deleteEmbeddedDocuments('Token', originalIds)
    const replacement = scene.tokens.get(partyToken.id)
    if (originalIds.some(id => scene.tokens.has(id)) || !replacement?.actorLink || replacement.actorId !== party.id ||
      !foundry.utils.equals(party.getFlag('dcc', 'partyTokenSnapshots'), snapshot)) throw new Error(code)
    return { gathered: tokens.length, partyTokenId: partyToken.id, skippedCombatTokenIds }
  } catch (cause) {
    const rollbackIssues = uncertainPartyCreation ? ['party-create-uncertain'] : []
    // Restore only missing originals, with their full sources and original IDs.
    // A rejected operation may still have applied; verify stored data afterwards.
    if (confirmedSave && (memberDeleteStarted || originalIds.some(id => !scene.tokens.has(id)))) {
      const missing = snapshot.members.filter(member => !scene.tokens.has(member.tokenData._id))
      if (missing.length) {
        try {
          await scene.createEmbeddedDocuments('Token', missing.map(member => member.tokenData), { keepId: true })
        } catch (_) { /* Verification below decides whether restoration is certain. */ }
      }
      if (snapshot.members.some(member => !foundry.utils.equals(scene.tokens.get(member.tokenData._id)?.toObject(), member.tokenData))) {
        rollbackIssues.push('original-restore-failed')
      }
    }
    // Never remove the replacement while any original's restoration is unclear.
    if (!rollbackIssues.length && newPartyIds.length) {
      const remainingIds = newPartyIds.filter(id => scene.tokens.has(id))
      try {
        if (remainingIds.length) await scene.deleteEmbeddedDocuments('Token', remainingIds)
      } catch (_) { rollbackIssues.push('party-delete-failed') }
      if (newPartyIds.some(id => scene.tokens.has(id)) && !rollbackIssues.length) rollbackIssues.push('party-delete-failed')
    }
    // Only discard our provisional flag after every token change is undone.
    if (!rollbackIssues.length) {
      try {
        const saved = party.getFlag('dcc', 'partyTokenSnapshots')
        if (foundry.utils.equals(saved, snapshot)) await party.unsetFlag('dcc', 'partyTokenSnapshots')
        if (party.getFlag('dcc', 'partyTokenSnapshots') != null) rollbackIssues.push('snapshot-clear-failed')
      } catch (_) { rollbackIssues.push('snapshot-clear-failed') }
    }
    if (rollbackIssues.length) blockedPartyIds.add(party.id)
    throw Object.assign(new Error(code, { cause }), {
      code, rollbackComplete: !rollbackIssues.length, rollbackIssues, severity: rollbackIssues.length ? 'error' : 'warning'
    })
  }
}

/** Validate every source ID before filtering departed/invalid members or doing any writes. */
export function resolveDeployContext (party, scene, { partyTokenId } = {}) {
  assertPartyAvailable(party)
  const snapshot = party.flags?.dcc?.partyTokenSnapshots
  if (!snapshot) throw new Error('missing-snapshot')
  const sourceScene = game.scenes.get(snapshot.sceneId)
  if (!sourceScene) throw new Error('missing-source-scene')
  for (const member of snapshot.members) {
    const id = member.tokenData?._id
    if (typeof id !== 'string' || !/^[A-Za-z0-9]{16}$/.test(id)) throw new Error('invalid-snapshot-token-id')
  }
  if (snapshot.members.some(member => sourceScene.tokens.has(member.tokenData._id))) throw new Error('original-token-exists')
  const partyToken = resolvePartyToken(party, scene, partyTokenId)
  if (!partyToken) throw new Error('missing-party-token')
  return { sourceScene, snapshot, partyToken }
}

/*
 * Square spiral adapted from nimble-party/src/groups.ts (spiralOffsets).
 * https://github.com/Vass1979/nimble-party/tree/Vass1979
 * MIT License — Copyright (c) 2026 Vass
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
function * spiralOffsets () {
  // Skip the center. Each edge includes exactly one corner, with no ring limit.
  for (let ring = 1; ; ring++) {
    for (let row = -ring + 1; row <= ring; row++) yield { col: ring, row }
    for (let col = ring - 1; col >= -ring; col--) yield { col, row: ring }
    for (let row = ring - 1; row >= -ring; row--) yield { col: -ring, row }
    for (let col = -ring + 1; col <= ring; col++) yield { col, row: -ring }
  }
}

/** Simple square spiral, spaced for the largest member; no walls or token packing. */
export function computeDeployPlacements (scene, center, tokenData) {
  if (!tokenData.length) return []
  const documents = tokenData.map(data => new TokenDocument(data, { parent: scene }))
  const grid = scene.grid
  const sizes = documents.map(document => document.getSize())
  // Hex snapping can move either neighbor: leave two cells of slack. Square
  // cell multiples already have consistent snapping; gridless does not snap.
  const padding = grid.isHexagonal ? 2 : 0
  const stepX = (Math.ceil(Math.max(grid.sizeX, ...sizes.map(size => size.width)) / grid.sizeX) + padding) * grid.sizeX
  const stepY = (Math.ceil(Math.max(grid.sizeY, ...sizes.map(size => size.height)) / grid.sizeY) + padding) * grid.sizeY
  const offsets = spiralOffsets()
  return documents.map(document => {
    const { col, row } = offsets.next().value
    const pivot = document.getCenterPoint({ x: 0, y: 0 })
    const { x, y } = document.getSnappedPosition({ x: center.x + col * stepX - pivot.x, y: center.y + row * stepY - pivot.y })
    return { x, y }
  })
}

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
    // Reinitialize from source before preparation: prepareData alone reapplies
    // additive Token ActiveEffects to their already-modified values in v14.
    document.reset()
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
