/* global rollToMessageMock, ChatMessage */
/**
 * Adapter round-trip test — Phase 2 session 1 (spell check).
 *
 * Exercises the dispatcher's routing decision and the minimal
 * generic-castingMode adapter path:
 *   DCCActor.rollSpellCheck →
 *     (generic item + no patron + not Cleric) → _rollSpellCheckViaAdapter →
 *       buildSpellCastInput → libCastSpell (formula) →
 *       new Roll(formula).evaluate() →
 *       libCastSpell (evaluate, pre-rolled natural) →
 *       renderSpellCheck.
 *
 * Mirrors adapter-skill-check.test.js / adapter-saving-throw.test.js.
 * Wizard / cleric / patron paths stay on the legacy path this session
 * and are covered by the existing actor.test.js / item.test.js suites.
 */

import { expect, test, vi } from 'vitest'
import '../__mocks__/foundry.js'
import DCCActor from '../actor.js'
import DCCItem from '../item.js'

// Mock actor-level-change like actor.test.js does
vi.mock('../actor-level-change.js')

function makeGenericSpellItem (overrides = {}) {
  const spell = new DCCItem({ name: 'Generic Cantrip', type: 'spell' }, {})
  spell.system = {
    level: 1,
    config: { castingMode: 'generic', inheritCheckPenalty: true },
    spellCheck: { die: '1d20', value: '+0', penalty: '-0' },
    results: { table: '', collection: '' },
    lost: false,
    ...overrides
  }
  return spell
}

test('adapter path fires for a generic spell item on a non-cleric non-patron actor', async () => {
  rollToMessageMock.mockClear()
  const chatMessageCreateSpy = vi.spyOn(ChatMessage, 'create')

  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  actor.system.class.patron = ''
  actor.system.details.sheetClass = 'Wizard'

  const spellItem = makeGenericSpellItem()
  const findSpy = vi.spyOn(actor.items, 'find').mockReturnValue(spellItem)

  await actor.rollSpellCheck({ spell: 'Generic Cantrip' })

  expect(findSpy).toHaveBeenCalledTimes(1)
  expect(rollToMessageMock).toHaveBeenCalledTimes(1)

  const [messageData] = rollToMessageMock.mock.calls[0]
  expect(messageData.flags['dcc.RollType']).toBe('SpellCheck')
  expect(messageData.flags['dcc.isSpellCheck']).toBe(true)

  const libResult = messageData.flags['dcc.libResult']
  expect(libResult).toBeDefined()
  expect(libResult.die).toBe('d20')
  expect(Array.isArray(libResult.modifiers)).toBe(true)
  expect(chatMessageCreateSpy).toHaveBeenCalledTimes(1)

  chatMessageCreateSpy.mockRestore()
  findSpy.mockRestore()
})

test('wizard-castingMode spell item routes to the legacy path (delegates to DCCItem)', async () => {
  rollToMessageMock.mockClear()

  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  actor.system.class.patron = ''
  actor.system.details.sheetClass = 'Wizard'

  const wizardSpell = new DCCItem({ name: 'Wizard Spell', type: 'spell' }, {})
  wizardSpell.system = {
    config: { castingMode: 'wizard' },
    results: { table: '' },
    lost: false
  }
  const findSpy = vi.spyOn(actor.items, 'find').mockReturnValue(wizardSpell)
  const itemSpy = vi.spyOn(DCCItem.prototype, 'rollSpellCheck').mockResolvedValue(undefined)

  await actor.rollSpellCheck({ spell: 'Wizard Spell' })

  expect(findSpy).toHaveBeenCalledTimes(1)
  expect(itemSpy).toHaveBeenCalledWith('int', { abilityId: 'int', spell: 'Wizard Spell' })
  // Adapter did not render — no roll.toMessage from chat-renderer.
  expect(rollToMessageMock).not.toHaveBeenCalled()

  itemSpy.mockRestore()
  findSpy.mockRestore()
})

test('generic item on a Cleric actor routes to legacy (disapproval side-effects preserved)', async () => {
  rollToMessageMock.mockClear()

  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  actor.system.class.patron = ''
  actor.system.details.sheetClass = 'Cleric'

  const spellItem = makeGenericSpellItem()
  const findSpy = vi.spyOn(actor.items, 'find').mockReturnValue(spellItem)
  const itemSpy = vi.spyOn(DCCItem.prototype, 'rollSpellCheck').mockResolvedValue(undefined)

  await actor.rollSpellCheck({ spell: 'Generic Cantrip' })

  expect(itemSpy).toHaveBeenCalledTimes(1)
  expect(rollToMessageMock).not.toHaveBeenCalled()

  itemSpy.mockRestore()
  findSpy.mockRestore()
})

test('generic item on a patron-bound actor routes to legacy (taint side-effects preserved)', async () => {
  rollToMessageMock.mockClear()

  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  actor.system.class.patron = 'Cthulhu'
  actor.system.details.sheetClass = 'Wizard'

  const spellItem = makeGenericSpellItem()
  const findSpy = vi.spyOn(actor.items, 'find').mockReturnValue(spellItem)
  const itemSpy = vi.spyOn(DCCItem.prototype, 'rollSpellCheck').mockResolvedValue(undefined)

  await actor.rollSpellCheck({ spell: 'Generic Cantrip' })

  expect(itemSpy).toHaveBeenCalledTimes(1)
  expect(rollToMessageMock).not.toHaveBeenCalled()

  itemSpy.mockRestore()
  findSpy.mockRestore()
})
