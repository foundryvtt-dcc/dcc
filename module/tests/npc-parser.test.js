/* Tests for NPC Parser */

import {parseNPC} from '../npc-parser.js';

/* Test snake */
test('super snake', () => {
    const parsedNPC = parseNPC("Very long, the power super-snake: Init +0; Atk bite +6 melee; Dmg 1d8; AC 13; HP 21; MV 20’; Act 1d20; SV Fort +8, Ref +4, Will +4; AL L.");
    const expected = {
        "name": "Very long, the power super-snake",
        "data.attributes.init.value": "+0",
        "data.attributes.ac.value": "13",
        "data.attributes.hp.value": "21",
        "data.attributes.hp.max": "21",
        "data.attributes.speed.value": "20’",
        "data.attributes.actionDice.value": "1d20",
        "data.saves.frt.value": "+8",
        "data.saves.ref.value": "+4",
        "data.saves.wil.value": "+4",
        "data.details.alignment": "l",
        "data.items.weapons.m1.name": "bite",
        "data.items.weapons.m1.toHit": "+6",
        "data.items.weapons.m1.damage": "1d8",
        "data.items.weapons.m1.special": ""
    };
    expect(parsedNPC).toEqual(expect.objectContaining(expected));
});

/* Test dry pile of bones */
test('pile of bones', () => {
    const parsedNPC = parseNPC("Seven items of dry stuff: Init -2; Atk bite +0 melee; Dmg 1d4-1; AC 8; HP 3; MV 5’; Act 1d20; SV Fort +0, Ref -4, Will +1; AL C.");
    const expected = {
        "name": "Seven items of dry stuff",
        "data.attributes.init.value": "-2",
        "data.attributes.ac.value": "8",
        "data.attributes.hp.value": "3",
        "data.attributes.hp.max": "3",
        "data.attributes.speed.value": "5’",
        "data.attributes.actionDice.value": "1d20",
        "data.saves.frt.value": "+0",
        "data.saves.ref.value": "-4",
        "data.saves.wil.value": "+1",
        "data.details.alignment": "c",
        "data.items.weapons.m1.name": "bite",
        "data.items.weapons.m1.toHit": "+0",
        "data.items.weapons.m1.damage": "1d4-1",
        "data.items.weapons.m1.special": ""
    };
    expect(parsedNPC).toEqual(expect.objectContaining(expected));
});

/* Test orcs */
test('orcs', () => {
    const parsedNPC = parseNPC("Cute-Infused Orcs (3): Init +2; Atk claw +1 melee (1d4) or spear +1 melee (1d8); AC 15; HD 2d8+2; hp 13 each; MV 30’; Act 1d20; SP none; SV Fort +3, Ref +0, Will -1; AL C.");
    const expected = {
        "name": "Cute-Infused Orcs",
        "data.attributes.init.value": "+2",
        "data.attributes.ac.value": "15",
        "data.attributes.hitDice.value": "2d8+2",
        "data.attributes.hp.value": "13",
        "data.attributes.hp.max": "13",
        "data.attributes.speed.value": "30’",
        "data.attributes.actionDice.value": "1d20",
        "data.attributes.special.value": "none",
        "data.saves.frt.value": "+3",
        "data.saves.ref.value": "+0",
        "data.saves.wil.value": "-1",
        "data.details.alignment": "c",
        "data.items.weapons.m1.name": "claw",
        "data.items.weapons.m1.toHit": "+1",
        "data.items.weapons.m1.damage": "1d4",
        "data.items.weapons.m1.special": "",
        "data.items.weapons.m2.name": "spear",
        "data.items.weapons.m2.toHit": "+1",
        "data.items.weapons.m2.damage": "1d8",
        "data.items.weapons.m2.special": ""
    };
    expect(parsedNPC).toEqual(expect.objectContaining(expected));
});

/* Test spider */
test('spider', () => {
    const parsedNPC = parseNPC("Xformed, Unicorn-Filled Spider: Init +1; Atk bite +2 melee (1d4 plus poison) or web +4 ranged (restrained, 20’ range); AC 13; HD 2d12 +2; hp 20; MV 30’ or climb 30’; Act 1d20; SP poison (DC 14 Fort save or additional 3d4 damage and lose 1 point of Strength, 1d4 damage if successful), create web, filled with bats; SV Fort +2, Ref +4, Will +0; AL N.");
    const expected = {
        "name": "Xformed, Unicorn-Filled Spider",
        "data.attributes.init.value": "+1",
        "data.attributes.ac.value": "13",
        "data.attributes.hitDice.value": "2d12 +2",
        "data.attributes.hp.value": "20",
        "data.attributes.hp.max": "20",
        "data.attributes.speed.value": "30’",
        "data.attributes.speed.other": "climb 30’",
        "data.attributes.actionDice.value": "1d20",
        "data.attributes.special.value": "poison (DC 14 Fort save or additional 3d4 damage and lose 1 point of Strength, 1d4 damage if successful), create web, filled with bats",
        "data.saves.frt.value": "+2",
        "data.saves.ref.value": "+4",
        "data.saves.wil.value": "+0",
        "data.details.alignment": "n",
        "data.items.weapons.m1.name": "bite",
        "data.items.weapons.m1.toHit": "+2",
        "data.items.weapons.m1.damage": "1d4",
        "data.items.weapons.m1.special": "plus poison",
        "data.items.weapons.r1.name": "web",
        "data.items.weapons.r1.toHit": "+4",
        // "data.items.weapons.r1.damage": "0", //@TODO: change damage to 0 when there is no die roll
        // "data.items.weapons.r1.special": "restrained, 20’ range"  // @TODO: Parse out this special
    };
    expect(parsedNPC).toEqual(expect.objectContaining(expected));
});

/* Test wetad */
test('wedad', () => {
    const parsedNPC = parseNPC("Gerieah (in her tree): Init +1; Atk tree limb slam +5 melee (1d10); AC 15; HD 4d10; hp 30; MV none; Act 1d20; SP takes 2x damage from fire, can attack targets up to 20’ away with tree limbs; SV Fort +6, Ref -2, Will +4; AL N.");
    const expected = {
        "name": "Gerieah (in her tree)",
        "data.attributes.init.value": "+1",
        "data.attributes.ac.value": "15",
        "data.attributes.hitDice.value": "4d10",
        "data.attributes.hp.value": "30",
        "data.attributes.hp.max": "30",
        "data.attributes.speed.value": "none",
        "data.attributes.actionDice.value": "1d20",
        "data.attributes.special.value": "takes 2x damage from fire, can attack targets up to 20’ away with tree limbs",
        "data.saves.frt.value": "+6",
        "data.saves.ref.value": "-2",
        "data.saves.wil.value": "+4",
        "data.details.alignment": "n",
        "data.items.weapons.m1.name": "tree limb slam",
        // "data.items.weapons.m1.toHit": "+5", // @TODO: Parse out this tohit
        "data.items.weapons.m1.damage": "1d10",
    };
    expect(parsedNPC).toEqual(expect.objectContaining(expected));
});
