/* global game, Roll, ui */

import EntityImages from './entity-images.js'

/**
 *  Parses one or more NPC Stat Blocks (e.g. from published modules) into actor data
 *  @param {string} npcString The NPC stat block to import
 *  @return {Array}           Array of NPC data for actor creation (currently a single NPC)
 **/
function parseNPCs (npcString) {
  npcString = npcString.replace(/[\n\r]+/g, '\n').replace(/\s{2,}/g, ' ').replace(/^\s+|\s+$/g, '')

  // Make sure we match the last period if there's no trailing newline
  npcString += '\n'

  const npcObjects = []

  // Match the period followed by a newline at the end of each stat block
  const matches = npcString.matchAll(/\.[\n$]/gm)

  let previousIndex = 0
  for (const match of matches) {
    const matchIndex = match.index

    // Parse each section between the end of the last NPC (or start of the string) and the period
    const npcSection = npcString.substring(previousIndex, matchIndex + 1)
    try {
      npcObjects.push(parseNPC(npcSection))
    } catch (e) {
      ui.notifications.warn(game.i18n.localize('DCC.ParseSingleNPCWarning'))
    }

    previousIndex = matchIndex + 1
  }

  return npcObjects
}

/**
 *  Parses NPC Stat Blocks (e.g. from published modules) into an NPC sheet
 *  @param {string} npcString The NPC stat block to import
 *  @return {Object}            NPC data for actor creation (currently a single NPC)
 **/
function parseNPC (npcString) {
  const npc = {}
  npcString = npcString.replace(/[\n\r]+/g, ' ').replace(/\s{2,}/g, ' ').replace(/^\s+|\s+$/, '')

  npc.name = _firstMatch(/(.*?):.*/, npcString) || 'Unnamed'
  npc.name = npc.name.replace(/ ?\(\d+\)/, '')
  const hd = npc['data.attributes.hitDice.value'] = _firstMatch(/.*HD ?(.+?)[;.].*/, npcString) || '1'
  npc['data.attributes.init.value'] = _firstMatch(/.*Init ?(.+?)[;.].*/, npcString) || '+0'
  npc['data.attributes.ac.value'] = _firstMatch(/.*AC ?(\d+?)[;,.].*/, npcString) || '10'
  npc['data.attributes.hp.max'] = npc['data.attributes.hp.value'] = _firstMatch(/.*(?:HP|hp) ?(\d+).*?[;.].*/, npcString) || new Roll(hd).evaluate({ async: false }).total
  npc['data.attributes.speed.value'] = _firstMatch(/.*MV ?(.+?)[;.].*/, npcString) || '30'
  npc['data.config.actionDice'] = _firstMatch(/.*Act ?(.+?)[;.].*/, npcString) || '1d20'
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

  npc.items = []
  if (attackStringOne) {
    const parsedAttackOne = _parseAttack(attackStringOne, npc.damage)
    if (parsedAttackOne.name) {
      npc.items.push(parsedAttackOne)
    }
  }
  if (attackStringTwo) {
    const parsedAttackTwo = _parseAttack(attackStringTwo, npc.damage)
    if (parsedAttackTwo.name) {
      npc.items.push(parsedAttackTwo)
    }
  }

  /* Put the full statline into the notes field for reference and to handle data that doesn't get parsed */
  npc['data.details.notes.value'] = npcString

  return npc
}

/** Parse out a attack string into fields
 * @param {string} attackString  Full weapon string for a single attack
 * @param {string} damageString  Damage string for blocks with damage separate
 */
function _parseAttack (attackString, damageString) {
  const attack = {
    config: { inheritActionDie: true },
    actionDie: '1d20',
    range: '',
    twoHanded: false,
    backstab: false,
    backstabDamage: null,
    description: {
      value: ''
    }
  }
  const name = _firstMatch(/(.*?) [+-].*/, attackString)
  attack.toHit = _firstMatch(/.*? ([+-].*?) .*/, attackString)
  attack.damage = ''
  attack.melee = !(attackString.includes('ranged') || attackString.includes('missile'))
  if (damageString) {
    attack.damage = damageString
  } else {
    attack.description.value = _firstMatch(/.*\(\w+(?:\s*[+-]\s*\d+)? (.*)\).*/, attackString) || ''
    attack.damage = _firstMatch(/.*\((\w+(?:\s*[+-]\s*\d+)?).*\).*/, attackString) || ''

    /*
     * If damage doesn't start with a number assume it's special
     * Checking for a dice expression would exclude constant damage values
     */
    if (_firstMatch(/\d+.*/, attack.damage) === null) {
      attack.description.summary = _firstMatch(/.*\((.*)\).*/, attackString) || attack.damage
      attack.damage = '0'
    }
  }
  return {
    name: name,
    type: 'weapon',
    img: EntityImages.imageForItem('weapon'),
    system: attack
  }
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

export default parseNPCs
