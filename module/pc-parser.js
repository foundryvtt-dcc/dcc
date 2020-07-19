/**
 *  Parses Player Stat Blocks (e.g. from Purple Sorceror) into an NPC sheet
 *
 *  @param {string} pcString the player stat block to import
 *  @return {Object}        Player character object
 **/
function parsePC (pcString) {
  try {
    const pcObject = JSON.parse(pcString)
    return _parseJSONPC(pcObject);
  } catch (e) {
    return _parsePlainPC(pcString);
  }
}

/**
 *  Parses Purple Sorcerer JSON zero level character into a PC sheet
 *
 *  @param {Object} pcObject the JSON object to import
 *  @return {Object}        Player character object
 **/
function _parseJSONPC (pcObject)
{
  let pc = {}
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
    pc['data.items.weapons.m1.name'] = pcObject.weapon
    pc['data.items.weapons.m1.toHit'] = pcObject.attackMod || 0
    pc['data.items.weapons.m1.damage'] = pcObject.attackDamage || '1d3'
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
    notes = notes + game.i18n.localize('DCC.Equipment') + ':\n'
    if (pcObject.equipment) {
      notes = notes + '  ' + pcObject.equipment + '\n'
    }
    if (pcObject.equipment2) {
      notes = notes + '  ' + pcObject.equipment2 + '\n'
    }
    if (pcObject.equipment3) {
      notes = notes + '  ' + pcObject.equipment3 + '\n'
    }
    if (pcObject.tradeGood) {
      notes = notes + '  ' + pcObject.tradeGood + ' (' + game.i18n.localize('DCC.TradeGoods') + ')\n'
    }
    notes = notes + '\n'
  }
  // Other attributes if present
  if (pcObject.startingFunds) {
    notes = notes + game.i18n.localize('DCC.StartingFunds') + ': ' + pcObject.startingFunds + '\n'
  }
  if (pcObject.luckySign) {
    notes = notes + game.i18n.localize('DCC.BirthAugur') + ': ' + pcObject.luckySign + '\n'
  }
  if (pcObject.languages) {
    notes = notes + game.i18n.localize('DCC.Languages') + ': ' + pcObject.languages + '\n'
  }
  if (pcObject.racialTraits) {
    notes = notes + pcObject.racialTraits + '\n'
  }
  pc['data.details.notes.value'] = notes
  return pc;
}

/**
 * Parses Purple Sorceror plain text character into a PC sheet
 *
 *  @param {String}         pcString the plain text character to import
 *  @return {Object}        Player character object
 **/
 function _parsePlainPC (pcString)
 {
  let pc = {}
  return pc;
 }

export default parsePC
