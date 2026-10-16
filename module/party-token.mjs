/* global CONFIG, game, TokenDocument, canvas, Hooks, foundry, ui, document */

import { executeAsGM, registerSocketHandler } from './socket.mjs'

/** Session-local latch, lost on reload. Unattributed fresh-ID Tokens need manual inspection. */
export const blockedPartyIds = new Set()

// One productive entry for every Party, held until workflow rollback has settled.
// Overlapping requests are dropped, never queued against a stale snapshot.
let inFlight = false

// A future core template/class rename must not silently drop the HUD control.
let warnedMissingHudColumn = false

async function onPartyTokenAction (payload, senderId) {
  if (!game.users.get(senderId)?.isGM) throw Object.assign(new Error('unauthorized'), { code: 'unauthorized' })
  if (inFlight) return
  inFlight = true
  try {
    const isId = value => typeof value === 'string' && value.length > 0
    if (!payload || !['gather', 'deploy'].includes(payload.action) ||
      !isId(payload.partyId) || !isId(payload.sceneId) ||
      (payload.partyTokenId !== undefined && !isId(payload.partyTokenId))) throw new Error('invalid-request')
    const { action, partyId, sceneId, levelId, tokenIds, partyTokenId } = payload
    if (action === 'gather' && (!isId(levelId) || !Array.isArray(tokenIds) || !tokenIds.every(isId))) throw new Error('invalid-request')
    if (action === 'deploy' && !isId(partyTokenId)) throw new Error('missing-party-token-id')
    const party = game.actors.get(partyId)
    const scene = game.scenes.get(sceneId)
    if (party?.type !== 'Party' || party.isToken || party.pack) throw new Error('invalid-party')
    if (!scene) throw new Error('missing-scene')
    // Only document IDs cross the boundary: no client snapshots, stats or canvas fallback.
    return await (action === 'gather'
      ? gatherPartyTokens({ party, scene, levelId, tokenIds, partyTokenId })
      : deployPartyTokens({ party, scene, partyTokenId }))
  } finally {
    inFlight = false
  }
}

/** Internal ready registration; intentionally not exposed on game.dcc. */
export function registerPartyTokenSocket () {
  registerSocketHandler('partyTokenAction', async (payload, senderId) => {
    // Socket event emitters ignore promises: contain every Party failure here,
    // including authorization before the workflow acquires its lock.
    try {
      const result = await onPartyTokenAction(payload, senderId)
      notifyPartyTokenResult(result)
      return result
    } catch (error) {
      notifyPartyTokenError(error)
      return { error: { ...error, code: error.code ?? error.message } }
    }
  })
}

/** Same socket/lock path for every UI caller. Local failures return { error: { code, ... } }; remote calls are fire-and-forget. */
export function requestPartyTokenAction (payload) {
  return executeAsGM('partyTokenAction', payload)
}

const partyTokenErrors = {
  unauthorized: 'Unauthorized',
  'invalid-request': 'InvalidRequest',
  'invalid-party': 'InvalidParty',
  'missing-scene': 'MissingScene',
  'missing-party-token-id': 'MissingPartyToken',
  'missing-party-token': 'MissingPartyTokenOnScene',
  'ambiguous-party-token': 'AmbiguousPartyToken',
  'party-token-in-combat': 'PartyInCombat',
  'party-blocked': 'Blocked',
  'snapshot-open': 'SnapshotOpen',
  'missing-snapshot': 'MissingSnapshot',
  'unlinked-party-token': 'UnlinkedToken',
  'unlinked-party-prototype': 'UnlinkedPrototype',
  'invalid-gather-level': 'InvalidGatherLevel',
  'invalid-deploy-level': 'InvalidDeployLevel',
  'missing-source-scene': 'MissingSourceScene',
  'invalid-snapshot-token-id': 'InvalidSnapshot',
  'original-token-exists': 'OriginalsPresent',
  'snapshot-save-failed': 'SnapshotSaveFailed',
  'party-create-failed': 'PartyCreateFailed',
  'gather-context-changed': 'GatherContextChanged',
  'member-delete-failed': 'MemberDeleteFailed',
  'deploy-context-changed': 'DeployContextChanged',
  'member-create-failed': 'MemberCreateFailed',
  'party-delete-failed': 'PartyDeleteFailed',
  'snapshot-clear-failed': 'SnapshotClearFailed'
}

function notifyPartyTokenError (error) {
  const code = error.code ?? error.message
  const key = error.rollbackComplete === false ? 'RollbackFailed' : partyTokenErrors[code]
  if (!key || error.cause || error.rollbackIssues?.length) console.error('DCC | Party token action failed', error)
  ui.notifications?.warn(game.i18n.localize(`DCC.PartyToken${key ?? 'UnexpectedError'}`))
}

function notifyPartyTokenResult (result) {
  if (!result) return
  if (result.gathered) ui.notifications?.info(game.i18n.format('DCC.PartyTokenGathered', { count: result.gathered }))
  if (result.gathered === 0) ui.notifications?.warn(game.i18n.localize('DCC.PartyTokenNoMembers'))
  if (result.skippedCombatTokenIds?.length) ui.notifications?.warn(game.i18n.format('DCC.PartyTokenSkippedCombat', { count: result.skippedCombatTokenIds.length }))
  if (result.deployed) ui.notifications?.info(game.i18n.format('DCC.PartyTokenDeployed', { count: result.deployed }))
  if (result.skipped) ui.notifications?.warn(game.i18n.format('DCC.PartyTokenSkippedMembers', { count: result.skipped }))
}

/** Single source of truth for the toggle state: an open snapshot means "deploy" is pending. */
function hasCollectedMembers (party) {
  return party.flags?.dcc?.partyTokenSnapshots != null
}

/**
 * Derive the neutral control's action on the initiating client.
 *
 * The authoritative state is the snapshot flag plus the presence of this
 * party's tokens on the supplied scene; a party token's visibility is never
 * read. Never throws: ambiguity and a legacy unlinked token are reported by the
 * workflow's existing notices, not by a new chooser here.
 *
 * @returns {'gather'|'deploy'|null} `null` means "nothing to act on": no mutation, only a hint.
 */
export function derivePartyTokenAction (party, scene) {
  try {
    if (hasCollectedMembers(party)) return 'deploy'
    if (resolveGatherTokens(party, scene).length) return 'gather'
    // No member tokens here: a party token turns the click into the prototype
    // deploy path. Any token of this party qualifies (linked or not) so the
    // deploy preflight can report ambiguity or a legacy token unchanged.
    return [...scene.tokens].some(token => token.actorId === party?.id) ? 'deploy' : null
  } catch (_) {
    return null
  }
}

/** Initiator-only controller: freeze the action and selection before any asynchronous work. */
export async function togglePartyTokens ({ party, scene, levelId, selection = [], partyTokenId, action }) {
  try {
    if (!game.user.isGM) throw new Error('unauthorized')
    // Never read or write a legacy token's synthetic Actor snapshot.
    party = game.actors.get(party?.id)
    if (party?.type !== 'Party' || party.isToken || party.pack) throw new Error('invalid-party')
    if (!scene) throw new Error('missing-scene')
    action ??= derivePartyTokenAction(party, scene)
    if (!action) throw new Error('missing-party-token')
    const payload = { action, partyId: party.id, sceneId: scene.id }
    if (action === 'gather') {
      payload.levelId = levelId
      // Keep foreign/combat/stale IDs: only the executing service filters them.
      // A Party token is never a gather candidate, but Foundry leaves a freshly
      // dropped token selected; treating it as an explicit selection would make
      // "Gather" find no members right after placing the party token.
      payload.tokenIds = selection
        .map(token => token.document ?? token)
        .filter(document => document.actorId !== party.id)
        .map(document => document.id)
    }
    if (partyTokenId !== undefined) payload.partyTokenId = partyTokenId
    else {
      const tokens = [...scene.tokens].filter(token => token.actorId === party.id)
      const selected = new Set(selection.map(token => (token.document ?? token).id))
      const contextual = tokens.filter(token => selected.has(token.id))
      const target = contextual.length === 1 ? contextual[0] : tokens.length === 1 ? tokens[0] : null
      if (tokens.length > 1 && !target) throw new Error('ambiguous-party-token')
      if (action === 'deploy' && !target) throw new Error('missing-party-token')
      if (target) payload.partyTokenId = target.id
    }
    return await requestPartyTokenAction(payload)
  } catch (error) {
    notifyPartyTokenError(error)
  }
}

/** v14 ApplicationV2 render hook: HTMLElement, never an AppV1 jQuery wrapper. */
function renderPartyTokenHUD (hud, html) {
  for (const control of html.querySelectorAll('[data-action="partyTokenAction"]')) control.remove()
  if (!game.user.isGM) return
  const token = hud.document ?? hud.object?.document
  const scene = token?.parent
  if (!scene) return
  const actor = game.actors.get(token.actorId)
  const party = actor?.type === 'Party' ? actor : null
  const selection = canvas.tokens?.controlled ?? []
  if (!party && !gatherHudParties(scene, selection, token).length) return
  // The party control is a neutral toggle: the action is decided on click from
  // the snapshot state. Only the member HUD (no resolved Party) means "gather".
  const label = game.i18n.localize(party ? 'DCC.PartyTokenGatherDeploy' : 'DCC.PartyTokenGather')
  const control = document.createElement('button')
  control.type = 'button'
  control.classList.add('control-icon')
  control.dataset.action = 'partyTokenAction'
  control.setAttribute('aria-label', label)
  control.setAttribute('title', label)
  const icon = document.createElement('i')
  icon.classList.add('fas', 'fa-people-group')
  icon.setAttribute('aria-hidden', 'true')
  control.append(icon)
  control.addEventListener('click', async event => {
    event.preventDefault()
    event.stopPropagation()
    try {
      // Capture the initiating client's context before opening a chooser.
      const selection = [...(canvas.tokens?.controlled ?? [])]
      const levelId = canvas.level?.id
      if (party) return await togglePartyTokens({ party, scene, levelId, selection, partyTokenId: token.id })
      const candidates = gatherHudParties(scene, selection, token)
      let chosen = candidates[0]
      if (candidates.length > 1) {
        const id = await foundry.applications.api.DialogV2.wait({
          window: { title: game.i18n.localize('DCC.PartyTokenChooseParty') },
          content: `<p>${game.i18n.localize('DCC.PartyTokenChoosePartyHint')}</p>`,
          buttons: candidates.map(candidate => ({ action: candidate.id, label: candidate.name, callback: () => candidate.id })),
          rejectClose: false
        })
        chosen = candidates.find(candidate => candidate.id === id)
      }
      if (chosen) return await togglePartyTokens({ party: chosen, scene, levelId, selection, action: 'gather' })
    } catch (error) {
      notifyPartyTokenError(error)
    }
  })
  const column = html.querySelector('.col.right')
  if (column) column.append(control)
  else {
    if (!warnedMissingHudColumn) {
      warnedMissingHudColumn = true
      console.warn('DCC | Party token HUD control attached to the HUD root: .col.right column not found')
    }
    html.append(control)
  }
}

function gatherHudParties (scene, selection, token) {
  return findPartyCandidates(scene, selection).filter(party => isGatherHudEligible(party, scene, selection) &&
    resolveGatherTokens(party, scene, [token]).length)
}

/** All started, still-present encounters in the supplied scene, not just the active tracker. */
export function isTokenInRunningCombat (token, scene) {
  return [...(game.combats ?? [])].some(combat => combat.scene?.id === scene.id && combat.started &&
    [...combat.combatants].some(combatant => combatant.tokenId === token.id))
}

/** World-actor IDs of the party roster, deduplicated. */
function partyMemberIds (party) {
  return new Set((party.flags?.dcc?.partyMembers ?? []).map(member => member.id))
}

/** Resolve documents in the explicit scene. A foreign-only selection is never a fallback to all. */
export function resolveGatherTokens (party, scene, selection = []) {
  const members = partyMemberIds(party)
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

/** The member HUD control requires two eligible selected members; the sheet may gather a single one. */
export function isGatherHudEligible (party, scene, selection) {
  return selection.length >= 2 && resolveGatherTokens(party, scene, selection).length >= 2
}

function assertPartyAvailable (party) {
  if (blockedPartyIds.has(party.id)) throw new Error('party-blocked')
}

function assertNoOpenSnapshot (party) {
  if (party.flags?.dcc?.partyTokenSnapshots != null) throw new Error('snapshot-open')
}

/** Both workflows run exclusively on a GM client, before any normalization or mutation. */
function requireGM () {
  if (!game.user.isGM) throw Object.assign(new Error('unauthorized'), { code: 'unauthorized' })
}

/** Resolve the world Party actor and its explicit scene, or throw a stable error code. */
function resolveWorldPartyScene (party, scene) {
  if (party?.isToken || party?.pack) throw new Error('invalid-party')
  const worldParty = game.actors.get(party?.id)
  const worldScene = game.scenes.get(scene?.id)
  if (worldParty?.type !== 'Party') throw new Error('invalid-party')
  if (!worldScene) throw new Error('missing-scene')
  return { party: worldParty, scene: worldScene }
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
  requireGM()
  let context
  try {
    const resolved = resolveWorldPartyScene(party, scene)
    party = resolved.party
    scene = resolved.scene
    // Keep missing selected IDs in the selection: never fall back to all members.
    const selection = tokenIds.map(id => ({ id, parent: scene }))
    context = resolveGatherContext(party, scene, { selection, levelId, partyTokenId })
  } catch (error) {
    error.code ??= error.message
    throw error
  }
  const { tokens } = context
  const members = partyMemberIds(party)
  const skippedCombatTokenIds = [...scene.tokens].filter(token => token.actorLink && members.has(token.actorId) &&
    (!tokenIds.length || tokenIds.includes(token.id)) && isTokenInRunningCombat(token, scene)).map(token => token.id)
  if (!tokens.length) return { gathered: 0, skippedCombatTokenIds }

  const snapshot = createPartyTokenSnapshot(party, scene, tokens)
  const originalIds = tokens.map(token => token.id)
  const newPartyMembers = new Map()
  let partyToken = context.partyToken
  let previousPartySource = null
  let uncertainPartyCreation = false
  let confirmedSave = false
  let memberDeleteStarted = false
  let code = 'snapshot-save-failed'
  try {
    await party.setFlag('dcc', 'partyTokenSnapshots', snapshot)
    if (!foundry.utils.equals(party.getFlag('dcc', 'partyTokenSnapshots'), snapshot)) throw new Error(code)
    confirmedSave = true

    // The party token is the party's anchor: a fresh one is created at the
    // members' cluster centre, a reused one is moved there and shown.
    const centers = tokens.map(token => token.getCenterPoint())
    const center = centers.reduce((sum, point) => ({ x: sum.x + point.x / tokens.length, y: sum.y + point.y / tokens.length }), { x: 0, y: 0 })
    if (!partyToken) {
      code = 'party-create-failed'
      const document = await party.getTokenDocument({ ...center, level: levelId }, { parent: scene })
      if (!document.actorLink || document.actorId !== party.id) throw new Error(code)
      const pivot = document.getCenterPoint({ x: 0, y: 0 })
      document.updateSource(document.getSnappedPosition({ x: center.x - pivot.x, y: center.y - pivot.y }))
      document.updateSource({ hidden: false })
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
        if (returnedIds.size) {
          for (const token of additions.filter(token => returnedIds.has(token.id))) newPartyMembers.set(token.id, token)
        } else if (candidates.length) uncertainPartyCreation = true
      }
      partyToken = created?.length === 1 ? scene.tokens.get(created[0]?.id) : null
      if (!partyToken?.actorLink || partyToken.actorId !== party.id || partyToken.level !== levelId ||
        newPartyMembers.size !== 1 || !newPartyMembers.has(partyToken.id)) throw new Error(code)
    } else {
      // Reuse the existing anchor: move it onto the cluster centre with the same
      // centre/snap logic as a fresh creation, and make it visible (travelling).
      code = 'party-create-failed'
      previousPartySource = { x: partyToken.x, y: partyToken.y, hidden: !!partyToken.hidden }
      const pivot = partyToken.getCenterPoint({ x: 0, y: 0 })
      const position = partyToken.getSnappedPosition({ x: center.x - pivot.x, y: center.y - pivot.y })
      // A plain position update runs through v14's animated movement pipeline and
      // does not reliably reach the target. The supported way to relocate the
      // anchor deterministically is the movement API with an explicit `displace`
      // waypoint (a teleport that ignores walls, surfaces and cost).
      await partyToken.move({ ...position, action: 'displace', snapped: true })
      await partyToken.update({ hidden: false })
      const marker = scene.tokens.get(partyToken.id)
      if (marker !== partyToken || marker.x !== position.x || marker.y !== position.y || marker.hidden !== false) throw new Error(code)
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
      if (snapshot.members.some(member => {
        const document = scene.tokens.get(member.tokenData._id)
        return !document || !foundry.utils.equals(comparable(document.toObject()), comparable(member.tokenData))
      })) {
        rollbackIssues.push('original-restore-failed')
      }
    }
    // Never remove the replacement while any original's restoration is unclear.
    // Delete only the document we created: a foreign one may have taken its ID.
    if (!rollbackIssues.length && newPartyMembers.size) {
      const remaining = [...newPartyMembers].filter(([id, document]) => scene.tokens.get(id) === document).map(([id]) => id)
      try {
        if (remaining.length) await scene.deleteEmbeddedDocuments('Token', remaining)
      } catch (_) { rollbackIssues.push('party-delete-failed') }
      if ([...newPartyMembers.keys()].some(id => scene.tokens.has(id)) && !rollbackIssues.length) rollbackIssues.push('party-delete-failed')
    }
    // Undo a reused anchor's move and visibility change. The position needs the
    // movement API; a plain update would be dropped by the movement pipeline.
    if (!rollbackIssues.length && previousPartySource) {
      if (scene.tokens.get(partyToken.id) === partyToken) {
        if (partyToken.x !== previousPartySource.x || partyToken.y !== previousPartySource.y) {
          try {
            await partyToken.move({ x: previousPartySource.x, y: previousPartySource.y, action: 'displace', snapped: true })
          } catch (_) { /* Verified below. */ }
        }
        if (!!partyToken.hidden !== previousPartySource.hidden) {
          try { await partyToken.update({ hidden: previousPartySource.hidden }) } catch (_) { /* Verified below. */ }
        }
      }
      const restored = scene.tokens.get(partyToken.id)
      if (!restored || restored !== partyToken || restored.x !== previousPartySource.x || restored.y !== previousPartySource.y ||
        !!restored.hidden !== previousPartySource.hidden) rollbackIssues.push('party-token-restore-failed')
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
  const sourceScene = assertOriginalTokensAbsent(snapshot)
  if (typeof partyTokenId !== 'string' || !partyTokenId.length) throw new Error('missing-party-token-id')
  const partyToken = resolvePartyToken(party, scene, partyTokenId)
  if (!partyToken) throw new Error('missing-party-token')
  return { sourceScene, snapshot, partyToken }
}

function assertOriginalTokensAbsent (snapshot) {
  const sourceScene = game.scenes.get(snapshot.sceneId)
  if (!sourceScene) throw new Error('missing-source-scene')
  if (!Array.isArray(snapshot.members)) throw new Error('invalid-snapshot-token-id')
  for (const member of snapshot.members) {
    const id = member.tokenData?._id
    if (typeof id !== 'string' || !/^[A-Za-z0-9]{16}$/.test(id)) throw new Error('invalid-snapshot-token-id')
  }
  if (snapshot.members.some(member => sourceScene.tokens.has(member.tokenData._id))) throw new Error('original-token-exists')
  return sourceScene
}

/** Foundry resets movement history and recalculates regions when creating a Token. */
function comparable (data) {
  const copy = structuredClone(data)
  delete copy._movementHistory
  delete copy._regions
  return copy
}

function sameTokenSource (document, source) {
  if (!document) return false
  if (['actorId', 'actorLink', 'level'].some(key => document[key] !== source[key])) return false
  return foundry.utils.equals(comparable(document.toObject()), comparable(source))
}

function currentDeployMembers (party, snapshot) {
  const roster = partyMemberIds(party)
  return snapshot.members.filter(member => roster.has(member.actorId) && game.actors.has(member.actorId))
}

/** Internal, document-only workflow. No canvas, socket, persisted journal or reload recovery. */
export async function deployPartyTokens ({ party, scene, partyTokenId }) {
  requireGM()
  let context
  try {
    const resolved = resolveWorldPartyScene(party, scene)
    party = resolved.party
    scene = resolved.scene
    context = resolveDeployContext(party, scene, { partyTokenId })
    if (!scene.levels.has(context.partyToken.level)) throw new Error('invalid-deploy-level')
  } catch (error) {
    error.code ??= error.message
    throw error
  }

  const snapshot = structuredClone(context.snapshot)
  const originalParty = context.partyToken
  const partySource = structuredClone(originalParty.toObject())
  // The deployed marker stays on the scene, hidden: the same party token is the
  // party's anchor while its members are placed around it.
  const markerSource = { ...structuredClone(partySource), hidden: true }
  const members = currentDeployMembers(party, snapshot)
  const skippedMemberIds = snapshot.members.filter(member => !members.includes(member)).map(member => member.actorId)
  const result = { deployed: members.length, skipped: skippedMemberIds.length, skippedMemberIds }
  const payloads = members.map(member => {
    const data = structuredClone(member.tokenData)
    delete data._id
    data.level = originalParty.level
    return data
  })
  const placements = computeDeployPlacements(scene, originalParty.getCenterPoint(), payloads)
  for (const [i, data] of payloads.entries()) {
    Object.assign(data, placements[i])
    // Foundry does not guarantee that created documents come back in the order
    // they were passed. Assign the fresh IDs ourselves and create with keepId
    // so each created Token stays mapped to its own payload.
    data._id = foundry.utils.randomID()
  }
  const expectedPayloads = structuredClone(payloads)
  const ownMembers = new Map()
  let uncertainCreation = false
  let markerHidden = false
  let code = 'deploy-context-changed'

  const assertContext = (withParty = true, expectedPartySource = partySource) => {
    assertPartyAvailable(party)
    if (party.type !== 'Party' || party.isToken || party.pack ||
      game.actors.get(party.id) !== party || game.scenes.get(scene.id) !== scene ||
      !foundry.utils.equals(party.getFlag('dcc', 'partyTokenSnapshots'), snapshot) ||
      !foundry.utils.equals(currentDeployMembers(party, snapshot), members)) throw new Error(code)
    assertOriginalTokensAbsent(snapshot)
    if (withParty) {
      const current = resolveDeployContext(party, scene, { partyTokenId: originalParty.id }).partyToken
      if (current !== originalParty || current.actorId !== party.id || !current.actorLink ||
        current.level !== partySource.level || !scene.levels.has(current.level) ||
        !sameTokenSource(current, expectedPartySource)) throw new Error(code)
    }
  }
  const assertReplacements = () => {
    if (ownMembers.size !== payloads.length || [...ownMembers].some(([id, { document, source }]) =>
      scene.tokens.get(id) !== document || !sameTokenSource(document, source))) throw new Error(code)
  }

  try {
    assertContext()
    if (members.length) {
      code = 'member-create-failed'
      const before = new Set([...scene.tokens].map(token => token.id))
      let created
      try {
        // This guard must precede every create, including rollback Party restoration.
        assertOriginalTokensAbsent(snapshot)
        created = await scene.createEmbeddedDocuments('Token', payloads, { keepId: true })
      } finally {
        // Scene additions alone never establish ownership: another client can
        // create even the only new same-Actor Token while our create aborts.
        // Match by the ID we assigned: the batch return order is not guaranteed.
        const byId = new Map((created ?? []).map(token => [token.id, token]))
        for (const source of expectedPayloads) {
          const token = byId.get(source._id)
          if (token && !before.has(token.id) && scene.tokens.get(token.id) === token) {
            ownMembers.set(token.id, { document: token, source })
          }
        }
        if (created?.length !== payloads.length || ownMembers.size !== payloads.length) {
          const actors = new Set(members.map(member => member.actorId))
          uncertainCreation = [...scene.tokens].some(token => !before.has(token.id) && !ownMembers.has(token.id) && actors.has(token.actorId))
        }
      }
      const originals = new Set(snapshot.members.map(member => member.tokenData._id))
      if (created?.length !== payloads.length || [...ownMembers.keys()].some(id =>
        !/^[A-Za-z0-9]{16}$/.test(id) || originals.has(id))) throw new Error(code)
      assertReplacements()
      code = 'deploy-context-changed'
      assertContext()
      // Check actual documents, not just a successful batch return, before any destruction.
      assertReplacements()
    }
    code = 'party-delete-failed'
    // Keep the party token as the party's anchor instead of deleting it: hiding
    // it marks the party as deployed and is undone on rollback.
    markerHidden = true
    await originalParty.update({ hidden: true })
    if (!sameTokenSource(scene.tokens.get(originalParty.id), markerSource)) throw new Error(code)
    assertReplacements()
    code = 'deploy-context-changed'
    assertContext(true, markerSource)
    code = 'snapshot-clear-failed'
    await party.unsetFlag('dcc', 'partyTokenSnapshots')
    if (party.getFlag('dcc', 'partyTokenSnapshots') != null) throw new Error(code)
    assertOriginalTokensAbsent(snapshot)
    assertReplacements()
    if (!sameTokenSource(scene.tokens.get(originalParty.id), markerSource)) throw new Error(code)
    return result
  } catch (cause) {
    const rollbackIssues = uncertainCreation ? ['member-create-uncertain'] : []
    // A rejected flag clear can already have persisted. Retain the deep-cloned
    // original snapshot on every failed completion, regardless of cleanup outcome.
    if (!foundry.utils.equals(party.getFlag('dcc', 'partyTokenSnapshots'), snapshot)) {
      try { await party.setFlag('dcc', 'partyTokenSnapshots', structuredClone(snapshot)) } catch (_) { /* Verify below. */ }
    }
    if (!foundry.utils.equals(party.getFlag('dcc', 'partyTokenSnapshots'), snapshot)) rollbackIssues.push('snapshot-restore-failed')

    // Never delete a legitimate external Token that now occupies the Party ID.
    // Restore a missing original Party first, including when it disappeared in
    // an awaited creation before our own deletion was ever attempted. This is a
    // safety net only: the regular deploy keeps the token as a hidden marker.
    if (!scene.tokens.has(originalParty.id)) {
      try {
        assertOriginalTokensAbsent(snapshot)
        await scene.createEmbeddedDocuments('Token', [structuredClone(partySource)], { keepId: true })
      } catch (_) { /* Stored documents, not exceptions, decide restoration. */ }
    }
    // Undo our own marker change (visibility) on the document we hid.
    const hiddenParty = scene.tokens.get(originalParty.id)
    if (markerHidden && hiddenParty === originalParty && !sameTokenSource(hiddenParty, partySource)) {
      try { await originalParty.update({ hidden: partySource.hidden }) } catch (_) { /* Verified below. */ }
    }
    const restored = scene.tokens.get(originalParty.id)
    const partyRestored = game.actors.get(party.id) === party && game.scenes.get(scene.id) === scene &&
      restored?.actorId === party.id && restored.actorLink &&
      restored.level === partySource.level && sameTokenSource(restored, partySource)
    if (!partyRestored) rollbackIssues.push('party-restore-failed')
    if (partyRestored && foundry.utils.equals(party.getFlag('dcc', 'partyTokenSnapshots'), snapshot)) {
      // Keep document identity as well as the returned ID: do not delete a
      // foreign replacement that acquired that ID during an awaited rollback.
      const remaining = [...ownMembers].filter(([id, { document }]) => scene.tokens.get(id) === document).map(([id]) => id)
      try {
        if (remaining.length) await scene.deleteEmbeddedDocuments('Token', remaining)
      } catch (_) { /* Verify actual absence even after a callback throws. */ }
    }
    // Cleanup itself is awaited: never claim retry safety from a pre-await check.
    if (!foundry.utils.equals(party.getFlag('dcc', 'partyTokenSnapshots'), snapshot)) {
      try { await party.setFlag('dcc', 'partyTokenSnapshots', structuredClone(snapshot)) } catch (_) { /* Verify below. */ }
      if (!foundry.utils.equals(party.getFlag('dcc', 'partyTokenSnapshots'), snapshot) &&
        !rollbackIssues.includes('snapshot-restore-failed')) rollbackIssues.push('snapshot-restore-failed')
    }
    if ([...ownMembers.keys()].some(id => scene.tokens.has(id))) rollbackIssues.push('member-delete-failed')
    const finalParty = scene.tokens.get(originalParty.id)
    if ((game.actors.get(party.id) !== party || game.scenes.get(scene.id) !== scene || !sameTokenSource(finalParty, partySource)) &&
      !rollbackIssues.includes('party-restore-failed')) rollbackIssues.push('party-restore-failed')
    if (rollbackIssues.length) blockedPartyIds.add(party.id)
    throw Object.assign(new Error(code, { cause }), {
      code,
      rollbackComplete: !rollbackIssues.length,
      rollbackIssues,
      severity: rollbackIssues.length ? 'error' : 'warning',
      manualInspectionRequired: !!rollbackIssues.length
    })
  }
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
    // TokenDocument.x/y are integer fields (Foundry rounds them on create), so
    // round here too: otherwise a fractional hex snap would never match the
    // persisted document and deploy verification would abort.
    return { x: Math.round(x), y: Math.round(y) }
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
  Hooks.on('renderTokenHUD', renderPartyTokenHUD)
  for (const hook of ['createActiveEffect', 'updateActiveEffect', 'deleteActiveEffect']) Hooks.on(hook, onMemberEffectChange)
}
