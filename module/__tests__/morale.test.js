/* global game */
import { describe, test, expect, vi } from 'vitest'
import '../__mocks__/foundry.js'
import { onGetCombatContextOptions, onGetCombatTrackerContextOptions } from '../morale.mjs'

function combatant (id, { type = 'NPC', defeated = false } = {}) {
  return { id, isDefeated: defeated, actor: { type, rollMoraleCheck: vi.fn() } }
}

function trackerWith (combatants) {
  const map = new Map(combatants.map(c => [c.id, c]))
  return { viewed: { combatants: Object.assign(map, { filter: fn => combatants.filter(fn) }) } }
}

describe('combat tracker morale entries', () => {
  test('combatant entry shows for NPCs only and rolls that NPC', () => {
    game.user.isGM = true
    const npc = combatant('a')
    const pc = combatant('b', { type: 'Player' })
    const options = []
    onGetCombatTrackerContextOptions(trackerWith([npc, pc]), options)
    const [entry] = options
    const li = id => ({ dataset: { combatantId: id } })

    expect(entry.visible(li('a'))).toBe(true)
    expect(entry.visible(li('b'))).toBe(false)
    entry.onClick(null, li('a'))
    expect(npc.actor.rollMoraleCheck).toHaveBeenCalledTimes(1)
  })

  test('encounter entry rolls every NPC that is not defeated', async () => {
    game.user.isGM = true
    const standing = combatant('a')
    const defeated = combatant('b', { defeated: true })
    const pc = combatant('c', { type: 'Player' })
    const options = []
    onGetCombatContextOptions(trackerWith([standing, defeated, pc]), options)
    const [entry] = options

    expect(entry.visible()).toBe(true)
    await entry.onClick()
    expect(standing.actor.rollMoraleCheck).toHaveBeenCalledTimes(1)
    expect(defeated.actor.rollMoraleCheck).not.toHaveBeenCalled()
    expect(pc.actor.rollMoraleCheck).not.toHaveBeenCalled()
  })
})
