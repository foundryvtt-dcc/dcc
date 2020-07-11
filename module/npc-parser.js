/**
 *  Parses NPC Stat Blocks (e.g. from published modules) into an NPC sheet
 *  @param {string} npcString the NPC stat block to import
 **/
export function parseNPC(npcString) {
    let npc = {};
    npc.name = npcString.replace(/(.*):.*/, "$1").replace(/ ?\(\d+\)/, "");
    npc["data.attributes.init.value"] = npcString.replace(/.*Init ?(.+?);.*/, "$1");
    npc.attacks = npcString.replace(/.*Atk ?(.+?);.*/, "$1");
    if (npcString.includes("Dmg ")) npc.damage = npcString.replace(/.*Dmg ?(.+?);.*/, "$1");
    npc["data.attributes.ac.value"] = npcString.replace(/.*AC ?(.+?);.*/, "$1");
    npc["data.attributes.hp.value"] = npcString.replace(/.*(?:HP|hp) ?(\d+).*?;.*/, "$1");
    npc["data.attributes.hp.max"] = npcString.replace(/.*(?:HP|hp) ?(\d+).*?;.*/, "$1");
    npc["data.attributes.hitDice.value"] = npcString.replace(/.*HD ?(.+?);.*/, "$1");
    npc["data.attributes.speed.value"] = npcString.replace(/.*MV ?(.+?);.*/, "$1");
    npc["data.attributes.actionDice.value"] = npcString.replace(/.*Act ?(.+?);.*/, "$1");
    if (npcString.includes("SP ")) npc["data.attributes.special.value"] = npcString.replace(/.*SP ?(.+?);.*/, "$1");
    npc["data.saves.frt.value"] = npcString.replace(/.*Fort ?(.+?),.*/, "$1");
    npc["data.saves.ref.value"] = npcString.replace(/.*Ref ?(.+?),.*/, "$1");
    npc["data.saves.wil.value"] = npcString.replace(/.*Will ?(.+?);.*/, "$1");
    npc["data.details.alignment"] = npcString.replace(/.*AL ?(.+?)\..*/, "$1").toLowerCase();

    /* Parse Out Attacks */
    const m1 = {};
    const m2 = {};
    if (npc.attacks.includes(" or ")) {
        m1.all = npc.attacks.replace(/(.*) or.*/, "$1");
        m2.all = npc.attacks.replace(/.* or (.*)/, "$1");
    } else {
        m1.all = npc.attacks;
    }

    m1.name = m1.all.replace(/(.*) [+-]\d+ .*/, "$1");
    m1.toHit = m1.all.replace(/.* ([+-]\d+) .*/, "$1");
    if (npc.damage) {
        m1.damage = npc.damage;
    } else {
        m1.damage = m1.all.replace(/.* \((\d+d\d*\+?\d*).*?\).*/, "$1");
        m1.special = m1.all.replace(/.* \(\d+d\d*\+?\d* ?(.*?)\).*/, "$1");
        npc["data.items.weapons.m1.special"] = m1.special;
    }
    npc["data.items.weapons.m1.name"] = m1.name;
    npc["data.items.weapons.m1.toHit"] = m1.toHit;
    npc["data.items.weapons.m1.damage"] = m1.damage;

    if (m2.all) {
        m2.name = m2.all.replace(/(.*) [+-]\d+ .*/, "$1");
        m2.toHit = m2.all.replace(/.* ([+-]\d+) .*/, "$1");
        if (npc.damage) {
            m2.damage = npc.damage;
        } else {
            m2.damage = m2.all.replace(/.* \((\d+d\d*\+?\d*).*?\).*/, "$1");
            m2.special = m2.all.replace(/.* \(\d+d\d*\+?\d* ?(.*?)\).*/, "$1");
            npc["data.items.weapons.m2.special"] = m2.special;
        }
        npc["data.items.weapons.m2.name"] = m2.name;
        npc["data.items.weapons.m2.toHit"] = m2.toHit;
        npc["data.items.weapons.m2.damage"] = m2.damage;
    }

    return npc;
}