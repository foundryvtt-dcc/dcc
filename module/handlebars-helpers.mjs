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

/**
 * Format a stored distance for display: a single number (with or without a
 * foot mark) renders as `30'`. Anything else, such as `25/50/100`, `fly 40'`
 * or `none`, is returned unchanged. Inputs that submit on change use this as
 * their value, so dropping the rest of the text would delete it (#1044).
 */
export function distanceFormat (object) {
  const text = String(object ?? '').trim()
  const single = text.match(/^(-?\d+)\s*['’]?$/)
  return single ? single[1] + '\'' : text
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
