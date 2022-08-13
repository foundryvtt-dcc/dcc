/* Tests for Actor.js using Foundry Mocks */
/* Mocks for Foundry Classes/Functions are found in __mocks__/foundry.js */
/* Mocks for DCCItem Class are found in __mocks__/item.js */
/* eslint-env jest */
/* global CONFIG, DCCItem, actorUpdateMock, rollToMessageMock, collectionFindMock, dccRollCreateRollMock, dccItemRollSpellCheckMock, uiNotificationsWarnMock, itemTypesMock, game */

import DCCActor from '../actor'

// Create Base Test Actor
const actor = new DCCActor()

test('prepareData sets ability modifiers', () => {
  const abilities = actor.abilities

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
  global.dccRollCreateRollMock.mockClear()

  await actor.rollAbilityCheck('str')
  expect(global.dccRollCreateRollMock).toHaveBeenCalledTimes(1)
  expect(global.dccRollCreateRollMock).toHaveBeenCalledWith(
    [
      {
        type: 'Die',
        label: 'ActionDie',
        formula: '1d20',
        presets: [
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
        type: 'CheckPenalty',
        formula: 0,
        apply: false
      }
    ],
    { },
    {
      title: 'AbilityStr Check'
    })
  expect(rollToMessageMock).toHaveBeenCalledWith({ flavor: 'AbilityStr Check', speaker: actor, flags: { 'dcc.Ability': 'str', 'dcc.RollType': 'AbilityCheck' } })

  // Check that rollUnder option is interpreted correctly
  await actor.rollAbilityCheck('lck', { rollUnder: true })
  expect(global.dccRollCreateRollMock).toHaveBeenCalledTimes(2)
  expect(global.dccRollCreateRollMock).toHaveBeenCalledWith(
    [
      {
        type: 'Die',
        formula: '1d20'
      }
    ],
    { },
    {
      rollUnder: true,
      title: 'AbilityLck Check'
    }
  )
  expect(rollToMessageMock).toHaveBeenLastCalledWith({ flavor: 'AbilityLck Check', speaker: actor, flags: { 'dcc.Ability': 'lck', 'dcc.RollType': 'AbilityCheckRollUnder' } })

  // ...both ways
  await actor.rollAbilityCheck('lck', { rollUnder: false })
  expect(global.dccRollCreateRollMock).toHaveBeenCalledTimes(3)
  expect(global.dccRollCreateRollMock).toHaveBeenCalledWith(
    [
      {
        type: 'Die',
        label: 'ActionDie',
        formula: '1d20',
        presets: [
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
      },
      {
        type: 'CheckPenalty',
        formula: 0,
        apply: false
      }
    ],
    { },
    {
      rollUnder: false,
      title: 'AbilityLck Check'
    })
  expect(rollToMessageMock).toHaveBeenLastCalledWith({ flavor: 'AbilityLck Check', speaker: actor, flags: { 'dcc.Ability': 'lck', 'dcc.RollType': 'AbilityCheck' } })
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
  expect(rollToMessageMock).toHaveBeenCalledWith({ flavor: 'SavesFortitude Save', speaker: actor, flags: { 'dcc.Save': 'frt', 'dcc.RollType': 'SavingThrow' } })

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
  expect(rollToMessageMock).toHaveBeenCalledWith({ flavor: 'SavesReflex Save', speaker: actor, flags: { 'dcc.Save': 'ref', 'dcc.RollType': 'SavingThrow' } })

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
  expect(rollToMessageMock).toHaveBeenCalledWith({ flavor: 'SavesWill Save', speaker: actor, flags: { 'dcc.Save': 'wil', 'dcc.RollType': 'SavingThrow' } })
})

test('roll initiative', async () => {
  dccRollCreateRollMock.mockClear()

  await actor.rollInitiative({
    name: 'Test Actor',
    id: 'xxxxxxxxxx'
  })
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
  expect(rollToMessageMock).toHaveBeenCalledWith({ flavor: 'Initiative', speaker: actor, flags: { 'dcc.RollType': 'Initiative' } })
})

test('roll weapon attack', async () => {
  dccRollCreateRollMock.mockClear()
  collectionFindMock.mockClear()
  uiNotificationsWarnMock.mockClear()

  // Roll a weapon we don't have
  await actor.rollWeaponAttack('r123')
  expect(collectionFindMock).toHaveBeenCalledTimes(1)
  expect(itemTypesMock).toHaveBeenCalledTimes(1)
  expect(uiNotificationsWarnMock).toHaveBeenCalledTimes(1)
  expect(uiNotificationsWarnMock).toHaveBeenCalledWith('WeaponNotFound,id:r123[object Object]')

  // Roll a weapon we do have - by name
  collectionFindMock.mockReturnValue(new DCCItem('longsword', {
    type: 'weapon',
    data: {
      actionDie: '1d20',
      toHit: 1,
      melee: true
    }
  }))
  await actor.rollWeaponAttack('longsword')
  expect(collectionFindMock).toHaveBeenCalledTimes(2)
  expect(itemTypesMock).toHaveBeenCalledTimes(1)
  expect(uiNotificationsWarnMock).toHaveBeenCalledTimes(1)
  expect(dccRollCreateRollMock).toHaveBeenCalledTimes(2)
  expect(dccRollCreateRollMock).toHaveBeenCalledWith(
    [
      {
        type: 'Die',
        label: game.i18n.localize('DCC.ActionDie'),
        formula: '1d20',
        presets: [
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
        formula: 1
      }
    ],
    Object.assign({ critical: 20 }, actor.getRollData()),
    {
      title: 'ToHit'
    }
  )
  expect(CONFIG.ChatMessage.documentClass.create).toHaveBeenCalledWith({
    speaker: actor,
    type: 'emote',
    content: 'AttackRollEmote,weaponName:longsword,rollHTML:<a class="inline-roll inline-result" data-roll="%7B%22dice%22%3A%5B%7B%22results%22%3A%5B10%5D%2C%22options%22%3A%7B%22dcc%22%3A%7B%22upperThreshold%22%3A20%7D%7D%7D%5D%7D" title="undefined"><i class="fas fa-dice-d20"></i> undefined</a>,damageRollHTML:<a class="inline-roll inline-result damage-applyable" data-roll="%7B%22dice%22%3A%5B%7B%22results%22%3A%5B10%5D%2C%22options%22%3A%7B%7D%7D%5D%7D" data-damage="1" title="undefined"><i class="fas fa-dice-d20"></i> 1 (undefined)</a>,deedRollHTML:,crit:,fumble:[object Object]',
    sound: 'diceSound',
    flags: {
      'dcc.ItemId': undefined,
      'dcc.RollType': 'CombinedAttack'
    },
    user: undefined
  })

  // Roll a weapon we do have - by slot
  collectionFindMock.mockReturnValue(null)
  itemTypesMock.mockReturnValue({
    weapon: [
      new DCCItem('axe', { name: 'axe', data: { melee: true } }),
      new DCCItem('javelin', { name: 'javelin', data: { melee: false } }),
      new DCCItem('longsword', { name: 'longsword', data: { actionDie: '1d20', toHit: 2, melee: true } })
    ]
  })
  await actor.rollWeaponAttack('m2')
  expect(collectionFindMock).toHaveBeenCalledTimes(3)
  expect(itemTypesMock).toHaveBeenCalledTimes(2)
  expect(uiNotificationsWarnMock).toHaveBeenCalledTimes(1)
  expect(dccRollCreateRollMock).toHaveBeenCalledTimes(4)
  expect(dccRollCreateRollMock).toHaveBeenCalledWith(
    [
      {
        type: 'Die',
        label: game.i18n.localize('DCC.ActionDie'),
        formula: '1d20',
        presets: [
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
        formula: 1
      }
    ],
    Object.assign({ critical: 20 }, actor.getRollData()),
    {
      title: 'ToHit'
    }
  )
  expect(CONFIG.ChatMessage.documentClass.create).toHaveBeenCalledWith({
    speaker: actor,
    type: 'emote',
    content: 'AttackRollEmote,weaponName:longsword,rollHTML:<a class="inline-roll inline-result" data-roll="%7B%22dice%22%3A%5B%7B%22results%22%3A%5B10%5D%2C%22options%22%3A%7B%22dcc%22%3A%7B%22upperThreshold%22%3A20%7D%7D%7D%5D%7D" title="undefined"><i class="fas fa-dice-d20"></i> undefined</a>,damageRollHTML:<a class="inline-roll inline-result damage-applyable" data-roll="%7B%22dice%22%3A%5B%7B%22results%22%3A%5B10%5D%2C%22options%22%3A%7B%7D%7D%5D%7D" data-damage="1" title="undefined"><i class="fas fa-dice-d20"></i> 1 (undefined)</a>,deedRollHTML:,crit:,fumble:[object Object]',
    sound: 'diceSound',
    flags: {
      'dcc.itemId': undefined,
      'dcc.RollType': 'CombinedAttack'
    },
    user: undefined
  })

  collectionFindMock.mockReturnValue(new DCCItem('lefthand dagger', {
    type: 'weapon',
    data: {
      actionDie: '1d16',
      toHit: 2,
      critRange: 16,
      melee: true
    }
  }))
  await actor.rollWeaponAttack('lefthand dagger')
  expect(dccRollCreateRollMock).toHaveBeenCalledWith(
    [
      {
        type: 'Die',
        label: game.i18n.localize('DCC.ActionDie'),
        formula: '1d16',
        presets: [
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

test('roll skill check', async () => {
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
            formula: '1d10',
            label: 'Untrained'
          }
        ]
      },
      {
        type: 'CheckPenalty',
        apply: false,
        formula: 0
      }
    ],
    actor.getRollData(),
    {
      title: 'Custom Die Skill'
    }
  )
  expect(rollToMessageMock).toHaveBeenCalledWith({ flavor: 'Custom Die Skill', speaker: actor, flags: { 'dcc.RollType': 'SkillCheck', 'dcc.SkillId': 'customDieSkill' } })

  await actor.rollSkillCheck('customDieAndValueSkill')
  expect(dccRollCreateRollMock).toHaveBeenCalledTimes(2)
  expect(dccRollCreateRollMock).toHaveBeenCalledWith(
    [
      {
        type: 'Die',
        label: null,
        formula: '1d14',
        presets: [
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
      },
      {
        type: 'CheckPenalty',
        apply: false,
        formula: 0
      }
    ],
    actor.getRollData(),
    {
      title: 'Custom Die And Value Skill'
    }
  )
  expect(rollToMessageMock).toHaveBeenCalledWith({ flavor: 'Custom Die And Value Skill', speaker: actor, flags: { 'dcc.RollType': 'SkillCheck', 'dcc.SkillId': 'customDieAndValueSkill' } })

  await actor.rollSkillCheck('actionDieSkill')
  expect(dccRollCreateRollMock).toHaveBeenCalledTimes(3)
  expect(dccRollCreateRollMock).toHaveBeenCalledWith(
    [
      {
        type: 'Die',
        label: 'ActionDie',
        formula: '1d20',
        presets: [
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
      },
      {
        type: 'CheckPenalty',
        apply: false,
        formula: 0
      }
    ],
    actor.getRollData(),
    {
      title: 'Action Die Skill'
    }
  )
  expect(rollToMessageMock).toHaveBeenCalledWith({ flavor: 'Action Die Skill', speaker: actor, flags: { 'dcc.RollType': 'SkillCheck', 'dcc.SkillId': 'actionDieSkill' } })

  await actor.rollSkillCheck('customDieSkillWithInt')
  expect(dccRollCreateRollMock).toHaveBeenCalledTimes(4)
  expect(dccRollCreateRollMock).toHaveBeenCalledWith(
    [
      {
        type: 'Die',
        label: null,
        formula: '1d24',
        presets: [
          {
            formula: '1d10',
            label: 'Untrained'
          }
        ]
      },
      {
        type: 'CheckPenalty',
        apply: false,
        formula: 0
      }
    ],
    actor.getRollData(),
    {
      title: 'Custom Die Skill With Int'
    }
  )
  expect(rollToMessageMock).toHaveBeenCalledWith({ flavor: 'Custom Die Skill With Int (AbilityInt)', speaker: actor, flags: { 'dcc.RollType': 'SkillCheck', 'dcc.SkillId': 'customDieSkillWithInt' } })

  await actor.rollSkillCheck('customDieAndValueSkillWithPer')
  expect(dccRollCreateRollMock).toHaveBeenCalledTimes(5)
  expect(dccRollCreateRollMock).toHaveBeenCalledWith(
    [
      {
        type: 'Die',
        label: null,
        formula: '1d24',
        presets: [
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
        formula: '3'
      },
      {
        type: 'CheckPenalty',
        apply: false,
        formula: 0
      }
    ],
    actor.getRollData(),
    {
      title: 'Custom Die And Value Skill With Per'
    }
  )
  expect(rollToMessageMock).toHaveBeenCalledWith({ flavor: 'Custom Die And Value Skill With Per (AbilityPer)', speaker: actor, flags: { 'dcc.RollType': 'SkillCheck', 'dcc.SkillId': 'customDieAndValueSkillWithPer' } })

  await actor.rollSkillCheck('actionDieSkillWithLck')
  expect(dccRollCreateRollMock).toHaveBeenCalledTimes(6)
  expect(dccRollCreateRollMock).toHaveBeenCalledWith(
    [
      {
        type: 'Die',
        label: 'ActionDie',
        formula: '1d20',
        presets: [
          {
            formula: '1d10',
            label: 'Untrained'
          }
        ]
      },
      {
        type: 'Compound',
        dieLabel: 'RollModifierDieTerm',
        modifierLabel: 'Action Die Skill With Lck (AbilityLck)',
        formula: '4'
      },
      {
        type: 'CheckPenalty',
        apply: false,
        formula: 0
      }
    ],
    actor.getRollData(),
    {
      title: 'Action Die Skill With Lck'
    }
  )
  expect(rollToMessageMock).toHaveBeenCalledWith({ flavor: 'Action Die Skill With Lck (AbilityLck)', speaker: actor, flags: { 'dcc.RollType': 'SkillCheck', 'dcc.SkillId': 'actionDieSkillWithLck' } })
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
      'data.abilities.lck.value': 17
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
            formula: '1d10',
            label: 'Untrained'
          }
        ]
      },
      {
        type: 'Compound',
        dieLabel: 'RollModifierDieTerm',
        modifierLabel: 'SpellCheck',
        formula: '3'
      },
      {
        type: 'CheckPenalty',
        apply: true,
        formula: 0
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

  // Force int for display purposes
  await actor.rollSpellCheck({ abilityId: 'int' })
  expect(dccRollCreateRollMock).toHaveBeenCalledTimes(2)
  expect(dccRollCreateRollMock).toHaveBeenCalledWith(
    [
      {
        type: 'Die',
        label: 'ActionDie',
        formula: '1d20',
        presets: [
          {
            formula: '1d10',
            label: 'Untrained'
          }
        ]
      },
      {
        type: 'Compound',
        dieLabel: 'RollModifierDieTerm',
        modifierLabel: 'SpellCheck',
        formula: '3'
      },
      {
        type: 'CheckPenalty',
        apply: true,
        formula: 0
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
  expect(game.dcc.processSpellCheck).toHaveBeenCalledTimes(2)
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

  // Force personality for display purposes
  await actor.rollSpellCheck({ abilityId: 'per' })
  expect(dccRollCreateRollMock).toHaveBeenCalledTimes(3)
  expect(dccRollCreateRollMock).toHaveBeenCalledWith(
    [
      {
        type: 'Die',
        label: 'ActionDie',
        formula: '1d20',
        presets: [
          {
            formula: '1d10',
            label: 'Untrained'
          }
        ]
      },
      {
        type: 'Compound',
        dieLabel: 'RollModifierDieTerm',
        modifierLabel: 'SpellCheck',
        formula: '3'
      },
      {
        type: 'CheckPenalty',
        apply: true,
        formula: 0
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
  expect(game.dcc.processSpellCheck).toHaveBeenCalledTimes(3)
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

  // Roll a spell check with an item
  const dummyItem = new DCCItem('The Gloaming', { type: 'spell' })
  collectionFindMock.mockReturnValue(dummyItem)
  await actor.rollSpellCheck({ spell: 'The Gloaming' })
  expect(collectionFindMock).toHaveBeenCalledTimes(1)
  expect(game.dcc.processSpellCheck).toHaveBeenCalledTimes(3)
  expect(dccItemRollSpellCheckMock).toHaveBeenCalledWith('int', { abilityId: 'int', spell: 'The Gloaming' })
  expect(uiNotificationsWarnMock).toHaveBeenCalledTimes(0)

  // Roll a spell check with an item of the wrong type
  collectionFindMock.mockReturnValue(new DCCItem('Swordfish', { type: 'weapon' }))
  await actor.rollSpellCheck({ spell: 'Swordfish' })
  expect(collectionFindMock).toHaveBeenCalledTimes(2)
  expect(game.dcc.processSpellCheck).toHaveBeenCalledTimes(3)
  expect(game.dcc.processSpellCheck).toHaveBeenCalledTimes(3)
  expect(uiNotificationsWarnMock).toHaveBeenCalledTimes(1)
  expect(uiNotificationsWarnMock).toHaveBeenCalledWith('SpellCheckNonSpellWarning')

  // Roll a spell check with an unowned item
  collectionFindMock.mockReturnValue(null)
  await actor.rollSpellCheck({ spell: 'Missing Spell' })
  expect(collectionFindMock).toHaveBeenCalledTimes(3)
  expect(game.dcc.processSpellCheck).toHaveBeenCalledTimes(3)
  expect(game.dcc.processSpellCheck).toHaveBeenCalledTimes(3)
  expect(uiNotificationsWarnMock).toHaveBeenCalledTimes(2)
  expect(uiNotificationsWarnMock).toHaveBeenCalledWith('SpellCheckNoOwnedItemWarning')
})
