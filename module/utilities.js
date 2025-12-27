/* global game, CONFIG */

/**
 * Ensure modifiers have a + on the front of them if they aren't negative
 * @param {string} value - value to ensure has a plus
 * @param {boolean} includeZero - if true, will return +0 if the value is 0
 * @return {string} - value with + on the front if zero or positive
 */
// Force a + on the front of positive strings
export function ensurePlus (value, includeZero = true) {
  let sign = ''
  if (parseInt(value) >= 0 && value[0] !== '+') {
    sign = '+'
  }
  if (value[0] === 'd') {
    sign = '+'
  }
  if (!includeZero && parseInt(value) === 0) {
    return ''
  }
  return `${sign}${value}`
}

/**
 * Get the first die in a string expression
 * @param {string} value - value to extract first die from
 * @return {string} - first die expression or an empty string if none
 */
export function getFirstDie (value) {
  if (!value) {
    return ''
  }
  const firstDie = value.match(/\d\d?d\d\d?/)
  if (!firstDie) {
    return ''
  }
  return firstDie[0] || ''
}

/**
 * Get the first modifier in a string expression
 * @param {string} value - value to extract first modifier from
 * @return {string} - first modifier expression or an empty string if none
 */
export function getFirstMod (value) {
  const firstMod = value.match(/[+-]\d\d?/)
  return firstMod ? firstMod[0] : ''
}

/**
 * Draw a result from the crit table
 * @param roll - roll instance to use
 * @param critTableName - name of the crit table - like 'Crit Table III' -- might be localized, e.g. "Table d'critique III"
 */
export async function getCritTableResult (roll, critTableName) {
  // Make sure the roll is evaluated first
  if (!roll._evaluated) {
    await roll.evaluate()
  }

  // Extract the crit table suffix (e.g. "III" from "Crit Table III" or "T. dei Critici III")
  // The table name might be passed as either "Crit Table III" (English) or localized
  let critTableSuffix = critTableName

  // First try to remove the English "Crit Table " prefix (with space)
  if (critTableName.startsWith('Crit Table ')) {
    critTableSuffix = critTableName.substring('Crit Table '.length).trim()
  } else {
    // If not English, try with the localized text
    const critTableText = game.i18n.localize('DCC.CritTable')
    if (critTableName.startsWith(critTableText)) {
      critTableSuffix = critTableName.substring(critTableText.length).trim()
    }
  }

  let critTableCanonical = 'Crit Table ' + critTableSuffix

  // Check to see if this is the Elemental Crit/Fumble table
  if (critTableSuffix === 'EL') {
    critTableCanonical = 'Crit/Fumble Table EL'
    CONFIG.DCC.criticalHitPacks.addPack('dcc-core-book.dcc-monster-fumble-tables')
  }

  // Lookup the crit table if available
  let critResult = null
  for (const criticalHitPackName of CONFIG.DCC?.criticalHitPacks?.packs || []) {
    if (criticalHitPackName) {
      const pack = game.packs.get(criticalHitPackName)
      if (pack) {
        const entry = pack.index.find((entity) => entity.name.startsWith(critTableCanonical))
        if (entry) {
          const table = await pack.getDocument(entry._id)
          critResult = table.getResultsForRoll(roll.total)
          return critResult[0] || 'Unable to find crit result'
        }
      }
    }
  }

  // Try in the local world if we've gotten this far and not returned
  const worldCritTables = game.tables.find((entity) => entity.name.startsWith(critTableCanonical))
  if (worldCritTables) {
    critResult = worldCritTables.getResultsForRoll(roll.total)
    return critResult[0] || 'Unable to find crit result'
  }
}

/**
 * Get a link to the crit table if available, otherwise return plain text
 * @param {string} critTableSuffix - The crit table suffix (e.g. "III", "IV")
 * @param {string} displayText - The text to display for the link
 * @returns {string} - A UUID link if the table is found, otherwise just the display text
 */
export async function getCritTableLink (critTableSuffix, displayText) {
  let critTableCanonical = 'Crit Table ' + critTableSuffix

  // Check to see if this is the Elemental Crit/Fumble table
  if (critTableSuffix === 'EL') {
    critTableCanonical = 'Crit/Fumble Table EL'
  }

  // Look up the crit table in compendium packs
  for (const criticalHitPackName of CONFIG.DCC?.criticalHitPacks?.packs || []) {
    if (criticalHitPackName) {
      const pack = game.packs.get(criticalHitPackName)
      if (pack) {
        const entry = pack.index.find((entity) => entity.name.startsWith(critTableCanonical))
        if (entry) {
          return `@UUID[Compendium.${criticalHitPackName}.${entry._id}]{${displayText}}`
        }
      }
    }
  }

  // Try in the local world
  const worldCritTable = game.tables.find((entity) => entity.name.startsWith(critTableCanonical))
  if (worldCritTable) {
    return `@UUID[RollTable.${worldCritTable.id}]{${displayText}}`
  }

  // No table found, return plain text
  return displayText
}

/**
 * Draw a result from the fumble table
 * @param roll - roll instance to use
 * @param localTableName - name of the local world table to check first (e.g. 'Table 4-2: Fumbles')
 */
export async function getFumbleTableResult (roll, localTableName = 'Table 4-2: Fumbles') {
  // First check for a local world table
  const worldFumbleTable = game.tables.find((entity) => entity.name === localTableName)
  if (worldFumbleTable) {
    const fumbleResult = worldFumbleTable.getResultsForRoll(roll.total)
    return fumbleResult[0] || 'Unable to find fumble result'
  }

  // Lookup the fumble table in compendium packs if available
  const fumbleTableName = CONFIG.DCC.fumbleTable
  if (fumbleTableName) {
    const fumbleTablePath = fumbleTableName.split('.')
    let pack
    if (fumbleTablePath.length === 3) {
      pack = game.packs.get(fumbleTablePath[0] + '.' + fumbleTablePath[1])
    }
    if (pack) {
      const entry = pack.index.find((entity) => entity.name === fumbleTablePath[2])
      if (entry) {
        const table = await pack.getDocument(entry._id)
        const fumbleResult = table.getResultsForRoll(roll.total)
        return fumbleResult[0] || 'Unable to find fumble result'
      }
    }
  }
}

/**
 * Determine the fumble table name from a crit table name
 * @param {string} critTableName - name of the crit table - like 'III'
 * @return {string} - fumble table name - like 'Fumble Table H'
 */
export function getFumbleTableNameFromCritTableName (critTableName) {
  if (!critTableName) {
    return '(Table 4-2: Fumbles).' // Default PC fumble table
  }
  const humanoidCritTables = ['III', 'IV', 'V']
  if (humanoidCritTables.some(ctn => critTableName.includes(ctn))) {
    return 'Fumble Table H'
  }
  // Check for EL suffix (works with both English and localized)
  if (critTableName === 'EL' || critTableName.endsWith(' EL')) {
    return 'Crit/Fumble Table EL'
  }
  return `Fumble Table ${critTableName}`
}

/**
 * Draw a result from the monster fumble table
 * @param roll - roll instance to use
 * @param fumbleTableName - name of the fumble table - like 'Fumble Table M'
 */
export async function getNPCFumbleTableResult (roll, fumbleTableName) {
// Lookup the fumble table if available
  if (fumbleTableName) {
    const fumblePackName = 'dcc-core-book.dcc-monster-fumble-tables'
    const pack = game.packs.get(fumblePackName)
    if (pack) {
      const entry = pack.index.filter((entity) => entity.name.startsWith(fumbleTableName))
      if (entry.length > 0) {
        const table = await pack.getDocument(entry[0]._id)
        const fumbleResult = table.getResultsForRoll(roll.total)
        return fumbleResult[0] || 'Unable to find fumble result'
      }
    }
  }
}
