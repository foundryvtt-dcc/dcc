const superSnake = "Very long, the power super-snake: Init +0; Atk bite +6 melee; Dmg 1d8; AC 13; HP 21; MV 20’; Act 1d20; SV Fort +8, Ref +4, Will +4; AL L.";
const dryPile = "Seven items of dry stuff: Init -2; Atk bite +0 melee; Dmg 1d4-1; AC 8; HP 3; MV 5’; Act 1d20; SV Fort +0, Ref -4, Will +1; AL C.";
const neatStatues = "Six neat statues: Init -2; Atk punch +2 melee; Dmg 1d4; AC 12; HP 7; MV 10’; Act 1d20; SV Fort -2, Ref -2, Will +0; AL N.";
const cuteOrcs = "Cute-Infused Orcs (3): Init +2; Atk claw +1 melee (1d4) or spear +1 melee (1d8); AC 15; HD 2d8+2; hp 13 each; MV 30’; Act 1d20; SP none; SV Fort +3, Ref +0, Will -1; AL C.";
const jellyOrcs = "Jelly-Armed Orc (2): Init +2; Atk jelly arms +3 melee (1d5+2); AC 14; HD 3d8+2; hp 18 each; MV 30’; Act 1d20; SP constrict on a natural 19-20 (1d6 automatic damage each round), can attack targets up to 15’ away; SV Fort +3, Ref +1, Will -1; AL C.";


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
    return npc;
}

console.log(parseNPC(superSnake));
console.log(parseNPC(dryPile));
console.log(parseNPC(neatStatues));
console.log(parseNPC(cuteOrcs));
console.log(parseNPC(jellyOrcs));
