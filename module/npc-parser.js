/**
 *  Parses NPC Stat Blocks (e.g. from published modules) into an NPC sheet
 *  @param {string} npcString the NPC stat block to import
 **/
function parseNPC (npcString) {
  const npc = {}
  npcString = npcString.replace(/[\n\r]+/g, ' ').replace(/\s{2,}/g, ' ').replace(/^\s+|\s+$/, '')
  npc.name = npcString.replace(/(.*):.*/, '$1').replace(/ ?\(\d+\)/, '')
  npc['data.attributes.init.value'] = npcString.replace(/.*Init ?(.+?);.*/, '$1')
  npc.attacks = npcString.replace(/.*Atk ?(.+?);.*/, '$1')
  if (npcString.includes('Dmg ')) npc.damage = npcString.replace(/.*Dmg ?(.+?);.*/, '$1')
  npc['data.attributes.ac.value'] = npcString.replace(/.*AC ?(.+?);.*/, '$1')
  npc['data.attributes.hp.value'] = npcString.replace(/.*(?:HP|hp) ?(\d+).*?;.*/, '$1')
  npc['data.attributes.hp.max'] = npcString.replace(/.*(?:HP|hp) ?(\d+).*?;.*/, '$1')
  if (npcString.includes('HD ')) npc['data.attributes.hitDice.value'] = npcString.replace(/.*HD ?(.+?);.*/, '$1')
  npc['data.attributes.speed.value'] = npcString.replace(/.*MV ?(.+?);.*/, '$1')
  npc['data.attributes.actionDice.value'] = npcString.replace(/.*Act ?(.+?);.*/, '$1')
  if (npcString.includes('SP ')) npc['data.attributes.special.value'] = npcString.replace(/.*SP ?(.+?);.*/, '$1')
  npc['data.saves.frt.value'] = npcString.replace(/.*Fort ?(.+?),.*/, '$1')
  npc['data.saves.ref.value'] = npcString.replace(/.*Ref ?(.+?),.*/, '$1')
  npc['data.saves.wil.value'] = npcString.replace(/.*Will ?(.+?);.*/, '$1')
  npc['data.details.alignment'] = npcString.replace(/.*AL ?(.+?)\..*/, '$1').toLowerCase()

  /* Speed */
  if (npc['data.attributes.speed.value'].includes('or')) {
    npc['data.attributes.speed.other'] = npc['data.attributes.speed.value'].replace(/.* or (.*)/, '$1')
    npc['data.attributes.speed.value'] = npc['data.attributes.speed.value'].replace(/(.*) or.*/, '$1')
  }

  /* Attacks */
  let attackStringOne, attackStringTwo
  if (npc.attacks.includes(' or ')) {
    attackStringTwo = npc.attacks.replace(/.* or (.*)/, '$1')
    attackStringOne = npc.attacks.replace(/(.*) or.*/, '$1')
  } else {
    attackStringOne = npc.attacks
  }
  const parsedAttackOne = _parseAttack(attackStringOne, npc.damage)
  let attackOneName = 'm1'
  if (parsedAttackOne.type === 'ranged') attackOneName = 'r1'
  npc[`data.items.weapons.${attackOneName}.name`] = parsedAttackOne.name
  npc[`data.items.weapons.${attackOneName}.toHit`] = parsedAttackOne.toHit
  npc[`data.items.weapons.${attackOneName}.damage`] = parsedAttackOne.damage
  npc[`data.items.weapons.${attackOneName}.special`] = parsedAttackOne.special
  if (attackStringTwo) {
    const parsedAttackTwo = _parseAttack(attackStringTwo, npc.damage)
    let attackTwoName = 'm2'
    if (parsedAttackTwo.type === 'ranged') attackTwoName = 'r1'
    if (parsedAttackTwo.type === 'ranged' && parsedAttackOne.type === 'ranged') attackTwoName = 'r2'
    npc[`data.items.weapons.${attackTwoName}.name`] = parsedAttackTwo.name
    npc[`data.items.weapons.${attackTwoName}.toHit`] = parsedAttackTwo.toHit
    npc[`data.items.weapons.${attackTwoName}.damage`] = parsedAttackTwo.damage
    npc[`data.items.weapons.${attackTwoName}.special`] = parsedAttackTwo.special
  }
  return npc
}

/** Parse out a attack string into fields
 * @param {string} attackString  Full weapon string for a single attack
 * @param {string} damageString  Damage string for blocks with damage separate
 */
function _parseAttack (attackString, damageString) {
  const attack = {}
  attack.name = attackString.replace(/(.*?) [+-].*/, '$1')
  attack.toHit = attackString.replace(/.*? ([+-].*?) .*/, '$1')
  attack.special = ''
  attack.damage = ''
  attack.type = 'melee'
  if (attackString.includes('ranged')) attack.type = 'ranged'
  if (damageString) {
    attack.damage = damageString
  } else {
    if (attackString.match(/.*\(\w+ (.*)\).*/)) attack.special = attackString.replace(/.*\(\w+ (.*)\).*/, '$1')
    attack.damage = attackString.replace(/.*\((\w+).*\).*/, '$1')
  }
  return attack
}

export default parseNPC