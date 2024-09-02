/* global game, ui, CONFIG */

import EntityImages from './entity-images.js'
import { getFirstDie, getFirstMod } from './utilities.js'

/**
 *  Parses Player Stat Blocks (e.g. from Purple Sorcerer) into an Actor sheet
 *
 *  @param {string} pcString The player stat block to import
 *  @return {Array}          Array of player character objects to create
 **/
function parsePCs (pcString) {
  try {
    const pcObject = JSON.parse(pcString)
    return _parseJSONPCs(pcObject)
  } catch (e) {
    // console.error(e) // Debug only
    return _parseJSONPCs(_splitAndParsePlainPCsToJSON(pcString))
  }
}

/**
 *  Parses Purple Sorcerer JSON zero level character into a PC sheet
 *
 *  @param {Object} pcObject The JSON object to import
 *  @return {Array}          Array of character objects
 **/
function _parseJSONPCs (pcObject) {
  // A full 500 character JSON object has a 'characters' array at the root
  if (pcObject.characters) {
    return pcObject.characters.map(x => _parseJSONPCs(x)[0])
    // Otherwise we're looking at a JSON object representing a single character
  } else {
    const pc = {}
    if (pcObject.name) {
      pc.name = pcObject.name
    }
    pc['details.occupation.value'] = pcObject.occTitle || ''
    pc['abilities.str.value'] = pcObject.strengthScore || 10
    pc['abilities.agl.value'] = pcObject.agilityScore || 10
    pc['abilities.sta.value'] = pcObject.staminaScore || 10
    pc['abilities.per.value'] = pcObject.personalityScore || 10
    pc['abilities.int.value'] = pcObject.intelligenceScore || 10
    pc['abilities.lck.value'] = pcObject.luckScore || 10
    pc['abilities.str.max'] = pc['abilities.str.value']
    pc['abilities.agl.max'] = pc['abilities.agl.value']
    pc['abilities.sta.max'] = pc['abilities.sta.value']
    pc['abilities.per.max'] = pc['abilities.per.value']
    pc['abilities.int.max'] = pc['abilities.int.value']
    pc['abilities.lck.max'] = pc['abilities.lck.value']
    pc['attributes.ac.value'] = pcObject.armorClass || 10
    if (pcObject.hitPoints) {
      pc['attributes.hp.value'] = pc['attributes.hp.max'] = pcObject.hitPoints
    }
    let hitDice = '1d4'
    if (pcObject.className) {
      hitDice = CONFIG.DCC.hitDiePerClass[pcObject.className.toLowerCase()]
    }
    pc['attributes.hitDice.value'] = hitDice
    pc.items = []
    if (pcObject.weapons) {
      for (const weapon of pcObject.weapons) {
        // Split damage into weapon damage and bonus
        const damageWeapon = getFirstDie(weapon.attackDamage)
        const damageWeaponBonus = getFirstMod(weapon.name)

        // Do we need to override the damage or is it standard stuff?
        let damageOverride = ''
        if (weapon.attackDamage.includes('+') || weapon.attackDamage.includes('-')) {
          damageOverride = weapon.attackDamage || '1d3'
        }
        if (weapon.melee === true && (damageWeaponBonus + CONFIG.DCC.abilityModifiers[pc['abilities.str.value']] || getFirstMod(weapon.attackDamage) === 0)) {
          damageOverride = ''
        }
        if (weapon.melee === false && (damageWeaponBonus + CONFIG.DCC.abilityModifiers[pc['abilities.agl.value']] || getFirstMod(weapon.attackDamage) === 0)) {
          damageOverride = ''
        }

        // Do we need to override the toHit or is it standard stuff?
        const attackBonusWeapon = getFirstMod(weapon.name)
        let attackBonusOverride = weapon.attackMod || '0'
        if (weapon.melee === true && (pcObject.attackBonus || 0 + CONFIG.DCC.abilityModifiers[pc['abilities.str.value']] || attackBonusOverride) === 0) {
          attackBonusOverride = ''
        }
        if (weapon.melee === false && (pcObject.attackBonus || 0 + CONFIG.DCC.abilityModifiers[pc['abilities.agl.value']] || attackBonusOverride) === 0) {
          attackBonusOverride = ''
        }

        pc.items.push({
          name: weapon.name,
          type: 'weapon',
          img: weapon.img,
          system: {
            attackBonusWeapon,
            toHit: weapon.attackMod || '0',
            damage: weapon.attackDamage || '1d3',
            damageWeapon,
            damageWeaponBonus,
            config: {
              attackBonusOverride,
              damageOverride
            },
            melee: weapon.melee
          }
        })
      }
    }

    if (pcObject.weapon && !pcObject.weapons) {
      pc.items.push({
        name: pcObject.weapon,
        type: 'weapon',
        img: EntityImages.imageForItem('weapon'),
        system: {
          toHit: pcObject.attackMod || '0',
          damage: pcObject.attackDamage || '1d3',
          melee: true // No way to know, but melee is most likely
        }
      })
    }
    pc['attributes.speed.value'] = pcObject.speed || 30
    if (pcObject.initiative) {
      pc['attributes.init.value'] = pcObject.initiative
    }
    if (pcObject.saveReflex) {
      pc['saves.ref.value'] = pcObject.saveReflex
    }
    if (pcObject.saveFort) {
      pc['saves.frt.value'] = pcObject.saveFort
    }
    if (pcObject.saveWill) {
      pc['saves.wil.value'] = pcObject.saveWill
    }

    // Attributes only in upper level exports
    // Alignment
    if (pcObject.alignment) {
      pc['details.alignment'] = pcObject.alignment
    }
    // Class
    if (pcObject.className) {
      pc['class.className'] = pcObject.className
    }
    // Level
    if (pcObject.level) {
      pc['details.level.value'] = pcObject.level
    }

    // Crit die and table
    if (pcObject.critDie) {
      pc['attributes.critical.die'] = pcObject.critDie
    }
    if (pcObject.critTable) {
      pc['attributes.critical.table'] = pcObject.critTable
    }
    // Spell Check
    if (pcObject.spellCheck) {
      pc['class.spellCheck'] = pcObject.spellCheck
    }
    // Action Die
    if (pcObject.actionDice) {
      pc['config.actionDice'] = pcObject.actionDice
    }
    // Attack Bonus
    if (pcObject.attackBonus) {
      pc['details.attackBonus'] = pcObject.attackBonus
    }
    // Armor
    if (pcObject.armorData) {
      const armor = _parseArmor(pcObject.armorData)
      if (armor) {
        pc.items.push(armor)
      }
    }

    // Remaining character attributes go in notes until there is a better place
    let notes = ''
    // Equipment block
    if (pcObject.equipment || pcObject.equipment2 || pcObject.equipment3 || pcObject.tradeGood) {
      notes = notes + game.i18n.localize('DCC.Equipment') + ':<br/>'
      if (pcObject.equipment) {
        notes = notes + '  ' + pcObject.equipment + '<br/>'
        pc.items.push({
          name: pcObject.equipment,
          type: 'equipment',
          img: EntityImages.imageForItem('equipment')
        })
      }
      if (pcObject.equipment2) {
        notes = notes + '  ' + pcObject.equipment2 + '<br/>'
        pc.items.push({
          name: pcObject.equipment2,
          type: 'equipment',
          img: EntityImages.imageForItem('equipment')
        })
      }
      if (pcObject.equipment3) {
        notes = notes + '  ' + pcObject.equipment3 + '<br/>'
        pc.items.push({
          name: pcObject.equipment3,
          type: 'equipment',
          img: EntityImages.imageForItem('equipment')
        })
      }
      if (pcObject.tradeGood) {
        notes = notes + '  ' + pcObject.tradeGood + ' (' + game.i18n.localize('DCC.TradeGoods') + ')<br/>'
        pc.items.push({
          name: pcObject.tradeGood,
          type: 'equipment',
          img: EntityImages.imageForItem('equipment')
        })
      }
      notes = notes + '<br/>'
    }
    // Other attributes if present
    if (pcObject.startingFunds) {
      notes = notes + game.i18n.localize('DCC.StartingFunds') + ': ' + pcObject.startingFunds + '<br/>'
      pc.items.push(_parseStartingFunds(pcObject.startingFunds))
    }
    if (pcObject.luckySign) {
      notes = notes + game.i18n.localize('DCC.BirthAugur') + ': ' + pcObject.luckySign + '<br/>'
      pc['details.birthAugur'] = pcObject.luckySign
    }
    if (pcObject.languages) {
      notes = notes + game.i18n.localize('DCC.Languages') + ': ' + pcObject.languages + '<br/>'
      pc['details.languages'] = pcObject.languages
    }
    if (pcObject.racialTraits) {
      notes = notes + pcObject.racialTraits + '<br/>'
    }
    if (pcObject.spells) {
      notes = notes + '<br/>Spells:<br/>'
      for (const spell of pcObject.spells) {
        notes = notes + spell.level + ') ' + spell.name + '<br/>'
        pc.items.push({
          name: spell.name,
          img: EntityImages.imageForItem('spell'),
          type: 'spell',
          system: {
            level: spell.level,
            spellCheck: {
              die: '1d20',
              value: pcObject.spellCheck || '0'
            }
          }
        })
      }
    }
    if (pcObject.thiefSkills) {
      // Dump raw skills as notes
      notes = notes + '<br/>Skills:<br/>' + pcObject.thiefSkills.raw.replace(/\n/g, '<br/>')
      delete pcObject.thiefSkills.raw
      // Handle special case thief skills
      pc['class.backstab'] = pcObject.thiefSkills.backstab || '0'
      delete pcObject.thiefSkills.backstab
      pc['skills.castSpellFromScroll.die'] = `1${pcObject.thiefSkills.castSpellFromScroll || 'd10'}`
      delete pcObject.thiefSkills.castSpellFromScroll
      // Halflings use the sneakSilently and hideInShadowsSkills according to the generator
      pc['skills.sneakAndHide.value'] = pcObject.thiefSkills.sneakSilently || '0'
      // Handle standard thief skills
      for (const skill in pcObject.thiefSkills) {
        pc[`skills.${skill}.value`] = pcObject.thiefSkills[skill] || '0'
      }
    }
    pc['details.notes.value'] = notes

    return [pc]
  }
}

/**
 * Splits a set of Purple Sorcerer plain text characters and parses each character
 *
 *  @param {String} pcString  The plain text characters to import
 *  @return {Object}          Object with character property that is an array of player character objects
 **/
function _splitAndParsePlainPCsToJSON (pcString) {
  pcString = pcString.replace(/[\n\r]+/g, '\n').replace(/[ \t]{2,}/g, ' ').replace(/^[ \t]+|[ \t]+$/g, '')

  const pcObjects = []

  // Match the start of either a zero level or an upper level stat block
  const matches = pcString.matchAll(/(0-level Occupation:\s+(.+)[;\n$]|(\w+)\s+(\w+)\s+\((\d+)\w+\s+level\)[\n$])/gm)

  let first = true
  let previousIndex = 0
  for (const match of matches) {
    const matchIndex = match.index

    // First iteration is the PSG header and not a character - skip it
    if (!first) {
      // Parse the previous character using the string up to the next section start
      const pcSection = pcString.substring(previousIndex, matchIndex)
      try {
        pcObjects.push(_parsePlainPCToJSON(pcSection))
      } catch (e) {
        ui.notifications.warn(game.i18n.localize('DCC.ParsePlayerWarning'))
        console.error(e)
      }
    }
    first = false

    previousIndex = matchIndex
  }

  // Parse the final character (if we found any)
  if (!first) {
    const pcSection = pcString.substring(previousIndex, pcString.length)
    try {
      pcObjects.push(_parsePlainPCToJSON(pcSection))
    } catch (e) {
      ui.notifications.warn(game.i18n.localize('DCC.ParsePlayerWarning'))
      console.error(e)
    }
  }

  return {
    characters: pcObjects
  }
}

/**
 * Parses Purple Sorcerer plain text character into a PC sheet
 *
 *  @param {String} pcString The plain text character to import
 *  @return {Array}          Player character object
 **/
function _parsePlainPCToJSON (pcString) {
  const pcObject = {}
  pcString = pcString.replace(/[\n\r]+/g, '\n').replace(/[ \t]{2,}/g, ' ').replace(/^[ \t]+|[ \t]+$/g, '')

  // Name is non-standard, but it's handy to be able to add it to the text before pasting
  pcObject.name = _firstMatch(pcString.match(/Name:\s+(.+)[;\n$]/))

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
  const weapon = (weaponString && weaponString.length > 0) ? _parseWeapon(weaponString[1]) : null
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
    pcObject.armorData = _firstMatch(pcString.match(/AC:\s+\(\d+\)\*?\s+\((.*)\)/))
    pcObject.critDie = _firstMatch(pcString.match(/Crit Die\/Table:\s+(\d+d\d+)\/.*[;\n$]/))
    pcObject.critTable = _firstMatch(pcString.match(/Crit Die\/Table:\s+\d+d\d+\/(.*)[;\n$]/))
    pcObject.actionDice = _firstMatch(pcString.match(/Attack Dice:\s+((?:1d\d+\+?)+)[;\n$]/))
    pcObject.attackBonus = _firstMatch(pcString.match(/Base Attack Mod:\s+(.+)[;\n$]/))
    pcObject.spellCheck = _firstMatch(pcString.match(/Spells:\s+\(Spell Check:\s+d20([+-]\d+)\)/))

    const alignmentLevelClass = pcString.match(/(\w+)\s+(\w+)\s+\((\d+)\w+\s+level\)[\n$]/)
    if (alignmentLevelClass && alignmentLevelClass.length === 4) {
      pcObject.alignment = alignmentLevelClass[1][0].toLowerCase()
      pcObject.className = alignmentLevelClass[2]
      pcObject.level = alignmentLevelClass[3]
    }

    if (pcObject.spellCheck) {
      const spellsSection = _firstMatch(pcString.match(/Spells:\s+\(Spell Check:\s+d20[+-]\d+\)\n((?:.|\n)*)/))
      const spells = spellsSection.split('\n')
      pcObject.spells = []
      for (const spell of spells) {
        const levelName = spell.match(/(\d+)\)\s+(.*)$/)
        if (levelName) {
          pcObject.spells.push({
            level: levelName[1],
            name: levelName[2]
          })
        }
      }
    }

    const thiefSkills = _firstMatch(pcString.match(/Thief Skills:\n((?:.|\n)*)/))
    if (thiefSkills) {
      pcObject.thiefSkills = {
        raw: thiefSkills,
        backstab: _firstMatch(thiefSkills.match(/Backstab:\s+([+-]?\d+)\s+\([+-]?\d+\)/)),
        sneakSilently: _firstMatch(thiefSkills.match(/Sneak Silently:\s+([+-]?\d+)\s+\([+-]?\d+\)/)),
        hideInShadows: _firstMatch(thiefSkills.match(/Hide In Shadows:\s+([+-]?\d+)\s+\([+-]?\d+\)/)),
        pickPockets: _firstMatch(thiefSkills.match(/Pick Pocket:\s+([+-]?\d+)\s+\([+-]?\d+\)/)),
        climbSheerSurfaces: _firstMatch(thiefSkills.match(/Climb Sheer Surfaces:\s+([+-]?\d+)\s+\([+-]?\d+\)/)),
        pickLock: _firstMatch(thiefSkills.match(/Pick Lock:\s+([+-]?\d+)\s+\([+-]?\d+\)/)),
        findTrap: _firstMatch(thiefSkills.match(/Find Trap:\s+([+-]?\d+)\s+\([+-]?\d+\)/)),
        disableTrap: _firstMatch(thiefSkills.match(/Disable Trap:\s+([+-]?\d+)\s+\([+-]?\d+\)/)),
        forgeDocument: _firstMatch(thiefSkills.match(/Forge Document:\s+([+-]?\d+)\s+\([+-]?\d+\)/)),
        disguiseSelf: _firstMatch(thiefSkills.match(/Disguise Self:\s+([+-]?\d+)\s+\([+-]?\d+\)/)),
        readLanguages: _firstMatch(thiefSkills.match(/Read Languages:\s+([+-]?\d+)\s+\([+-]?\d+\)/)),
        handlePoison: _firstMatch(thiefSkills.match(/Handle Poison:\s+([+-]?\d+)\s+\([+-]?\d+\)/)),
        castSpellFromScroll: _firstMatch(thiefSkills.match(/Cast Spell From Scroll\s+\((d\d+)\)/))
      }
    }

    pcObject.weapons = []
    const weapon1String = pcString.match(/Occupation Weapon:[ \t]*([^\n].*)[;\n$]/)
    const weapon1 = (weapon1String && weapon1String.length > 0) ? _parseWeapon(weapon1String[1]) : null
    if (weapon1) {
      pcObject.weapons.push({
        name: weapon1.name,
        img: EntityImages.imageForItem('weapon'),
        attackMod: weapon1.attackMod,
        attackDamage: weapon1.attackDamage,
        melee: weapon1.melee
      })
    }
    const weapon2String = pcString.match(/Main Weapon:[ \t]*([^\n].*)[;\n$]/)
    const weapon2 = (weapon2String && weapon2String.length > 0) ? _parseWeapon(weapon2String[1]) : null
    if (weapon2) {
      pcObject.weapons.push({
        name: weapon2.name,
        img: EntityImages.imageForItem('weapon'),
        attackMod: weapon2.attackMod,
        attackDamage: weapon2.attackDamage,
        melee: weapon2.melee
      })
    }
    const weapon3String = pcString.match(/Secondary Weapon:[ \t]*([^\n].*)[;\n$]/)
    const weapon3 = (weapon3String && weapon3String.length > 0) ? _parseWeapon(weapon3String[1]) : null
    if (weapon3) {
      pcObject.weapons.push({
        name: weapon3.name,
        img: EntityImages.imageForItem('weapon'),
        attackMod: weapon3.attackMod,
        attackDamage: weapon3.attackDamage,
        melee: weapon3.melee
      })
    }
  }

  return pcObject
}

/**
 * Return first match or null from a regex match result
 * @param {RegExpMatchArray} result result
 * @return {string} First matched group or null if no match
 */
function _firstMatch (result) {
  return (result && result.length > 0) ? result[1] : null
}

function _parseWeapon (weaponString) {
  if (weaponString.length === 0) { return }
  const weaponData = weaponString.match(/^(.*)\s+(.+)\s+\((?:dmg\s+)?(.+)\)$/)
  if (weaponData && weaponData.length === 4) {
    let melee = true
    if (!weaponString.match(/melee/)) {
      melee = false
    }
    const damage = weaponData[3].replace('deed', '@ab')
    const name = weaponData[1].replace(/\s+melee/, '').replace(/\s+ranged/, '')
    return {
      name,
      img: EntityImages.imageForItem('weapon'),
      attackMod: weaponData[2],
      attackDamage: damage,
      melee
    }
  }

  return null
}

function _parseArmor (armorString) {
  const armorFields = armorString.match(/(.*)\s+\(([+-]?\d+)\)\s+Check penalty\s+\(([+-]?\d+)\)\s+Fumble die\s+\((d\d+)\)/)

  if (armorFields && armorFields.length === 5) {
    return {
      name: armorFields[1],
      type: 'armor',
      img: EntityImages.imageForItem('armor'),
      system: {
        acBonus: armorFields[2],
        checkPenalty: armorFields[3],
        fumbleDie: '1' + armorFields[4]
      }
    }
  }

  return null
}

function _parseStartingFunds (startingFundsString) {
  const pp = _firstMatch(startingFundsString.match(/(\d+)\s+pp/)) || '0'
  const ep = _firstMatch(startingFundsString.match(/(\d+)\s+ep/)) || '0'
  const gp = _firstMatch(startingFundsString.match(/(\d+)\s+gp/)) || '0'
  const sp = _firstMatch(startingFundsString.match(/(\d+)\s+sp/)) || '0'
  const cp = _firstMatch(startingFundsString.match(/(\d+)\s+cp/)) || '0'
  return {
    name: 'Coins',
    type: 'treasure',
    img: EntityImages.imageForItem('treasure'),
    system: {
      value: {
        pp,
        ep,
        gp,
        sp,
        cp
      },
      isCoins: true
    }
  }
}

export default parsePCs
