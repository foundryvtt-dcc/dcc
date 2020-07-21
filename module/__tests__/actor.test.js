/* Tests for Actor.js using Foundry Mocks */
/* Mocks for Foundry Classes/Functions are found in __mocks__/foundry.js */

import DCCActor from '../actor'

//Create Base Test Actor
const actor = new DCCActor()

test('prepareData sets ability modifiers', () => {
  const abilities = actor.data.data.abilities

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

test('roll ability check', () => {
  actor.rollAbilityCheck('str')
  expect(Roll).toHaveBeenCalledTimes(1)
  expect(Roll).toHaveBeenCalledWith('1d20+@abilMod', { 'abilMod': -1, 'critical': 20 })
  expect(rollToMessageMock).toHaveBeenCalledWith({ flavor: 'AbilityStr Check', speaker: actor })

  //Check that luck doesn't add ability mod
  actor.rollAbilityCheck('lck', { event: { currentTarget: { className: 'random' } } })
  expect(Roll).toHaveBeenCalledTimes(3)
  expect(Roll).toHaveBeenCalledWith('1d20')
  expect(rollToMessageMock).toHaveBeenLastCalledWith({ flavor: 'AbilityLck Check', speaker: actor })

  //Unless they click on the ability mod of luck
  actor.rollAbilityCheck('lck', { event: { currentTarget: { className: 'ability-modifiers' } } })
  expect(Roll).toHaveBeenCalledTimes(4)
  expect(Roll).toHaveBeenCalledWith('1d20+@abilMod', { 'abilMod': -1, 'critical': 20 })
  expect(rollToMessageMock).toHaveBeenLastCalledWith({ flavor: 'AbilityLck Check', speaker: actor })
})