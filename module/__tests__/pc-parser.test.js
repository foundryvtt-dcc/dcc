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
    'data.abilities.str.max': '7',
    'data.abilities.agl.max': '7',
    'data.abilities.sta.max': '12',
    'data.abilities.per.max': '17',
    'data.abilities.int.max': '5',
    'data.abilities.lck.max': '12',
    'data.saves.frt.value': '0',
    'data.saves.ref.value': '-1',
    'data.saves.wil.value': '2',
    items: [
      {
        name: 'Hammer (as club)',
        type: 'weapon',
        data: {
          toHit: '-1',
          damage: '1d4-1',
          melee: true
        }
      },
      {
        name: 'Crowbar (2 gp)',
        type: 'equipment'
      },
      {
        name: 'Steel tongs',
        type: 'equipment'
      },
      {
        name: 'Coins',
        type: 'treasure',
        data: {
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
  expect(parsedNPC).toMatchObject(expected)
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
    'data.abilities.str.max': '15',
    'data.abilities.agl.max': '5',
    'data.abilities.sta.max': '17',
    'data.abilities.per.max': '8',
    'data.abilities.int.max': '6',
    'data.abilities.lck.max': '5',
    'data.saves.frt.value': '2',
    'data.saves.ref.value': '-2',
    'data.saves.wil.value': '-1',
    items: [
      {
        name: 'Staff',
        type: 'weapon',
        data: {
          toHit: '1',
          damage: '1d4+1',
          melee: true
        }
      },
      {
        name: 'Sack (small) (8 cp)',
        type: 'equipment'
      },
      {
        name: 'Water skin',
        type: 'equipment'
      },
      {
        name: 'Jar of honey',
        type: 'equipment'
      },
      {
        name: 'Coins',
        type: 'treasure',
        data: {
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
  expect(parsedNPC).toMatchObject(expected)
})

/* Test Cleric's text */
test('cleric', () => {
  const parsedNPC = parsePC(
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
    'data.attributes.init.value': '1',
    'data.attributes.speed.value': '30',
    'data.details.occupation.value': 'Cobbler',
    'data.attributes.ac.value': '15',
    'data.attributes.hp.value': '4',
    'data.attributes.hp.max': '4',
    'data.attributes.critical.die': '1d8',
    'data.attributes.critical.table': 'III',
    'data.abilities.str.value': '10',
    'data.abilities.agl.value': '14',
    'data.abilities.sta.value': '6',
    'data.abilities.per.value': '13',
    'data.abilities.int.value': '13',
    'data.abilities.lck.value': '10',
    'data.abilities.str.max': '10',
    'data.abilities.agl.max': '14',
    'data.abilities.sta.max': '6',
    'data.abilities.per.max': '13',
    'data.abilities.int.max': '13',
    'data.abilities.lck.max': '10',
    'data.class.className': 'Cleric',
    'data.class.spellCheck': '+2',
    'data.config.actionDice': '1d20',
    'data.details.alignment': 'n',
    'data.details.attackBonus': '0',
    'data.details.birthAugur': 'Lucky sign (Saving throws) (+0)',
    'data.details.languages': 'Common, Elf',
    'data.details.level.value': '1',
    'data.saves.frt.value': '0',
    'data.saves.ref.value': '1',
    'data.saves.wil.value': '2',
    items: [
      {
        name: 'Dagger',
        type: 'weapon',
        data: {
          toHit: '+0',
          damage: '1d4',
          melee: true
        }
      },
      {
        name: 'Dart',
        type: 'weapon',
        data: {
          toHit: '+1',
          damage: '1d4',
          melee: false
        }
      },
      {
        name: 'Spear',
        type: 'weapon',
        data: {
          toHit: '+0',
          damage: '1d8',
          melee: true
        }
      },
      {
        name: 'Hide + Shield',
        type: 'armor',
        data: {
          acBonus: '+4',
          checkPenalty: '-4',
          fumbleDie: '1d12'
        }
      },
      {
        name: 'Waterskin (5 sp)',
        type: 'equipment'
      },
      {
        name: 'Shoehorn',
        type: 'equipment'
      },
      {
        name: 'Coins',
        type: 'treasure',
        data: {
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
        data: {
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
        data: {
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
        data: {
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
        data: {
          level: '1',
          spellCheck: {
            die: '1d20',
            value: '+2'
          }
        }
      }
    ]
  }
  expect(parsedNPC).toMatchObject(expected)
})

/* Test Thief's text */
test('thief', () => {
  const parsedNPC = parsePC(
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
    'data.attributes.init.value': '1',
    'data.attributes.speed.value': '30',
    'data.details.occupation.value': 'Ditch digger',
    'data.attributes.ac.value': '12',
    'data.attributes.hp.value': '25',
    'data.attributes.hp.max': '25',
    'data.attributes.critical.die': '1d24',
    'data.attributes.critical.table': 'II',
    'data.abilities.str.value': '10',
    'data.abilities.agl.value': '15',
    'data.abilities.sta.value': '8',
    'data.abilities.per.value': '9',
    'data.abilities.int.value': '10',
    'data.abilities.lck.value': '10',
    'data.abilities.str.max': '10',
    'data.abilities.agl.max': '15',
    'data.abilities.sta.max': '8',
    'data.abilities.per.max': '9',
    'data.abilities.int.max': '10',
    'data.abilities.lck.max': '10',
    'data.class.className': 'Thief',
    'data.config.actionDice': '1d20+1d14',
    'data.details.alignment': 'n',
    'data.details.attackBonus': '4',
    'data.details.birthAugur': 'Fox\'s cunning (Find/disable traps) (+0)',
    'data.details.languages': 'Common, Thieves\' Cant',
    'data.details.level.value': '6',
    'data.saves.frt.value': '1',
    'data.saves.ref.value': '5',
    'data.saves.wil.value': '2',
    'data.class.backstab': '5',
    'data.skills.sneakSilently.value': '12',
    'data.skills.hideInShadows.value': '10',
    'data.skills.pickPockets.value': '12',
    'data.skills.climbSheerSurfaces.value': '12',
    'data.skills.pickLock.value': '10',
    'data.skills.findTrap.value': '9',
    'data.skills.disableTrap.value': '10',
    'data.skills.forgeDocument.value': '12',
    'data.skills.disguiseSelf.value': '4',
    'data.skills.readLanguages.value': '5',
    'data.skills.handlePoison.value': '4',
    'data.skills.castSpellFromScroll.die': '1d16',
    items: [
      {
        name: 'Staff',
        type: 'weapon',
        data: {
          toHit: '+4',
          damage: '1d4',
          melee: true
        }
      },
      {
        name: '+1 Shortbow',
        type: 'weapon',
        data: {
          toHit: '+6',
          damage: '1d6',
          melee: false
        }
      },
      {
        name: '+1 Blowgun',
        type: 'weapon',
        data: {
          toHit: '+6',
          damage: '1d3',
          melee: false
        }
      },
      {
        name: 'Padded',
        type: 'armor',
        data: {
          acBonus: '+1',
          checkPenalty: '0',
          fumbleDie: '1d8'
        }
      },
      {
        name: 'Holy symbol (25 gp)',
        type: 'equipment'
      },
      {
        name: 'Fine dirt (1 lb.)',
        type: 'equipment'
      },
      {
        name: 'Coins',
        type: 'treasure',
        data: {
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
  expect(parsedNPC).toMatchObject(expected)
})

/* Test Halfling's text */
test('halfling', () => {
  const parsedNPC = parsePC(
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
    'data.attributes.init.value': '0',
    'data.attributes.speed.value': '15',
    'data.details.occupation.value': 'Halfling gypsy',
    'data.attributes.ac.value': '14',
    'data.attributes.hp.value': '48',
    'data.attributes.hp.max': '48',
    'data.attributes.critical.die': '1d16',
    'data.attributes.critical.table': 'III',
    'data.abilities.str.value': '11',
    'data.abilities.agl.value': '11',
    'data.abilities.sta.value': '13',
    'data.abilities.per.value': '15',
    'data.abilities.int.value': '12',
    'data.abilities.lck.value': '11',
    'data.abilities.str.max': '11',
    'data.abilities.agl.max': '11',
    'data.abilities.sta.max': '13',
    'data.abilities.per.max': '15',
    'data.abilities.int.max': '12',
    'data.abilities.lck.max': '11',
    'data.class.className': 'Halfling',
    'data.config.actionDice': '1d20+1d20',
    'data.details.alignment': 'c',
    'data.details.attackBonus': '8',
    'data.details.birthAugur': 'Harsh winter (All attack rolls) (+0)',
    'data.details.languages': 'Common, Halfling, Alignment',
    'data.details.level.value': '10',
    'data.saves.frt.value': '5',
    'data.saves.ref.value': '6',
    'data.saves.wil.value': '7',
    'data.skills.sneakAndHide.value': '11',
    'data.skills.sneakSilently.value': '11',
    'data.skills.hideInShadows.value': '11',
    items: [
      {
        name: 'Sling',
        type: 'weapon',
        data: {
          toHit: '+8',
          damage: '1d4',
          melee: false
        }
      },
      {
        name: '+3 Crossbow',
        type: 'weapon',
        data: {
          toHit: '+11',
          damage: '1d6',
          melee: false
        }
      },
      {
        name: '+2 Dagger',
        type: 'weapon',
        data: {
          toHit: '+10',
          damage: '1d4+2',
          melee: true
        }
      },
      {
        name: 'Scale Mail',
        type: 'armor',
        data: {
          acBonus: '+4',
          checkPenalty: '-4',
          fumbleDie: '1d12'
        }
      },
      {
        name: 'Iron spike (1 sp)',
        type: 'equipment'
      },
      {
        name: 'Hex doll',
        type: 'equipment'
      },
      {
        name: 'Coins',
        type: 'treasure',
        data: {
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
  expect(parsedNPC).toMatchObject(expected)
})

/* Test Wizard's text */
/*
test('wizard', () => {
  const parsedNPC = parsePC() {
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
  }
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
    'data.abilities.str.max': '7',
    'data.abilities.agl.max': '7',
    'data.abilities.sta.max': '12',
    'data.abilities.per.max': '17',
    'data.abilities.int.max': '5',
    'data.abilities.lck.max': '12',
    'data.saves.frt.value': '0',
    'data.saves.ref.value': '-1',
    'data.saves.wil.value': '2',
    items: [
      {
        name: 'Hammer (as club)',
        type: 'weapon',
        data: {
          toHit: '-1',
          damage: '1d4-1',
          description: { value: '' },
          melee: true
        }
      }
    ]
  }
  expect(parsedNPC).toMatchObject(expected)
})
*/
