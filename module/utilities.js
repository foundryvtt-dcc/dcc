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
  const firstDie = value.match(/\d\d?d\d\d?/)
  return firstDie || ''
}

/**
 * Get the first modifier in a string expression
 * @param {string} value - value to extract first modifier from
 * @return {string} - first modifier expression or an empty string if none
 */
export function getFirstMod (value) {
  const firstMod = value.match(/[+-]\d\d?/)
  return firstMod || ''
}

/**
 * Create an inline roll expression
 * @param {DCCRoll} roll - value to ensure has a plus
 * @param {string} type - value to add as data-<type> to the link
 * @return {string} - An inline roll expression built from teh roll
 */
export function createInlineRollHTML (roll, type = 'damage') {
  const rollData = encodeURIComponent(JSON.stringify(roll))
  let iconClass = 'fa-dice-d20'
  if (roll.dice[0]?.faces === 6) {
    iconClass = 'fa-dice-d6'
  }
  return `<a class="inline-roll inline-result" data-roll="${rollData}" data-${type}="${roll.total}">
            <i class="fas ${iconClass}"></i> ${roll.total}</a>`
}

/**
 * Draw a result from the crit table
 * @param roll - roll instance to use
 * @param critTableName - name of the crit table - like 'III'
 */
export async function getCritTableResult (roll, critTableName) {
  // Lookup the crit table if available
  let critResult = null
  for (const criticalHitPackName of CONFIG.DCC.criticalHitPacks.packs) {
    if (criticalHitPackName) {
      const pack = game.packs.get(criticalHitPackName)
      if (pack) {
        await pack.getIndex() // Load the compendium index
        const critTableFilter = critTableName

        const entry = pack.index.find((entity) => entity.name.startsWith(critTableFilter))
        if (entry) {
          const table = await pack.getDocument(entry._id)
          critResult = await table.draw({ roll, displayChat: false })
          return critResult
        }
      }
    }
  }
}

/**
 * Draw a result from the fumble table
 * @param roll - roll instance to use
 */
export async function getFumbleTableResult (roll) {
// Lookup the fumble table if available
  let fumbleResult = null
  const fumbleTableName = CONFIG.DCC.fumbleTable
  if (fumbleTableName) {
    const fumbleTablePath = fumbleTableName.split('.')
    let pack
    if (fumbleTablePath.length === 3) {
      pack = game.packs.get(fumbleTablePath[0] + '.' + fumbleTablePath[1])
    }
    if (pack) {
      await pack.getIndex() // Load the compendium index
      const entry = pack.index.find((entity) => entity.name === fumbleTablePath[2])
      if (entry) {
        const table = await pack.getDocument(entry._id)
        fumbleResult = await table.draw({ roll, displayChat: false })
        return fumbleResult
      }
    }
  }
}
