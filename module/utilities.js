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

// Get the first Die in a string
export function getFirstDie (value) {
  const firstDie = value.match(/\d\d?d\d\d?/)
  return firstDie || ''
}

export function getFirstMod (value) {
  const firstMod = value.match(/[+-]\d\d?/)
  return firstMod || ''
}

export function createInlineRollHTML (roll) {
  const rollData = encodeURIComponent(JSON.stringify(roll))
  let iconClass = 'fa-dice-d20'
  if (roll.dice[0]?.faces === 6) {
    iconClass = 'fa-dice-d6'
  }
  return `<a class="inline-roll inline-result" data-roll="${rollData}" data-damage="${roll.total}">
            <i class="fas ${iconClass}"></i> ${roll.total}</a>`
}

/** Draw a result from the crit table
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