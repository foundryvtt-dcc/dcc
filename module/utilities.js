//Force a + on the front of positive strings
export function addPlus (value) {
  let sign = ''
  if (parseInt(value) >= 0 && value[0] !== '+') {
    sign = '+'
  }
  if (value[0] === 'd') {
    sign = '+'
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