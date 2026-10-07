/* global game, gameSettingsGetMock */
/**
 * The weapon-attack dispatch reads dcc-core-book's `registerNPCFumbleTables`
 * setting to pick NPC fumble tables. Turning it off must fall back to
 * Table 4-2 (#989: `|| true` made it always on).
 */

import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import '../__mocks__/foundry.js'
import DCCActor from '../actor'

vi.mock('../actor-level-change.js')

const actor = new DCCActor()
let saved

beforeEach(() => {
  saved = { find: actor.items.find, rollToHit: actor.rollToHit, rollFumble: actor._rollFumble, isPC: actor.isPC, isNPC: actor.isNPC, modules: game.modules }
  game.modules = { get: () => undefined } // dcc-qol inactive
  actor.isPC = false
  actor.isNPC = true
  actor.items.find = vi.fn().mockReturnValue({ name: 'Claws', system: { toHit: '+0', damage: '1d6', actionDie: '1d20', equipped: true, melee: true } })
  actor.rollToHit = vi.fn(async () => ({ roll: { options: {}, dice: [{ faces: 20 }], render: async () => '' }, fumble: true, crit: false, hitsAc: 1 }))
  actor._rollFumble = vi.fn(async (weapon, ctx) => ({ fumbleTableName: ctx.fumbleTableName, isNPCFumble: ctx.useNPCFumbles }))
})

afterEach(() => {
  actor.items.find = saved.find
  actor.rollToHit = saved.rollToHit
  actor._rollFumble = saved.rollFumble
  actor.isPC = saved.isPC
  actor.isNPC = saved.isNPC
  game.modules = saved.modules
})

async function fumbleContext (registerNPCFumbleTables) {
  const original = gameSettingsGetMock.getMockImplementation()
  gameSettingsGetMock.mockImplementation((module, key) => {
    if (module === 'dcc-core-book' && key === 'registerNPCFumbleTables') return registerNPCFumbleTables
    if (module === 'dcc' && key === 'automateDamageFumblesCrits') return false
    return original ? original(module, key) : undefined
  })
  try {
    await actor.rollWeaponAttack('claws')
  } finally {
    gameSettingsGetMock.mockImplementation(original)
  }
  return actor._rollFumble.mock.calls[0][1]
}

test('an NPC fumble honours registerNPCFumbleTables turned off', async () => {
  const ctx = await fumbleContext(false)
  expect(ctx.useNPCFumbles).toBe(false)
  expect(ctx.fumbleTableName).toBe('Table 4-2: Fumbles')
})

test('an NPC fumble uses the NPC tables when the setting is on', async () => {
  expect((await fumbleContext(true)).useNPCFumbles).toBe(true)
})

test('an NPC fumble uses the NPC tables when the setting is unset', async () => {
  expect((await fumbleContext(undefined)).useNPCFumbles).toBe(true)
})
