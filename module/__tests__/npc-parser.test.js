/* Tests for NPC Parser */

import { expect, test } from 'vitest'
import '../__mocks__/foundry.js'
import '../__mocks__/roll.js'
import parseNPCs from '../npc-parser.js'

/* Test snake */
test('super snake', async () => {
  const parsedNPC = await parseNPCs('Very long, the power super-snake: Init +0; Atk bite +6 melee; Dmg 1d8;\r\n AC 13; HP 21; MV 20’; Act 1d20; SV Fort +8, Ref +4, Will +4; AL L.')
  const expected = {
    name: 'Very long, the power super-snake',
    'attributes.init.value': '+0',
    'attributes.ac.value': '13',
    'attributes.hp.value': '21',
    'attributes.hp.max': '21',
    'attributes.speed.value': '20’',
    'config.actionDice': '1d20',
    'saves.frt.value': '+8',
    'saves.ref.value': '+4',
    'saves.wil.value': '+4',
    'details.alignment': 'l',
    items: [
      {
        name: 'bite',
        type: 'weapon',
        img: 'systems/dcc/styles/images/weapon.webp',
        system: {
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
test('pile of bones', async () => {
  const parsedNPC = await parseNPCs('Seven items of dry stuff: Init -2; Atk bite +0 melee; Dmg 1d4-1; AC 8; HP 3; MV 5’;\r\n Act 1d20; SV Fort +0, Ref -4, Will +1; AL C.')
  const expected = {
    name: 'Seven items of dry stuff',
    'attributes.init.value': '-2',
    'attributes.ac.value': '8',
    'attributes.hp.value': '3',
    'attributes.hp.max': '3',
    'attributes.speed.value': '5’',
    'config.actionDice': '1d20',
    'saves.frt.value': '+0',
    'saves.ref.value': '-4',
    'saves.wil.value': '+1',
    'details.alignment': 'c',
    items: [
      {
        name: 'bite',
        type: 'weapon',
        system: {
          toHit: '+0',
          melee: true
        }
      }
    ]
  }
  expect(parsedNPC).toMatchObject([expected])
})

/* Test orcs */
test('orcs', async () => {
  const parsedNPC = await parseNPCs('Cute-Infused Orcs (3): Init +2; Atk claw +1 melee (1d4) or spear +1 melee (1d8); AC 15; HD 2d8+2; hp 13 each; MV 30’; Act 1d20; SP none; SV Fort +3, Ref +0, Will -1; AL C.')
  const expected = {
    name: 'Cute-Infused Orcs',
    'attributes.init.value': '+2',
    'attributes.ac.value': '15',
    'attributes.hitDice.value': '2d8+2',
    'attributes.hp.value': '13',
    'attributes.hp.max': '13',
    'attributes.speed.value': '30’',
    'attributes.special.value': 'none',
    'config.actionDice': '1d20',
    'saves.frt.value': '+3',
    'saves.ref.value': '+0',
    'saves.wil.value': '-1',
    'details.alignment': 'c',
    items: [
      {
        name: 'claw',
        type: 'weapon',
        img: 'systems/dcc/styles/images/weapon.webp',
        system: {
          toHit: '+1',
          damage: '1d4',
          description: { value: '' },
          melee: true
        }
      },
      {
        name: 'spear',
        type: 'weapon',
        img: 'systems/dcc/styles/images/weapon.webp',
        system: {
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
test('spider', async () => {
  const parsedNPC = await parseNPCs('Xformed, Unicorn-Filled Spider: Init +1; Atk bite +2 melee (1d4 plus poison) or web +4 ranged (restrained, 20’ range); AC 13; HD 2d12 +2; hp 20; MV 30’ or climb 30’; Act 1d20; SP poison (DC 14 Fort save or additional 3d4 damage and lose 1 point of Strength, 1d4 damage if successful), create web, filled with bats; SV Fort +2, Ref +4, Will +0; AL N.\n')
  const expected = {
    name: 'Xformed, Unicorn-Filled Spider',
    'attributes.init.value': '+1',
    'attributes.ac.value': '13',
    'attributes.hitDice.value': '2d12 +2',
    'attributes.hp.value': '20',
    'attributes.hp.max': '20',
    'attributes.speed.value': '30’',
    'attributes.speed.other': 'climb 30’',
    'attributes.special.value': 'poison (DC 14 Fort save or additional 3d4 damage and lose 1 point of Strength, 1d4 damage if successful), create web, filled with bats',
    'config.actionDice': '1d20',
    'saves.frt.value': '+2',
    'saves.ref.value': '+4',
    'saves.wil.value': '+0',
    'details.alignment': 'n',
    items: [
      {
        name: 'bite',
        type: 'weapon',
        img: 'systems/dcc/styles/images/weapon.webp',
        system: {
          toHit: '+2',
          damage: '1d4',
          description: { value: 'plus poison' },
          melee: true
        }
      },
      {
        name: 'web',
        type: 'weapon',
        img: 'systems/dcc/styles/images/weapon.webp',
        system: {
          toHit: '+4',
          melee: false,
          damage: '0',
          description: {
            summary: 'restrained, 20’ range'
          }
        }
      }
    ]
  }
  expect(parsedNPC).toMatchObject([expected])
})

/* Test wetad */
test('wedad', async () => {
  const parsedNPC = await parseNPCs('Gerieah (in her tree): Init +1; Atk tree limb slam +5 melee (1d10); AC 15;\n HD 4d10; hp 30; MV none; Act 1d20; SP takes 2x damage from fire, can attack targets up to 20’ away with tree limbs; SV Fort +6, Ref -2, Will +4; AL N.')
  const expected = {
    name: 'Gerieah (in her tree)',
    'attributes.init.value': '+1',
    'attributes.ac.value': '15',
    'attributes.hitDice.value': '4d10',
    'attributes.hp.value': '30',
    'attributes.hp.max': '30',
    'attributes.speed.value': 'none',
    'attributes.special.value': 'takes 2x damage from fire, can attack targets up to 20’ away with tree limbs',
    'config.actionDice': '1d20',
    'saves.frt.value': '+6',
    'saves.ref.value': '-2',
    'saves.wil.value': '+4',
    'details.alignment': 'n',
    items: [
      {
        name: 'tree limb slam',
        type: 'weapon',
        img: 'systems/dcc/styles/images/weapon.webp',
        system: {
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
test('smultist', async () => {
  const parsedNPC = await parseNPCs('Green-robed smultist (1): Init +4; Atk dagger +5 melee (1d4+3); AC 11; HD 5d4+5; hp 21; MV 20’; SP 3d6 control check, able to cast arms of the angel, squid-mass (when killed, an squid-mass emerges; see stats below); Act 1d20; SV Fort +3, Ref +4, Will +0; AL C. Equipment: bird-shaped talisman of gold tied on a leather thong (worth 10 gp; see level 3).')
  const expected = {
    name: 'Green-robed smultist',
    'attributes.init.value': '+4',
    'attributes.ac.value': '11',
    'attributes.hitDice.value': '5d4+5',
    'attributes.hp.value': '21',
    'attributes.hp.max': '21',
    'attributes.speed.value': '20’',
    'attributes.special.value': '3d6 control check, able to cast arms of the angel, squid-mass (when killed, an squid-mass emerges; see stats below)', // Fixed: No longer truncated at semicolon
    'config.actionDice': '1d20',
    'saves.frt.value': '+3',
    'saves.ref.value': '+4',
    'saves.wil.value': '+0',
    'details.alignment': 'c',
    items: [
      {
        name: 'dagger',
        type: 'weapon',
        img: 'systems/dcc/styles/images/weapon.webp',
        system: {
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
test('shortstats', async () => {
  const parsedNPC = await parseNPCs('Stunty, the short and muddled: Init +1; Atk kick +2 melee (1d3); AC 15;\n hp 4; Act 1d20; SV Ref +6, Fort -2, Will +4.')
  const expected = {
    name: 'Stunty, the short and muddled',
    'attributes.init.value': '+1',
    'attributes.ac.value': '15',
    'attributes.hitDice.value': '1d8',
    'attributes.hp.value': '4',
    'attributes.hp.max': '4',
    'attributes.speed.value': '30',
    'attributes.special.value': '',
    'config.actionDice': '1d20',
    'saves.frt.value': '-2',
    'saves.ref.value': '+6',
    'saves.wil.value': '+4',
    'details.alignment': 'n',
    items: [
      {
        name: 'kick',
        type: 'weapon',
        img: 'systems/dcc/styles/images/weapon.webp',
        system: {
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
test('familiar', async () => {
  const parsedNPC = await parseNPCs('The bad guy\'s familiar: Atk claw +3 melee (1d4), AC 15, HP 2.')
  const expected = {
    name: 'The bad guy\'s familiar',
    'attributes.init.value': '+0',
    'attributes.ac.value': '15',
    'attributes.hitDice.value': '1d8',
    'attributes.hp.value': '2',
    'attributes.hp.max': '2',
    'attributes.speed.value': '30',
    'attributes.special.value': '',
    'config.actionDice': '1d20',
    'saves.frt.value': '+0',
    'saves.ref.value': '+0',
    'saves.wil.value': '+0',
    'details.alignment': 'n',
    items: [
      {
        name: 'claw',
        type: 'weapon',
        img: 'systems/dcc/styles/images/weapon.webp',
        system: {
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
test('bonusguy', async () => {
  const parsedNPC = await parseNPCs('Bonus Guy: Init -1; Atk big club +3 melee (1d4+2) or small club -2 melee (1d4 - 3); AC 13; HD 1d8+2; MV 30’; Act 1d20; SV Fort +2, Ref +1, Will -2; AL C.')
  const expected = {
    name: 'Bonus Guy',
    'attributes.init.value': '-1',
    'attributes.ac.value': '13',
    'attributes.hitDice.value': '1d8+2',
    'attributes.hp.value': 2,
    'attributes.hp.max': 2,
    'attributes.speed.value': '30’',
    'config.actionDice': '1d20',
    'saves.frt.value': '+2',
    'saves.ref.value': '+1',
    'saves.wil.value': '-2',
    'details.alignment': 'c',
    items: [
      {
        name: 'big club',
        type: 'weapon',
        img: 'systems/dcc/styles/images/weapon.webp',
        system: {
          toHit: '+3',
          damage: '1d4+2',
          melee: true
        }
      },
      {
        name: 'small club',
        type: 'weapon',
        img: 'systems/dcc/styles/images/weapon.webp',
        system: {
          toHit: '-2',
          damage: '1d4 - 3',
          melee: true
        }
      }
    ]
  }
  expect(parsedNPC).toMatchObject([expected])
})

/* Test multiple attacks */
test('chimeric', async () => {
  const parsedNPC = await parseNPCs('Chimeric: Init +0; Atk lion bite +5 melee (2d4) or goat gore\n' +
    '+4 melee (2d4) or snake bite +6 melee (1d10+2) or claws +4\n' +
    'melee (1d3) or breathe fire; AC 18; HD 5d8+8; MV 30’ or\n' +
    'fly 30’; Act 3d20; SP breathe fire 3/day; SV Fort +4, Ref +2,\n' +
    'Will +2; AL C.')
  const expected = {
    name: 'Chimeric',
    'attributes.init.value': '+0',
    'attributes.ac.value': '18',
    'attributes.hitDice.value': '5d8+8',
    'attributes.hp.value': 2,
    'attributes.hp.max': 2,
    'attributes.special.value': 'breathe fire 3/day',
    'attributes.speed.value': '30’',
    'attributes.speed.other': 'fly 30’',
    'config.actionDice': '3d20',
    'saves.frt.value': '+4',
    'saves.ref.value': '+2',
    'saves.wil.value': '+2',
    'details.alignment': 'c',
    items: [
      {
        name: 'lion bite',
        type: 'weapon',
        img: 'systems/dcc/styles/images/weapon.webp',
        system: {
          toHit: '+5',
          damage: '2d4',
          melee: true
        }
      },
      {
        name: 'goat gore',
        type: 'weapon',
        img: 'systems/dcc/styles/images/weapon.webp',
        system: {
          toHit: '+4',
          damage: '2d4',
          melee: true
        }
      },
      {
        name: 'snake bite',
        type: 'weapon',
        img: 'systems/dcc/styles/images/weapon.webp',
        system: {
          toHit: '+6',
          damage: '1d10+2',
          melee: true
        }
      },
      {
        name: 'claws',
        type: 'weapon',
        img: 'systems/dcc/styles/images/weapon.webp',
        system: {
          toHit: '+4',
          damage: '1d3',
          melee: true
        }
      },
      {
        name: 'breathe fire',
        type: 'weapon',
        img: 'systems/dcc/styles/images/weapon.webp',
        system: {
          toHit: '',
          damage: '0',
          melee: true
        }
      }
    ]
  }
  expect(parsedNPC).toMatchObject([expected])
})

/* Test multiple attacks */
test('witchharps', async () => {
  const parsedNPC = await parseNPCs('Witchharps (8): Init +3; Atk talons +1 melee (1 point); AC 12; HD 2d8; hp 15, 6, 12, 9, 10, 7, 15, 9; MV flight 30\'; Act 1d20; SP snatch and grab; SV Fort +1, Ref +2, Will +2; Path POD.')
  const expected = {
    name: 'Witchharps',
    'attributes.init.value': '+3',
    'attributes.ac.value': '12',
    'attributes.hitDice.value': '2d8',
    'attributes.hp.value': '15',
    'attributes.hp.max': '15',
    'attributes.special.value': 'snatch and grab',
    'attributes.speed.value': 'flight 30\'',
    'config.actionDice': '1d20',
    'saves.frt.value': '+1',
    'saves.ref.value': '+2',
    'saves.wil.value': '+2',
    items: [
      {
        name: 'talons',
        type: 'weapon',
        img: 'systems/dcc/styles/images/weapon.webp',
        system: {
          toHit: '+1',
          damage: '1',
          melee: true
        }
      }
    ]
  }
  expect(parsedNPC).toMatchObject([expected])
})

/* Test multiple statlines */
test('rodentsquad', async () => {
  const parsedNPC = await parseNPCs(
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
      'attributes.init.value': '+5',
      'attributes.ac.value': '17',
      'attributes.hitDice.value': '3d8',
      'attributes.speed.value': '20’',
      'config.actionDice': '1d20',
      'saves.frt.value': '+4',
      'saves.ref.value': '+4',
      'saves.wil.value': '+2',
      'details.alignment': 'c',
      items: [
        {
          name: 'claws',
          type: 'weapon',
          img: 'systems/dcc/styles/images/weapon.webp',
          system: {
            toHit: '+6',
            damage: '1d8+3',
            melee: true
          }
        }
      ]
    },
    {
      name: 'Large Rat',
      'attributes.init.value': '+2',
      'attributes.ac.value': '13',
      'attributes.hitDice.value': '1d8',
      'attributes.speed.value': '30’',
      'config.actionDice': '1d20',
      'saves.frt.value': '+2',
      'saves.ref.value': '+2',
      'saves.wil.value': '+0',
      'details.alignment': 'c',
      items: [
        {
          name: 'teeth',
          type: 'weapon',
          img: 'systems/dcc/styles/images/weapon.webp',
          system: {
            toHit: '+2',
            damage: '1d6',
            melee: true
          }
        },
        {
          name: 'tail',
          type: 'weapon',
          img: 'systems/dcc/styles/images/weapon.webp',
          system: {
            toHit: '+3',
            damage: '1d4',
            melee: true
          }
        }
      ]
    },
    {
      name: 'Medium Mouse',
      'attributes.init.value': '+1',
      'attributes.ac.value': '9',
      'attributes.hitDice.value': '1d6',
      'attributes.speed.value': '35’',
      'config.actionDice': '1d20',
      'saves.frt.value': '+0',
      'saves.ref.value': '+4',
      'saves.wil.value': '+2',
      'details.alignment': 'c',
      items: [
        {
          name: 'bite',
          type: 'weapon',
          img: 'systems/dcc/styles/images/weapon.webp',
          system: {
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

/* Test giant stat block */
test('giant', async () => {
  const parsedNPC = await parseNPCs(
    `Gabbie (stone giant): Init +1; Atk club +18 melee (3d8+10)
or hurled stone +10 missile fire (1d8+10, range 200’); Crit
20-24 G/d4; AC 17; HD 12d10 (hp 72); MV 40’; Act 1d24; SP
infravision 60’, stone camouflage, transmute earth; SV Fort
+12, Ref +6, Will +8; AL N.`
  )
  const expected = [
    {
      name: 'Gabbie (stone giant)',
      'attributes.init.value': '+1',
      'attributes.ac.value': '17',
      'attributes.critical.die': 'd4',
      'attributes.critical.table': 'G',
      'attributes.hitDice.value': '12d10',
      'attributes.speed.value': '40’',
      'config.actionDice': '1d24',
      'details.alignment': 'n',
      'details.critRange': '20',
      'saves.frt.value': '+12',
      'saves.ref.value': '+6',
      'saves.wil.value': '+8',
      items: [
        {
          name: 'club',
          type: 'weapon',
          img: 'systems/dcc/styles/images/weapon.webp',
          system: {
            actionDie: '1d20',
            backstab: false,
            backstabDamage: null,
            toHit: '+18',
            damage: '3d8+10',
            melee: true
          }
        },
        {
          name: 'hurled stone',
          type: 'weapon',
          img: 'systems/dcc/styles/images/weapon.webp',
          system: {
            actionDie: '1d20',
            backstab: false,
            backstabDamage: null,
            toHit: '+10',
            damage: '1d8+10',
            melee: false
          }
        }
      ]
    }
  ]
  expect(parsedNPC).toMatchObject(expected)
})

/* Test stat block with crit after attacks */
test('Cool creature', async () => {
  const parsedNPC = await parseNPCs(
    'Cool creature (1+1/round): Init -1; Atk burning fist +1 melee (1d3 plus 1 hp of heat damage); Crit M/ d6; AC 14; HD 1d8+1 (hp 6 each); MV 30\'; Act 1d20; SP immune to fire, vulnerable to cold (+1d6 damage); SV Fort +4, Ref -1, Will +3; AL N.'
  )
  const expected = [
    {
      name: 'Cool creature (1+1/round)',
      'attributes.init.value': '-1',
      'attributes.ac.value': '14',
      'attributes.critical.die': 'd6',
      'attributes.critical.table': 'M',
      'attributes.hitDice.value': '1d8+1',
      'attributes.speed.value': '30\'',
      'config.actionDice': '1d20',
      'saves.frt.value': '+4',
      'saves.ref.value': '-1',
      'saves.wil.value': '+3',
      'details.alignment': 'n',
      items: [
        {
          name: 'burning fist',
          type: 'weapon',
          img: 'systems/dcc/styles/images/weapon.webp',
          system: {
            actionDie: '1d20',
            backstab: false,
            backstabDamage: null,
            toHit: '+1',
            damage: '1d3',
            melee: true
          }
        }
      ]
    }
  ]
  expect(parsedNPC).toMatchObject(expected)
})

/* Test DT-style stat block */
test('Wormy the Warrior', async () => {
  const parsedNPC = await parseNPCs(
    'Wormy Bonechewer (warrior): Init +3; Atk longsword +2+deed die melee (1d8+2+deed die); AC 16 (chainmail & shield); HD 3d12+6; hp 42; MV 25\'; Act 1d20; SP Mighty Deed of Arms, deed die (+d5); SV Fort +3, Ref +3, Will +2; AL C; Crit 19-20 IV/d16.'
  )
  const expected = [
    {
      name: 'Wormy Bonechewer (warrior)',
      'attributes.init.value': '+3',
      'attributes.ac.value': '16',
      'attributes.critical.die': 'd16',
      'attributes.critical.table': 'IV',
      'attributes.hitDice.value': '3d12+6',
      'attributes.speed.value': '25\'',
      'config.actionDice': '1d20',
      'saves.frt.value': '+3',
      'saves.ref.value': '+3',
      'saves.wil.value': '+2',
      'details.alignment': 'c',
      items: [
        {
          name: 'longsword',
          type: 'weapon',
          img: 'systems/dcc/styles/images/weapon.webp',
          system: {
            actionDie: '1d20',
            backstab: false,
            backstabDamage: null,
            toHit: '+2+@ab',
            damage: '1d8+2+@ab',
            melee: true
          }
        }
      ]
    }
  ]
  expect(parsedNPC).toMatchObject(expected)
})

/* Test fractional HD parsing */
test('fractional HD', async () => {
  const parsedNPC = await parseNPCs('Tiny Creature: Init +0; Atk bite +1 melee (1d2); AC 12; HD ½d4; hp 1; MV 10\'; Act 1d20; SV Fort +0, Ref +2, Will +0; AL N.')
  const expected = {
    name: 'Tiny Creature',
    'attributes.hitDice.value': '1d4/2'
  }
  expect(parsedNPC).toMatchObject([expected])
})

/* Test creature type detection for critical hits */
test('creature type detection', async () => {
  const humanoidNPC = await parseNPCs('Goblin Scout: Init +2; Atk shortsword +1 melee (1d6); AC 13; HD 1d8; hp 4; MV 30\'; Act 1d20; SV Fort +1, Ref +2, Will +0; AL C.')
  expect(humanoidNPC[0]['attributes.critical.table']).toBe('III')
  expect(humanoidNPC[0]['attributes.critical.die']).toBe('d6')
})

/* Test error handling with malformed input */
test('malformed input handling', async () => {
  // Should not throw errors even with malformed input
  const result = await parseNPCs('This is not a valid stat block at all.')
  expect(Array.isArray(result)).toBe(true)
  expect(result.length).toBeGreaterThanOrEqual(0)
})
