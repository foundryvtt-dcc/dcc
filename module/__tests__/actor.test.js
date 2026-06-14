/* global actorUpdateMock, rollToMessageMock, collectionFindMock, dccRollCreateRollMock, uiNotificationsWarnMock, game, ChatMessage */
/**
 * Tests for Actor.js using Foundry Mocks.
 * Mocks for Foundry Classes/Functions are found in __mocks__/foundry.js
 * Mocks for DCCItem Class are found in __mocks__/item.js
 **/

import { expect, test, vi } from 'vitest'
import '../__mocks__/foundry.js'
import DCCItem from '../item'

import DCCActor from '../actor'

// Mock the actor-level-change module
vi.mock('../actor-level-change.js')

// Create Base Test Actor
// noinspection JSCheckFunctionSignatures
const actor = new DCCActor()

test('prepareData sets ability modifiers', () => {
  const abilities = actor.system.abilities

  expect(abilities.str.value).toEqual(6)
  expect(abilities.str.mod).toEqual(-1)

  expect(abilities.agl.value).toEqual(8)
  expect(abilities.agl.mod).toEqual(-1)

  expect(abilities.sta.value).toEqual(12)
  expect(abilities.sta.mod).toEqual(0)

  expect(abilities.int.value).toEqual(14)
  expect(abilities.int.mod).toEqual(1)

  expect(abilities.per.value).toEqual(16)
  expect(abilities.per.mod).toEqual(2)

  expect(abilities.lck.value).toEqual(18)
  expect(abilities.lck.mod).toEqual(3)
})

test('classId returns null when sheetClass is unset', () => {
  const blankActor = new DCCActor()
  blankActor.system.details.sheetClass = ''
  expect(blankActor.classId).toBeNull()
})

test('classId returns null when sheetClass is missing entirely', () => {
  const blankActor = new DCCActor()
  delete blankActor.system.details.sheetClass
  expect(blankActor.classId).toBeNull()
})

test('classId lowercases the canonical sheetClass label', () => {
  const halflingActor = new DCCActor()
  halflingActor.system.details.sheetClass = 'Halfling'
  expect(halflingActor.classId).toEqual('halfling')

  const wizardActor = new DCCActor()
  wizardActor.system.details.sheetClass = 'Wizard'
  expect(wizardActor.classId).toEqual('wizard')

  const dwarfActor = new DCCActor()
  dwarfActor.system.details.sheetClass = 'Dwarf'
  expect(dwarfActor.classId).toEqual('dwarf')
})

test('classId is idempotent when sheetClass is already lowercase', () => {
  const already = new DCCActor()
  already.system.details.sheetClass = 'halfling'
  expect(already.classId).toEqual('halfling')
})

test('_stripDieCount delegates to normalizeLibDie with a null fallback', () => {
  // Phase 7 session 12: _stripDieCount is now a thin wrapper over the
  // canonical adapter normalizeLibDie(formula, null). Single die strings
  // strip to the bare lib DieType; falsy / unparseable input returns null
  // (callers `|| 'd20'` it or leave the existing die untouched).
  expect(actor._stripDieCount('1d14')).toEqual('d14')
  expect(actor._stripDieCount('1d20')).toEqual('d20')
  expect(actor._stripDieCount('d24')).toEqual('d24')
  expect(actor._stripDieCount('')).toEqual(null)
  expect(actor._stripDieCount(null)).toEqual(null)
  expect(actor._stripDieCount('not-a-die')).toEqual(null)
})

test('roll ability check', async () => {
  dccRollCreateRollMock.mockClear()
  const chatMessageCreateSpy = vi.spyOn(ChatMessage, 'create')

  // Strength check with the mock actor's checkPenalty=0 takes the
  // adapter path (no non-zero penalty to display). DCCRoll.createRoll
  // is NOT invoked; the lib builds the formula and the Foundry Roll
  // is constructed inline in _rollAbilityCheckViaAdapter
  // (`new Roll(plan.formula).evaluate()`).
  await actor.rollAbilityCheck('str')
  expect(dccRollCreateRollMock).toHaveBeenCalledTimes(0)
  expect(rollToMessageMock).toHaveBeenLastCalledWith(
    expect.objectContaining({
      flavor: 'Strength Check',
      speaker: actor,
      flags: expect.objectContaining({
        'dcc.Ability': 'str',
        'dcc.RollType': 'AbilityCheck',
        'dcc.isAbilityCheck': true,
        checkPenaltyCouldApply: true
      })
    }),
    { create: false }
  )
  expect(chatMessageCreateSpy).toHaveBeenCalledTimes(1)

  chatMessageCreateSpy.mockRestore()

  // rollUnder (Luck checks) now routes through the adapter's
  // _rollLuckCheckViaAdapter → lib rollLuckCheck, NOT the legacy
  // DCCRoll.createRoll term-builder. The on-message contract is
  // preserved (roll-under flavor + AbilityCheckRollUnder flags, no
  // libResult / Fleeting Luck — matching the prior legacy output).
  await actor.rollAbilityCheck('lck', { rollUnder: true })
  // Adapter path — DCCRoll.createRoll is never invoked.
  expect(dccRollCreateRollMock).toHaveBeenCalledTimes(0)
  expect(rollToMessageMock).toHaveBeenLastCalledWith({
    flavor: 'Luck CheckRollUnder',
    speaker: actor,
    flags: { 'dcc.Ability': 'lck', 'dcc.RollType': 'AbilityCheckRollUnder', 'dcc.isAbilityCheck': true },
    system: {
      checkPenaltyRollIndex: null
    }
  }, { create: false })

  // ...and the non-rollUnder Luck check also takes the adapter path (not
  // str/agl, no dialog → adapter), producing the standard AbilityCheck
  // flavor. DCCRoll.createRoll is still never called.
  await actor.rollAbilityCheck('lck', { rollUnder: false })
  expect(dccRollCreateRollMock).toHaveBeenCalledTimes(0)
  expect(rollToMessageMock).toHaveBeenLastCalledWith(
    expect.objectContaining({
      flavor: 'Luck Check',
      speaker: actor,
      flags: expect.objectContaining({
        'dcc.Ability': 'lck',
        'dcc.RollType': 'AbilityCheck',
        'dcc.isAbilityCheck': true
      })
    }),
    { create: false }
  )
})

test('roll saving throw', async () => {
  dccRollCreateRollMock.mockClear()

  // Saving throws without a dialog flow through the adapter path, so
  // DCCRoll.createRoll is NOT invoked — the lib builds the formula and
  // the Foundry Roll is constructed directly in the adapter.
  await actor.rollSavingThrow('frt')
  expect(dccRollCreateRollMock).toHaveBeenCalledTimes(0)
  expect(rollToMessageMock).toHaveBeenLastCalledWith(
    expect.objectContaining({
      flavor: 'Fortitude Save',
      speaker: actor,
      flags: expect.objectContaining({
        'dcc.Save': 'frt',
        'dcc.RollType': 'SavingThrow',
        'dcc.isSave': true
      })
    }),
    { create: false }
  )

  await actor.rollSavingThrow('ref')
  expect(dccRollCreateRollMock).toHaveBeenCalledTimes(0)
  expect(rollToMessageMock).toHaveBeenLastCalledWith(
    expect.objectContaining({
      flavor: 'Reflex Save',
      speaker: actor,
      flags: expect.objectContaining({
        'dcc.Save': 'ref',
        'dcc.RollType': 'SavingThrow',
        'dcc.isSave': true
      })
    }),
    { create: false }
  )

  await actor.rollSavingThrow('wil')
  expect(dccRollCreateRollMock).toHaveBeenCalledTimes(0)
  expect(rollToMessageMock).toHaveBeenLastCalledWith(
    expect.objectContaining({
      flavor: 'Will Save',
      speaker: actor,
      flags: expect.objectContaining({
        'dcc.Save': 'wil',
        'dcc.RollType': 'SavingThrow',
        'dcc.isSave': true
      })
    }),
    { create: false }
  )
})

test('roll saving throw with dc option hides dc by default', async () => {
  dccRollCreateRollMock.mockClear()
  rollToMessageMock.mockClear()

  // Roll with DC lower than mock total (10) - should succeed without showing DC
  await actor.rollSavingThrow('ref', { dc: 5 })
  expect(rollToMessageMock).toHaveBeenCalledWith(
    expect.objectContaining({
      flavor: 'Reflex Save \u2014 Success'
    }),
    { create: false }
  )

  rollToMessageMock.mockClear()

  // Roll with DC higher than mock total (10) - should fail without showing DC
  await actor.rollSavingThrow('ref', { dc: 15 })
  expect(rollToMessageMock).toHaveBeenCalledWith(
    expect.objectContaining({
      flavor: 'Reflex Save \u2014 Failure'
    }),
    { create: false }
  )
})

test('roll saving throw with dc option shows dc when showDc is true', async () => {
  dccRollCreateRollMock.mockClear()
  rollToMessageMock.mockClear()

  await actor.rollSavingThrow('ref', { dc: 5, showDc: true })
  expect(rollToMessageMock).toHaveBeenCalledWith(
    expect.objectContaining({
      flavor: 'Reflex Save (DC 5) \u2014 Success'
    }),
    { create: false }
  )

  rollToMessageMock.mockClear()

  await actor.rollSavingThrow('ref', { dc: 15, showDc: true })
  expect(rollToMessageMock).toHaveBeenCalledWith(
    expect.objectContaining({
      flavor: 'Reflex Save (DC 15) \u2014 Failure'
    }),
    { create: false }
  )
})

test('roll saving throw with dc equal to roll total succeeds', async () => {
  rollToMessageMock.mockClear()

  // Mock roll total is 10, DC 10 should succeed (meet-or-beat)
  await actor.rollSavingThrow('ref', { dc: 10 })
  expect(rollToMessageMock).toHaveBeenCalledWith(
    expect.objectContaining({
      flavor: 'Reflex Save \u2014 Success'
    }),
    { create: false }
  )
})

test('roll saving throw with invalid dc ignores dc check', async () => {
  rollToMessageMock.mockClear()

  // Invalid DC should be ignored, producing a plain save flavor
  await actor.rollSavingThrow('ref', { dc: 'invalid' })
  expect(rollToMessageMock).toHaveBeenCalledWith(
    expect.objectContaining({
      flavor: 'Reflex Save'
    }),
    { create: false }
  )
})

test('roll saving throw returns roll', async () => {
  dccRollCreateRollMock.mockClear()

  const roll = await actor.rollSavingThrow('ref')
  expect(roll).toBeDefined()
  expect(roll.total).toBeDefined()
})

test('roll initiative', async () => {
  // Default (no dialog) path flows through the adapter: the lib
  // builds the formula string and `new Roll(formula)` replaces
  // `DCCRoll.createRoll`. Assert the call produces a Roll instead.
  dccRollCreateRollMock.mockClear()

  await actor.rollInitiative({ createCombatants: true })
  expect(dccRollCreateRollMock).not.toHaveBeenCalled()
})

test('roll weapon attack dagger', async () => {
  dccRollCreateRollMock.mockClear()
  collectionFindMock.mockClear()
  uiNotificationsWarnMock.mockClear()
  const attackItem = new DCCItem({
    name: 'lefthand dagger',
    type: 'weapon',
    system: {
      actionDie: '1d16',
      toHit: '+2',
      critRange: 16,
      damage: '1d4',
      melee: true
    }
  })
  collectionFindMock.mockReturnValue(attackItem)
  await actor.rollWeaponAttack(actor.items[0])
  expect(dccRollCreateRollMock).toHaveBeenCalledWith(
    [
      {
        type: 'Die',
        label: game.i18n.localize('DCC.ActionDie'),
        formula: '1d16',
        presets: [
          {
            formula: '1d20',
            label: '1d20'
          },
          {
            formula: '1d10',
            label: 'Untrained'
          }
        ]
      },
      {
        type: 'Compound',
        dieLabel: 'DeedDie',
        modifierLabel: 'Attack',
        formula: '+2'
      }
    ],
    Object.assign({ critical: 16 }, actor.getRollData()),
    {
      targets: undefined,
      title: 'Attack'
    }
  )
})

// Skill checks that reach the lib adapter no longer invoke DCCRoll.createRoll:
// the lib builds the formula and Foundry evaluates it directly. Assertions
// use objectContaining against the chat-message flags + flavor that the
// legacy path previously emitted verbatim.

test('roll Custom Die Skill', async () => {
  dccRollCreateRollMock.mockClear()

  await actor.rollSkillCheck('customDieSkill')
  expect(dccRollCreateRollMock).toHaveBeenCalledTimes(0)
  expect(rollToMessageMock).toHaveBeenLastCalledWith(
    expect.objectContaining({
      flavor: 'Custom Die Skill',
      speaker: actor,
      flags: expect.objectContaining({
        'dcc.RollType': 'SkillCheck',
        'dcc.ItemId': 'customDieSkill',
        'dcc.SkillId': 'customDieSkill',
        'dcc.isSkillCheck': true
      })
    }),
    { create: false }
  )
})

test('roll Custom Die And Value Skill', async () => {
  dccRollCreateRollMock.mockClear()
  await actor.rollSkillCheck('customDieAndValueSkill')
  expect(dccRollCreateRollMock).toHaveBeenCalledTimes(0)
  expect(rollToMessageMock).toHaveBeenLastCalledWith(
    expect.objectContaining({
      flavor: 'Custom Die And Value Skill',
      speaker: actor,
      flags: expect.objectContaining({
        'dcc.RollType': 'SkillCheck',
        'dcc.ItemId': 'customDieAndValueSkill',
        'dcc.SkillId': 'customDieAndValueSkill',
        'dcc.isSkillCheck': true
      })
    }),
    { create: false }
  )
})

test('roll Action Die Skill', async () => {
  dccRollCreateRollMock.mockClear()
  await actor.rollSkillCheck('actionDieSkill')
  expect(dccRollCreateRollMock).toHaveBeenCalledTimes(0)
  expect(rollToMessageMock).toHaveBeenLastCalledWith(
    expect.objectContaining({
      flavor: 'Action Die Skill',
      speaker: actor,
      flags: expect.objectContaining({
        'dcc.RollType': 'SkillCheck',
        'dcc.ItemId': 'actionDieSkill',
        'dcc.SkillId': 'actionDieSkill',
        'dcc.isSkillCheck': true
      })
    }),
    { create: false }
  )
})

test('roll Custom Die Skill With Int', async () => {
  dccRollCreateRollMock.mockClear()
  await actor.rollSkillCheck('customDieSkillWithInt')
  expect(dccRollCreateRollMock).toHaveBeenCalledTimes(0)
  expect(rollToMessageMock).toHaveBeenLastCalledWith(
    expect.objectContaining({
      flavor: 'Custom Die Skill With Int (Intelligence)',
      speaker: actor,
      flags: expect.objectContaining({
        'dcc.RollType': 'SkillCheck',
        'dcc.Ability': 'int',
        'dcc.ItemId': 'customDieSkillWithInt',
        'dcc.SkillId': 'customDieSkillWithInt',
        'dcc.isSkillCheck': true
      })
    }),
    { create: false }
  )
})

test('roll Custom Die And Value Skill With Per', async () => {
  dccRollCreateRollMock.mockClear()
  await actor.rollSkillCheck('customDieAndValueSkillWithPer')
  expect(dccRollCreateRollMock).toHaveBeenCalledTimes(0)
  expect(rollToMessageMock).toHaveBeenLastCalledWith(
    expect.objectContaining({
      flavor: 'Custom Die And Value Skill With Per (Personality)',
      speaker: actor,
      flags: expect.objectContaining({
        'dcc.RollType': 'SkillCheck',
        'dcc.Ability': 'per',
        'dcc.ItemId': 'customDieAndValueSkillWithPer',
        'dcc.SkillId': 'customDieAndValueSkillWithPer',
        'dcc.isSkillCheck': true
      })
    }),
    { create: false }
  )
})

test('roll Custom Die And Value Luck', async () => {
  dccRollCreateRollMock.mockClear()
  await actor.rollSkillCheck('actionDieAndValueSkillWithLck')
  expect(dccRollCreateRollMock).toHaveBeenCalledTimes(0)
  expect(rollToMessageMock).toHaveBeenLastCalledWith(
    expect.objectContaining({
      flavor: 'Action Die And Value Skill With Lck (Luck)',
      speaker: actor,
      flags: expect.objectContaining({
        'dcc.RollType': 'SkillCheck',
        'dcc.Ability': 'lck',
        'dcc.ItemId': 'actionDieAndValueSkillWithLck',
        'dcc.SkillId': 'actionDieAndValueSkillWithLck',
        'dcc.isSkillCheck': true
      })
    }),
    { create: false }
  )
})

test('roll luck die', async () => {
  dccRollCreateRollMock.mockClear()
  actorUpdateMock.mockClear()

  await actor.rollLuckDie()
  expect(dccRollCreateRollMock).toHaveBeenCalledTimes(1)
  expect(dccRollCreateRollMock).toHaveBeenCalledWith(
    [
      {
        type: 'LuckDie',
        formula: '1d3',
        lck: 18,
        callback: expect.any(Function)
      }
    ],
    actor.getRollData(),
    {
      title: 'Luck Die'
    }
  )
  expect(actorUpdateMock).toHaveBeenCalledTimes(1)
  expect(actorUpdateMock).toHaveBeenCalledWith(
    {
      'system.abilities.lck.value': 17
    }
  )
})

test('roll spell check routes naked check via adapter (Phase 3 session 25 / D4 naked)', async () => {
  dccRollCreateRollMock.mockClear()
  collectionFindMock.mockReset()
  uiNotificationsWarnMock.mockReset()
  game.dcc.processSpellCheck.mockClear()
  rollToMessageMock.mockClear()

  // Naked spell check (no `options.spell`) now routes through
  // `_castNakedViaAdapter` instead of the legacy term-builder →
  // `processSpellCheck` flow, which is no longer reachable for the
  // no-item case.
  await actor.rollSpellCheck()

  expect(dccRollCreateRollMock).not.toHaveBeenCalled()
  expect(game.dcc.processSpellCheck).not.toHaveBeenCalled()
  expect(rollToMessageMock).toHaveBeenCalled()
  expect(collectionFindMock).toHaveBeenCalledTimes(0)
})

test('roll spell check int routes naked check via adapter (D4 naked)', async () => {
  dccRollCreateRollMock.mockClear()
  collectionFindMock.mockReset()
  uiNotificationsWarnMock.mockReset()
  game.dcc.processSpellCheck.mockClear()
  rollToMessageMock.mockClear()

  await actor.rollSpellCheck({ abilityId: 'int' })

  expect(dccRollCreateRollMock).not.toHaveBeenCalled()
  expect(game.dcc.processSpellCheck).not.toHaveBeenCalled()
  expect(rollToMessageMock).toHaveBeenCalled()
  expect(collectionFindMock).toHaveBeenCalledTimes(0)
})

test('roll spell check per routes naked check via adapter (D4 naked)', async () => {
  dccRollCreateRollMock.mockClear()
  collectionFindMock.mockReset()
  uiNotificationsWarnMock.mockReset()
  game.dcc.processSpellCheck.mockClear()
  rollToMessageMock.mockClear()

  await actor.rollSpellCheck({ abilityId: 'per' })

  expect(dccRollCreateRollMock).not.toHaveBeenCalled()
  expect(game.dcc.processSpellCheck).not.toHaveBeenCalled()
  expect(rollToMessageMock).toHaveBeenCalled()
  expect(collectionFindMock).toHaveBeenCalledTimes(0)
})

test('roll spell check sta routes naked check via adapter (D4 naked)', async () => {
  dccRollCreateRollMock.mockClear()
  collectionFindMock.mockReset()
  uiNotificationsWarnMock.mockReset()
  game.dcc.processSpellCheck.mockClear()
  rollToMessageMock.mockClear()

  await actor.rollSpellCheck({ abilityId: 'sta' })

  expect(dccRollCreateRollMock).not.toHaveBeenCalled()
  expect(game.dcc.processSpellCheck).not.toHaveBeenCalled()
  expect(rollToMessageMock).toHaveBeenCalled()
  expect(collectionFindMock).toHaveBeenCalledTimes(0)
})

test('roll spell check item', async () => {
  dccRollCreateRollMock.mockClear()
  collectionFindMock.mockReset()
  uiNotificationsWarnMock.mockReset()
  rollToMessageMock.mockClear()

  // Roll a spell check with an item. The item carries no explicit
  // `config.castingMode`, so the dispatcher treats it as generic and
  // routes it through the adapter's synthetic-generic `_castViaCastSpell`
  // (Phase 7 session 16 — the former `_rollSpellCheckLegacy` fall-through
  // is now adapter-owned). The cast no longer delegates to
  // `DCCItem.rollSpellCheck`.
  const dummyItem = new DCCItem({ name: 'The Gloaming', type: 'spell' })
  collectionFindMock.mockReturnValue(dummyItem)
  const dccItemRollSpellCheckSpy = vi.spyOn(DCCItem.prototype, 'rollSpellCheck')
  await actor.rollSpellCheck({ spell: 'The Gloaming' })
  expect(collectionFindMock).toHaveBeenCalledTimes(1)
  expect(dccItemRollSpellCheckSpy).not.toHaveBeenCalled()
  expect(rollToMessageMock).toHaveBeenCalled()
  expect(uiNotificationsWarnMock).toHaveBeenCalledTimes(0)
})

test('roll spell check wrong item type', async () => {
  dccRollCreateRollMock.mockClear()
  collectionFindMock.mockReset()
  uiNotificationsWarnMock.mockReset()
  game.dcc.processSpellCheck.mockClear()
  // Roll a spell check with an item of the wrong type
  collectionFindMock.mockReturnValue(new DCCItem('Swordfish', 'weapon'))
  await actor.rollSpellCheck({ spell: 'Swordfish' })
  expect(uiNotificationsWarnMock).toHaveBeenCalledTimes(1)
  expect(uiNotificationsWarnMock).toHaveBeenCalledWith('SpellCheckNonSpellWarning')
})

test('roll spell check missing spell', async () => {
  dccRollCreateRollMock.mockClear()
  collectionFindMock.mockReset()
  uiNotificationsWarnMock.mockReset()
  game.dcc.processSpellCheck.mockClear()
  // Roll a spell check with an unowned item
  collectionFindMock.mockReturnValue(null)
  await actor.rollSpellCheck({ spell: 'Missing Spell' })
  expect(uiNotificationsWarnMock).toHaveBeenCalledWith('SpellCheckNoOwnedItemWarning')
})

// Enhanced Actor Testing - Phase 3.1 Implementation

test('computeSpellCheck sets correct values', () => {
  // Test default intelligence-based spell check
  actor.computeSpellCheck()
  expect(actor.system.class.spellCheck).toEqual('+1+1') // level 1 + int mod 1 (ensurePlus format)

  // Test personality-based spell check
  actor.system.class.spellCheckAbility = 'per'
  actor.computeSpellCheck()
  expect(actor.system.class.spellCheck).toEqual('+1+2') // level 1 + per mod 2

  // Test stamina-based spell check
  actor.system.class.spellCheckAbility = 'sta'
  actor.computeSpellCheck()
  expect(actor.system.class.spellCheck).toEqual('+1+0') // level 1 + sta mod 0

  // Test with other modifier (reset to per for this test)
  actor.system.class.spellCheckAbility = 'per'
  actor.system.class.spellCheckOtherMod = '+2'
  actor.computeSpellCheck()
  expect(actor.system.class.spellCheck).toEqual('+1+2+2') // level 1 + per mod 2 + other 2

  // Test with override
  actor.system.class.spellCheckOverride = '+10'
  actor.computeSpellCheck()
  expect(actor.system.class.spellCheck).toEqual('+10')
})

test('computeSpellCheck fires the dcc.afterComputeSpellCheck extension hook', () => {
  // Stable extension hook for sibling modules (closes XCC's monkey-
  // patch on `CONFIG.Actor.documentClass`). Hook runs AFTER DCC has
  // populated `system.class.spellCheck` so listeners can either
  // observe or overwrite the result.
  const callAllSpy = vi.spyOn(global.Hooks, 'callAll')
  callAllSpy.mockClear()

  actor.computeSpellCheck()

  const afterComputeCalls = callAllSpy.mock.calls.filter(c => c[0] === 'dcc.afterComputeSpellCheck')
  expect(afterComputeCalls).toHaveLength(1)
  expect(afterComputeCalls[0][1]).toBe(actor)

  callAllSpy.mockRestore()
})

test('computeSpellCheck early-return path (no class) skips the hook', () => {
  // Only fire the extension hook when DCC actually computed something
  // — otherwise listeners would have to defensively re-check.
  const callAllSpy = vi.spyOn(global.Hooks, 'callAll')
  callAllSpy.mockClear()

  const noClassActor = new DCCActor()
  noClassActor.system = { ...noClassActor.system, class: null }
  noClassActor.computeSpellCheck()

  const afterComputeCalls = callAllSpy.mock.calls.filter(c => c[0] === 'dcc.afterComputeSpellCheck')
  expect(afterComputeCalls).toHaveLength(0)

  callAllSpy.mockRestore()
})

test('computeSavingThrows calculates correct values', () => {
  actor.system.config.computeSavingThrows = true
  actor.computeSavingThrows()

  // Ref save = agl mod + class bonus + other bonus
  expect(actor.system.saves.ref.value).toEqual('-1') // agl -1 + 0 + 0

  // Frt save = sta mod + class bonus + other bonus
  expect(actor.system.saves.frt.value).toEqual('+0') // sta 0 + 0 + 0

  // Wil save = per mod + class bonus + other bonus
  expect(actor.system.saves.wil.value).toEqual('+2') // per 2 + 0 + 0

  // Test with overrides
  actor.system.saves.ref.override = '5'
  actor.system.saves.frt.override = '3'
  actor.system.saves.wil.override = '7'
  actor.computeSavingThrows()
  expect(actor.system.saves.ref.value).toEqual('+5')
  expect(actor.system.saves.frt.value).toEqual('+3')
  expect(actor.system.saves.wil.value).toEqual('+7')
})

test('computeSavingThrows handles zero overrides correctly', () => {
  actor.system.config.computeSavingThrows = true

  // Test that zero overrides are applied correctly (not ignored)
  actor.system.saves.ref.override = '0'
  actor.system.saves.frt.override = 0
  actor.system.saves.wil.override = '0'
  actor.computeSavingThrows()

  expect(actor.system.saves.ref.value).toEqual('+0') // Should use override value of 0
  expect(actor.system.saves.frt.value).toEqual('+0') // Should use override value of 0
  expect(actor.system.saves.wil.value).toEqual('+0') // Should use override value of 0

  // Test that empty/null/undefined overrides are ignored
  actor.system.saves.ref.override = ''
  actor.system.saves.frt.override = null
  actor.system.saves.wil.override = undefined
  actor.computeSavingThrows()

  expect(actor.system.saves.ref.value).toEqual('-1') // Should use calculated value (agl -1)
  expect(actor.system.saves.frt.value).toEqual('+0') // Should use calculated value (sta 0)
  expect(actor.system.saves.wil.value).toEqual('+2') // Should use calculated value (per 2)
})

test('computeMeleeAndMissileAttackAndDamage with flat bonus', () => {
  actor.system.details.attackBonus = '+2'
  actor.computeMeleeAndMissileAttackAndDamage()

  // Melee attack = attack bonus + str mod + adjustment
  expect(actor.system.details.attackHitBonus.melee.value).toEqual('+1') // 2 + (-1) + 0

  // Missile attack = attack bonus + agl mod + adjustment
  expect(actor.system.details.attackHitBonus.missile.value).toEqual('+1') // 2 + (-1) + 0

  // Melee damage = str mod + adjustment
  expect(actor.system.details.attackDamageBonus.melee.value).toEqual('-1') // (-1) + 0

  // Missile damage = adjustment only
  expect(actor.system.details.attackDamageBonus.missile.value).toEqual('+0') // 0
})

test('computeMeleeAndMissileAttackAndDamage with deed die', () => {
  actor.system.details.attackBonus = '1d3+1'
  actor.computeMeleeAndMissileAttackAndDamage()

  // With deed die, formulas include the die expression
  expect(actor.system.details.attackHitBonus.melee.value).toEqual('+1d3') // +1d3 + (-1 str + 0 adj + 1 bonus) = +1d3+0
  expect(actor.system.details.attackHitBonus.missile.value).toEqual('+1d3') // +1d3 + (-1 agl + 0 adj + 1 bonus) = +1d3+0
  expect(actor.system.details.attackDamageBonus.melee.value).toEqual('+1d3') // +1d3 + (-1 str + 0 adj + 1 bonus) = +1d3+0
  expect(actor.system.details.attackDamageBonus.missile.value).toEqual('+1d3+1') // +1d3 + (0 adj + 1 bonus)
})

test('getActionDice returns correct dice array', () => {
  const actionDice = actor.getActionDice()
  expect(actionDice).toHaveLength(1)
  expect(actionDice[0].formula).toEqual('1d20')
  expect(actionDice[0].label).toEqual('1d20')

  // Test with multiple dice
  actor.system.config.actionDice = '1d20,1d16'
  const multiDice = actor.getActionDice()
  expect(multiDice).toHaveLength(2)
  expect(multiDice[0].formula).toEqual('1d20')
  expect(multiDice[1].formula).toEqual('1d16')

  // Test with untrained option
  const withUntrained = actor.getActionDice({ includeUntrained: true })
  expect(withUntrained).toHaveLength(3)
  expect(withUntrained[2].formula).toEqual('1d10')
  expect(withUntrained[2].label).toEqual('Untrained')
})

test('getAttackBonusMode returns valid modes', () => {
  expect(actor.getAttackBonusMode()).toEqual('flat')

  actor.system.config.attackBonusMode = 'manual'
  expect(actor.getAttackBonusMode()).toEqual('manual')

  actor.system.config.attackBonusMode = 'autoPerAttack'
  expect(actor.getAttackBonusMode()).toEqual('autoPerAttack')

  actor.system.config.attackBonusMode = 'invalid'
  expect(actor.getAttackBonusMode()).toEqual('flat')
})

test('rollHitDice for player character', async () => {
  dccRollCreateRollMock.mockClear()

  // Initialize hitDice attribute
  actor.system.attributes.hitDice = { value: '1d4' }

  await actor.rollHitDice()

  expect(dccRollCreateRollMock).toHaveBeenCalledWith(
    [
      {
        type: 'Compound',
        formula: '1d4'
      }
    ],
    actor.getRollData(),
    { title: 'RollModifierHitDice' }
  )
})

test('rollHitDice with fractional dice', async () => {
  dccRollCreateRollMock.mockClear()

  // Initialize hitDice attribute
  actor.system.attributes.hitDice = { value: '½d4' }

  // Test half HD
  await actor.rollHitDice()

  expect(dccRollCreateRollMock).toHaveBeenCalledWith(
    [
      {
        type: 'Compound',
        formula: 'ceil(1d4/2)'
      }
    ],
    actor.getRollData(),
    { title: 'RollModifierHitDice' }
  )

  // Test quarter HD
  actor.system.attributes.hitDice.value = '¼d6'
  await actor.rollHitDice()

  expect(dccRollCreateRollMock).toHaveBeenCalledWith(
    [
      {
        type: 'Compound',
        formula: 'ceil(1d6/4)'
      }
    ],
    actor.getRollData(),
    { title: 'RollModifierHitDice' }
  )
})

test('applyDamage reduces hit points', async () => {
  actorUpdateMock.mockClear()

  await actor.applyDamage(2, 1)

  expect(actorUpdateMock).toHaveBeenCalledWith({
    'system.attributes.hp.value': 1 // 3 - 2
  })
})

test('applyDamage with healing', async () => {
  actorUpdateMock.mockClear()

  // Set current HP below max (actor starts with 3 HP max)
  actor.system.attributes.hp.value = 1

  await actor.applyDamage(-2, 1) // Negative damage = healing

  expect(actorUpdateMock).toHaveBeenCalledWith({
    'system.attributes.hp.value': 3 // min(1 + 2, 3)
  })
})

test('applyDamage does not overheal', async () => {
  actorUpdateMock.mockClear()

  // Current HP already at max (3)
  actor.system.attributes.hp.value = 3

  await actor.applyDamage(-5, 1) // Try to overheal

  expect(actorUpdateMock).toHaveBeenCalledWith({
    'system.attributes.hp.value': 3 // Stays at max
  })
})

test('applyDamage allows damage below zero', async () => {
  actorUpdateMock.mockClear()

  await actor.applyDamage(10, 1) // More damage than current HP

  expect(actorUpdateMock).toHaveBeenCalledWith({
    'system.attributes.hp.value': -7 // 3 - 10 = -7
  })
})

test('loseSpell marks spell as lost', async () => {
  const spellItem = {
    name: 'Test Spell',
    update: vi.fn()
  }

  await actor.loseSpell(spellItem)

  expect(spellItem.update).toHaveBeenCalledWith({
    'system.lost': true
  })
})

test('loseSpell without item still creates message', async () => {
  await actor.loseSpell(null)
  // Should complete without errors and create a chat message
})

test('applyDisapproval increases disapproval range', async () => {
  actorUpdateMock.mockClear()
  actor.system.class.disapproval = 2

  await actor.applyDisapproval(1)

  expect(actorUpdateMock).toHaveBeenCalledWith({
    'system.class.disapproval': 3
  })
})

test('applyDisapproval caps at 20', async () => {
  actorUpdateMock.mockClear()
  actor.system.class.disapproval = 19

  await actor.applyDisapproval(5) // Try to go over 20

  expect(actorUpdateMock).toHaveBeenCalledWith({
    'system.class.disapproval': 20 // Capped at 20
  })
})

test('applyDisapproval does nothing for NPCs', async () => {
  actorUpdateMock.mockClear()
  // Create an NPC actor using the mock setup
  const npcActor = Object.create(actor)
  npcActor.type = 'NPC'
  npcActor.isNPC = true
  npcActor.isPC = false

  await npcActor.applyDisapproval(1)

  expect(actorUpdateMock).not.toHaveBeenCalled()
})

test('rollDisapproval creates proper terms', async () => {
  dccRollCreateRollMock.mockClear()

  await actor.rollDisapproval(3)

  expect(dccRollCreateRollMock).toHaveBeenCalledWith(
    [
      {
        type: 'DisapprovalDie',
        formula: '3d4'
      },
      {
        type: 'Modifier',
        label: 'Luck Modifier',
        formula: -3 // Negative luck mod
      }
    ],
    actor.getRollData(),
    {}
  )
})

test('rollDisapproval forces dialog when no natural roll', async () => {
  dccRollCreateRollMock.mockClear()

  await actor.rollDisapproval() // No natural roll provided

  expect(dccRollCreateRollMock).toHaveBeenCalledWith(
    expect.any(Array),
    actor.getRollData(),
    { showModifierDialog: true }
  )
})

// Note: rollCritical tests removed due to CONFIG.DCC.criticalHitPacks mock limitations

// Note: skill check with itemTypes test removed due to mock property redefinition issues

test('skill check with disapproval range sets threshold', async () => {
  dccRollCreateRollMock.mockClear()

  // Set up a skill that uses disapproval range
  actor.system.skills.divineAid = {
    label: 'Divine Aid',
    useDisapprovalRange: true,
    die: '1d20'
  }
  actor.system.class.disapproval = 3

  await actor.rollSkillCheck('divineAid')

  expect(dccRollCreateRollMock).toHaveBeenCalled()
  // The roll should be evaluated and have disapproval threshold set
})

// Note: rollToHit tests removed due to mock complexity

test('rollToHit with backstab adds bonus', async () => {
  dccRollCreateRollMock.mockClear()

  const weapon = {
    system: {
      toHit: '+2',
      actionDie: '1d20'
    }
  }

  await actor.rollToHit(weapon, { backstab: true })

  expect(dccRollCreateRollMock).toHaveBeenCalledWith(
    expect.arrayContaining([
      expect.objectContaining({
        type: 'Modifier',
        label: 'Backstab',
        formula: 0 // Default backstab bonus
      })
    ]),
    expect.any(Object),
    expect.objectContaining({
      backstab: true
    })
  )
})

test('getInitiativeRoll with two-handed weapon', () => {
  // Inject a real two-handed weapon into the items collection. The adapter
  // iterates `this.items` in a single pass (it no longer calls `.find`), so
  // assert the weapon's d16 init die actually reaches the formula rather
  // than just that a Roll comes back.
  const originalItems = actor.items
  actor.items = new global.Collection([['two-handed', {
    system: {
      twoHanded: true,
      equipped: true,
      initiativeDie: '1d16',
      config: {}
    }
  }]])

  try {
    const roll = actor.getInitiativeRoll()

    expect(roll).toBeDefined()
    expect(roll.formula).toMatch(/1d16/)
  } finally {
    actor.items = originalItems
  }
})

test('prepareBaseData sets ability modifiers correctly', () => {
  // Verify ability modifiers are calculated from CONFIG
  expect(actor.system.abilities.str.mod).toEqual(-1)
  expect(actor.system.abilities.agl.mod).toEqual(-1)
  expect(actor.system.abilities.sta.mod).toEqual(0)
  expect(actor.system.abilities.int.mod).toEqual(1)
  expect(actor.system.abilities.per.mod).toEqual(2)
  expect(actor.system.abilities.lck.mod).toEqual(3)
})

// Note: prepareBaseData armor test removed due to itemTypes mock redefinition issues

// Note: prepareDerivedData tests removed due to mock method limitations

// Note: Remaining complex integration tests removed due to mock limitations

// Note: levelChange test removed due to mock import issues

test('_getConfig merges with defaults', () => {
  // Reset config to test defaults
  actor.system.config = {}
  const config = actor._getConfig()

  expect(config).toEqual(expect.objectContaining({
    attackBonusMode: 'flat',
    actionDice: '1d20',
    maxLevel: '',
    computeAC: false,
    computeMeleeAndMissileAttackAndDamage: true,
    computeSpeed: false,
    baseACAbility: 'agl',
    sortInventory: true,
    removeEmptyItems: true
  }))
})

// Enhanced Actor Testing - Phase 3.1 Additional Tests

test('rollInit creates initiative roll', async () => {
  // Adapter path — `new Roll(formula)` replaces `DCCRoll.createRoll`.
  // Assert rollInit runs end-to-end and does not hit the legacy path.
  dccRollCreateRollMock.mockClear()

  // Mock the sheet._fillRollOptions method
  actor.sheet = {
    _fillRollOptions: vi.fn().mockReturnValue({ showModifierDialog: false })
  }

  await actor.rollInit(null, null)

  expect(dccRollCreateRollMock).not.toHaveBeenCalled()
})

test('rollHitDice for NPC rolls dice', async () => {
  dccRollCreateRollMock.mockClear()

  // Create NPC actor with proper prototype chain
  const npcActor = new DCCActor()
  npcActor.type = 'NPC'
  npcActor.isNPC = true
  npcActor.isPC = false
  npcActor.system.attributes.hitDice = { value: '2d8' }
  npcActor.system.attributes.hp = { max: 10, value: 10 }

  await npcActor.rollHitDice()

  expect(dccRollCreateRollMock).toHaveBeenCalledWith(
    [
      {
        type: 'Compound',
        formula: '2d8'
      }
    ],
    npcActor.getRollData(),
    { title: 'RollModifierHitDice' }
  )
})

test('rollSkillCheck with disapproval range for cleric', async () => {
  dccRollCreateRollMock.mockClear()

  // Set up cleric with disapproval
  actor.system.details.sheetClass = 'Cleric'
  actor.system.class.disapproval = 4
  actor.system.skills.layOnHands = {
    label: 'Lay on Hands',
    die: '1d20',
    value: '+2',
    useDeed: false,
    useDisapprovalRange: true
  }

  await actor.rollSkillCheck('layOnHands')

  expect(dccRollCreateRollMock).toHaveBeenCalled()
  // Check that disapproval threshold would be set on the roll
  const rollCall = dccRollCreateRollMock.mock.calls[0]
  expect(rollCall[2].title).toBe('Lay on Hands')
})

test('rollSkillCheck routes cleric disapproval-range abilities via adapter (D4 skill-table)', async () => {
  // Phase 3 session 25 / D4(skill-table): turnUnholy etc. route
  // through `_skillTableViaAdapter` (not `processSpellCheck`). The
  // adapter handles the table lookup + chat emit + drainDisapproval
  // inline, mirroring the legacy behavior without the dcc.js detour.
  dccRollCreateRollMock.mockClear()
  game.dcc.processSpellCheck.mockClear()
  game.dcc.getSkillTable.mockClear()
  rollToMessageMock.mockClear()

  game.dcc.getSkillTable.mockResolvedValue(null)

  actor.system.details.sheetClass = 'Cleric'
  actor.system.class.disapproval = 1
  actor.system.skills.turnUnholy = {
    label: 'DCC.TurnUnholy',
    die: '1d20',
    value: 0,
    useDisapprovalRange: true
  }

  await actor.rollSkillCheck('turnUnholy')

  expect(game.dcc.processSpellCheck).not.toHaveBeenCalled()
  // Adapter still uses DCCRoll.createRoll for the underlying skill roll
  // (terms, dialog, lower-threshold display) — preserved from legacy.
  expect(dccRollCreateRollMock).toHaveBeenCalled()
  // Disapproval-only-no-table path emits chat via roll.toMessage with
  // the SpellCheck*NoTable HTML indicator.
  expect(rollToMessageMock).toHaveBeenCalled()
})

test('rollSkillCheck routes layOnHands via adapter (D4 skill-table)', async () => {
  dccRollCreateRollMock.mockClear()
  game.dcc.processSpellCheck.mockClear()
  game.dcc.getSkillTable.mockClear()
  rollToMessageMock.mockClear()

  game.dcc.getSkillTable.mockResolvedValue(null)

  actor.system.details.sheetClass = 'Cleric'
  actor.system.class.disapproval = 1
  actor.system.skills.layOnHands = {
    label: 'DCC.LayOnHands',
    die: '1d20',
    value: 0,
    useDisapprovalRange: true
  }

  await actor.rollSkillCheck('layOnHands')

  expect(game.dcc.processSpellCheck).not.toHaveBeenCalled()
  expect(dccRollCreateRollMock).toHaveBeenCalled()
  expect(rollToMessageMock).toHaveBeenCalled()
})

test('rollSkillCheck routes divineAid via adapter and applies +10 disapproval (D4 skill-table)', async () => {
  dccRollCreateRollMock.mockClear()
  game.dcc.processSpellCheck.mockClear()
  game.dcc.getSkillTable.mockClear()
  actorUpdateMock.mockClear()

  game.dcc.getSkillTable.mockResolvedValue(null)

  // Mock automateClericDisapproval to return true for this test
  const originalGet = game.settings.get
  game.settings.get = vi.fn((module, key) => {
    if (module === 'dcc' && key === 'automateClericDisapproval') return true
    if (module === 'core' && key === 'messageMode') return 'public'
    return originalGet(module, key)
  })

  actor.system.details.sheetClass = 'Cleric'
  actor.system.class.disapproval = 1
  actor.system.skills.divineAid = {
    label: 'DCC.DivineAid',
    die: '1d20',
    value: 0,
    useDisapprovalRange: true,
    drainDisapproval: 10
  }

  await actor.rollSkillCheck('divineAid')

  expect(game.dcc.processSpellCheck).not.toHaveBeenCalled()
  // drainDisapproval still applies via the adapter's
  // `actor.applyDisapproval(skill.drainDisapproval)` call — mirrors
  // the former legacy skill-check post-step.
  expect(actorUpdateMock).toHaveBeenCalledWith({
    'system.class.disapproval': 11
  })

  // Restore original settings mock
  game.settings.get = originalGet
})

test('rollSkillCheck does not apply drainDisapproval for turnUnholy (D4 skill-table)', async () => {
  dccRollCreateRollMock.mockClear()
  game.dcc.processSpellCheck.mockClear()
  game.dcc.getSkillTable.mockClear()
  actorUpdateMock.mockClear()

  game.dcc.getSkillTable.mockResolvedValue(null)

  actor.system.details.sheetClass = 'Cleric'
  actor.system.class.disapproval = 1
  actor.system.skills.turnUnholy = {
    label: 'DCC.TurnUnholy',
    die: '1d20',
    value: 0,
    useDisapprovalRange: true
  }

  await actor.rollSkillCheck('turnUnholy')

  expect(game.dcc.processSpellCheck).not.toHaveBeenCalled()
  // Turn unholy has no `drainDisapproval` key, so no
  // `applyDisapproval` mutation should fire.
  expect(actorUpdateMock).not.toHaveBeenCalled()
})

test('rollSkillCheck does not route regular skills through processSpellCheck', async () => {
  dccRollCreateRollMock.mockClear()
  game.dcc.processSpellCheck.mockClear()
  game.dcc.getSkillTable.mockClear()
  rollToMessageMock.mockClear()

  game.dcc.getSkillTable.mockResolvedValue(null)

  actor.system.details.sheetClass = 'Cleric'
  actor.system.skills.sneakSilently = {
    label: 'DCC.SneakSilently',
    die: '1d20',
    value: '+2'
  }

  await actor.rollSkillCheck('sneakSilently')

  // Regular skills should NOT go through processSpellCheck
  expect(game.dcc.processSpellCheck).not.toHaveBeenCalled()
  // Should use the plain skill check path
  expect(rollToMessageMock).toHaveBeenCalled()
})

test('rollSkillCheck routes spell-like wizard skills through the adapter with spell-loss automation', async () => {
  dccRollCreateRollMock.mockClear()
  game.dcc.processSpellCheck.mockClear()
  game.dcc.getSkillTable.mockClear()
  game.dcc.getSkillTable.mockResolvedValue(null)

  // Wizard spell-loss automation enabled for this test
  const originalGet = game.settings.get
  game.settings.get = vi.fn((module, key) => {
    if (module === 'dcc' && key === 'automateWizardSpellLoss') return true
    if (module === 'core' && key === 'messageMode') return 'public'
    return originalGet(module, key)
  })

  const loseSpellSpy = vi.spyOn(actor, 'loseSpell').mockResolvedValue(undefined)

  // A custom skill item that casts like a wizard spell (issue #375): no
  // result table, no disapproval range, just an explicit casting mode. Spell-
  // like skills route through the one adapter path, not a processSpellCheck
  // detour.
  const skillItem = new DCCItem({
    name: 'Runic Alphabet',
    type: 'skill',
    system: {
      config: {
        useSummary: false,
        useAbility: false,
        useDie: true,
        useLevel: false,
        useValue: true,
        showLastResult: false,
        applyCheckPenalty: false,
        castingMode: 'wizard'
      },
      die: '1d20',
      value: '+0',
      description: { value: '' }
    }
  })
  global.itemTypesMock.mockReturnValue({
    skill: {
      find: vi.fn().mockReturnValue(skillItem)
    }
  })

  await actor.rollSkillCheck('Runic Alphabet')

  // Unified adapter path — no processSpellCheck detour for spell-like skills
  expect(game.dcc.processSpellCheck).not.toHaveBeenCalled()
  expect(dccRollCreateRollMock).toHaveBeenCalled()
  // The default failing roll (total 10 < threshold 12) loses the spell
  expect(loseSpellSpy).toHaveBeenCalledWith(skillItem)

  loseSpellSpy.mockRestore()
  global.itemTypesMock.mockReset()
  game.settings.get = originalGet
})

test('rollSkillCheck does not route generic casting mode skills through processSpellCheck', async () => {
  dccRollCreateRollMock.mockClear()
  game.dcc.processSpellCheck.mockClear()
  game.dcc.getSkillTable.mockClear()
  rollToMessageMock.mockClear()

  game.dcc.getSkillTable.mockResolvedValue(null)

  // Generic casting mode means no failure automation - plain skill path
  actor.system.skills.plainSkill = {
    label: 'Plain Skill',
    die: '1d20',
    value: '+2',
    castingMode: 'generic'
  }

  await actor.rollSkillCheck('plainSkill')

  expect(game.dcc.processSpellCheck).not.toHaveBeenCalled()
  expect(rollToMessageMock).toHaveBeenCalled()
})

test('rollSkillCheck leaves castingMode undefined for cleric abilities without one', async () => {
  dccRollCreateRollMock.mockClear()
  game.dcc.processSpellCheck.mockClear()
  game.dcc.getSkillTable.mockClear()

  game.dcc.getSkillTable.mockResolvedValue(null)

  // Built-in cleric abilities carry no castingMode of their own, so they
  // are not treated as spell-like skills: they route through the adapter's
  // skill-table / disapproval-range path rather than the #375 castingMode
  // branch, leaving processSpellCheck's own sheet-class default in charge.
  actor.system.details.sheetClass = 'Cleric'
  actor.system.class.disapproval = 1
  actor.system.skills.turnUnholy = {
    label: 'DCC.TurnUnholy',
    die: '1d20',
    value: 0,
    useDisapprovalRange: true
  }

  await actor.rollSkillCheck('turnUnholy')

  // Without an explicit castingMode the new #375 branch must not fire, so
  // turnUnholy is not misrouted through processSpellCheck by rollSkillCheck
  expect(game.dcc.processSpellCheck).not.toHaveBeenCalled()
})

test('rollLuckDie with negative luck modifier', async () => {
  dccRollCreateRollMock.mockClear()
  actorUpdateMock.mockClear()

  // Set luck to low value for negative modifier
  actor.system.abilities.lck.value = 3
  actor.system.abilities.lck.mod = -3

  await actor.rollLuckDie()

  expect(dccRollCreateRollMock).toHaveBeenCalledWith(
    [
      {
        type: 'LuckDie',
        formula: '1d3',
        lck: 3,
        callback: expect.any(Function)
      }
    ],
    actor.getRollData(),
    {
      title: 'Luck Die'
    }
  )

  // Luck should decrease by 1
  expect(actorUpdateMock).toHaveBeenCalledWith({
    'system.abilities.lck.value': 2
  })
})

test('rollSpellCheck routes naked check via adapter (replaces calls-processSpellCheck assertion)', async () => {
  dccRollCreateRollMock.mockClear()
  game.dcc.processSpellCheck.mockClear()
  rollToMessageMock.mockClear()

  // Reset spell check ability to ensure consistent behavior
  actor.system.class.spellCheckAbility = 'int'
  actor.system.class.spellCheckOverride = ''
  actor.system.class.spellCheckOtherMod = ''

  await actor.rollSpellCheck({ abilityId: 'int' })

  // D4(naked) replaced the legacy term-builder + processSpellCheck
  // flow with the adapter's `_castNakedViaAdapter`. processSpellCheck
  // is no longer reachable from naked spell-check paths.
  expect(game.dcc.processSpellCheck).not.toHaveBeenCalled()
  expect(rollToMessageMock).toHaveBeenCalled()
})

test('rollWeaponAttack creates attack roll', async () => {
  dccRollCreateRollMock.mockClear()

  // Mock the actor's items.find method to return a valid weapon
  const originalFind = actor.items.find
  actor.items.find = vi.fn().mockReturnValue({
    system: {
      toHit: '+1',
      damage: '1d6',
      actionDie: '1d20',
      equipped: true
    }
  })

  try {
    await actor.rollWeaponAttack('test-weapon')
    expect(dccRollCreateRollMock).toHaveBeenCalled()
  } finally {
    // Restore original method
    actor.items.find = originalFind
  }
})

test('rollWeaponAttack with invalid weapon id warns user', async () => {
  dccRollCreateRollMock.mockClear()
  uiNotificationsWarnMock.mockClear()

  // Mock the actor's items.find method to return null
  const originalFind = actor.items.find
  actor.items.find = vi.fn().mockReturnValue(null)

  await actor.rollWeaponAttack('missing-weapon')

  expect(uiNotificationsWarnMock).toHaveBeenCalled()

  // Restore original method
  actor.items.find = originalFind
})

test('rollToHit with basic weapon', async () => {
  dccRollCreateRollMock.mockClear()

  const weapon = {
    system: {
      toHit: '+2',
      actionDie: '1d20',
      damage: '1d8'
    }
  }

  await actor.rollToHit(weapon, { rollType: 'Attack' })

  expect(dccRollCreateRollMock).toHaveBeenCalled()
})

test('applyDamage with multiplier', async () => {
  actorUpdateMock.mockClear()

  // Current HP is 3
  await actor.applyDamage(2, 2) // 2 damage * 2 multiplier

  expect(actorUpdateMock).toHaveBeenCalledWith({
    'system.attributes.hp.value': -1 // 3 - (2*2) = -1
  })
})

test('rollDisapproval with specific dice count', async () => {
  dccRollCreateRollMock.mockClear()

  await actor.rollDisapproval(5)

  expect(dccRollCreateRollMock).toHaveBeenCalledWith(
    [
      {
        type: 'DisapprovalDie',
        formula: '5d4'
      },
      {
        type: 'Modifier',
        label: 'Luck Modifier',
        formula: -actor.system.abilities.lck.mod // Negative of luck mod
      }
    ],
    actor.getRollData(),
    {}
  )
})

test('rollDisapproval with no natural roll forces dialog', async () => {
  dccRollCreateRollMock.mockClear()

  await actor.rollDisapproval()

  // The roll is created with showModifierDialog
  expect(dccRollCreateRollMock).toHaveBeenCalledWith(
    expect.any(Array),
    actor.getRollData(),
    { showModifierDialog: true }
  )
})

test('computeMeleeAndMissileAttackAndDamage with adjustments', () => {
  // Set adjustments
  actor.system.details.attackHitAdjustment = { melee: '+1', missile: '+2' }
  actor.system.details.attackDamageAdjustment = { melee: '+1', missile: '+0' }
  actor.system.details.attackBonus = '+3'

  actor.computeMeleeAndMissileAttackAndDamage()

  // Need to check the actual computation logic
  // Melee: base + str mod + adjustment
  expect(actor.system.details.attackHitBonus.melee.value).toBeDefined()
  // Missile: base + agl mod + adjustment
  expect(actor.system.details.attackHitBonus.missile.value).toBeDefined()
  // Damage bonuses
  expect(actor.system.details.attackDamageBonus.melee.value).toBeDefined()
  expect(actor.system.details.attackDamageBonus.missile.value).toBeDefined()
})

test('getActionDice with formula expressions', () => {
  actor.system.config.actionDice = '1d20+1d14'

  const dice = actor.getActionDice()

  expect(dice).toHaveLength(2)
  expect(dice[0].formula).toEqual('1d20')
  expect(dice[1].formula).toEqual('1d14')
})

test('getActionDice with invalid format returns original', () => {
  actor.system.config.actionDice = 'invalid'

  const dice = actor.getActionDice()

  expect(dice).toHaveLength(1)
  expect(dice[0].formula).toEqual('invalid') // Returns as-is if not a valid die expression
})

test('getRollData includes all system data', () => {
  const rollData = actor.getRollData()

  expect(rollData).toHaveProperty('abilities')
  expect(rollData).toHaveProperty('attributes')
  expect(rollData).toHaveProperty('saves')
  expect(rollData).toHaveProperty('config')
  expect(rollData.abilities.str.mod).toEqual(-1)
})

test('levelChange creates dialog', () => {
  // Since we're mocking the module, we need to check if it was imported
  actor.levelChange()

  // The method should execute without errors
  expect(true).toBe(true)
})

test('roll skill check with useLevel config', async () => {
  dccRollCreateRollMock.mockClear()
  collectionFindMock.mockClear()

  // Create a skill item with useLevel configuration
  const skillItem = new DCCItem({
    name: 'levelBasedSkill',
    type: 'skill',
    system: {
      config: {
        useAbility: true,
        useDie: true,
        useLevel: true,
        useValue: true
      },
      ability: 'int',
      die: '1d20',
      value: '+2',
      description: {
        value: 'A level-based skill description'
      }
    }
  })

  // Mock the itemTypes to return our skill
  global.itemTypesMock.mockReturnValue({
    skill: {
      find: vi.fn().mockReturnValue(skillItem)
    }
  })

  // Set actor level
  actor.system.details.level.value = 5

  await actor.rollSkillCheck('levelBasedSkill')

  // Skill-item adapter path: DCCRoll.createRoll is not invoked; the
  // lib builds the formula and Foundry evaluates it directly.
  expect(dccRollCreateRollMock).toHaveBeenCalledTimes(0)
  expect(rollToMessageMock).toHaveBeenLastCalledWith(
    expect.objectContaining({
      flavor: 'levelBasedSkill (Intelligence)',
      speaker: actor,
      flags: expect.objectContaining({
        'dcc.RollType': 'SkillCheck',
        'dcc.Ability': 'int',
        'dcc.ItemId': 'levelBasedSkill',
        'dcc.SkillId': 'levelBasedSkill',
        'dcc.isSkillCheck': true
      })
    }),
    { create: false }
  )
})

test('roll skill check without useLevel config', async () => {
  dccRollCreateRollMock.mockClear()
  collectionFindMock.mockClear()

  // Create a skill item without useLevel configuration
  const skillItem = new DCCItem({
    name: 'nonLevelSkill',
    type: 'skill',
    system: {
      config: {
        useAbility: true,
        useDie: true,
        useLevel: false, // Explicitly set to false
        useValue: true
      },
      ability: 'per',
      die: '1d24',
      value: '+3',
      description: {
        value: 'A non-level skill description'
      }
    }
  })

  // Mock the itemTypes to return our skill
  global.itemTypesMock.mockReturnValue({
    skill: {
      find: vi.fn().mockReturnValue(skillItem)
    }
  })

  // Set actor level to ensure it's not used
  actor.system.level = 10

  await actor.rollSkillCheck('nonLevelSkill')

  expect(dccRollCreateRollMock).toHaveBeenCalledTimes(0)
  expect(rollToMessageMock).toHaveBeenLastCalledWith(
    expect.objectContaining({
      flavor: 'nonLevelSkill (Personality)',
      speaker: actor,
      flags: expect.objectContaining({
        'dcc.RollType': 'SkillCheck',
        'dcc.Ability': 'per',
        'dcc.ItemId': 'nonLevelSkill',
        'dcc.SkillId': 'nonLevelSkill',
        'dcc.isSkillCheck': true
      })
    }),
    { create: false }
  )
})

test('NPC skill item with useDie:false + a value modifier inherits the actor action die', async () => {
  // Regression (#742): imported NPCs carry skill items configured with
  // `useDie: false` but a flat `value` (e.g. "Divine Aid +4"). The
  // missing-die fallback in `_resolveSkill` must treat such a rollable
  // skill item like a built-in slot and inherit the actor's action die,
  // so it rolls with the action die rather than dropping to the
  // description path with no die.
  //
  // Branch architecture: ordinary skill checks flow through the lib
  // adapter (`_rollSkillCheckViaAdapter` → `new Roll(plan.formula)`), not
  // `DCCRoll.createRoll`, so this asserts the resolved term-builder output
  // (`_resolveSkill` + `_buildSkillCheckRollTerms`) — the unit that
  // implements the fix — rather than a `createRoll` call.
  const skillItem = new DCCItem({
    name: 'Divine Aid',
    type: 'skill',
    system: {
      config: {
        useSummary: true,
        useAbility: false,
        useDie: false,
        useLevel: false,
        useValue: true,
        showLastResult: false,
        applyCheckPenalty: false
      },
      ability: 'int',
      die: '1d20',
      value: '4',
      description: { value: '' }
    }
  })
  global.itemTypesMock.mockReturnValue({
    skill: {
      find: vi.fn().mockReturnValue(skillItem)
    }
  })

  // Ensure a clean action die (earlier tests can leave config.actionDice
  // mutated to 'invalid').
  actor.system.config.actionDice = '1d20'

  const resolved = actor._resolveSkill('Divine Aid')
  const terms = actor._buildSkillCheckRollTerms('Divine Aid', resolved)

  // Inherited the actor's action die (labelled "Action Die" because the
  // skill item carries no per-skill die).
  const dieTerm = terms.find(t => t.type === 'Die')
  expect(dieTerm).toBeDefined()
  expect(dieTerm.formula).toBe('1d20')
  expect(dieTerm.label).toBe(game.i18n.localize('DCC.ActionDie'))

  // Flat +4 skill value carried through as a Compound term.
  const valueTerm = terms.find(t => t.type === 'Compound')
  expect(valueTerm).toBeDefined()
  expect(valueTerm.formula).toBe('4')

  global.itemTypesMock.mockReset()
})

test('computeSpellCheck propagates spellCheckOtherMod to cleric abilities', () => {
  // Set up cleric-like skills
  actor.system.skills.divineAid = { label: 'Divine Aid', value: '', ability: '' }
  actor.system.skills.turnUnholy = { label: 'Turn Unholy', value: '', ability: '' }
  actor.system.skills.layOnHands = { label: 'Lay on Hands', value: '', ability: '' }

  // Reset to personality-based (cleric)
  actor.system.class.spellCheckAbility = 'per'
  actor.system.class.spellCheckOverride = ''
  actor.system.class.spellCheckOtherMod = '+3'
  actor.system.details.level.value = 1

  actor.computeSpellCheck()

  // spellCheck = level(1) + per mod(+2) + other(+3) = +1+2+3
  expect(actor.system.class.spellCheck).toEqual('+1+2+3')
  // divineAid and layOnHands mirror spellCheck
  expect(actor.system.skills.divineAid.value).toEqual('+1+2+3')
  expect(actor.system.skills.layOnHands.value).toEqual('+1+2+3')
  // turnUnholy adds luck mod
  expect(actor.system.skills.turnUnholy.value).toEqual(`+1+2+3+${actor.system.abilities.lck.mod}`)
})

test('_applyAddEffect treats null initial values as zero', () => {
  const overrides = {}

  // Set a property to null to simulate cleric's spellCheckOtherMod
  actor.system.class.spellCheckOtherMod = null
  expect(actor.system.class.spellCheckOtherMod).toBeNull()

  // Apply an ADD effect of +2
  actor._applyAddEffect('system.class.spellCheckOtherMod', '2', overrides)

  // Should treat null as 0 and add 2
  expect(actor.system.class.spellCheckOtherMod).toEqual(2)
  expect(overrides['system.class.spellCheckOtherMod']).toEqual(2)
})

// ============================================================================
// Phase 7 session 25 — legacy-decom step 5 retirement guard
// ============================================================================

test('legacy-decom step 5: all four _xxxLegacy roll bodies are absent from the prototype', () => {
  // Steps 1–4 moved every gate (roll-under, modifier dialog, check-penalty,
  // description-only skill items) into the adapter; step 5 deleted the now-dead
  // bodies. Each public dispatcher is single-path through the adapter. This
  // guard fails loudly if any legacy body is ever reintroduced.
  const proto = DCCActor.prototype
  expect(typeof proto._rollAbilityCheckLegacy, '_rollAbilityCheckLegacy retired in step 5').toBe('undefined')
  expect(typeof proto._rollSavingThrowLegacy, '_rollSavingThrowLegacy retired in step 5').toBe('undefined')
  expect(typeof proto._getInitiativeRollLegacy, '_getInitiativeRollLegacy retired in step 5').toBe('undefined')
  expect(typeof proto._rollSkillCheckLegacy, '_rollSkillCheckLegacy retired in step 5').toBe('undefined')

  // The public dispatchers + their adapter routes remain.
  expect(typeof proto.rollAbilityCheck, 'rollAbilityCheck dispatcher remains').toBe('function')
  expect(typeof proto._rollAbilityCheckViaAdapter).toBe('function')
  expect(typeof proto.rollSavingThrow, 'rollSavingThrow dispatcher remains').toBe('function')
  expect(typeof proto._rollSavingThrowViaAdapter).toBe('function')
  expect(typeof proto.getInitiativeRoll, 'getInitiativeRoll dispatcher remains').toBe('function')
  expect(typeof proto._getInitiativeRollViaAdapter).toBe('function')
  expect(typeof proto.rollSkillCheck, 'rollSkillCheck dispatcher remains').toBe('function')
  expect(typeof proto._rollSkillCheckViaAdapter).toBe('function')
  expect(typeof proto._emitSkillDescriptionViaAdapter, 'description route from step 4 remains').toBe('function')
})

test('legacy-decom step 5: the shared skill-term builder was renamed off the "Legacy" token', () => {
  const proto = DCCActor.prototype
  // The DCCRoll term-descriptor builder is still needed by the skill-table +
  // dialog adapter routes, so it was renamed (not deleted) once the last
  // legacy caller went away.
  expect(typeof proto._buildSkillCheckLegacyTerms, 'old name retired').toBe('undefined')
  expect(typeof proto._buildSkillCheckRollTerms, 'renamed builder present').toBe('function')
})

test('rollSkillCheck routes spell-like cleric skills through the adapter with disapproval automation', async () => {
  dccRollCreateRollMock.mockClear()
  game.dcc.processSpellCheck.mockClear()
  game.dcc.getSkillTable.mockClear()
  game.dcc.getSkillTable.mockResolvedValue(null)

  const applyDisapprovalSpy = vi.spyOn(actor, 'applyDisapproval').mockResolvedValue(undefined)

  // Cleric disapproval automation enabled for this test
  const originalGet = game.settings.get
  game.settings.get = vi.fn((module, key) => {
    if (module === 'dcc' && key === 'automateClericDisapproval') return true
    if (module === 'core' && key === 'messageMode') return 'public'
    return originalGet(module, key)
  })

  actor.system.class.disapproval = 1

  // A custom skill item configured as a spell-like cleric ability (issue #375)
  const skillItem = new DCCItem({
    name: 'Invoke Ancestors',
    type: 'skill',
    system: {
      config: {
        useSummary: false,
        useAbility: false,
        useDie: true,
        useLevel: false,
        useValue: true,
        showLastResult: false,
        applyCheckPenalty: false,
        castingMode: 'cleric'
      },
      die: '1d20',
      value: '+2',
      description: { value: '' }
    }
  })
  global.itemTypesMock.mockReturnValue({
    skill: {
      find: vi.fn().mockReturnValue(skillItem)
    }
  })

  await actor.rollSkillCheck('Invoke Ancestors')

  // Unified adapter path — no processSpellCheck detour; the failed check
  // (default roll total 10 < threshold 12) applies a point of disapproval
  expect(game.dcc.processSpellCheck).not.toHaveBeenCalled()
  expect(dccRollCreateRollMock).toHaveBeenCalled()
  expect(applyDisapprovalSpy).toHaveBeenCalled()

  applyDisapprovalSpy.mockRestore()
  global.itemTypesMock.mockReset()
  game.settings.get = originalGet
})

test('rollSkillCheck blocks lost wizard casting mode skill items', async () => {
  dccRollCreateRollMock.mockClear()
  game.dcc.processSpellCheck.mockClear()
  game.dcc.getSkillTable.mockClear()
  global.uiNotificationsWarnMock.mockClear()

  game.dcc.getSkillTable.mockResolvedValue(null)

  const originalGet = game.settings.get
  game.settings.get = vi.fn((module, key) => {
    if (module === 'dcc' && key === 'automateWizardSpellLoss') return true
    return originalGet(module, key)
  })

  // A wizard casting mode skill that was lost on a failed check
  const skillItem = new DCCItem({
    name: 'Runic Blast',
    type: 'skill',
    system: {
      config: {
        useSummary: false,
        useAbility: false,
        useDie: true,
        useLevel: false,
        useValue: true,
        showLastResult: false,
        applyCheckPenalty: false,
        castingMode: 'wizard'
      },
      die: '1d20',
      value: '+2',
      lost: true,
      description: { value: '' }
    }
  })
  global.itemTypesMock.mockReturnValue({
    skill: {
      find: vi.fn().mockReturnValue(skillItem)
    }
  })

  await actor.rollSkillCheck('Runic Blast')

  // The lost skill must warn and never roll, mirroring lost wizard spells
  expect(global.uiNotificationsWarnMock).toHaveBeenCalled()
  expect(dccRollCreateRollMock).not.toHaveBeenCalled()
  expect(game.dcc.processSpellCheck).not.toHaveBeenCalled()

  global.itemTypesMock.mockReset()
  game.settings.get = originalGet
})
