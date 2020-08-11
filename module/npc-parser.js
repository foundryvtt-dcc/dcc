/* global Roll */

/**
 *  Parses NPC Stat Blocks (e.g. from published modules) into an NPC sheet
 *  @param {string} npcString the NPC stat block to import
 **/
function parseNPC (npcString) {
  const npc = {}
  npcString = npcString.replace(/[\n\r]+/g, ' ').replace(/\s{2,}/g, ' ').replace(/^\s+|\s+$/, '')

  npc.name = _firstMatch(/(.*):.*/, npcString) || 'Unnamed'
  npc.name = npc.name.replace(/ ?\(\d+\)/, '')
  const hd = npc['data.attributes.hitDice.value'] = _firstMatch(/.*HD ?(.+?)[;.].*/, npcString) || '1'
  npc['data.attributes.init.value'] = _firstMatch(/.*Init ?(.+?)[;.].*/, npcString) || '+0'
  npc['data.attributes.ac.value'] = _firstMatch(/.*AC ?(\d+?)[;,.].*/, npcString) || '10'
  npc['data.attributes.hp.max'] = npc['data.attributes.hp.value'] = _firstMatch(/.*(?:HP|hp) ?(\d+).*?[;.].*/, npcString) || new Roll(hd).roll().total
  npc['data.attributes.speed.value'] = _firstMatch(/.*MV ?(.+?)[;.].*/, npcString) || '30'
  npc['data.attributes.actionDice.value'] = _firstMatch(/.*Act ?(.+?)[;.].*/, npcString) || '1d20'
  npc['data.attributes.special.value'] = _firstMatch(/.*SP ?(.+?);.*/, npcString) || ''
  npc['data.saves.frt.value'] = _firstMatch(/.*Fort ?(.+?)[;,.].*/, npcString) || '+0'
  npc['data.saves.ref.value'] = _firstMatch(/.*Ref ?(.+?)[;,.].*/, npcString) || '+0'
  npc['data.saves.wil.value'] = _firstMatch(/.*Will ?(.+?)[;,.].*/, npcString) || '+0'
  npc['data.details.alignment'] = (_firstMatch(/.*AL ?(.+?)\..*/, npcString) || 'n').toLowerCase()

  /* Speed */
  if (npc['data.attributes.speed.value'].includes('or')) {
    npc['data.attributes.speed.other'] = _firstMatch(/.* or (.*)/, npc['data.attributes.speed.value'])
    npc['data.attributes.speed.value'] = _firstMatch(/(.*) or .*/, npc['data.attributes.speed.value'])
  }

  npc.attacks = _firstMatch(/.*Atk ?(.+?)[;.].*/, npcString) || ''
  npc.damage = _firstMatch(/.*Dmg ?(.+?)[;.].*/, npcString) || ''

  /* Attacks */
  let attackStringOne, attackStringTwo
  if (npc.attacks.includes(' or ')) {
    attackStringOne = _firstMatch(/(.*) or .*/, npc.attacks)
    attackStringTwo = _firstMatch(/.* or (.*)/, npc.attacks)
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
  attack.name = _firstMatch(/(.*?) [+-].*/, attackString)
  attack.toHit = _firstMatch(/.*? ([+-].*?) .*/, attackString)
  attack.special = ''
  attack.damage = ''
  attack.type = 'melee'
  if (attackString.includes('ranged')) attack.type = 'ranged'
  if (damageString) {
    attack.damage = damageString
  } else {
    attack.special = _firstMatch(/.*\(\w+ (.*)\).*/, attackString) || ''
    attack.damage = _firstMatch(/.*\((\w+).*\).*/, attackString) || ''
  }
  return attack
}

/** Match a regex against the string provided and return the first match group or null
 * @param {Regex}       Regular expression to match against, containing at least one group
 * @param {string}      The string to match against
 *
 * @ return {string} First matched group or null if no match
 */
function _firstMatch (regex, string) {
  const result = string.match(regex)
  return (result && result.length > 0) ? result[1] : null
}

export default parseNPC
