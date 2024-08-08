export function signOrBlank (value) {
  let sign = ''
  if (parseInt(value) >= 0 && value[0] !== '+') {
    sign = '+'
  }
  return `${sign}${value}`
}