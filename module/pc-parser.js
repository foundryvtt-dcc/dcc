/* global game */

/**
 *  Parses Player Stat Blocks (e.g. from Purple Sorceror) into an NPC sheet
 *
 *  @param {string} pcString the player stat block to import
 *  @return {Object}        Player character object
 **/
function parsePC (pcString) {
  try {
    const pcObject = JSON.parse(pcString)
    return _parseJSONPC(pcObject)
  } catch (e) {
    return _parseJSONPC(_parsePlainPCToJSON(pcString))
  }
}

/**
 *  Parses Purple Sorcerer JSON zero level character into a PC sheet
 *
 *  @param {Object} pcObject the JSON object to import
 *  @return {Object}        Player character object
 **/
function _parseJSONPC (pcObject) {
  const pc = {}
  pc['data.details.occupation.value'] = pcObject.occTitle || ''
  pc['data.abilities.str.value'] = pcObject.strengthScore || 10
  pc['data.abilities.agl.value'] = pcObject.agilityScore || 10
  pc['data.abilities.sta.value'] = pcObject.staminaScore || 10
  pc['data.abilities.per.value'] = pcObject.personalityScore || 10
  pc['data.abilities.int.value'] = pcObject.intelligenceScore || 10
  pc['data.abilities.lck.value'] = pcObject.luckScore || 10
  pc['data.attributes.ac.value'] = pcObject.armorClass || 10
  if (pcObject.hitPoints) {
    pc['data.attributes.hp.value'] = pc['data.attributes.hp.max'] = pcObject.hitPoints
  }
  if (pcObject.weapon) {
    pc.items = [{
      name: pcObject.weapon,
      type: 'weapon',
      data: {
        config: { inheritActionDie: true },
        actionDie: '1d20',
        toHit: pcObject.attackMod || '0',
        damage: pcObject.attackDamage || '1d3',
        melee: true, // No way to know, but melee is most likely
        range: '',
        twoHanded: false,
        backstab: false,
        backstabDamage: null,
        description: {
          value: ''
        }
      }
    }]
  }
  pc['data.attributes.speed.value'] = pcObject.speed || 30
  if (pcObject.initiative) {
    pc['data.attributes.init.value'] = pcObject.initiative
  }
  if (pcObject.saveReflex) {
    pc['data.saves.ref.value'] = pcObject.saveReflex
  }
  if (pcObject.saveFort) {
    pc['data.saves.frt.value'] = pcObject.saveFort
  }
  if (pcObject.saveWill) {
    pc['data.saves.wil.value'] = pcObject.saveWill
  }

  // Remaining character attributes go in notes until there is a better place
  let notes = ''
  // Equipment block
  if (pcObject.equipment || pcObject.equipment2 || pcObject.equipment3 || pcObject.tradeGood) {
    notes = notes + game.i18n.localize('DCC.Equipment') + ':<br/>'
    if (pcObject.equipment) {
      notes = notes + '  ' + pcObject.equipment + '<br/>'
    }
    if (pcObject.equipment2) {
      notes = notes + '  ' + pcObject.equipment2 + '<br/>'
    }
    if (pcObject.equipment3) {
      notes = notes + '  ' + pcObject.equipment3 + '<br/>'
    }
    if (pcObject.tradeGood) {
      notes = notes + '  ' + pcObject.tradeGood + ' (' + game.i18n.localize('DCC.TradeGoods') + ')<br/>'
    }
    notes = notes + '<br/>'
  }
  // Other attributes if present
  if (pcObject.startingFunds) {
    notes = notes + game.i18n.localize('DCC.StartingFunds') + ': ' + pcObject.startingFunds + '<br/>'
  }
  if (pcObject.luckySign) {
    notes = notes + game.i18n.localize('DCC.BirthAugur') + ': ' + pcObject.luckySign + '<br/>'
  }
  if (pcObject.languages) {
    notes = notes + game.i18n.localize('DCC.Languages') + ': ' + pcObject.languages + '<br/>'
  }
  if (pcObject.racialTraits) {
    notes = notes + pcObject.racialTraits + '<br/>'
  }
  pc['data.details.notes.value'] = notes
  return pc
}

/**
 * Parses Purple Sorcerer plain text character into a PC sheet
 *
 *  @param {String}         pcString the plain text character to import
 *  @return {Object}        Player character object
 **/
function _parsePlainPCToJSON (pcString) {
  const pcObject = {}
  pcString = pcString.replace(/[\n\r]+/g, '\n').replace(/\s{2,}/g, ' ').replace(/^\s+|\s+$/, '')

  pcObject.occTitle = _firstMatch(pcString.match(/0-level Occupation:\s+(.+)[;\n$]/))

  pcObject.strengthScore = _firstMatch(pcString.match(/Strength:\s+(\d+)\s+\([+-]?\d+\)[;\n$]/))
  pcObject.agilityScore = _firstMatch(pcString.match(/Agility:\s+(\d+)\s+\([+-]?\d+\)[;\n$]/))
  pcObject.staminaScore = _firstMatch(pcString.match(/Stamina:\s+(\d+)\s+\([+-]?\d+\)[;\n$]/))
  pcObject.personalityScore = _firstMatch(pcString.match(/Personality:\s+(\d+)\s+\([+-]?\d+\)[;\n$]/))
  pcObject.intelligenceScore = _firstMatch(pcString.match(/Intelligence:\s+(\d+)\s+\([+-]?\d+\)[;\n$]/))
  pcObject.luckScore = _firstMatch(pcString.match(/Luck:\s+(\d+)\s+\([+-]?\d+\)[;\n$]/))

  pcObject.armorClass = _firstMatch(pcString.match(/AC:\s+(\d+)[;\n$]/))
  pcObject.hitPoints = _firstMatch(pcString.match(/HP:\s+(\d+)[;\n$]/))

  const weaponString = pcString.match(/Weapon:\s+(.*)[;\n$]/)
  const weapon = weaponString.length > 0 ? _parseWeapon(weaponString[1]) : null
  if (weapon) {
    pcObject.weapon = weapon.name
    pcObject.attackMod = weapon.attackMod
    pcObject.attackDamage = weapon.attackDamage
  }

  pcObject.speed = _firstMatch(pcString.match(/Speed:\s+(\d+)[;\n$]/))
  pcObject.initiative = _firstMatch(pcString.match(/Init:\s+([+-]?\d+)[;\n$]/))
  pcObject.saveReflex = _firstMatch(pcString.match(/Ref:\s+([+-]?\d+)[;\n$]/))
  pcObject.saveFort = _firstMatch(pcString.match(/Fort:\s+([+-]?\d+)[;\n$]/))
  pcObject.saveWill = _firstMatch(pcString.match(/Will:\s+([+-]?\d+)[;\n$]/))

  pcObject.equipment = _firstMatch(pcString.match(/Equipment:\s+(.*)[;\n$]/))
  pcObject.tradeGood = _firstMatch(pcString.match(/Trade good:\s+(.*)[;\n$]/))
  pcObject.startingFunds = _firstMatch(pcString.match(/Starting Funds:\s+(.*)[;\n$]/))
  pcObject.luckySign = _firstMatch(pcString.match(/Lucky sign:\s+(.*)[;\n$]/))
  pcObject.languages = _firstMatch(pcString.match(/Languages:\s+(.*)[;\n$]/))
  pcObject.racialTraits = _firstMatch(pcString.match(/Racial Traits:\s+(.*)[;\n$]/))

  return pcObject
}

/** Return first match or null from a regex match result
 * @param {Array} Match result
 *
 * @ return {string} First matched group or null if no match
 */
function _firstMatch (result) {
  return (result && result.length > 0) ? result[1] : null
}

function _parseWeapon (weaponString) {
  const weaponData = weaponString.match(/^(.*)\s+([+-]?\d+)\s+\((.+)\)$/)
  if (weaponData.length > 0) {
    return {
      name: weaponData[1],
      attackMod: weaponData[2],
      attackDamage: weaponData[3]
    }
  }

  return null
}

export default parsePC
