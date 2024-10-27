/* global DCCItem, actorUpdateMock, rollToMessageMock, collectionFindMock, dccRollCreateRollMock, dccItemRollSpellCheckMock, uiNotificationsWarnMock, game */
/**
 * Tests for Actor.js using Foundry Mocks.
 * Mocks for Foundry Classes/Functions are found in __mocks__/foundry.js
 * Mocks for DCCItem Class are found in __mocks__/item.js
 **/

import { expect, test } from 'vitest'
import '../__mocks__/foundry.js'
import '../__mocks__/item.js'
import DCCActor from '../actor'

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

test('roll ability check', async () => {
  dccRollCreateRollMock.mockClear()

  await actor.rollAbilityCheck('str')
  expect(dccRollCreateRollMock).toHaveBeenCalledTimes(1)
  expect(dccRollCreateRollMock).toHaveBeenCalledWith(
    [
      {
        type: 'Die',
        label: 'ActionDie',
        formula: '1d20',
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
        type: 'Modifier',
        label: 'AbilityStr',
        formula: -1
      },
      {
        apply: true,
        formula: '+0',
        type: 'CheckPenalty'
      }
    ],
    {},
    {
      title: 'AbilityStr Check'
    })
  expect(rollToMessageMock).toHaveBeenCalledWith({
    flavor: 'AbilityStr Check',
    speaker: actor,
    flags: { 'dcc.Ability': 'str', 'dcc.RollType': 'AbilityCheck', checkPenaltyCouldApply: true, 'dcc.isAbilityCheck': true }
  })

  // Check that rollUnder option is interpreted correctly
  await actor.rollAbilityCheck('lck', { rollUnder: true })
  expect(dccRollCreateRollMock).toHaveBeenCalledTimes(2)
  expect(dccRollCreateRollMock).toHaveBeenCalledWith(
    [
      {
        type: 'Die',
        formula: '1d20'
      }
    ],
    {},
    {
      rollUnder: true,
      title: 'AbilityLck Check'
    }
  )
  expect(rollToMessageMock).toHaveBeenLastCalledWith({
    flavor: 'AbilityLck CheckRollUnder',
    speaker: actor,
    flags: { 'dcc.Ability': 'lck', 'dcc.RollType': 'AbilityCheckRollUnder', 'dcc.isAbilityCheck': true }
  })

  // ...both ways
  await actor.rollAbilityCheck('lck', { rollUnder: false })
  expect(dccRollCreateRollMock).toHaveBeenCalledTimes(3)
  expect(dccRollCreateRollMock).toHaveBeenCalledWith(
    [
      {
        type: 'Die',
        label: 'ActionDie',
        formula: '1d20',
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
        type: 'Modifier',
        label: 'AbilityLck',
        formula: 3
      }
    ],
    {},
    {
      rollUnder: false,
      title: 'AbilityLck Check'
    })
  expect(rollToMessageMock).toHaveBeenLastCalledWith({
    flavor: 'AbilityLck Check',
    speaker: actor,
    flags: { 'dcc.Ability': 'lck', 'dcc.RollType': 'AbilityCheck', 'dcc.isAbilityCheck': true }
  })
})

test('roll saving throw', async () => {
  dccRollCreateRollMock.mockClear()

  await actor.rollSavingThrow('frt')
  expect(dccRollCreateRollMock).toHaveBeenCalledTimes(1)
  expect(dccRollCreateRollMock).toHaveBeenCalledWith(
    [
      {
        type: 'Die',
        formula: '1d20'
      },
      {
        type: 'Modifier',
        label: 'SavesFortitude',
        formula: -1
      }
    ],
    actor.getRollData(),
    {
      title: 'SavesFortitude Save'
    }
  )
  expect(rollToMessageMock).toHaveBeenCalledWith({
    flavor: 'SavesFortitude Save',
    speaker: actor,
    flags: { 'dcc.Save': 'frt', 'dcc.RollType': 'SavingThrow' }
  })

  await actor.rollSavingThrow('ref')
  expect(dccRollCreateRollMock).toHaveBeenCalledTimes(2)
  expect(dccRollCreateRollMock).toHaveBeenCalledWith(
    [
      {
        type: 'Die',
        formula: '1d20'
      },
      {
        type: 'Modifier',
        label: 'SavesReflex',
        formula: 0
      }
    ],
    actor.getRollData(),
    {
      title: 'SavesReflex Save'
    }
  )
  expect(rollToMessageMock).toHaveBeenCalledWith({
    flavor: 'SavesReflex Save',
    speaker: actor,
    flags: { 'dcc.Save': 'ref', 'dcc.RollType': 'SavingThrow' }
  })

  await actor.rollSavingThrow('wil')
  expect(dccRollCreateRollMock).toHaveBeenCalledTimes(3)
  expect(dccRollCreateRollMock).toHaveBeenCalledWith(
    [
      {
        type: 'Die',
        formula: '1d20'
      },
      {
        type: 'Modifier',
        label: 'SavesWill',
        formula: 2
      }
    ],
    actor.getRollData(),
    {
      title: 'SavesWill Save'
    }
  )
  expect(rollToMessageMock).toHaveBeenCalledWith({
    flavor: 'SavesWill Save',
    speaker: actor,
    flags: { 'dcc.Save': 'wil', 'dcc.RollType': 'SavingThrow' }
  })
})

test('roll initiative', async () => {
  dccRollCreateRollMock.mockClear()

  await actor.rollInitiative({ createCombatants: true })
  expect(dccRollCreateRollMock).toHaveBeenCalledTimes(1)
  expect(dccRollCreateRollMock).toHaveBeenCalledWith(
    [
      {
        type: 'Die',
        formula: '1d20'
      },
      {
        type: 'Modifier',
        label: 'Initiative',
        formula: -1
      }
    ],
    actor.getRollData(),
    {
      title: 'RollModifierTitleInitiative'
    }
  )
})

test('roll weapon attack dagger', async () => {
  dccRollCreateRollMock.mockClear()
  collectionFindMock.mockClear()
  uiNotificationsWarnMock.mockClear()
  collectionFindMock.mockReturnValue(new DCCItem('lefthand dagger', 'weapon', {
    actionDie: '1d16',
    toHit: 2,
    critRange: 16,
    damage: '1d4',
    melee: true
  }))
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
        modifierLabel: 'ToHit',
        formula: 2
      }
    ],
    Object.assign({ critical: 16 }, actor.getRollData()),
    {
      title: 'ToHit'
    }
  )
})

test('roll Custom Die Skill', async () => {
  dccRollCreateRollMock.mockClear()

  await actor.rollSkillCheck('customDieSkill')
  expect(dccRollCreateRollMock).toHaveBeenCalledTimes(1)
  expect(dccRollCreateRollMock).toHaveBeenCalledWith(
    [
      {
        type: 'Die',
        label: null,
        formula: '1d14',
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
      }
    ],
    actor.getRollData(),
    {
      title: 'Custom Die Skill'
    }
  )
  expect(rollToMessageMock).toHaveBeenCalledWith({
    flavor: 'Custom Die Skill',
    speaker: actor,
    flags: { 'dcc.RollType': 'SkillCheck', 'dcc.SkillId': 'customDieSkill' }
  })
})

test('roll Custom Die And Value Skill', async () => {
  dccRollCreateRollMock.mockClear()
  await actor.rollSkillCheck('customDieAndValueSkill')
  expect(dccRollCreateRollMock).toHaveBeenCalledWith(
    [
      {
        type: 'Die',
        label: null,
        formula: '1d14',
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
        dieLabel: 'RollModifierDieTerm',
        modifierLabel: 'Custom Die And Value Skill',
        formula: '3'
      }
    ],
    actor.getRollData(),
    {
      title: 'Custom Die And Value Skill'
    }
  )
  expect(rollToMessageMock).toHaveBeenCalledWith({
    flavor: 'Custom Die And Value Skill',
    speaker: actor,
    flags: { 'dcc.RollType': 'SkillCheck', 'dcc.SkillId': 'customDieAndValueSkill' }
  })
})

test('roll Action Die Skill', async () => {
  dccRollCreateRollMock.mockClear()
  await actor.rollSkillCheck('actionDieSkill')
  expect(dccRollCreateRollMock).toHaveBeenCalledWith(
    [
      {
        type: 'Die',
        label: 'ActionDie',
        formula: '1d20',
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
        dieLabel: 'RollModifierDieTerm',
        modifierLabel: 'Action Die Skill',
        formula: '-4'
      }
    ],
    actor.getRollData(),
    {
      title: 'Action Die Skill'
    }
  )
  expect(rollToMessageMock).toHaveBeenCalledWith({
    flavor: 'Action Die Skill',
    speaker: actor,
    flags: { 'dcc.RollType': 'SkillCheck', 'dcc.SkillId': 'actionDieSkill' }
  })
})

test('roll Custom Die Skill With Int', async () => {
  dccRollCreateRollMock.mockClear()
  await actor.rollSkillCheck('customDieSkillWithInt')
  expect(dccRollCreateRollMock).toHaveBeenCalledWith(
    [
      {
        type: 'Die',
        label: null,
        formula: '1d24',
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
      }
    ],
    actor.getRollData(),
    {
      title: 'Custom Die Skill With Int'
    }
  )
  expect(rollToMessageMock).toHaveBeenCalledWith({
    flavor: 'Custom Die Skill With Int (AbilityInt)',
    speaker: actor,
    flags: { 'dcc.RollType': 'SkillCheck', 'dcc.SkillId': 'customDieSkillWithInt' }
  })
})

test('roll Custom Die And Value Skill With Per', async () => {
  dccRollCreateRollMock.mockClear()
  await actor.rollSkillCheck('customDieAndValueSkillWithPer')
  expect(dccRollCreateRollMock).toHaveBeenCalledWith(
    [
      {
        type: 'Die',
        label: null,
        formula: '1d24',
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
        dieLabel: 'RollModifierDieTerm',
        modifierLabel: 'Custom Die And Value Skill With Per (AbilityPer)',
        formula: '3 + 2'
      }
    ],
    actor.getRollData(),
    {
      title: 'Custom Die And Value Skill With Per'
    }
  )
  expect(rollToMessageMock).toHaveBeenCalledWith({
    flavor: 'Custom Die And Value Skill With Per (AbilityPer)',
    speaker: actor,
    flags: { 'dcc.RollType': 'SkillCheck', 'dcc.SkillId': 'customDieAndValueSkillWithPer' }
  })
})

test('roll Custom Die And Value Luck', async () => {
  dccRollCreateRollMock.mockClear()
  await actor.rollSkillCheck('actionDieAndValueSkillWithLck')
  expect(dccRollCreateRollMock).toHaveBeenCalledWith(
    [
      {
        type: 'Die',
        label: 'ActionDie',
        formula: '1d20',
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
        dieLabel: 'RollModifierDieTerm',
        modifierLabel: 'Action Die And Value Skill With Lck (AbilityLck)',
        formula: '1 + 3'
      }
    ],
    actor.getRollData(),
    {
      title: 'Action Die And Value Skill With Lck'
    }
  )
  expect(rollToMessageMock).toHaveBeenCalledWith({
    flavor: 'Action Die And Value Skill With Lck (AbilityLck)',
    speaker: actor,
    flags: { 'dcc.RollType': 'SkillCheck', 'dcc.SkillId': 'actionDieAndValueSkillWithLck' }
  })
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
      title: 'LuckDie'
    }
  )
  expect(actorUpdateMock).toHaveBeenCalledTimes(1)
  expect(actorUpdateMock).toHaveBeenCalledWith(
    {
      'system.abilities.lck.value': 17
    }
  )
})

test('roll spell check', async () => {
  dccRollCreateRollMock.mockClear()
  collectionFindMock.mockReset()
  uiNotificationsWarnMock.mockReset()
  game.dcc.processSpellCheck.mockClear()

  // Spell check with ability from actor data
  await actor.rollSpellCheck()
  expect(dccRollCreateRollMock).toHaveBeenCalledTimes(1)
  expect(dccRollCreateRollMock).toHaveBeenCalledWith(
    [
      {
        type: 'Die',
        label: 'ActionDie',
        formula: '1d20',
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
        dieLabel: 'RollModifierDieTerm',
        formula: 1,
        modifierLabel: 'Level'
      },
      {
        type: 'Compound',
        dieLabel: 'RollModifierDieTerm',
        formula: '+1',
        modifierLabel: 'AbilityMod'
      },
      {
        type: 'CheckPenalty',
        apply: true,
        formula: '+0',
        label: 'CheckPenalty'
      },
      {
        type: 'Spellburn',
        formula: '+0',
        str: 6,
        sta: 12,
        agl: 8,
        callback: expect.any(Function)
      }
    ],
    actor.getRollData(),
    {
      abilityId: 'int',
      title: 'SpellCheck'
    }
  )
  expect(game.dcc.processSpellCheck).toHaveBeenCalledTimes(1)
  expect(game.dcc.processSpellCheck).toHaveBeenCalledWith(
    actor,
    {
      rollTable: null,
      roll: expect.objectContaining({
        dice: [
          expect.objectContaining({
            results: [
              10
            ]
          })
        ]
      }),
      item: null,
      flavor: 'SpellCheck (AbilityInt)'
    }
  )
  expect(collectionFindMock).toHaveBeenCalledTimes(0)
})

test('roll spell check int', async () => {
  dccRollCreateRollMock.mockClear()
  collectionFindMock.mockReset()
  uiNotificationsWarnMock.mockReset()
  game.dcc.processSpellCheck.mockClear()
  // Force int for display purposes
  await actor.rollSpellCheck({ abilityId: 'int' })
  expect(dccRollCreateRollMock).toHaveBeenCalledWith(
    [
      {
        type: 'Die',
        label: 'ActionDie',
        formula: '1d20',
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
        dieLabel: 'RollModifierDieTerm',
        formula: 1,
        modifierLabel: 'Level'
      },
      {
        type: 'Compound',
        dieLabel: 'RollModifierDieTerm',
        formula: '+1',
        modifierLabel: 'AbilityMod'
      },
      {
        type: 'CheckPenalty',
        apply: true,
        formula: '+0',
        label: 'CheckPenalty'
      },
      {
        type: 'Spellburn',
        formula: '+0',
        str: 6,
        sta: 12,
        agl: 8,
        callback: expect.any(Function)
      }
    ],
    actor.getRollData(),
    {
      abilityId: 'int',
      title: 'SpellCheck'
    }
  )
  expect(game.dcc.processSpellCheck).toHaveBeenCalledWith(
    actor,
    {
      rollTable: null,
      roll: expect.objectContaining({
        dice: [
          expect.objectContaining({
            results: [
              10
            ]
          })
        ]
      }),
      item: null,
      flavor: 'SpellCheck (AbilityInt)'
    }
  )
  expect(collectionFindMock).toHaveBeenCalledTimes(0)
})

test('roll spell check per', async () => {
  dccRollCreateRollMock.mockClear()
  collectionFindMock.mockReset()
  uiNotificationsWarnMock.mockReset()
  game.dcc.processSpellCheck.mockClear()
  // Force personality for display purposes
  await actor.rollSpellCheck({ abilityId: 'per' })
  expect(dccRollCreateRollMock).toHaveBeenCalledWith(
    [
      {
        type: 'Die',
        label: 'ActionDie',
        formula: '1d20',
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
        dieLabel: 'RollModifierDieTerm',
        formula: 1,
        modifierLabel: 'Level'
      },
      {
        type: 'Compound',
        dieLabel: 'RollModifierDieTerm',
        formula: '+2',
        modifierLabel: 'AbilityMod'
      },
      {
        type: 'CheckPenalty',
        apply: true,
        formula: '+0',
        label: 'CheckPenalty'
      },
      {
        type: 'Spellburn',
        formula: '+0',
        str: 6,
        sta: 12,
        agl: 8,
        callback: expect.any(Function)
      }
    ],
    actor.getRollData(),
    {
      abilityId: 'per',
      title: 'SpellCheck'
    }
  )
  expect(game.dcc.processSpellCheck).toHaveBeenCalledWith(
    actor,
    {
      rollTable: null,
      roll: expect.objectContaining({
        dice: [
          expect.objectContaining({
            results: [
              10
            ]
          })
        ]
      }),
      item: null,
      flavor: 'SpellCheck (AbilityPer)'
    }
  )
  expect(collectionFindMock).toHaveBeenCalledTimes(0)
})

test('roll spell check item', async () => {
  dccRollCreateRollMock.mockClear()
  collectionFindMock.mockReset()
  uiNotificationsWarnMock.mockReset()
  // game.dcc.processSpellCheck.mockClear()

  // Roll a spell check with an item
  const dummyItem = new DCCItem('The Gloaming', 'spell')
  collectionFindMock.mockReturnValue(dummyItem)
  await actor.rollSpellCheck({ spell: 'The Gloaming' })
  expect(collectionFindMock).toHaveBeenCalledTimes(1)
  expect(dccItemRollSpellCheckMock).toHaveBeenCalledWith('int', { abilityId: 'int', spell: 'The Gloaming' })
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
