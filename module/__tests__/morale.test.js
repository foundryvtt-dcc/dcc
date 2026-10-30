/* global game, ChatMessage */
import { beforeEach, describe, test, expect, vi } from 'vitest'
import '../__mocks__/foundry.js'

vi.mock('../socket.mjs', () => ({ isActiveGM: vi.fn(() => true) }))

const {
  onGetCombatContextOptions,
  onGetCombatTrackerContextOptions,
  onPreUpdateActorForMorale,
  onUpdateActorForMorale
} = await import('../morale.mjs')

function combatant (id, { type = 'NPC', defeated = false, hidden = false, actor } = {}) {
  return { id, name: id, hidden, isDefeated: defeated, actor: actor ?? { type, uuid: `Actor.${id}`, rollMoraleCheck: vi.fn() } }
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

  test('encounter entry rolls each standing NPC actor once and keeps going past a failure', async () => {
    const failing = combatant('a')
    failing.actor.rollMoraleCheck.mockRejectedValue(new Error('bad Will save'))
    const standing = combatant('b')
    const linkedTwice = combatant('c', { actor: standing.actor })
    const defeated = combatant('d', { defeated: true })
    const pc = combatant('e', { type: 'Player' })
    const options = []
    onGetCombatContextOptions(trackerWith([failing, standing, linkedTwice, defeated, pc]), options)
    const [entry] = options
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(entry.visible()).toBe(true)
    await entry.onClick()
    expect(standing.actor.rollMoraleCheck).toHaveBeenCalledTimes(1)
    expect(defeated.actor.rollMoraleCheck).not.toHaveBeenCalled()
    expect(pc.actor.rollMoraleCheck).not.toHaveBeenCalled()
    consoleError.mockRestore()

    game.user.isGM = false
    expect(entry.visible()).toBe(false)
  })
})

describe('half-HP morale prompt', () => {
  const npc = (hp, max = 10) => ({ type: 'NPC', name: 'Goblin', uuid: 'Actor.g', system: { attributes: { hp: { value: hp, max } } } })

  /** Run the pre/post hook pair for an HP change and report whether a prompt was posted. */
  async function damage (from, to, max = 10, { promptSetting = true } = {}) {
    const setting = vi.spyOn(game.settings, 'get').mockImplementation((ns, key) => key === 'moraleHalfHpPrompt' ? promptSetting : false)
    const create = vi.spyOn(ChatMessage, 'create').mockResolvedValue({})
    ChatMessage.getWhisperRecipients = vi.fn(() => [{ id: 'gm1' }])
    const changes = { system: { attributes: { hp: { value: to } } } }
    const options = {}
    onPreUpdateActorForMorale(npc(from, max), changes, options)
    await onUpdateActorForMorale(npc(to, max), changes, options)
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

    expect(await damage(10, 6)).toBeUndefined() // still above half
    expect(await damage(5, 3)).toBeUndefined() // already at half before this hit
    expect(await damage(10, 0)).toBeUndefined() // dropped: no morale, it's down
    expect(await damage(10, 5, 10, { promptSetting: false })).toBeUndefined()
  })
})
