/* global game, ChatMessage */
import { beforeEach, describe, test, expect, vi } from 'vitest'
import '../__mocks__/foundry.js'

vi.mock('../socket.mjs', () => ({ isActiveGM: vi.fn(() => true) }))

const {
  markNeverChecksMorale,
  onGetCombatContextOptions,
  onGetCombatTrackerContextOptions,
  onPreUpdateActorForMorale,
  onUpdateActorForMorale
} = await import('../morale.mjs')

function combatant (id, { type = 'NPC', defeated = false, hidden = false, immune = false, actor } = {}) {
  return {
    id,
    name: id,
    hidden,
    isDefeated: defeated,
    actor: actor ?? { type, uuid: `Actor.${id}`, system: { config: { moraleImmune: immune } }, rollMoraleCheck: vi.fn() }
  }
}

function trackerWith (combatants) {
  const map = new Map(combatants.map(c => [c.id, c]))
  return { viewed: { combatants: Object.assign(map, { filter: fn => combatants.filter(fn) }) } }
}

const li = id => ({ dataset: { combatantId: id } })

beforeEach(() => {
  game.user.isGM = true
})

describe('combat tracker morale entries', () => {
  test('combatant entry: GM-only, NPCs only, hidden combatants roll to the GM', () => {
    const npc = combatant('a')
    const pc = combatant('b', { type: 'Player' })
    const lurker = combatant('c', { hidden: true })
    const options = []
    onGetCombatTrackerContextOptions(trackerWith([npc, pc, lurker]), options)
    const [entry] = options

    expect(entry.visible(li('a'))).toBe(true)
    expect(entry.visible(li('b'))).toBe(false)
    entry.onClick(null, li('a'))
    entry.onClick(null, li('c'))
    expect(npc.actor.rollMoraleCheck).toHaveBeenCalledWith(expect.objectContaining({ messageMode: undefined }))
    expect(lurker.actor.rollMoraleCheck).toHaveBeenCalledWith(expect.objectContaining({ messageMode: 'gm' }))

    game.user.isGM = false
    expect(entry.visible(li('a'))).toBe(false)
  })

  test('encounter entry rolls each standing NPC actor once, skips those that never check morale, and keeps going past a failure', async () => {
    const failing = combatant('a')
    failing.actor.rollMoraleCheck.mockRejectedValue(new Error('bad Will save'))
    const standing = combatant('b')
    const linkedTwice = combatant('c', { actor: standing.actor })
    const defeated = combatant('d', { defeated: true })
    const pc = combatant('e', { type: 'Player' })
    const fearless = combatant('f', { immune: true })
    const options = []
    onGetCombatContextOptions(trackerWith([failing, standing, linkedTwice, defeated, pc, fearless]), options)
    const [entry] = options
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(entry.visible()).toBe(true)
    await entry.onClick()
    expect(standing.actor.rollMoraleCheck).toHaveBeenCalledTimes(1)
    expect(defeated.actor.rollMoraleCheck).not.toHaveBeenCalled()
    expect(pc.actor.rollMoraleCheck).not.toHaveBeenCalled()
    expect(fearless.actor.rollMoraleCheck).not.toHaveBeenCalled()
    consoleError.mockRestore()

    game.user.isGM = false
    expect(entry.visible()).toBe(false)
  })
})

describe('half-HP morale prompt', () => {
  const npc = (hp, max = 10, immune = false) => ({ type: 'NPC', name: 'Goblin', uuid: 'Actor.g', system: { attributes: { hp: { value: hp, max } }, config: { moraleImmune: immune } } })

  /** Run the pre/post hook pair for an HP change and report whether a prompt was posted. */
  async function damage (from, to, max = 10, { promptSetting = true, immune = false } = {}) {
    const setting = vi.spyOn(game.settings, 'get').mockImplementation((ns, key) => key === 'moraleHalfHpPrompt' ? promptSetting : false)
    const create = vi.spyOn(ChatMessage, 'create').mockResolvedValue({})
    ChatMessage.getWhisperRecipients = vi.fn(() => [{ id: 'gm1' }])
    const changes = { system: { attributes: { hp: { value: to } } } }
    const options = {}
    onPreUpdateActorForMorale(npc(from, max, immune), changes, options)
    await onUpdateActorForMorale(npc(to, max, immune), changes, options)
    const posted = create.mock.calls[0]?.[0]
    create.mockRestore()
    setting.mockRestore()
    return posted
  }

  test('whispers the GM once HP crosses to half or below, not otherwise', async () => {
    const posted = await damage(10, 5)
    expect(posted.whisper).toEqual(['gm1'])
    expect(posted.flags.dcc.moraleHalfHpPrompt).toBe(true)
    expect(posted.content).toContain('data-action="rollMoraleHalfHp"')
    expect(posted.content).toContain('data-action="moraleNeverAsk"')

    expect(await damage(10, 6)).toBeUndefined() // still above half
    expect(await damage(5, 3)).toBeUndefined() // already at half before this hit
    expect(await damage(10, 0)).toBeUndefined() // dropped: no morale, it's down
    expect(await damage(10, 5, 10, { promptSetting: false })).toBeUndefined()
    expect(await damage(10, 5, 10, { immune: true })).toBeUndefined() // never checks morale
  })

  test("Don't Ask Again marks the world actor behind an unlinked token", async () => {
    const worldActor = { update: vi.fn(), name: 'Cultist' }
    const tokenActor = { id: 'cult1', isToken: true, update: vi.fn(), name: 'Cultist' }
    const previousActors = game.actors
    game.actors = { get: id => id === 'cult1' ? worldActor : undefined }

    await markNeverChecksMorale(tokenActor)
    expect(worldActor.update).toHaveBeenCalledWith({ 'system.config.moraleImmune': true })
    expect(tokenActor.update).not.toHaveBeenCalled()
    game.actors = previousActors
  })
})
