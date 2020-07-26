/* Tests for PC Parser */
/* eslint-env jest */

import parsePC from '../pc-parser.js'

/* Test blacksmith text */
test('blacksmith', () => {
  const parsedNPC = parsePC(
    `0-level Occupation: Blacksmith
Strength: 7 (-1)
Agility: 7 (-1)
Stamina: 12 (0)
Personality: 17 (+2)
Intelligence: 5 (-2)
Luck: 12 (0)

AC: 9; HP: 3
Weapon: Hammer (as club) -1 (1d4-1)
Speed: 30; Init: -1; Ref: -1; Fort: 0; Will: 2

Equipment: Crowbar (2 gp)
Trade good: Steel tongs
Starting Funds: 42 cp
Lucky sign: Fox's cunning (Find/disable traps)
Languages: Common`)
  const expected = {
    'data.attributes.init.value': '-1',
    'data.attributes.speed.value': '30',
    'data.details.occupation.value': 'Blacksmith',
    'data.attributes.ac.value': '9',
    'data.attributes.hp.value': '3',
    'data.attributes.hp.max': '3',
    'data.abilities.str.value': '7',
    'data.abilities.agl.value': '7',
    'data.abilities.sta.value': '12',
    'data.abilities.per.value': '17',
    'data.abilities.int.value': '5',
    'data.abilities.lck.value': '12',
    'data.saves.frt.value': '0',
    'data.saves.ref.value': '-1',
    'data.saves.wil.value': '2',
    'data.items.weapons.m1.name': 'Hammer (as club)',
    'data.items.weapons.m1.toHit': '-1',
    'data.items.weapons.m1.damage': '1d4-1'
  }
  expect(parsedNPC).toEqual(expect.objectContaining(expected))
})

/* Test beekeeper json */
test('beekeeper', () => {
  const parsedNPC = parsePC(
    `{
  "occTitle": "Beekeeper",
  "strengthScore": "15",
  "strengthMod": "1",
  "agilityScore": "5",
  "agilityMod": "-2",
  "staminaScore": "17",
  "staminaMod": "2",
  "personalityScore": "8",
  "personalityMod": "-1",
  "intelligenceScore": "6",
  "intelligenceMod": "-1",
  "luckScore": "5",
  "luckMod": "-2",
  "armorClass": "8",
  "hitPoints": "6",
  "weapon": "Staff",
  "attackMod": "1",
  "attackDamageMod": "1",
  "attackDamage": "1d4+1",
  "attackModMelee": "1",
  "attackDamageMelee": "1",
  "attackModRanged": "-2",
  "attackDamageRanged": "0",
  "speed": "30",
  "initiative": "-2",
  "saveReflex": "-2",
  "saveFort": "2",
  "saveWill": "-1",
  "equipment": "Sack (small) (8 cp)",
  "equipment2": "",
  "equipment3": "Water skin",
  "tradeGood": "Jar of honey",
  "startingFunds": "31 cp",
  "luckySign": "Unholy house (Corruption rolls) (-2)",
  "languages": "Common",
  "racialTraits": ""
}`)
  const expected = {
    'data.attributes.init.value': '-2',
    'data.attributes.speed.value': '30',
    'data.details.occupation.value': 'Beekeeper',
    'data.attributes.ac.value': '8',
    'data.attributes.hp.value': '6',
    'data.attributes.hp.max': '6',
    'data.abilities.str.value': '15',
    'data.abilities.agl.value': '5',
    'data.abilities.sta.value': '17',
    'data.abilities.per.value': '8',
    'data.abilities.int.value': '6',
    'data.abilities.lck.value': '5',
    'data.saves.frt.value': '2',
    'data.saves.ref.value': '-2',
    'data.saves.wil.value': '-1',
    'data.items.weapons.m1.name': 'Staff',
    'data.items.weapons.m1.toHit': '1',
    'data.items.weapons.m1.damage': '1d4+1'
  }
  expect(parsedNPC).toEqual(expect.objectContaining(expected))
})
