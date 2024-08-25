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