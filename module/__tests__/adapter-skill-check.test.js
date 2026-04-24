/* global rollToMessageMock, ChatMessage */
/**
 * Adapter round-trip test — Phase 1 (skill check).
 *
 * Exercises the full adapter flow for a skill check:
 *   DCCActor._rollSkillCheckViaAdapter →
 *   _resolveSkill (built-in slot or skill item) →
 *   actorToCharacter →
 *   libRollCheck (formula mode) → new Roll(formula).evaluate() →
 *   libRollCheck (evaluate mode, pre-rolled natural) →
 *   chat-renderer (builds ChatMessage, preserves legacy flags).
 *
 * Mirrors adapter-saving-throw.test.js / adapter-ability-check.test.js.
 */

import { expect, test, vi } from 'vitest'
import '../__mocks__/foundry.js'
import DCCActor from '../actor.js'
import DCCItem from '../item.js'

// Mock actor-level-change like actor.test.js does
vi.mock('../actor-level-change.js')

// noinspection JSCheckFunctionSignatures
const actor = new DCCActor()

test('adapter path skips DCCRoll.createRoll for a built-in skill with a die', async () => {
  rollToMessageMock.mockClear()
  const chatMessageCreateSpy = vi.spyOn(ChatMessage, 'create')

  // customDieSkill is defined in __mocks__/foundry.js — die '1d14', no ability.
  await actor.rollSkillCheck('customDieSkill')

  expect(rollToMessageMock).toHaveBeenCalledTimes(1)
  const [messageData, toMessageOpts] = rollToMessageMock.mock.calls[0]

  expect(messageData.flavor).toBe('Custom Die Skill')
  expect(messageData.flags['dcc.RollType']).toBe('SkillCheck')
  expect(messageData.flags['dcc.SkillId']).toBe('customDieSkill')
  // dcc.ItemId is emitted for built-in slots too — legacy behavior
  // downstream modules (token-action-hud-dcc, dcc-qol) parse.
  expect(messageData.flags['dcc.ItemId']).toBe('customDieSkill')
  expect(messageData.flags['dcc.isSkillCheck']).toBe(true)

  const libResult = messageData.flags['dcc.libResult']
  expect(libResult).toBeDefined()
  expect(libResult.skillId).toBe('skill:customDieSkill')
  expect(libResult.die).toBe('d14')
  expect(Array.isArray(libResult.modifiers)).toBe(true)

  expect(toMessageOpts).toEqual({ create: false })
  expect(chatMessageCreateSpy).toHaveBeenCalledTimes(1)

  chatMessageCreateSpy.mockRestore()
})

test('adapter path attaches ability id for skills that roll against one', async () => {
  rollToMessageMock.mockClear()

  // customDieSkillWithInt has ability: 'int', die: '1d24'.
  await actor.rollSkillCheck('customDieSkillWithInt')

  const [messageData] = rollToMessageMock.mock.calls[0]
  expect(messageData.flavor).toBe('Custom Die Skill With Int (Intelligence)')
  expect(messageData.flags['dcc.Ability']).toBe('int')
  expect(messageData.flags['dcc.libResult'].die).toBe('d24')
})

test('adapter path emits skill-value modifier with the skill label as origin', async () => {
  rollToMessageMock.mockClear()

  // customDieAndValueSkill has die '1d14' + value 3, no ability.
  await actor.rollSkillCheck('customDieAndValueSkill')

  const [messageData] = rollToMessageMock.mock.calls[0]
  const valueMod = messageData.flags['dcc.libResult'].modifiers.find(
    (m) => m.origin?.id === 'skill-value'
  )
  expect(valueMod).toBeDefined()
  expect(valueMod.kind).toBe('add')
  expect(valueMod.value).toBe(3)
  expect(valueMod.origin.label).toBe('Custom Die And Value Skill')
})

test('adapter path handles a skill item (useDie, useValue, useAbility, useLevel)', async () => {
  rollToMessageMock.mockClear()

  const skillItem = new DCCItem({
    name: 'itemBackstab',
    type: 'skill',
    system: {
      config: {
        useAbility: true,
        useDie: true,
        useLevel: true,
        useValue: true
      },
      ability: 'agl',
      die: '1d20',
      value: '+2',
      description: {
        value: 'A skill item with a description.'
      }
    }
  })
  global.itemTypesMock.mockReturnValue({
    skill: {
      find: vi.fn().mockReturnValue(skillItem)
    }
  })
  actor.system.details.level.value = 3

  await actor.rollSkillCheck('itemBackstab')

  const [messageData] = rollToMessageMock.mock.calls[0]
  expect(messageData.flavor).toBe('itemBackstab (Agility)')
  expect(messageData.flags['dcc.ItemId']).toBe('itemBackstab')
  expect(messageData.flags['dcc.Ability']).toBe('agl')

  const libResult = messageData.flags['dcc.libResult']
  expect(libResult.die).toBe('d20')

  // Level modifier present (level 3).
  const levelMod = libResult.modifiers.find(
    (m) => m.origin?.category === 'level'
  )
  expect(levelMod).toBeDefined()
  expect(levelMod.value).toBe(3)

  // Skill description is appended to the rendered content.
  expect(messageData.system.skillDescription).toBe(
    'A skill item with a description.'
  )

  // Reset itemTypes mock so later tests don't see this skill item.
  global.itemTypesMock.mockReset()
})

test('description-only skill item routes to the legacy path', async () => {
  rollToMessageMock.mockClear()
  const chatMessageCreateSpy = vi.spyOn(ChatMessage, 'create')

  // Skill item with NO die and NO value — nothing to roll, just a
  // description. Dispatcher routes to legacy; legacy posts a plain
  // ChatMessage.create with the description, no Roll.toMessage call.
  const descOnlyItem = new DCCItem({
    name: 'loreOnly',
    type: 'skill',
    system: {
      config: {
        useAbility: false,
        useDie: false,
        useLevel: false,
        useValue: false
      },
      description: {
        value: 'Forbidden lore about cosmic indifference.'
      }
    }
  })
  global.itemTypesMock.mockReturnValue({
    skill: {
      find: vi.fn().mockReturnValue(descOnlyItem)
    }
  })

  await actor.rollSkillCheck('loreOnly')

  // No Roll.toMessage — the legacy path calls ChatMessage.create directly.
  expect(rollToMessageMock).not.toHaveBeenCalled()
  // Legacy path created one message with the description and legacy flags.
  const createCalls = chatMessageCreateSpy.mock.calls.filter(
    (call) => call[0]?.flags?.['dcc.SkillId'] === 'loreOnly'
  )
  expect(createCalls.length).toBe(1)
  expect(createCalls[0][0].flags['dcc.RollType']).toBe('SkillCheck')
  expect(createCalls[0][0].flags['dcc.ItemId']).toBe('loreOnly')
  expect(createCalls[0][0].flags['dcc.isSkillCheck']).toBe(true)

  chatMessageCreateSpy.mockRestore()
  global.itemTypesMock.mockReset()
})

// Regression: rollSkillCheck must NOT crash when the requested skill
// can't be resolved. Pre-fix, an unknown id (no built-in slot, no
// matching skill item) routed to legacy and crashed on
// `_rollSkillCheckLegacy:1694` (`skill.value` on an undefined skill).
// Now mirrors the rollSpellCheck shape: warns the user and returns
// without rolling.
test('rollSkillCheck warns and returns when the skill is unknown', async () => {
  rollToMessageMock.mockClear()
  global.uiNotificationsWarnMock.mockClear()
  // Make sure no skill item shadows the request.
  global.itemTypesMock.mockReturnValue({ skill: { find: vi.fn().mockReturnValue(undefined) } })

  await expect(actor.rollSkillCheck('thisSkillDoesNotExist')).resolves.toBeUndefined()

  expect(rollToMessageMock).not.toHaveBeenCalled()
  expect(global.uiNotificationsWarnMock).toHaveBeenCalledTimes(1)
  // Localized message — mock's i18n.format returns the key + interpolated args.
  const [msg] = global.uiNotificationsWarnMock.mock.calls[0]
  expect(msg).toContain('thisSkillDoesNotExist')

  global.itemTypesMock.mockReset()
})
