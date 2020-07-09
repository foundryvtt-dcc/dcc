const superSnake = "Very long, the power super-snake: Init +0; Atk bite +6 melee; Dmg 1d8; AC 13; HP 21; MV 20’; Act 1d20; SV Fort +8, Ref +4, Will +4; AL L.";
const dryPile = "Seven items of dry stuff: Init -2; Atk bite +0 melee; Dmg 1d4-1; AC 8; HP 3; MV 5’; Act 1d20; SV Fort +0, Ref -4, Will +1; AL C.";
const neatStatues = "Six neat statues: Init -2; Atk punch +2 melee; Dmg 1d4; AC 12; HP 7; MV 10’; Act 1d20; SV Fort -2, Ref -2, Will +0; AL N.";
const cuteOrcs = "Cute-Infused Orcs (3): Init +2; Atk claw +1 melee (1d4) or spear +1 melee (1d8); AC 15; HD 2d8+2; hp 13 each; MV 30’; Act 1d20; SP none; SV Fort +3, Ref +0, Will -1; AL C.";
const jellyOrcs = "Jelly-Armed Orc (2): Init +2; Atk jelly arms +3 melee (1d5+2); AC 14; HD 3d8+2; hp 18 each; MV 30’; Act 1d20; SP constrict on a natural 19-20 (1d6 automatic damage each round), can attack targets up to 15’ away; SV Fort +3, Ref +1, Will -1; AL C.";
const uniSpider = "Xformed, Unicorn-Filled Spider: Init +1; Atk bite +2 melee (1d4 plus poison) or web +4 ranged (restrained, 20’ range); AC 13; HD 2d12 +2; hp 20; MV 30’ or climb 30’; Act 1d20; SP poison (DC 14 Fort save or additional 3d4 damage and lose 1 point of Strength, 1d4 damage if successful), create web, filled with bats; SV Fort +2, Ref +4, Will +0; AL N."
const battySwarm = "Batty Swarm: Init +4; Atk swarming bite +1 melee (1d3 plus disease); AC 10; HD 2d8; hp 10; MV fly 40’; Act special; SP bite all targets within 20’ × 20’ space, half damage from non- area attacks, disease (DC 16 Fort save or temporarily lose 1d4 Strength and Stamina); SV Fort +0, Ref +10, Will -2; AL L."
const slapThings = "Slap-Things (4): Init -1; Atk slam +3 melee (1d8); AC 14; HD 3d12; hp 20 each; MV 20’; Act 1d20; SP camouflage (+10 to stealth checks in wooded areas), burning touch (DC 10 Fort save or suffer 1d5 damage for 2 rounds), odiferous (all within 5’ of the creature must succeed on a DC 10 Fort save or suffer a -1d penalty on all attack, saving throws, ability checks, and spell checks for 1 turn), 2× damage from fire and slashing attacks; SV Fort +4, Ref -2, Will -1; AL C."

function parseNPC(npcString) {
    let npc = {};
    npc.name = npcString.replace(/(.*):.*/, "$1").replace(/ ?\(\d+\)/, "");
    npc.init = npcString.replace(/.*Init ?(.+?);.*/, "$1");
    npc.attacks = npcString.replace(/.*Atk ?(.+?);.*/, "$1");
    if (npcString.includes("Dmg ")) npc.damage = npcString.replace(/.*Dmg ?(.+?);.*/, "$1");
    npc.ac = npcString.replace(/.*AC ?(.+?);.*/, "$1");
    npc.hp = npcString.replace(/.*[HP|hp] ?(.+?);.*/, "$1");
    npc.mv = npcString.replace(/.*MV ?(.+?);.*/, "$1");
    npc.actionDice = npcString.replace(/.*Act ?(.+?);.*/, "$1");
    if (npcString.includes("SP "))npc.special = npcString.replace(/.*SP ?(.+?);.*/, "$1");
    npc.fortSave = npcString.replace(/.*Fort ?(.+?),.*/, "$1");
    npc.refSave = npcString.replace(/.*Ref ?(.+?),.*/, "$1");
    npc.willSave = npcString.replace(/.*Will ?(.+?);.*/, "$1");
    npc.alignment = npcString.replace(/.*AL ?(.+?)\..*/, "$1");

    if (npc.attacks.includes(" or ")) {
        npc.attackOne = npc.attacks.replace(/(.*) or.*/, "$1");
        npc.attackTwo = npc.attacks.replace(/.* or (.*)/, "$1");
    } else {
        npc.attackOne = npc.attacks;
    }
    return npc;
}

console.log(parseNPC(superSnake));
console.log(parseNPC(dryPile));
console.log(parseNPC(neatStatues));
console.log(parseNPC(cuteOrcs));
console.log(parseNPC(jellyOrcs));
console.log(parseNPC(uniSpider));
console.log(parseNPC(battySwarm));
console.log(parseNPC(slapThings));
