/* global Handlebars, game */

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

/**
 * Render an action-die slot's display label, e.g. `1d20` or `1d20+4`.
 *
 * The lib's `parseActionDice` normalizes the die to `d20` (no leading
 * count); for the sheet chip we want the human form `1d20`, plus the
 * slot's own `+N` rider when present. Defensive against partial/absent
 * slot objects so a malformed list never breaks sheet render.
 * @param {{die?: string, modifier?: number}} slot
 * @returns {string}
 */
export function actionDieLabel (slot) {
  if (!slot || typeof slot.die !== 'string') return ''
  const die = /^d/i.test(slot.die) ? `1${slot.die}` : slot.die
  const modifier = parseInt(slot.modifier) || 0
  if (modifier > 0) return `${die}+${modifier}`
  if (modifier < 0) return `${die}${modifier}`
  return die
}

export function registerDCCHandlebarsHelpers () {
  Handlebars.registerHelper('add', add)
  Handlebars.registerHelper('stringify', stringify)
  Handlebars.registerHelper('distanceFormat', distanceFormat)
  Handlebars.registerHelper('dccPackExists', dccPackExists)
  Handlebars.registerHelper('actionDieLabel', actionDieLabel)
}
