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
  pc['data.abilities.str.max'] = pc['data.abilities.str.value']
  pc['data.abilities.agl.max'] = pc['data.abilities.agl.value']
  pc['data.abilities.sta.max'] = pc['data.abilities.sta.value']
  pc['data.abilities.per.max'] = pc['data.abilities.per.value']
  pc['data.abilities.int.max'] = pc['data.abilities.int.value']
  pc['data.abilities.lck.max'] = pc['data.abilities.lck.value']
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

  // Attributes only in upper level exports
  // Alignment
  if (pcObject.alignment) {
    pc['data.details.alignment'] = pcObject.alignment
  }
  // Class
  if (pcObject.className) {
    pc['data.class.className'] = pcObject.className
  }
  // Level
  if (pcObject.level) {
    pc['data.details.level.value'] = pcObject.level
  }
  
  // Crit die and table
  if (pcObject.critDie) {
    pc['data.attributes.critical.die'] = pcObject.critDie
  }
  if (pcObject.critTable) {
    pc['data.attributes.critical.table'] = pcObject.critTable
  }
  // Spell Check
  if (pcObject.spellCheck) {
    pc['data.class.spellCheck'] = pcObject.spellCheck
  }
  // Action Die
  if (pcObject.actionDice) {
    pc['data.config.actionDice'] = pcObject.actionDice
  }
  // Attack Bonus
  if (pcObject.attackBonus) {
    pc['data.details.attackBonus'] = pcObject.attackBonus
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
    pc['data.details.birthAugur'] = pcObject.luckySign
  }
  if (pcObject.languages) {
    notes = notes + game.i18n.localize('DCC.Languages') + ': ' + pcObject.languages + '<br/>'
    pc['data.details.languages'] = pcObject.languages
  }
  if (pcObject.racialTraits) {
    notes = notes + pcObject.racialTraits + '<br/>'
  }
  if (pcObject.spells) {
    for (const spell of pcObject.spells) {
      notes = notes + spell.level + ') ' + spell.name + '<br/>'
    }
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

  // Try parsing as a zero level first
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

  // See if upper level fields are present
  if (!pcObject.occTitle) {
    pcObject.occTitle = _firstMatch(pcString.match(/Occupation:\s+(.+)[;\n$]/))
    pcObject.armorClass = _firstMatch(pcString.match(/AC:\s+\((\d+)\)\*?/)) || pcObject.armorClass
    pcObject.critDie = _firstMatch(pcString.match(/Crit Die\/Table:\s+(1d\d+)\/.*[;\n$]/))
    pcObject.critTable = _firstMatch(pcString.match(/Crit Die\/Table:\s+1d\d+\/(.*)[;\n$]/))
    pcObject.actionDice = _firstMatch(pcString.match(/Attack Dice:\s+(1d\d+)[;\n$]/))
    pcObject.attackBonus = _firstMatch(pcString.match(/Base Attack Mod:\s+(\d+)[;\n$]/))
    pcObject.spellCheck = _firstMatch(pcString.match(/Spells:\s+\(Spell Check:\s+d20([+-]\d+)\)/))

    const alignmentLevelClass = pcString.match(/(\w+)\s+(\w+)\s+\((\d+)\w+\s+level\)[\n$]/)
    if (alignmentLevelClass && alignmentLevelClass.length == 4) {
      pcObject.alignment = alignmentLevelClass[1][0].toLowerCase()
      pcObject.className = alignmentLevelClass[2]
      pcObject.level = alignmentLevelClass[3]
    }

    if (pcObject.spellCheck) {
      const spellsSection = _firstMatch(pcString.match(/Spells:\s+\(Spell Check:\s+d20[+-]\d+\)\n(.*)/))
      const spells = spellsSection.split('\n')
      pcObject.spells = []
      for (const spell in spells) {
        const levelName = spell.match(/(\d+)\)\s+(.*)$/)
        if (levelName) {
          pcObject.spells.push({
            level: levelName[1],
            name: levelName[2]
          })
        }
      }
    }
  }

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
