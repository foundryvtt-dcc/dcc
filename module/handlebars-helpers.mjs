/**
 * Handlebars helpers for DCC templates.
 *
 * Each helper is exported individually so the unit tests can call them as
 * pure functions; `registerDCCHandlebarsHelpers()` is the production
 * entry-point invoked from `module/dcc.js`'s `init` hook.
 */

export function add (object1, object2) {
  return parseInt(object1) + parseInt(object2)
}

export function stringify (object) {
  return JSON.stringify(object)
}

export function distanceFormat (object) {
  const fields = String(object).match(/(-?\d+)'?/)
  if (fields) {
    return fields[1] + '\''
  } else {
    return ''
  }
}

export function dccPackExists (pack, options) {
  return new Handlebars.SafeString(game.packs.get(pack) ? options.fn(this) : options.inverse(this))
}

export function registerDCCHandlebarsHelpers () {
  Handlebars.registerHelper('add', add)
  Handlebars.registerHelper('stringify', stringify)
  Handlebars.registerHelper('distanceFormat', distanceFormat)
  Handlebars.registerHelper('dccPackExists', dccPackExists)
}
