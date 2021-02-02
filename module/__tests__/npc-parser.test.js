/* Tests for NPC Parser */
/* eslint-env jest */

import parseNPCs from '../npc-parser.js'

/* Test snake */
test('super snake', () => {
  const parsedNPC = parseNPCs('Very long, the power super-snake: Init +0; Atk bite +6 melee; Dmg 1d8;\r\n AC 13; HP 21; MV 20’; Act 1d20; SV Fort +8, Ref +4, Will +4; AL L.')
  const expected = {
    name: 'Very long, the power super-snake',
    'data.attributes.init.value': '+0',
    'data.attributes.ac.value': '13',
    'data.attributes.hp.value': '21',
    'data.attributes.hp.max': '21',
    'data.attributes.speed.value': '20’',
    'data.config.actionDice': '1d20',
    'data.saves.frt.value': '+8',
    'data.saves.ref.value': '+4',
    'data.saves.wil.value': '+4',
    'data.details.alignment': 'l',
    items: [
      {
        name: 'bite',
        type: 'weapon',
        data: {
          toHit: '+6',
          damage: '1d8',
          description: { value: '' },
          melee: true
        }
      }
    ]
  }
  expect(parsedNPC).toMatchObject([expected])
})

/* Test dry pile of bones */
test('pile of bones', () => {
  const parsedNPC = parseNPCs('Seven items of dry stuff: Init -2; Atk bite +0 melee; Dmg 1d4-1; AC 8; HP 3; MV 5’;\r\n Act 1d20; SV Fort +0, Ref -4, Will +1; AL C.')
  const expected = {
    name: 'Seven items of dry stuff',
    'data.attributes.init.value': '-2',
    'data.attributes.ac.value': '8',
    'data.attributes.hp.value': '3',
    'data.attributes.hp.max': '3',
    'data.attributes.speed.value': '5’',
    'data.config.actionDice': '1d20',
    'data.saves.frt.value': '+0',
    'data.saves.ref.value': '-4',
    'data.saves.wil.value': '+1',
    'data.details.alignment': 'c',
    items: [
      {
        name: 'bite',
        type: 'weapon',
        data: {
          toHit: '+0',
          melee: true
        }
      }
    ]
  }
  expect(parsedNPC).toMatchObject([expected])
})

/* Test orcs */
test('orcs', () => {
  const parsedNPC = parseNPCs('Cute-Infused Orcs (3): Init +2; Atk claw +1 melee (1d4) or spear +1 melee (1d8); AC 15; HD 2d8+2; hp 13 each; MV 30’; Act 1d20; SP none; SV Fort +3, Ref +0, Will -1; AL C.')
  const expected = {
    name: 'Cute-Infused Orcs',
    'data.attributes.init.value': '+2',
    'data.attributes.ac.value': '15',
    'data.attributes.hitDice.value': '2d8+2',
    'data.attributes.hp.value': '13',
    'data.attributes.hp.max': '13',
    'data.attributes.speed.value': '30’',
    'data.attributes.special.value': 'none',
    'data.config.actionDice': '1d20',
    'data.saves.frt.value': '+3',
    'data.saves.ref.value': '+0',
    'data.saves.wil.value': '-1',
    'data.details.alignment': 'c',
    items: [
      {
        name: 'claw',
        type: 'weapon',
        data: {
          toHit: '+1',
          damage: '1d4',
          description: { value: '' },
          melee: true
        }
      },
      {
        name: 'spear',
        type: 'weapon',
        data: {
          toHit: '+1',
          damage: '1d8',
          description: { value: '' },
          melee: true
        }
      }
    ]
  }
  expect(parsedNPC).toMatchObject([expected])
})

/* Test spider */
test('spider', () => {
  const parsedNPC = parseNPCs('Xformed, Unicorn-Filled Spider: Init +1; Atk bite +2 melee (1d4 plus poison) or web +4 ranged (restrained, 20’ range); AC 13; HD 2d12 +2; hp 20; MV 30’ or climb 30’; Act 1d20; SP poison (DC 14 Fort save or additional 3d4 damage and lose 1 point of Strength, 1d4 damage if successful), create web, filled with bats; SV Fort +2, Ref +4, Will +0; AL N.\n')
  const expected = {
    name: 'Xformed, Unicorn-Filled Spider',
    'data.attributes.init.value': '+1',
    'data.attributes.ac.value': '13',
    'data.attributes.hitDice.value': '2d12 +2',
    'data.attributes.hp.value': '20',
    'data.attributes.hp.max': '20',
    'data.attributes.speed.value': '30’',
    'data.attributes.speed.other': 'climb 30’',
    'data.attributes.special.value': 'poison (DC 14 Fort save or additional 3d4 damage and lose 1 point of Strength, 1d4 damage if successful), create web, filled with bats',
    'data.config.actionDice': '1d20',
    'data.saves.frt.value': '+2',
    'data.saves.ref.value': '+4',
    'data.saves.wil.value': '+0',
    'data.details.alignment': 'n',
    items: [
      {
        name: 'bite',
        type: 'weapon',
        data: {
          toHit: '+2',
          damage: '1d4',
          description: { value: 'plus poison' },
          melee: true
        }
      },
      {
        name: 'web',
        type: 'weapon',
        data: {
          toHit: '+4',
          melee: false
          // damage": '0', //@TODO: change damage to 0 when there is no die roll
          // description: { value: 'restrained, 20’ range' }  // @TODO: Parse out this special
        }
      }
    ]
  }
  expect(parsedNPC).toMatchObject([expected])
})

/* Test wetad */
test('wedad', () => {
  const parsedNPC = parseNPCs('Gerieah (in her tree): Init +1; Atk tree limb slam +5 melee (1d10); AC 15;\n HD 4d10; hp 30; MV none; Act 1d20; SP takes 2x damage from fire, can attack targets up to 20’ away with tree limbs; SV Fort +6, Ref -2, Will +4; AL N.')
  const expected = {
    name: 'Gerieah (in her tree)',
    'data.attributes.init.value': '+1',
    'data.attributes.ac.value': '15',
    'data.attributes.hitDice.value': '4d10',
    'data.attributes.hp.value': '30',
    'data.attributes.hp.max': '30',
    'data.attributes.speed.value': 'none',
    'data.attributes.special.value': 'takes 2x damage from fire, can attack targets up to 20’ away with tree limbs',
    'data.config.actionDice': '1d20',
    'data.saves.frt.value': '+6',
    'data.saves.ref.value': '-2',
    'data.saves.wil.value': '+4',
    'data.details.alignment': 'n',
    items: [
      {
        name: 'tree limb slam',
        type: 'weapon',
        data: {
          toHit: '+5',
          damage: '1d10',
          description: { value: '' },
          melee: true
        }
      }
    ]
  }
  expect(parsedNPC).toMatchObject([expected])
})

/* Test smultist */
test('smultist', () => {
  const parsedNPC = parseNPCs('Green-robed smultist (1): Init +4; Atk dagger +5 melee (1d4+3); AC 11; HD 5d4+5; hp 21; MV 20’; SP 3d6 control check, able to cast arms of the angel, squid-mass (when killed, an squid-mass emerges; see stats below); Act 1d20; SV Fort +3, Ref +4, Will +0; AL C. Equipment: bird-shaped talisman of gold tied on a leather thong (worth 10 gp; see level 3).')
  const expected = {
    name: 'Green-robed smultist',
    'data.attributes.init.value': '+4',
    'data.attributes.ac.value': '11',
    'data.attributes.hitDice.value': '5d4+5',
    'data.attributes.hp.value': '21',
    'data.attributes.hp.max': '21',
    'data.attributes.speed.value': '20’',
    'data.attributes.special.value': '3d6 control check, able to cast arms of the angel, squid-mass (when killed, an squid-mass emerges', // TODO: Is it worth finding a way to ignore colons inside brackets?
    'data.config.actionDice': '1d20',
    'data.saves.frt.value': '+3',
    'data.saves.ref.value': '+4',
    'data.saves.wil.value': '+0',
    'data.details.alignment': 'c',
    items: [
      {
        name: 'dagger',
        type: 'weapon',
        data: {
          toHit: '+5',
          damage: '1d4+3',
          description: { value: '' },
          melee: true
        }
      }
    ]
  }
  expect(parsedNPC).toMatchObject([expected])
})

/* Test short statline */
test('shortstats', () => {
  const parsedNPC = parseNPCs('Stunty, the short and muddled: Init +1; Atk kick +2 melee (1d3); AC 15;\n hp 4; Act 1d20; SV Ref +6, Fort -2, Will +4.')
  const expected = {
    name: 'Stunty, the short and muddled',
    'data.attributes.init.value': '+1',
    'data.attributes.ac.value': '15',
    'data.attributes.hitDice.value': '1',
    'data.attributes.hp.value': '4',
    'data.attributes.hp.max': '4',
    'data.attributes.speed.value': '30',
    'data.attributes.special.value': '',
    'data.config.actionDice': '1d20',
    'data.saves.frt.value': '-2',
    'data.saves.ref.value': '+6',
    'data.saves.wil.value': '+4',
    'data.details.alignment': 'n',
    items: [
      {
        name: 'kick',
        type: 'weapon',
        data: {
          toHit: '+2',
          damage: '1d3',
          description: { value: '' },
          melee: true
        }
      }
    ]
  }
  expect(parsedNPC).toMatchObject([expected])
})

/* Test the bad guy's familiar with a minimal stat line */
test('familiar', () => {
  const parsedNPC = parseNPCs('The bad guy\'s familiar: Atk claw +3 melee (1d4), AC 15, HP 2.')
  const expected = {
    name: 'The bad guy\'s familiar',
    'data.attributes.init.value': '+0',
    'data.attributes.ac.value': '15',
    'data.attributes.hitDice.value': '1',
    'data.attributes.hp.value': '2',
    'data.attributes.hp.max': '2',
    'data.attributes.speed.value': '30',
    'data.attributes.special.value': '',
    'data.config.actionDice': '1d20',
    'data.saves.frt.value': '+0',
    'data.saves.ref.value': '+0',
    'data.saves.wil.value': '+0',
    'data.details.alignment': 'n',
    items: [
      {
        name: 'claw',
        type: 'weapon',
        data: {
          toHit: '+3',
          damage: '1d4',
          description: { value: '' },
          melee: true
        }
      }
    ]
  }
  expect(parsedNPC).toMatchObject([expected])
})

/* Test damage modifiers */
test('bonusguy', () => {
  const parsedNPC = parseNPCs('Bonus Guy: Init -1; Atk big club +3 melee (1d4+2) or small club -2 melee (1d4 - 3); AC 13; HD 1d8+2; MV 30’; Act 1d20; SV Fort +2, Ref +1, Will -2; AL C.')
  const expected = {
    name: 'Bonus Guy',
    'data.attributes.init.value': '-1',
    'data.attributes.ac.value': '13',
    'data.attributes.hitDice.value': '1d8+2',
    'data.attributes.speed.value': '30’',
    'data.config.actionDice': '1d20',
    'data.saves.frt.value': '+2',
    'data.saves.ref.value': '+1',
    'data.saves.wil.value': '-2',
    'data.details.alignment': 'c',
    items: [
      {
        name: 'big club',
        type: 'weapon',
        data: {
          toHit: '+3',
          damage: '1d4+2',
          melee: true
        }
      },
      {
        name: 'small club',
        type: 'weapon',
        data: {
          toHit: '-2',
          damage: '1d4 - 3',
          melee: true
        }
      }
    ]
  }
  expect(parsedNPC).toMatchObject([expected])
})

/* Test multiple statlines */
test('rodentsquad', () => {
  const parsedNPC = parseNPCs(
    `Mega Mole: Init +5; Atk claws +6 melee (1d8+3) ; AC 17;
HD 3d8; hp 16; MV 20’; Act 1d20; SV Fort +4, Ref +4, Will +2;
AL C.

Large Rat: Init +2; Atk teeth +2 melee (1d6) or tail +3 melee
(1d4); AC 13; HD 1d8; hp 4 each; MV 30’; Act 1d20; SV Fort +2,
Ref +2, Will +0; AL C.

Medium Mouse: Init +1; Atk bite +2 melee (1d3-1); AC 9;
HD 1d6; hp 4 each; MV 35’ or leap 20’; Act 1d20; SV Fort +0,
Ref +4, Will +2; AL C.`
  )
  const expected = [
    {
      name: 'Mega Mole',
      'data.attributes.init.value': '+5',
      'data.attributes.ac.value': '17',
      'data.attributes.hitDice.value': '3d8',
      'data.attributes.speed.value': '20’',
      'data.config.actionDice': '1d20',
      'data.saves.frt.value': '+4',
      'data.saves.ref.value': '+4',
      'data.saves.wil.value': '+2',
      'data.details.alignment': 'c',
      items: [
        {
          name: 'claws',
          type: 'weapon',
          data: {
            toHit: '+6',
            damage: '1d8+3',
            melee: true
          }
        }
      ]
    },
    {
      name: 'Large Rat',
      'data.attributes.init.value': '+2',
      'data.attributes.ac.value': '13',
      'data.attributes.hitDice.value': '1d8',
      'data.attributes.speed.value': '30’',
      'data.config.actionDice': '1d20',
      'data.saves.frt.value': '+2',
      'data.saves.ref.value': '+2',
      'data.saves.wil.value': '+0',
      'data.details.alignment': 'c',
      items: [
        {
          name: 'teeth',
          type: 'weapon',
          data: {
            toHit: '+2',
            damage: '1d6',
            melee: true
          }
        },
        {
          name: 'tail',
          type: 'weapon',
          data: {
            toHit: '+3',
            damage: '1d4',
            melee: true
          }
        }
      ]
    },
    {
      name: 'Medium Mouse',
      'data.attributes.init.value': '+1',
      'data.attributes.ac.value': '9',
      'data.attributes.hitDice.value': '1d6',
      'data.attributes.speed.value': '35’',
      'data.config.actionDice': '1d20',
      'data.saves.frt.value': '+0',
      'data.saves.ref.value': '+4',
      'data.saves.wil.value': '+2',
      'data.details.alignment': 'c',
      items: [
        {
          name: 'bite',
          type: 'weapon',
          data: {
            toHit: '+2',
            damage: '1d3-1',
            melee: true
          }
        }
      ]
    }
  ]
  expect(parsedNPC).toMatchObject(expected)
})
