/* global game, Roll, ui */

import EntityImages from './entity-images.js'
import DCC from './config.js'

/**
 *  Parses one or more NPC Stat Blocks (e.g. from published modules) into actor data
 *  @param {string} npcString The NPC stat block to import
 *  @return {Promise<Array>}  Array of NPC data for actor creation (currently a single NPC)
 **/
async function parseNPCs (npcString) {
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
      npcObjects.push(await parseNPC(npcSection))
    } catch (e) {
      console.error(e)
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
async function parseNPC (npcString) {
  const npc = {}
  npcString = npcString.replace(/[\n\r]+/g, ' ').replace(/\s{2,}/g, ' ').replace(/^\s+|\s+$/, '')

  npc.name = _firstMatch(/(.*?):.*/, npcString) || 'Unnamed'
  npc.name = npc.name.replace(/ ?\(\d+\)/, '')
  const hd = npc['attributes.hitDice.value'] = _firstMatch(/.*HD ?(.+?)[(;.].*/, npcString) || '1d8'
  const hpRoll = await new Roll(hd).evaluate()
  const hp = hpRoll.total
  npc['attributes.init.value'] = _firstMatch(/.*Init ?(.+?)[;.].*/, npcString) || '+0'
  npc['attributes.ac.value'] = _firstMatch(/.*AC ?(\d+?)[;,.].*/, npcString) || '10'
  npc['attributes.hp.max'] = npc['attributes.hp.value'] = _firstMatch(/.*(?:HP|hp) ?(\d+).*?[;.].*/, npcString) || hp
  npc['attributes.speed.value'] = _firstMatch(/.*MV ?(.+?)[;.].*/, npcString) || '30'
  npc['config.actionDice'] = _firstMatch(/.*Act ?(.+?)[;.].*/, npcString) || '1d20'
  npc['attributes.special.value'] = _firstMatch(/.*SP ?(.+?);.*/, npcString) || ''
  npc['saves.frt.value'] = _firstMatch(/.*Fort ?(.+?)[;,.].*/, npcString) || '+0'
  npc['saves.ref.value'] = _firstMatch(/.*Ref ?(.+?)[;,.].*/, npcString) || '+0'
  npc['saves.wil.value'] = _firstMatch(/.*Will ?(.+?)[;,.].*/, npcString) || '+0'
  npc['details.alignment'] = (_firstMatch(/.*AL ?(.+?)\..*/, npcString) || 'n').toLowerCase()

  /* Crits */
  const hdCount = parseInt(hd.match(/(\d*)d/)[0] || 1) || 0
  let npcType = 'other'
  const npcStringLower = npcString.toLowerCase()
  if (npcStringLower.includes('demon traits')) {
    npcType = 'demon'
  }
  if (npcStringLower.includes('dragon') && npcStringLower.includes('breath')) {
    npcType = 'dragon'
  }
  if (DCC.humanoidHints.some(humanoidType => npcStringLower.includes(humanoidType))) {
    npcType = 'humanoid'
  }
  if (DCC.giants.some(humanoidType => npcStringLower.includes(humanoidType))) {
    if (!DCC.giantsNotGiants.some(humanoidType => npcStringLower.includes(humanoidType))) {
      npcType = 'giant'
    }
  }
  if (npcStringLower.includes('un-dead')) {
    npcType = 'undead'
  }
  const monsterCritInfo = DCC.monsterCriticalHits[hdCount]
  if (monsterCritInfo) {
    npc['attributes.critical.die'] = monsterCritInfo[npcType].die || '1d4'
    npc['attributes.critical.table'] = monsterCritInfo[npcType].table || 'M'
  }

  /* Speed */
  if (npc['attributes.speed.value'].includes('or')) {
    npc['attributes.speed.other'] = _firstMatch(/.* or (.*)/, npc['attributes.speed.value'])
    npc['attributes.speed.value'] = _firstMatch(/(.*) or .*/, npc['attributes.speed.value'])
  }

  npc.attacks = _firstMatch(/.*Atk ?(.+?)[;.].*/, npcString) || ''
  npc.damage = _firstMatch(/.*Dmg ?(.+?)[;.].*/, npcString) || ''

  npc.items = []

  /* Attacks */
  const attackRegex = /(?:^|or )([^]+?)(?= or |$)/gm
  const matches = npc.attacks.matchAll(attackRegex)
  for (const match of matches) {
    const parsedAttack = _parseAttack(match[1], npc.damage)
    if (parsedAttack) {
      npc.items.push(parsedAttack)
    }
  }

  /* Put the full statline into the notes field for reference and to handle data that doesn't get parsed */
  npc['details.notes.value'] = npcString

  return npc
}

/** Parse out an attack string into fields
 * @param {string} attackString  Full weapon string for a single attack
 * @param {string} damageString  Damage string for blocks with damage separate
 */
function _parseAttack (attackString, damageString) {
  const attack = {
    config: {},
    actionDie: '1d20',
    range: '',
    twoHanded: false,
    backstab: false,
    backstabDamage: null,
    description: {
      value: ''
    }
  }
  const name = _firstMatch(/(.*?) [+-].*/, attackString) || attackString
  attack.toHit = _firstMatch(/.*? ([+-].*?) .*/, attackString) || ''
  attack.config.attackBonusOverride = attack.toHit
  attack.damage = ''
  attack.melee = !(attackString.includes('ranged') || attackString.includes('missile'))
  if (damageString) {
    attack.damage = damageString
  } else {
    attack.description.value = _firstMatch(/.*\(\w+(?:\s*[+-]\s*\d+)? (.*)\).*/, attackString) || ''
    attack.damage = _firstMatch(/.*\((\w+(?:\s*[+-]\s*\d+)?).*\).*/, attackString) || ''

    /*
     * If damage doesn't start with a number assume it's special
     * Checking for a roll expression would exclude constant damage values
     */
    if (_firstMatch(/(\d+.*)/, attack.damage) === '') {
      attack.description.summary = _firstMatch(/.*\((.*)\).*/, attackString) || attack.damage
      attack.damage = '0'
    }
  }
  if (attack.damage.includes('+') || attack.damage.includes('-')) {
    attack.config.damageOverride = attack.damage
  }
  return {
    name,
    type: 'weapon',
    img: EntityImages.imageForItem('weapon'),
    system: attack
  }
}

/**
 * Match a regex against the string provided and return the first match group or null
 * @param {RegExp} regex       Regular expression to match against, containing at least one group
 * @param {string} string     The string to match against
 *
 * @return {string} First matched group or '' if no match
 */
function _firstMatch (regex, string) {
  const result = string.match(regex)
  if (result && result.length > 0) {
    if (typeof result[1] === 'string') {
      return result[1].trim()
    }
  }
  return ''
}

export default parseNPCs
