/* Tests for PC Parser */

import { expect, test } from 'vitest'
import '../__mocks__/foundry.js'
import '../__mocks__/roll.js'
import parsePCs from '../pc-parser.js'

/* Test blacksmith text */
test('blacksmith', () => {
  const parsedNPC = parsePCs(
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
    'attributes.init.value': '-1',
    'attributes.speed.value': '30',
    'details.occupation.value': 'Blacksmith',
    'attributes.ac.value': '9',
    'attributes.hp.value': 3,
    'attributes.hp.max': 3,
    'attributes.hitDice.value': '1d4',
    'abilities.str.value': '7',
    'abilities.agl.value': '7',
    'abilities.sta.value': '12',
    'abilities.per.value': '17',
    'abilities.int.value': '5',
    'abilities.lck.value': '12',
    'abilities.str.max': '7',
    'abilities.agl.max': '7',
    'abilities.sta.max': '12',
    'abilities.per.max': '17',
    'abilities.int.max': '5',
    'abilities.lck.max': '12',
    'saves.frt.value': '0',
    'saves.ref.value': '-1',
    'saves.wil.value': '2',
    items: [
      {
        name: 'Hammer (as club)',
        type: 'weapon',
        img: 'systems/dcc/styles/images/weapon.webp',
        system: {
          toHit: '-1',
          damage: '1d4-1',
          melee: true
        }
      },
      {
        name: 'Crowbar (2 gp)',
        type: 'equipment',
        img: 'systems/dcc/styles/images/item.webp'
      },
      {
        name: 'Steel tongs',
        type: 'equipment',
        img: 'systems/dcc/styles/images/item.webp'
      },
      {
        name: 'Coins',
        type: 'treasure',
        img: 'systems/dcc/styles/images/coins.webp',
        system: {
          value: {
            cp: '42',
            ep: '0',
            gp: '0',
            pp: '0',
            sp: '0'
          },
          isCoins: true
        }
      }
    ]
  }
  expect(parsedNPC).toMatchObject([expected])
})

/* Test beekeeper json */
test('beekeeper', () => {
  const parsedNPC = parsePCs(
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
    'attributes.init.value': '-2',
    'attributes.speed.value': '30',
    'details.occupation.value': 'Beekeeper',
    'attributes.ac.value': '8',
    'attributes.hp.value': 6,
    'attributes.hp.max': 6,
    'attributes.hitDice.value': '1d4',
    'abilities.str.value': '15',
    'abilities.agl.value': '5',
    'abilities.sta.value': '17',
    'abilities.per.value': '8',
    'abilities.int.value': '6',
    'abilities.lck.value': '5',
    'abilities.str.max': '15',
    'abilities.agl.max': '5',
    'abilities.sta.max': '17',
    'abilities.per.max': '8',
    'abilities.int.max': '6',
    'abilities.lck.max': '5',
    'saves.frt.value': '2',
    'saves.ref.value': '-2',
    'saves.wil.value': '-1',
    items: [
      {
        name: 'Staff',
        type: 'weapon',
        img: 'systems/dcc/styles/images/weapon.webp',
        system: {
          toHit: '1',
          damage: '1d4+1',
          melee: true
        }
      },
      {
        name: 'Sack (small) (8 cp)',
        type: 'equipment',
        img: 'systems/dcc/styles/images/item.webp'
      },
      {
        name: 'Water skin',
        type: 'equipment',
        img: 'systems/dcc/styles/images/item.webp'
      },
      {
        name: 'Jar of honey',
        type: 'equipment',
        img: 'systems/dcc/styles/images/item.webp'
      },
      {
        name: 'Coins',
        type: 'treasure',
        img: 'systems/dcc/styles/images/coins.webp',
        system: {
          value: {
            cp: '31',
            ep: '0',
            gp: '0',
            pp: '0',
            sp: '0'
          },
          isCoins: true
        }
      }
    ]
  }
  expect(parsedNPC).toMatchObject([expected])
})

/* Test blacksmith text */
test('blacksmith-no-weapons', () => {
  const parsedNPC = parsePCs(
    `0-level Occupation: Blacksmith
Strength: 7 (-1)
Agility: 7 (-1)
Stamina: 12 (0)
Personality: 17 (+2)
Intelligence: 5 (-2)
Luck: 12 (0)

AC: 9; HP: 3
Speed: 30; Init: -1; Ref: -1; Fort: 0; Will: 2

Equipment: Crowbar (2 gp)
Trade good: Steel tongs
Starting Funds: 42 cp
Lucky sign: Fox's cunning (Find/disable traps)
Languages: Common`)
  const expected = {
    'attributes.init.value': '-1',
    'attributes.speed.value': '30',
    'details.occupation.value': 'Blacksmith',
    'attributes.ac.value': '9',
    'attributes.hp.value': 3,
    'attributes.hp.max': 3,
    'attributes.hitDice.value': '1d4',
    'abilities.str.value': '7',
    'abilities.agl.value': '7',
    'abilities.sta.value': '12',
    'abilities.per.value': '17',
    'abilities.int.value': '5',
    'abilities.lck.value': '12',
    'abilities.str.max': '7',
    'abilities.agl.max': '7',
    'abilities.sta.max': '12',
    'abilities.per.max': '17',
    'abilities.int.max': '5',
    'abilities.lck.max': '12',
    'saves.frt.value': '0',
    'saves.ref.value': '-1',
    'saves.wil.value': '2',
    items: [
      {
        name: 'Crowbar (2 gp)',
        type: 'equipment',
        img: 'systems/dcc/styles/images/item.webp'
      },
      {
        name: 'Steel tongs',
        type: 'equipment',
        img: 'systems/dcc/styles/images/item.webp'
      },
      {
        name: 'Coins',
        type: 'treasure',
        img: 'systems/dcc/styles/images/coins.webp',
        system: {
          value: {
            cp: '42',
            ep: '0',
            gp: '0',
            pp: '0',
            sp: '0'
          },
          isCoins: true
        }
      }
    ]
  }
  expect(parsedNPC).toMatchObject([expected])
})

/* Test multiple zeroes */
test('zeroes', () => {
  const parsedNPC = parsePCs(
    `Some banner text
That should be ignored

0-level Occupation: Blacksmith
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
Languages: Common


0-level Occupation: Woodcutter
Strength: 8 (-1)
Agility: 11 (0)
Stamina: 10 (0)
Personality: 12 (0)
Intelligence: 11 (0)
Luck: 10 (0)

AC: 10; HP: 1
Weapon: Handaxe -1 (1d6-1)
Speed: 30; Init: 0; Ref: 0; Fort: 0; Will: 0

Equipment: Torch (1 cp)
Trade good: Bundle of wood
Starting Funds: 29 cp
Lucky sign: Survived the plague (Magical healing) (+0)
Languages: Common `)
  const expected = [
    {
      'attributes.init.value': '-1',
      'attributes.speed.value': '30',
      'details.occupation.value': 'Blacksmith',
      'attributes.ac.value': '9',
      'attributes.hp.value': 3,
      'attributes.hp.max': 3,
      'attributes.hitDice.value': '1d4',
      'abilities.str.value': '7',
      'abilities.agl.value': '7',
      'abilities.sta.value': '12',
      'abilities.per.value': '17',
      'abilities.int.value': '5',
      'abilities.lck.value': '12',
      'abilities.str.max': '7',
      'abilities.agl.max': '7',
      'abilities.sta.max': '12',
      'abilities.per.max': '17',
      'abilities.int.max': '5',
      'abilities.lck.max': '12',
      'saves.frt.value': '0',
      'saves.ref.value': '-1',
      'saves.wil.value': '2',
      items: [
        {
          name: 'Hammer (as club)',
          type: 'weapon',
          img: 'systems/dcc/styles/images/weapon.webp',
          system: {
            toHit: '-1',
            damage: '1d4-1',
            melee: true
          }
        },
        {
          name: 'Crowbar (2 gp)',
          type: 'equipment',
          img: 'systems/dcc/styles/images/item.webp'
        },
        {
          name: 'Steel tongs',
          type: 'equipment',
          img: 'systems/dcc/styles/images/item.webp'
        },
        {
          name: 'Coins',
          type: 'treasure',
          img: 'systems/dcc/styles/images/coins.webp',
          system: {
            value: {
              cp: '42',
              ep: '0',
              gp: '0',
              pp: '0',
              sp: '0'
            },
            isCoins: true
          }
        }
      ]
    },
    {
      'attributes.init.value': '0',
      'attributes.speed.value': '30',
      'details.occupation.value': 'Woodcutter',
      'attributes.ac.value': '10',
      'attributes.hp.value': 1,
      'attributes.hp.max': 1,
      'attributes.hitDice.value': '1d4',
      'abilities.str.value': '8',
      'abilities.agl.value': '11',
      'abilities.sta.value': '10',
      'abilities.per.value': '12',
      'abilities.int.value': '11',
      'abilities.lck.value': '10',
      'abilities.str.max': '8',
      'abilities.agl.max': '11',
      'abilities.sta.max': '10',
      'abilities.per.max': '12',
      'abilities.int.max': '11',
      'abilities.lck.max': '10',
      'saves.frt.value': '0',
      'saves.ref.value': '0',
      'saves.wil.value': '0',
      items: [
        {
          name: 'Handaxe',
          type: 'weapon',
          img: 'systems/dcc/styles/images/weapon.webp',
          system: {
            toHit: '-1',
            damage: '1d6-1',
            melee: true
          }
        },
        {
          name: 'Torch (1 cp)',
          type: 'equipment',
          img: 'systems/dcc/styles/images/item.webp'
        },
        {
          name: 'Bundle of wood',
          type: 'equipment',
          img: 'systems/dcc/styles/images/item.webp'
        },
        {
          name: 'Coins',
          type: 'treasure',
          img: 'systems/dcc/styles/images/coins.webp',
          system: {
            value: {
              cp: '29',
              ep: '0',
              gp: '0',
              pp: '0',
              sp: '0'
            },
            isCoins: true
          }
        }
      ]
    }
  ]
  expect(parsedNPC).toMatchObject(expected)
})

/* Test Cleric's text */
test('cleric', () => {
  const parsedNPC = parsePCs(
    `Generator Settings
Source: Rulebook | Roll Mode: 3d6 | HP: normal | HP-up: normal | Augur: normal

Neutral Cleric (1st level)
Occupation: Cobbler
Strength: 10 (0)
Agility: 14 (+1)
Stamina: 6 (-1)
Personality: 13 (+1)
Intelligence: 13 (+1)
Luck: 10 (0)

HP: 4; Speed: 30; Init: 1
Ref: 1; Fort: 0; Will: 2

Base Attack Mod: 0
Attack Dice: 1d20; Crit Die/Table: 1d8/III
Occupation Weapon: Dagger melee +0 (dmg 1d4)
Main Weapon: Dart ranged +1 (dmg 1d4)
Secondary Weapon: Spear melee +0 (dmg 1d8)

AC: (15)* (Hide + Shield (+4) Check penalty (-4) Fumble die (d12))
Equipment: Waterskin (5 sp)
Trade good: Shoehorn
Starting Funds: 36 cp + 40 gp
Lucky sign: Lucky sign (Saving throws) (+0)
Languages: Common, Elf

Spells: (Spell Check: d20+2)
1) Darkness
1) Detect Evil
1) Detect Magic
1) Word of Command`
  )
  const expected = {
    'attributes.init.value': '1',
    'attributes.speed.value': '30',
    'details.occupation.value': 'Cobbler',
    'attributes.ac.value': '15',
    'attributes.hp.value': 4,
    'attributes.hp.max': 4,
    'attributes.hitDice.value': '1d8',
    'attributes.critical.die': '1d8',
    'attributes.critical.table': 'III',
    'abilities.str.value': '10',
    'abilities.agl.value': '14',
    'abilities.sta.value': '6',
    'abilities.per.value': '13',
    'abilities.int.value': '13',
    'abilities.lck.value': '10',
    'abilities.str.max': '10',
    'abilities.agl.max': '14',
    'abilities.sta.max': '6',
    'abilities.per.max': '13',
    'abilities.int.max': '13',
    'abilities.lck.max': '10',
    'class.className': 'Cleric',
    'class.spellCheck': '+2',
    'config.actionDice': '1d20',
    'details.alignment': 'n',
    'details.attackBonus': '0',
    'details.birthAugur': 'Lucky sign (Saving throws) (+0)',
    'details.languages': 'Common, Elf',
    'details.level.value': '1',
    'saves.frt.value': '0',
    'saves.ref.value': '1',
    'saves.wil.value': '2',
    items: [
      {
        name: 'Dagger',
        type: 'weapon',
        img: 'systems/dcc/styles/images/weapon.webp',
        system: {
          toHit: '+0',
          damage: '1d4',
          melee: true
        }
      },
      {
        name: 'Dart',
        type: 'weapon',
        img: 'systems/dcc/styles/images/weapon.webp',
        system: {
          toHit: '+1',
          damage: '1d4',
          melee: false
        }
      },
      {
        name: 'Spear',
        type: 'weapon',
        img: 'systems/dcc/styles/images/weapon.webp',
        system: {
          toHit: '+0',
          damage: '1d8',
          melee: true
        }
      },
      {
        name: 'Hide + Shield',
        type: 'armor',
        img: 'systems/dcc/styles/images/armor.webp',
        system: {
          acBonus: '+4',
          checkPenalty: '-4',
          fumbleDie: '1d12'
        }
      },
      {
        name: 'Waterskin (5 sp)',
        type: 'equipment',
        img: 'systems/dcc/styles/images/item.webp'
      },
      {
        name: 'Shoehorn',
        type: 'equipment',
        img: 'systems/dcc/styles/images/item.webp'
      },
      {
        name: 'Coins',
        type: 'treasure',
        img: 'systems/dcc/styles/images/coins.webp',
        system: {
          value: {
            pp: '0',
            ep: '0',
            gp: '40',
            sp: '0',
            cp: '36'
          },
          isCoins: true
        }
      },
      {
        name: 'Darkness',
        type: 'spell',
        img: 'systems/dcc/styles/images/spell.webp',
        system: {
          level: '1',
          spellCheck: {
            die: '1d20',
            value: '+2'
          }
        }
      },
      {
        name: 'Detect Evil',
        type: 'spell',
        img: 'systems/dcc/styles/images/spell.webp',
        system: {
          level: '1',
          spellCheck: {
            die: '1d20',
            value: '+2'
          }
        }
      },
      {
        name: 'Detect Magic',
        type: 'spell',
        img: 'systems/dcc/styles/images/spell.webp',
        system: {
          level: '1',
          spellCheck: {
            die: '1d20',
            value: '+2'
          }
        }
      },
      {
        name: 'Word of Command',
        type: 'spell',
        img: 'systems/dcc/styles/images/spell.webp',
        system: {
          level: '1',
          spellCheck: {
            die: '1d20',
            value: '+2'
          }
        }
      }
    ]
  }
  expect(parsedNPC).toMatchObject([expected])
})

/* Test Thief's text */
test('thief', () => {
  const parsedNPC = parsePCs(
    `Generator Settings
Source: Rulebook | Roll Mode: 3d6 | HP: normal | HP-up: normal | Augur: normal

Neutral Thief (6th level)
Occupation: Ditch digger
Strength: 10 (0)
Agility: 15 (+1)
Stamina: 8 (-1)
Personality: 9 (0)
Intelligence: 10 (0)
Luck: 10 (0)

HP: 25; Speed: 30; Init: 1
Ref: 5; Fort: 1; Will: 2

Base Attack Mod: 4
Attack Dice: 1d20+1d14; Crit Die/Table: 1d24/II
Occupation Weapon: Staff melee +4 (dmg 1d4)
Main Weapon: +1 Shortbow ranged +6 (dmg 1d6)
Secondary Weapon: +1 Blowgun ranged +6 (dmg 1d3)

AC: (12) (Padded (+1) Check penalty (0) Fumble die (d8))
Equipment: Holy symbol (25 gp)
Trade good: Fine dirt (1 lb.)
Starting Funds: 30 cp + 508 gp
Lucky sign: Fox's cunning (Find/disable traps) (+0)
Languages: Common, Thieves' Cant
Thief Ability: When expending luck, roll d8 for each point expended

Thief Skills:
Backstab: 5 (0)
Sneak Silently: 12 (1)
Hide In Shadows: 10 (1)
Pick Pocket: 12 (1)
Climb Sheer Surfaces: 12 (1)
Pick Lock: 10 (1)
Find Trap: 9 (0)
Disable Trap: 10 (1)
Forge Document: 12 (1)
Disguise Self: 4 (0)
Read Languages: 5 (0)
Handle Poison: 4 (0)
Cast Spell From Scroll (d16)`
  )
  const expected = {
    'attributes.init.value': '1',
    'attributes.speed.value': '30',
    'details.occupation.value': 'Ditch digger',
    'attributes.ac.value': '12',
    'attributes.hp.value': 25,
    'attributes.hp.max': 25,
    'attributes.hitDice.value': '1d6',
    'attributes.critical.die': '1d24',
    'attributes.critical.table': 'II',
    'abilities.str.value': '10',
    'abilities.agl.value': '15',
    'abilities.sta.value': '8',
    'abilities.per.value': '9',
    'abilities.int.value': '10',
    'abilities.lck.value': '10',
    'abilities.str.max': '10',
    'abilities.agl.max': '15',
    'abilities.sta.max': '8',
    'abilities.per.max': '9',
    'abilities.int.max': '10',
    'abilities.lck.max': '10',
    'class.className': 'Thief',
    'config.actionDice': '1d20,1d14',
    'details.alignment': 'n',
    'details.attackBonus': '4',
    'details.birthAugur': 'Fox\'s cunning (Find/disable traps) (+0)',
    'details.languages': 'Common, Thieves\' Cant',
    'details.level.value': '6',
    'saves.frt.value': '1',
    'saves.ref.value': '5',
    'saves.wil.value': '2',
    'class.backstab': '5',
    'skills.sneakSilently.value': '12',
    'skills.hideInShadows.value': '10',
    'skills.pickPockets.value': '12',
    'skills.climbSheerSurfaces.value': '12',
    'skills.pickLock.value': '10',
    'skills.findTrap.value': '9',
    'skills.disableTrap.value': '10',
    'skills.forgeDocument.value': '12',
    'skills.disguiseSelf.value': '4',
    'skills.readLanguages.value': '5',
    'skills.handlePoison.value': '4',
    'skills.castSpellFromScroll.die': '1d16',
    items: [
      {
        name: 'Staff',
        type: 'weapon',
        img: 'systems/dcc/styles/images/weapon.webp',
        system: {
          toHit: '+4',
          damage: '1d4',
          melee: true
        }
      },
      {
        name: '+1 Shortbow',
        type: 'weapon',
        img: 'systems/dcc/styles/images/weapon.webp',
        system: {
          toHit: '+6',
          damage: '1d6',
          melee: false
        }
      },
      {
        name: '+1 Blowgun',
        type: 'weapon',
        img: 'systems/dcc/styles/images/weapon.webp',
        system: {
          toHit: '+6',
          damage: '1d3',
          melee: false
        }
      },
      {
        name: 'Padded',
        type: 'armor',
        img: 'systems/dcc/styles/images/armor.webp',
        system: {
          acBonus: '+1',
          checkPenalty: '0',
          fumbleDie: '1d8'
        }
      },
      {
        name: 'Holy symbol (25 gp)',
        type: 'equipment',
        img: 'systems/dcc/styles/images/item.webp'
      },
      {
        name: 'Fine dirt (1 lb.)',
        type: 'equipment',
        img: 'systems/dcc/styles/images/item.webp'
      },
      {
        name: 'Coins',
        type: 'treasure',
        img: 'systems/dcc/styles/images/coins.webp',
        system: {
          value: {
            pp: '0',
            ep: '0',
            gp: '508',
            sp: '0',
            cp: '30'
          },
          isCoins: true
        }
      }
    ]
  }
  expect(parsedNPC).toMatchObject([expected])
})

/* Test Halfling's text */
test('halfling', () => {
  const parsedNPC = parsePCs(
    `Generator Settings
Source: Rulebook | Roll Mode: 3d6 | HP: normal | HP-up: normal | Augur: normal

Chaotic Halfling (10th level)
Occupation: Halfling gypsy
Strength: 11 (0)
Agility: 11 (0)
Stamina: 13 (+1)
Personality: 15 (+1)
Intelligence: 12 (0)
Luck: 11 (0)

HP: 48; Speed: 15; Init: 0
Ref: 6; Fort: 5; Will: 7

Base Attack Mod: 8
Attack Dice: 1d20+1d20; Crit Die/Table: 1d16/III
Occupation Weapon: Sling ranged +8 (dmg 1d4)
Main Weapon: +3 Crossbow ranged +11 (dmg 1d6)
Secondary Weapon: +2 Dagger melee +10 (dmg 1d4+2)

AC: (14) (Scale Mail (+4) Check penalty (-4) Fumble die (d12) Speed (-5))
Equipment: Iron spike (1 sp)
Trade good: Hex doll
Starting Funds: 33 cp + 1535 gp
Lucky sign: Harsh winter (All attack rolls) (+0)
Languages: Common, Halfling, Alignment
Racial Traits: Halfling ability: Infravision
Halfling skills: Two weapon fighting, Good luck charm, Stealth

Thief Skills:
Sneak Silently: 11 (-4)
Hide In Shadows: 11 (-4)`
  )
  const expected = {
    'attributes.init.value': '0',
    'attributes.speed.value': '15',
    'details.occupation.value': 'Halfling gypsy',
    'attributes.ac.value': '14',
    'attributes.hp.value': 48,
    'attributes.hp.max': 48,
    'attributes.hitDice.value': '1d6',
    'attributes.critical.die': '1d16',
    'attributes.critical.table': 'III',
    'abilities.str.value': '11',
    'abilities.agl.value': '11',
    'abilities.sta.value': '13',
    'abilities.per.value': '15',
    'abilities.int.value': '12',
    'abilities.lck.value': '11',
    'abilities.str.max': '11',
    'abilities.agl.max': '11',
    'abilities.sta.max': '13',
    'abilities.per.max': '15',
    'abilities.int.max': '12',
    'abilities.lck.max': '11',
    'class.className': 'Halfling',
    'config.actionDice': '1d20,1d20',
    'details.alignment': 'c',
    'details.attackBonus': '8',
    'details.birthAugur': 'Harsh winter (All attack rolls) (+0)',
    'details.languages': 'Common, Halfling, Alignment',
    'details.level.value': '10',
    'saves.frt.value': '5',
    'saves.ref.value': '6',
    'saves.wil.value': '7',
    'skills.sneakAndHide.value': '11',
    'skills.sneakSilently.value': '11',
    'skills.hideInShadows.value': '11',
    items: [
      {
        name: 'Sling',
        type: 'weapon',
        img: 'systems/dcc/styles/images/weapon.webp',
        system: {
          toHit: '+8',
          damage: '1d4',
          melee: false
        }
      },
      {
        name: '+3 Crossbow',
        type: 'weapon',
        img: 'systems/dcc/styles/images/weapon.webp',
        system: {
          toHit: '+11',
          damage: '1d6',
          melee: false
        }
      },
      {
        name: '+2 Dagger',
        type: 'weapon',
        img: 'systems/dcc/styles/images/weapon.webp',
        system: {
          toHit: '+10',
          damage: '1d4+2',
          melee: true
        }
      },
      {
        name: 'Scale Mail',
        type: 'armor',
        img: 'systems/dcc/styles/images/armor.webp',
        system: {
          acBonus: '+4',
          checkPenalty: '-4',
          fumbleDie: '1d12'
        }
      },
      {
        name: 'Iron spike (1 sp)',
        type: 'equipment',
        img: 'systems/dcc/styles/images/item.webp'
      },
      {
        name: 'Hex doll',
        type: 'equipment',
        img: 'systems/dcc/styles/images/item.webp'
      },
      {
        name: 'Coins',
        type: 'treasure',
        img: 'systems/dcc/styles/images/coins.webp',
        system: {
          value: {
            pp: '0',
            ep: '0',
            gp: '1535',
            sp: '0',
            cp: '33'
          },
          isCoins: true
        }
      }
    ]
  }
  expect(parsedNPC).toMatchObject([expected])
})

/* Test Warrior's text */
test('warrior', () => {
  const parsedNPC = parsePCs(
    `Generator Settings
Source: Rulebook | Roll Mode: 3d6 | HP: normal | HP-up: normal | Augur: normal

Lawful Warrior (8th level)
Occupation: Orphan
Strength: 12 (0)
Agility: 8 (-1)
Stamina: 13 (+1)
Personality: 8 (-1)
Intelligence: 10 (0)
Luck: 11 (0)

HP: 62; Speed: 25; Init: 7
Ref: 2; Fort: 6; Will: 1

Base Attack Mod: d10+2
Attack Dice: 1d20+1d20; Crit Die/Table: 2d20/V
Occupation Weapon: Club melee d10+2 (dmg 1d4+deed)
Main Weapon: +2 Flail melee d10+2+2 (dmg 1d6+2+deed)
Secondary Weapon: +1 Club melee d10+2+1 (dmg 1d4+1+deed)

AC: (13) (Scale Mail (+4) Check penalty (-4) Fumble die (d12) Speed (-5))
Equipment: Chest - empty (2 gp)
Trade good: Rag doll
Starting Funds: 34 cp + 1520 gp
Lucky sign: Resisted temptation (Willpower saving throws) (+0)
Languages: Common
Warrior trait: Lucky weapon - choose one weapon that you apply your luck mod to`
  )
  const expected = {
    'attributes.init.value': '7',
    'attributes.speed.value': '25',
    'details.occupation.value': 'Orphan',
    'attributes.ac.value': '13',
    'attributes.hp.value': 62,
    'attributes.hp.max': 62,
    'attributes.hitDice.value': '1d12',
    'attributes.critical.die': '2d20',
    'attributes.critical.table': 'V',
    'abilities.str.value': '12',
    'abilities.agl.value': '8',
    'abilities.sta.value': '13',
    'abilities.per.value': '8',
    'abilities.int.value': '10',
    'abilities.lck.value': '11',
    'abilities.str.max': '12',
    'abilities.agl.max': '8',
    'abilities.sta.max': '13',
    'abilities.per.max': '8',
    'abilities.int.max': '10',
    'abilities.lck.max': '11',
    'class.className': 'Warrior',
    'config.actionDice': '1d20,1d20',
    'details.alignment': 'l',
    'details.attackBonus': 'd10+2',
    'details.birthAugur': 'Resisted temptation (Willpower saving throws) (+0)',
    'details.languages': 'Common',
    'details.level.value': '8',
    'saves.frt.value': '6',
    'saves.ref.value': '2',
    'saves.wil.value': '1',
    items: [
      {
        name: 'Club',
        type: 'weapon',
        img: 'systems/dcc/styles/images/weapon.webp',
        system: {
          toHit: 'd10+2',
          damage: '1d4+@ab',
          melee: true
        }
      },
      {
        name: '+2 Flail',
        type: 'weapon',
        img: 'systems/dcc/styles/images/weapon.webp',
        system: {
          toHit: 'd10+2+2',
          damage: '1d6+2+@ab',
          melee: true
        }
      },
      {
        name: '+1 Club',
        type: 'weapon',
        img: 'systems/dcc/styles/images/weapon.webp',
        system: {
          toHit: 'd10+2+1',
          damage: '1d4+1+@ab',
          melee: true
        }
      },
      {
        name: 'Scale Mail',
        type: 'armor',
        img: 'systems/dcc/styles/images/armor.webp',
        system: {
          acBonus: '+4',
          checkPenalty: '-4',
          fumbleDie: '1d12'
        }
      },
      {
        name: 'Chest - empty (2 gp)',
        type: 'equipment',
        img: 'systems/dcc/styles/images/item.webp'
      },
      {
        name: 'Rag doll',
        type: 'equipment',
        img: 'systems/dcc/styles/images/item.webp'
      },
      {
        name: 'Coins',
        type: 'treasure',
        img: 'systems/dcc/styles/images/coins.webp',
        system: {
          value: {
            pp: '0',
            ep: '0',
            gp: '1520',
            sp: '0',
            cp: '34'
          },
          isCoins: true
        }
      }
    ]
  }
  expect(parsedNPC).toMatchObject([expected])
})

/* Test Wizard's text */
test('wizard', () => {
  const parsedNPC = parsePCs(
    `Generator Settings
Source: Rulebook | Roll Mode: 3d6 | HP: normal | HP-up: normal | Augur: normal

Chaotic Wizard (10th level)
Occupation: Woodcutter
Strength: 14 (+1)
Agility: 7 (-1)
Stamina: 8 (-1)
Personality: 14 (+1)
Intelligence: 17 (+2)
Luck: 12 (0)

HP: 15; Speed: 30; Init: -1
Ref: 3; Fort: 2; Will: 7

Base Attack Mod: 4
Attack Dice: 1d20+1d20+1d14; Crit Die/Table: 1d14/I
Occupation Weapon: Handaxe melee +5 (dmg 1d6+1)
Main Weapon: +3 Staff melee +8 (dmg 1d4+4)
Secondary Weapon: +2 Shortbow ranged +5 (dmg 1d6)

AC: (9) (Unarmored (+0) Check penalty (0) Fumble die (d4))
Equipment: Sack (small) (8 cp)
Trade good: Bundle of wood
Starting Funds: 34 cp + 1115 gp
Lucky sign: Warrior's arm (Critical hit tables) (+0)
Languages: Common, Harpy, Alignment, Kobold, Orc

Spells: (Spell Check: d20+12)
1) Chill Touch
1) Ekim's Mystical Mask
1) Flaming Hands
1) Magic Missile
1) Read Magic
1) Ropework
1) Runic Alphabet
2) Mirror Image
2) Phantasm
3) Fly
3) Turn to Stone
4) Control Fire
4) Lokerimon's Orderly Assistance
4) Polymorph
4) Wizard Sense
5) Hepsoj's Fecund Fungi
5) Magic Bulwark
5) Mind Purge`
  )
  const expected = {
    'attributes.init.value': '-1',
    'attributes.speed.value': '30',
    'details.occupation.value': 'Woodcutter',
    'attributes.ac.value': '9',
    'attributes.hp.value': 15,
    'attributes.hp.max': 15,
    'attributes.hitDice.value': '1d4',
    'attributes.critical.die': '1d14',
    'attributes.critical.table': 'I',
    'abilities.str.value': '14',
    'abilities.agl.value': '7',
    'abilities.sta.value': '8',
    'abilities.per.value': '14',
    'abilities.int.value': '17',
    'abilities.lck.value': '12',
    'abilities.str.max': '14',
    'abilities.agl.max': '7',
    'abilities.sta.max': '8',
    'abilities.per.max': '14',
    'abilities.int.max': '17',
    'abilities.lck.max': '12',
    'class.className': 'Wizard',
    'class.spellCheck': '+12',
    'config.actionDice': '1d20,1d20,1d14',
    'details.alignment': 'c',
    'details.attackBonus': '4',
    'details.birthAugur': 'Warrior\'s arm (Critical hit tables) (+0)',
    'details.languages': 'Common, Harpy, Alignment, Kobold, Orc',
    'details.level.value': '10',
    'saves.frt.value': '2',
    'saves.ref.value': '3',
    'saves.wil.value': '7',
    items: [
      {
        name: 'Handaxe',
        type: 'weapon',
        img: 'systems/dcc/styles/images/weapon.webp',
        system: {
          toHit: '+5',
          damage: '1d6+1',
          melee: true
        }
      },
      {
        name: '+3 Staff',
        type: 'weapon',
        img: 'systems/dcc/styles/images/weapon.webp',
        system: {
          toHit: '+8',
          damage: '1d4+4',
          melee: true
        }
      },
      {
        name: '+2 Shortbow',
        type: 'weapon',
        img: 'systems/dcc/styles/images/weapon.webp',
        system: {
          toHit: '+5',
          damage: '1d6',
          melee: false
        }
      },
      {
        name: 'Unarmored',
        type: 'armor',
        img: 'systems/dcc/styles/images/armor.webp',
        system: {
          acBonus: '+0',
          checkPenalty: '0',
          fumbleDie: '1d4'
        }
      },
      {
        name: 'Sack (small) (8 cp)',
        type: 'equipment',
        img: 'systems/dcc/styles/images/item.webp'
      },
      {
        name: 'Bundle of wood',
        type: 'equipment',
        img: 'systems/dcc/styles/images/item.webp'
      },
      {
        name: 'Coins',
        type: 'treasure',
        img: 'systems/dcc/styles/images/coins.webp',
        system: {
          value: {
            pp: '0',
            ep: '0',
            gp: '1115',
            sp: '0',
            cp: '34'
          },
          isCoins: true
        }
      },
      {
        name: 'Chill Touch',
        type: 'spell',
        img: 'systems/dcc/styles/images/spell.webp',
        system: {
          level: '1',
          spellCheck: {
            die: '1d20',
            value: '+12'
          }
        }
      },
      {
        name: 'Ekim\'s Mystical Mask',
        type: 'spell',
        img: 'systems/dcc/styles/images/spell.webp',
        system: {
          level: '1',
          spellCheck: {
            die: '1d20',
            value: '+12'
          }
        }
      },
      {
        name: 'Flaming Hands',
        type: 'spell',
        img: 'systems/dcc/styles/images/spell.webp',
        system: {
          level: '1',
          spellCheck: {
            die: '1d20',
            value: '+12'
          }
        }
      },
      {
        name: 'Magic Missile',
        type: 'spell',
        img: 'systems/dcc/styles/images/spell.webp',
        system: {
          level: '1',
          spellCheck: {
            die: '1d20',
            value: '+12'
          }
        }
      },
      {
        name: 'Read Magic',
        type: 'spell',
        img: 'systems/dcc/styles/images/spell.webp',
        system: {
          level: '1',
          spellCheck: {
            die: '1d20',
            value: '+12'
          }
        }
      },
      {
        name: 'Ropework',
        type: 'spell',
        img: 'systems/dcc/styles/images/spell.webp',
        system: {
          level: '1',
          spellCheck: {
            die: '1d20',
            value: '+12'
          }
        }
      },
      {
        name: 'Runic Alphabet',
        type: 'spell',
        img: 'systems/dcc/styles/images/spell.webp',
        system: {
          level: '1',
          spellCheck: {
            die: '1d20',
            value: '+12'
          }
        }
      },
      {
        name: 'Mirror Image',
        type: 'spell',
        img: 'systems/dcc/styles/images/spell.webp',
        system: {
          level: '2',
          spellCheck: {
            die: '1d20',
            value: '+12'
          }
        }
      },
      {
        name: 'Phantasm',
        type: 'spell',
        img: 'systems/dcc/styles/images/spell.webp',
        system: {
          level: '2',
          spellCheck: {
            die: '1d20',
            value: '+12'
          }
        }
      },
      {
        name: 'Fly',
        type: 'spell',
        img: 'systems/dcc/styles/images/spell.webp',
        system: {
          level: '3',
          spellCheck: {
            die: '1d20',
            value: '+12'
          }
        }
      },
      {
        name: 'Turn to Stone',
        type: 'spell',
        img: 'systems/dcc/styles/images/spell.webp',
        system: {
          level: '3',
          spellCheck: {
            die: '1d20',
            value: '+12'
          }
        }
      },
      {
        name: 'Control Fire',
        type: 'spell',
        img: 'systems/dcc/styles/images/spell.webp',
        system: {
          level: '4',
          spellCheck: {
            die: '1d20',
            value: '+12'
          }
        }
      },
      {
        name: 'Lokerimon\'s Orderly Assistance',
        type: 'spell',
        img: 'systems/dcc/styles/images/spell.webp',
        system: {
          level: '4',
          spellCheck: {
            die: '1d20',
            value: '+12'
          }
        }
      },
      {
        name: 'Polymorph',
        type: 'spell',
        img: 'systems/dcc/styles/images/spell.webp',
        system: {
          level: '4',
          spellCheck: {
            die: '1d20',
            value: '+12'
          }
        }
      },
      {
        name: 'Wizard Sense',
        type: 'spell',
        img: 'systems/dcc/styles/images/spell.webp',
        system: {
          level: '4',
          spellCheck: {
            die: '1d20',
            value: '+12'
          }
        }
      },
      {
        name: 'Hepsoj\'s Fecund Fungi',
        type: 'spell',
        img: 'systems/dcc/styles/images/spell.webp',
        system: {
          level: '5',
          spellCheck: {
            die: '1d20',
            value: '+12'
          }
        }
      },
      {
        name: 'Magic Bulwark',
        type: 'spell',
        img: 'systems/dcc/styles/images/spell.webp',
        system: {
          level: '5',
          spellCheck: {
            die: '1d20',
            value: '+12'
          }
        }
      },
      {
        name: 'Mind Purge',
        type: 'spell',
        img: 'systems/dcc/styles/images/spell.webp',
        system: {
          level: '5',
          spellCheck: {
            die: '1d20',
            value: '+12'
          }
        }
      }
    ]
  }
  expect(parsedNPC).toMatchObject([expected])
})

/* Test Dwarf's text */
test('dwarf', () => {
  const parsedNPC = parsePCs(
    `Generator Settings
Source: Rulebook | Roll Mode: 3d6 | HP: normal | HP-up: normal | Augur: normal

Neutral Dwarf (3rd level)
Occupation: Dwarven apothacarist
Strength: 13 (+1)
Agility: 5 (-2)
Stamina: 13 (+1)
Personality: 8 (-1)
Intelligence: 11 (0)
Luck: 8 (-1)

HP: 24; Speed: 15; Init: -2
Ref: -1; Fort: 3; Will: 0

Base Attack Mod: d5
Attack Dice: 1d20; Crit Die/Table: 1d14/III
Occupation Weapon: Staff melee d5+1 (dmg 1d4+1+deed)
Main Weapon: Longbow ranged d5-2 (dmg 1d6+deed)
Secondary Weapon: Lance melee d5+1 (dmg 1d12+1+deed)

AC: (13)* (Scale Mail + Shield (+5) Check penalty (-5) Fumble die (d12) Speed (-5))
Equipment: Iron spike (1 sp)
Trade good: Steel vial
Starting Funds: 27 cp + 2027 gp
Lucky sign: Raised by wolves (Unarmed attack rolls) (-1)
Languages: Common, Dwarf, Alignment
Racial Traits: Dwarven ability: Infravision
Dwarf skill: Shield bash - make an extra d14 attack with your shield. (1d3 damage)`
  )
  const expected = {
    'attributes.init.value': '-2',
    'attributes.speed.value': '15',
    'details.occupation.value': 'Dwarven apothacarist',
    'attributes.ac.value': '13',
    'attributes.hp.value': 24,
    'attributes.hp.max': 24,
    'attributes.hitDice.value': '1d10',
    'attributes.critical.die': '1d14',
    'attributes.critical.table': 'III',
    'abilities.str.value': '13',
    'abilities.agl.value': '5',
    'abilities.sta.value': '13',
    'abilities.per.value': '8',
    'abilities.int.value': '11',
    'abilities.lck.value': '8',
    'abilities.str.max': '13',
    'abilities.agl.max': '5',
    'abilities.sta.max': '13',
    'abilities.per.max': '8',
    'abilities.int.max': '11',
    'abilities.lck.max': '8',
    'class.className': 'Dwarf',
    'config.actionDice': '1d20',
    'details.alignment': 'n',
    'details.attackBonus': 'd5',
    'details.birthAugur': 'Raised by wolves (Unarmed attack rolls) (-1)',
    'details.languages': 'Common, Dwarf, Alignment',
    'details.level.value': '3',
    'saves.frt.value': '3',
    'saves.ref.value': '-1',
    'saves.wil.value': '0',
    items: [
      {
        name: 'Staff',
        type: 'weapon',
        img: 'systems/dcc/styles/images/weapon.webp',
        system: {
          toHit: 'd5+1',
          damage: '1d4+1+@ab',
          melee: true
        }
      },
      {
        name: 'Longbow',
        type: 'weapon',
        img: 'systems/dcc/styles/images/weapon.webp',
        system: {
          toHit: 'd5-2',
          damage: '1d6+@ab',
          melee: false
        }
      },
      {
        name: 'Lance',
        type: 'weapon',
        img: 'systems/dcc/styles/images/weapon.webp',
        system: {
          toHit: 'd5+1',
          damage: '1d12+1+@ab',
          melee: true
        }
      },
      {
        name: 'Scale Mail + Shield',
        type: 'armor',
        img: 'systems/dcc/styles/images/armor.webp',
        system: {
          acBonus: '+5',
          checkPenalty: '-5',
          fumbleDie: '1d12'
        }
      },
      {
        name: 'Iron spike (1 sp)',
        type: 'equipment',
        img: 'systems/dcc/styles/images/item.webp'
      },
      {
        name: 'Steel vial',
        type: 'equipment',
        img: 'systems/dcc/styles/images/item.webp'
      },
      {
        name: 'Coins',
        type: 'treasure',
        img: 'systems/dcc/styles/images/coins.webp',
        system: {
          value: {
            pp: '0',
            ep: '0',
            gp: '2027',
            sp: '0',
            cp: '27'
          },
          isCoins: true
        }
      }
    ]
  }
  expect(parsedNPC).toMatchObject([expected])
})

/* Test Elf's text */
test('elf', () => {
  const parsedNPC = parsePCs(
    `Generator Settings
Source: Rulebook | Roll Mode: 3d6 | HP: normal | HP-up: normal | Augur: normal

Neutral Elf (3rd level)
Occupation: Elven navigator
Strength: 13 (+1)
Agility: 15 (+1)
Stamina: 6 (-1)
Personality: 9 (0)
Intelligence: 17 (+2)
Luck: 9 (0)

HP: 10; Speed: 30; Init: 1
Ref: 2; Fort: 0; Will: 2

Base Attack Mod: 2
Attack Dice: 1d20; Crit Die/Table: 1d8/II
Occupation Weapon: Shortbow ranged +3 (dmg 1d6)
Main Weapon: Spear melee +3 (dmg 1d8+1)
Secondary Weapon: Club melee +3 (dmg 1d4+1)

AC: (14) (Studded Leather (+3) Check penalty (-2) Fumble die (d8))
Equipment: Iron spike (1 sp)
Trade good: Spyglass
Starting Funds: 30 cp + 2025 gp
Lucky sign: Pack hunter (Attack/damage rolls for 0-level weapon) (+0)
Languages: Common, Elf, Dragon, Demonic, Naga
Racial Traits: Elven traits: Heightened senses, iron vulnerability, Infravision
Elf trait: Lucky spell - choose one spell that you apply your luck mod to

Spells: (Spell Check: d20+5)
1) Patron Bond
1) Invoke Patron
1) Color Spray
1) Ekim's Mystical Mask
1) Ventriloquism
1) Ward Portal
2) Monster Summoning`
  )
  const expected = {
    'attributes.init.value': '1',
    'attributes.speed.value': '30',
    'details.occupation.value': 'Elven navigator',
    'attributes.ac.value': '14',
    'attributes.hp.value': 10,
    'attributes.hp.max': 10,
    'attributes.hitDice.value': '1d6',
    'attributes.critical.die': '1d8',
    'attributes.critical.table': 'II',
    'abilities.str.value': '13',
    'abilities.agl.value': '15',
    'abilities.sta.value': '6',
    'abilities.per.value': '9',
    'abilities.int.value': '17',
    'abilities.lck.value': '9',
    'abilities.str.max': '13',
    'abilities.agl.max': '15',
    'abilities.sta.max': '6',
    'abilities.per.max': '9',
    'abilities.int.max': '17',
    'abilities.lck.max': '9',
    'class.className': 'Elf',
    'class.spellCheck': '+5',
    'config.actionDice': '1d20',
    'details.alignment': 'n',
    'details.attackBonus': '2',
    'details.birthAugur': 'Pack hunter (Attack/damage rolls for 0-level weapon) (+0)',
    'details.languages': 'Common, Elf, Dragon, Demonic, Naga',
    'details.level.value': '3',
    'saves.frt.value': '0',
    'saves.ref.value': '2',
    'saves.wil.value': '2',
    items: [
      {
        name: 'Shortbow',
        type: 'weapon',
        img: 'systems/dcc/styles/images/weapon.webp',
        system: {
          toHit: '+3',
          damage: '1d6',
          melee: false
        }
      },
      {
        name: 'Spear',
        type: 'weapon',
        img: 'systems/dcc/styles/images/weapon.webp',
        system: {
          toHit: '+3',
          damage: '1d8+1',
          melee: true
        }
      },
      {
        name: 'Club',
        type: 'weapon',
        img: 'systems/dcc/styles/images/weapon.webp',
        system: {
          toHit: '+3',
          damage: '1d4+1',
          melee: true
        }
      },
      {
        name: 'Studded Leather',
        type: 'armor',
        img: 'systems/dcc/styles/images/armor.webp',
        system: {
          acBonus: '+3',
          checkPenalty: '-2',
          fumbleDie: '1d8'
        }
      },
      {
        name: 'Iron spike (1 sp)',
        type: 'equipment',
        img: 'systems/dcc/styles/images/item.webp'
      },
      {
        name: 'Spyglass',
        type: 'equipment',
        img: 'systems/dcc/styles/images/item.webp'
      },
      {
        name: 'Coins',
        type: 'treasure',
        img: 'systems/dcc/styles/images/coins.webp',
        system: {
          value: {
            pp: '0',
            ep: '0',
            gp: '2025',
            sp: '0',
            cp: '30'
          },
          isCoins: true
        }
      },
      {
        name: 'Patron Bond',
        type: 'spell',
        img: 'systems/dcc/styles/images/spell.webp',
        system: {
          level: '1',
          spellCheck: {
            die: '1d20',
            value: '+5'
          }
        }
      },
      {
        name: 'Invoke Patron',
        type: 'spell',
        img: 'systems/dcc/styles/images/spell.webp',
        system: {
          level: '1',
          spellCheck: {
            die: '1d20',
            value: '+5'
          }
        }
      },
      {
        name: 'Color Spray',
        type: 'spell',
        img: 'systems/dcc/styles/images/spell.webp',
        system: {
          level: '1',
          spellCheck: {
            die: '1d20',
            value: '+5'
          }
        }
      },
      {
        name: 'Ekim\'s Mystical Mask',
        type: 'spell',
        img: 'systems/dcc/styles/images/spell.webp',
        system: {
          level: '1',
          spellCheck: {
            die: '1d20',
            value: '+5'
          }
        }
      },
      {
        name: 'Ventriloquism',
        type: 'spell',
        img: 'systems/dcc/styles/images/spell.webp',
        system: {
          level: '1',
          spellCheck: {
            die: '1d20',
            value: '+5'
          }
        }
      },
      {
        name: 'Ward Portal',
        type: 'spell',
        img: 'systems/dcc/styles/images/spell.webp',
        system: {
          level: '1',
          spellCheck: {
            die: '1d20',
            value: '+5'
          }
        }
      },
      {
        name: 'Monster Summoning',
        type: 'spell',
        img: 'systems/dcc/styles/images/spell.webp',
        system: {
          level: '2',
          spellCheck: {
            die: '1d20',
            value: '+5'
          }
        }
      }]
  }
  expect(parsedNPC).toMatchObject([expected])
})

/* Missing weapons test */
test('underarmed_warrior', () => {
  const parsedNPC = parsePCs(
    `Generator Settings
Source: Rulebook | Roll Mode: 3d6 | HP: normal | HP-up: normal | Augur: normal

Lawful Warrior (1st level)
Occupation: Confidence artist
Strength: 13 (+1)
Agility: 11 (0)
Stamina: 15 (+1)
Personality: 14 (+1)
Intelligence: 9 (0)
Luck: 9 (0)

HP: 13; Speed: 30; Init: 1
Ref: 1; Fort: 2; Will: 1

Base Attack Mod: d3
Attack Dice: 1d20; Crit Die/Table: 1d12/III
Occupation Weapon: Dagger melee d3+1 (dmg 1d4+1+deed)
Main Weapon:
Secondary Weapon:

AC: (10) (Unarmored (+0) Check penalty (0) Fumble die (d4))
Equipment: Sack (large) (12 cp)
Trade good: Quality cloak
Starting Funds: 33 cp + 30 gp
Lucky sign: Righteous heart (Turn unholy checks) (+0)
Languages: Common
Warrior trait: Lucky weapon - choose one weapon that you apply your luck mod to`
  )
  const expected = {
    'attributes.init.value': '1',
    'attributes.speed.value': '30',
    'details.occupation.value': 'Confidence artist',
    'attributes.ac.value': '10',
    'attributes.hp.value': 13,
    'attributes.hp.max': 13,
    'attributes.hitDice.value': '1d12',
    'attributes.critical.die': '1d12',
    'attributes.critical.table': 'III',
    'abilities.str.value': '13',
    'abilities.agl.value': '11',
    'abilities.sta.value': '15',
    'abilities.per.value': '14',
    'abilities.int.value': '9',
    'abilities.lck.value': '9',
    'abilities.str.max': '13',
    'abilities.agl.max': '11',
    'abilities.sta.max': '15',
    'abilities.per.max': '14',
    'abilities.int.max': '9',
    'abilities.lck.max': '9',
    'class.className': 'Warrior',
    'config.actionDice': '1d20',
    'details.alignment': 'l',
    'details.attackBonus': 'd3',
    'details.birthAugur': 'Righteous heart (Turn unholy checks) (+0)',
    'details.languages': 'Common',
    'details.level.value': '1',
    'saves.frt.value': '2',
    'saves.ref.value': '1',
    'saves.wil.value': '1',
    items: [
      {
        name: 'Dagger',
        type: 'weapon',
        img: 'systems/dcc/styles/images/weapon.webp',
        system: {
          toHit: 'd3+1',
          damage: '1d4+1+@ab',
          melee: true
        }
      },
      {
        name: 'Unarmored',
        type: 'armor',
        img: 'systems/dcc/styles/images/armor.webp',
        system: {
          acBonus: '+0',
          checkPenalty: '0',
          fumbleDie: '1d4'
        }
      },
      {
        name: 'Sack (large) (12 cp)',
        type: 'equipment',
        img: 'systems/dcc/styles/images/item.webp'
      },
      {
        name: 'Quality cloak',
        type: 'equipment',
        img: 'systems/dcc/styles/images/item.webp'
      },
      {
        name: 'Coins',
        type: 'treasure',
        img: 'systems/dcc/styles/images/coins.webp',
        system: {
          value: {
            pp: '0',
            ep: '0',
            gp: '30',
            sp: '0',
            cp: '33'
          },
          isCoins: true
        }
      }]
  }
  expect(parsedNPC).toMatchObject([expected])
})

/* Missing weapons test - with spaces before the newline */
test('underarmed_warrior_again', () => {
  const parsedNPC = parsePCs(
    `Generator Settings
Source: Rulebook | Roll Mode: 3d6 | HP: normal | HP-up: normal | Augur: normal

Lawful Warrior (1st level)
Occupation: Confidence artist
Strength: 13 (+1)
Agility: 11 (0)
Stamina: 15 (+1)
Personality: 14 (+1)
Intelligence: 9 (0)
Luck: 9 (0)

HP: 13; Speed: 30; Init: 1
Ref: 1; Fort: 2; Will: 1

Base Attack Mod: d3
Attack Dice: 1d20; Crit Die/Table: 1d12/III
Occupation Weapon: Dagger melee d3+1 (dmg 1d4+1+deed)
Main Weapon:
Secondary Weapon:

AC: (10) (Unarmored (+0) Check penalty (0) Fumble die (d4))
Equipment: Sack (large) (12 cp)
Trade good: Quality cloak
Starting Funds: 33 cp + 30 gp
Lucky sign: Righteous heart (Turn unholy checks) (+0)
Languages: Common
Warrior trait: Lucky weapon - choose one weapon that you apply your luck mod to`
  )
  const expected = {
    'attributes.init.value': '1',
    'attributes.speed.value': '30',
    'details.occupation.value': 'Confidence artist',
    'attributes.ac.value': '10',
    'attributes.hp.value': 13,
    'attributes.hp.max': 13,
    'attributes.hitDice.value': '1d12',
    'attributes.critical.die': '1d12',
    'attributes.critical.table': 'III',
    'abilities.str.value': '13',
    'abilities.agl.value': '11',
    'abilities.sta.value': '15',
    'abilities.per.value': '14',
    'abilities.int.value': '9',
    'abilities.lck.value': '9',
    'abilities.str.max': '13',
    'abilities.agl.max': '11',
    'abilities.sta.max': '15',
    'abilities.per.max': '14',
    'abilities.int.max': '9',
    'abilities.lck.max': '9',
    'class.className': 'Warrior',
    'config.actionDice': '1d20',
    'details.alignment': 'l',
    'details.attackBonus': 'd3',
    'details.birthAugur': 'Righteous heart (Turn unholy checks) (+0)',
    'details.languages': 'Common',
    'details.level.value': '1',
    'saves.frt.value': '2',
    'saves.ref.value': '1',
    'saves.wil.value': '1',
    items: [
      {
        name: 'Dagger',
        type: 'weapon',
        img: 'systems/dcc/styles/images/weapon.webp',
        system: {
          toHit: 'd3+1',
          damage: '1d4+1+@ab',
          melee: true
        }
      },
      {
        name: 'Unarmored',
        type: 'armor',
        img: 'systems/dcc/styles/images/armor.webp',
        system: {
          acBonus: '+0',
          checkPenalty: '0',
          fumbleDie: '1d4'
        }
      },
      {
        name: 'Sack (large) (12 cp)',
        type: 'equipment',
        img: 'systems/dcc/styles/images/item.webp'
      },
      {
        name: 'Quality cloak',
        type: 'equipment',
        img: 'systems/dcc/styles/images/item.webp'
      },
      {
        name: 'Coins',
        type: 'treasure',
        img: 'systems/dcc/styles/images/coins.webp',
        system: {
          value: {
            pp: '0',
            ep: '0',
            gp: '30',
            sp: '0',
            cp: '33'
          },
          isCoins: true
        }
      }]
  }
  expect(parsedNPC).toMatchObject([expected])
})

/* Missing weapons test - with spaces before the newline */
test('underarmed_warrior_again', () => {
  const parsedNPC = parsePCs(
    `Generator Settings
Source: Rulebook | Roll Mode: 3d6 | HP: normal | HP-up: normal | Augur: normal

Lawful Warrior (1st level)
Occupation: Confidence artist
Strength: 13 (+1)
Agility: 11 (0)
Stamina: 15 (+1)
Personality: 14 (+1)
Intelligence: 9 (0)
Luck: 9 (0)

HP: 13; Speed: 30; Init: 1
Ref: 1; Fort: 2; Will: 1

Base Attack Mod: d3
Attack Dice: 1d20; Crit Die/Table: 1d12/III
Occupation Weapon: Dagger melee d3+1 (dmg 1d4+1+deed)
Main Weapon:
Secondary Weapon:

AC: (10) (Unarmored (+0) Check penalty (0) Fumble die (d4))
Equipment: Sack (large) (12 cp)
Trade good: Quality cloak
Starting Funds: 33 cp + 30 gp
Lucky sign: Righteous heart (Turn unholy checks) (+0)
Languages: Common
Warrior trait: Lucky weapon - choose one weapon that you apply your luck mod to`
  )
  const expected = {
    'attributes.init.value': '1',
    'attributes.speed.value': '30',
    'details.occupation.value': 'Confidence artist',
    'attributes.ac.value': '10',
    'attributes.hp.value': 13,
    'attributes.hp.max': 13,
    'attributes.hitDice.value': '1d12',
    'attributes.critical.die': '1d12',
    'attributes.critical.table': 'III',
    'abilities.str.value': '13',
    'abilities.agl.value': '11',
    'abilities.sta.value': '15',
    'abilities.per.value': '14',
    'abilities.int.value': '9',
    'abilities.lck.value': '9',
    'abilities.agl.max': '11',
    'abilities.str.max': '13',
    'abilities.sta.max': '15',
    'abilities.per.max': '14',
    'abilities.int.max': '9',
    'abilities.lck.max': '9',
    'class.className': 'Warrior',
    'config.actionDice': '1d20',
    'details.alignment': 'l',
    'details.attackBonus': 'd3',
    'details.birthAugur': 'Righteous heart (Turn unholy checks) (+0)',
    'details.languages': 'Common',
    'details.level.value': '1',
    'saves.frt.value': '2',
    'saves.ref.value': '1',
    'saves.wil.value': '1',
    items: [
      {
        name: 'Dagger',
        type: 'weapon',
        img: 'systems/dcc/styles/images/weapon.webp',
        system: {
          toHit: 'd3+1',
          damage: '1d4+1+@ab',
          melee: true
        }
      },
      {
        name: 'Unarmored',
        type: 'armor',
        img: 'systems/dcc/styles/images/armor.webp',
        system: {
          acBonus: '+0',
          checkPenalty: '0',
          fumbleDie: '1d4'
        }
      },
      {
        name: 'Sack (large) (12 cp)',
        type: 'equipment',
        img: 'systems/dcc/styles/images/item.webp'
      },
      {
        name: 'Quality cloak',
        type: 'equipment',
        img: 'systems/dcc/styles/images/item.webp'
      },
      {
        name: 'Coins',
        type: 'treasure',
        img: 'systems/dcc/styles/images/coins.webp',
        system: {
          value: {
            pp: '0',
            ep: '0',
            gp: '30',
            sp: '0',
            cp: '33'
          },
          isCoins: true
        }
      }]
  }

  console.log(expected)
  expect(parsedNPC).toMatchObject([expected])
})

/* Test multiple uppers */
test('uppers', () => {
  const parsedNPC = parsePCs(
    `Generator Settings
Source: Rulebook | Roll Mode: 3d6 | HP: normal | HP-up: normal | Augur: normal

Neutral Elf (3rd level)
Occupation: Elven navigator
Strength: 13 (+1)
Agility: 15 (+1)
Stamina: 6 (-1)
Personality: 9 (0)
Intelligence: 17 (+2)
Luck: 9 (0)

HP: 10; Speed: 30; Init: 1
Ref: 2; Fort: 0; Will: 2

Base Attack Mod: 2
Attack Dice: 1d20; Crit Die/Table: 1d8/II
Occupation Weapon: Shortbow ranged +3 (dmg 1d6)
Main Weapon: Spear melee +3 (dmg 1d8+1)
Secondary Weapon: Club melee +3 (dmg 1d4+1)

AC: (14) (Studded Leather (+3) Check penalty (-2) Fumble die (d8))
Equipment: Iron spike (1 sp)
Trade good: Spyglass
Starting Funds: 30 cp + 2025 gp
Lucky sign: Pack hunter (Attack/damage rolls for 0-level weapon) (+0)
Languages: Common, Elf, Dragon, Demonic, Naga
Racial Traits: Elven traits: Heightened senses, iron vulnerability, Infravision
Elf trait: Lucky spell - choose one spell that you apply your luck mod to

Spells: (Spell Check: d20+5)
1) Patron Bond
1) Invoke Patron
1) Color Spray
1) Ekim's Mystical Mask
1) Ventriloquism
1) Ward Portal
2) Monster Summoning

Neutral Dwarf (3rd level)
Occupation: Dwarven apothacarist
Strength: 13 (+1)
Agility: 5 (-2)
Stamina: 13 (+1)
Personality: 8 (-1)
Intelligence: 11 (0)
Luck: 8 (-1)

HP: 24; Speed: 15; Init: -2
Ref: -1; Fort: 3; Will: 0

Base Attack Mod: d5
Attack Dice: 1d20; Crit Die/Table: 1d14/III
Occupation Weapon: Staff melee d5+1 (dmg 1d4+1+deed)
Main Weapon: Longbow ranged d5-2 (dmg 1d6+deed)
Secondary Weapon: Lance melee d5+1 (dmg 1d12+1+deed)

AC: (13)* (Scale Mail + Shield (+5) Check penalty (-5) Fumble die (d12) Speed (-5))
Equipment: Iron spike (1 sp)
Trade good: Steel vial
Starting Funds: 27 cp + 2027 gp
Lucky sign: Raised by wolves (Unarmed attack rolls) (-1)
Languages: Common, Dwarf, Alignment
Racial Traits: Dwarven ability: Infravision
Dwarf skill: Shield bash - make an extra d14 attack with your shield. (1d3 damage)`
  )
  const expected = [
    {
      'attributes.init.value': '1',
      'attributes.speed.value': '30',
      'details.occupation.value': 'Elven navigator',
      'attributes.ac.value': '14',
      'attributes.hp.value': 10,
      'attributes.hp.max': 10,
      'attributes.hitDice.value': '1d6',
      'attributes.critical.die': '1d8',
      'attributes.critical.table': 'II',
      'abilities.str.value': '13',
      'abilities.agl.value': '15',
      'abilities.sta.value': '6',
      'abilities.per.value': '9',
      'abilities.int.value': '17',
      'abilities.lck.value': '9',
      'abilities.str.max': '13',
      'abilities.agl.max': '15',
      'abilities.sta.max': '6',
      'abilities.per.max': '9',
      'abilities.int.max': '17',
      'abilities.lck.max': '9',
      'class.className': 'Elf',
      'class.spellCheck': '+5',
      'config.actionDice': '1d20',
      'details.alignment': 'n',
      'details.attackBonus': '2',
      'details.birthAugur': 'Pack hunter (Attack/damage rolls for 0-level weapon) (+0)',
      'details.languages': 'Common, Elf, Dragon, Demonic, Naga',
      'details.level.value': '3',
      'saves.frt.value': '0',
      'saves.ref.value': '2',
      'saves.wil.value': '2',
      items: [
        {
          name: 'Shortbow',
          type: 'weapon',
          img: 'systems/dcc/styles/images/weapon.webp',
          system: {
            toHit: '+3',
            damage: '1d6',
            melee: false
          }
        },
        {
          name: 'Spear',
          type: 'weapon',
          img: 'systems/dcc/styles/images/weapon.webp',
          system: {
            toHit: '+3',
            damage: '1d8+1',
            melee: true
          }
        },
        {
          name: 'Club',
          type: 'weapon',
          img: 'systems/dcc/styles/images/weapon.webp',
          system: {
            toHit: '+3',
            damage: '1d4+1',
            melee: true
          }
        },
        {
          name: 'Studded Leather',
          type: 'armor',
          img: 'systems/dcc/styles/images/armor.webp',
          system: {
            acBonus: '+3',
            checkPenalty: '-2',
            fumbleDie: '1d8'
          }
        },
        {
          name: 'Iron spike (1 sp)',
          type: 'equipment',
          img: 'systems/dcc/styles/images/item.webp'
        },
        {
          name: 'Spyglass',
          type: 'equipment',
          img: 'systems/dcc/styles/images/item.webp'
        },
        {
          name: 'Coins',
          type: 'treasure',
          img: 'systems/dcc/styles/images/coins.webp',
          system: {
            value: {
              pp: '0',
              ep: '0',
              gp: '2025',
              sp: '0',
              cp: '30'
            },
            isCoins: true
          }
        },
        {
          name: 'Patron Bond',
          type: 'spell',
          img: 'systems/dcc/styles/images/spell.webp',
          system: {
            level: '1',
            spellCheck: {
              die: '1d20',
              value: '+5'
            }
          }
        },
        {
          name: 'Invoke Patron',
          type: 'spell',
          img: 'systems/dcc/styles/images/spell.webp',
          system: {
            level: '1',
            spellCheck: {
              die: '1d20',
              value: '+5'
            }
          }
        },
        {
          name: 'Color Spray',
          type: 'spell',
          img: 'systems/dcc/styles/images/spell.webp',
          system: {
            level: '1',
            spellCheck: {
              die: '1d20',
              value: '+5'
            }
          }
        },
        {
          name: 'Ekim\'s Mystical Mask',
          type: 'spell',
          img: 'systems/dcc/styles/images/spell.webp',
          system: {
            level: '1',
            spellCheck: {
              die: '1d20',
              value: '+5'
            }
          }
        },
        {
          name: 'Ventriloquism',
          type: 'spell',
          img: 'systems/dcc/styles/images/spell.webp',
          system: {
            level: '1',
            spellCheck: {
              die: '1d20',
              value: '+5'
            }
          }
        },
        {
          name: 'Ward Portal',
          type: 'spell',
          img: 'systems/dcc/styles/images/spell.webp',
          system: {
            level: '1',
            spellCheck: {
              die: '1d20',
              value: '+5'
            }
          }
        },
        {
          name: 'Monster Summoning',
          type: 'spell',
          img: 'systems/dcc/styles/images/spell.webp',
          system: {
            level: '2',
            spellCheck: {
              die: '1d20',
              value: '+5'
            }
          }
        }]
    },
    {
      'attributes.init.value': '-2',
      'attributes.speed.value': '15',
      'details.occupation.value': 'Dwarven apothacarist',
      'attributes.ac.value': '13',
      'attributes.hp.value': 24,
      'attributes.hp.max': 24,
      'attributes.hitDice.value': '1d10',
      'attributes.critical.die': '1d14',
      'attributes.critical.table': 'III',
      'abilities.str.value': '13',
      'abilities.agl.value': '5',
      'abilities.sta.value': '13',
      'abilities.per.value': '8',
      'abilities.int.value': '11',
      'abilities.lck.value': '8',
      'abilities.str.max': '13',
      'abilities.agl.max': '5',
      'abilities.sta.max': '13',
      'abilities.per.max': '8',
      'abilities.int.max': '11',
      'abilities.lck.max': '8',
      'class.className': 'Dwarf',
      'config.actionDice': '1d20',
      'details.alignment': 'n',
      'details.attackBonus': 'd5',
      'details.birthAugur': 'Raised by wolves (Unarmed attack rolls) (-1)',
      'details.languages': 'Common, Dwarf, Alignment',
      'details.level.value': '3',
      'saves.frt.value': '3',
      'saves.ref.value': '-1',
      'saves.wil.value': '0',
      items: [
        {
          name: 'Staff',
          type: 'weapon',
          img: 'systems/dcc/styles/images/weapon.webp',
          system: {
            toHit: 'd5+1',
            damage: '1d4+1+@ab',
            melee: true
          }
        },
        {
          name: 'Longbow',
          type: 'weapon',
          img: 'systems/dcc/styles/images/weapon.webp',
          system: {
            toHit: 'd5-2',
            damage: '1d6+@ab',
            melee: false
          }
        },
        {
          name: 'Lance',
          type: 'weapon',
          img: 'systems/dcc/styles/images/weapon.webp',
          system: {
            toHit: 'd5+1',
            damage: '1d12+1+@ab',
            melee: true
          }
        },
        {
          name: 'Scale Mail + Shield',
          type: 'armor',
          img: 'systems/dcc/styles/images/armor.webp',
          system: {
            acBonus: '+5',
            checkPenalty: '-5',
            fumbleDie: '1d12'
          }
        },
        {
          name: 'Iron spike (1 sp)',
          type: 'equipment',
          img: 'systems/dcc/styles/images/item.webp'
        },
        {
          name: 'Steel vial',
          type: 'equipment',
          img: 'systems/dcc/styles/images/item.webp'
        },
        {
          name: 'Coins',
          type: 'treasure',
          img: 'systems/dcc/styles/images/coins.webp',
          system: {
            value: {
              pp: '0',
              ep: '0',
              gp: '2027',
              sp: '0',
              cp: '27'
            },
            isCoins: true
          }
        }
      ]
    }
  ]
  expect(parsedNPC).toMatchObject(expected)
})
