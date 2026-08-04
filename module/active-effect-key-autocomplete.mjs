/* global game, foundry, CONFIG, document */

/**
 * Autocomplete for Active Effect attribute keys (#904).
 *
 * Injects a <datalist> of sanctioned DCC attribute keys into the core
 * ActiveEffectConfig sheet and attaches it to each change-row key input,
 * so typing a key offers valid completions instead of requiring users to
 * memorize paths from the docs.
 *
 * Keys are derived from the owning actor's schema where possible (which
 * automatically picks up modifier fields contributed by class mixins and
 * sibling modules) and fall back to the curated
 * `CONFIG.DCC.activeEffectKeyLabels` list when no actor is available
 * (e.g. effects on unowned world items).
 */

// Dice-chain targets and other sanctioned keys that don't follow the
// otherMod / otherBonus / adjustment naming patterns
const EXTRA_SANCTIONED_KEYS = [
  'system.attributes.actionDice.value',
  'system.attributes.critical.die',
  'system.attributes.fumble.die',
  'system.class.luckDie',
  'system.class.backstab'
]

const ATTACK_ADJUSTMENT_PATTERN = /^system\.details\.attack(?:Hit|Damage)Bonus\.(?:melee|missile)\.adjustment$/

/**
 * Is this attribute key a sanctioned Active Effect target?
 * Modifier-style fields only — never the editable base values
 * (see docs/user-guide/Active-Effects.md).
 * @param {string} key - Full attribute key path (e.g. 'system.saves.ref.otherBonus')
 * @returns {boolean}
 */
export function isSanctionedEffectKey (key) {
  // Covers both nested fields (`saves.ref.otherBonus`) and camelCase
  // composites (`class.spellCheckOtherMod`)
  return key.endsWith('.otherMod') || key.endsWith('OtherMod') ||
    key.endsWith('.otherBonus') || key.endsWith('OtherBonus') ||
    ATTACK_ADJUSTMENT_PATTERN.test(key) ||
    EXTRA_SANCTIONED_KEYS.includes(key)
}

/**
 * Find the actor an effect will apply to, if determinable
 * @param {ActiveEffect} effect
 * @returns {Actor|null}
 */
function getTargetActor (effect) {
  const parent = effect?.parent
  if (parent?.documentName === 'Actor') return parent
  if (parent?.documentName === 'Item' && parent.parent?.documentName === 'Actor') return parent.parent
  return null
}

/**
 * Localized label for a sanctioned key. Prefers the curated label map;
 * skill keys fall back to the label stored in the actor's skill data so
 * class-specific overrides (e.g. elf Heightened Senses) and sibling-module
 * skills label themselves.
 * @param {string} key - Full attribute key path
 * @param {Actor|null} actor - Owning actor, if any
 * @returns {string} - Localized label, or '' if none is known
 */
function labelForKey (key, actor) {
  const skillMatch = key.match(/^system\.skills\.([^.]+)\.otherMod$/)
  const skillLabel = skillMatch ? actor?.system?.skills?.[skillMatch[1]]?.label : null
  const labelKey = skillLabel ?? CONFIG.DCC.activeEffectKeyLabels[key]
  return labelKey ? game.i18n.localize(labelKey) : ''
}

/**
 * Build the autocomplete options for an effect's attribute-key inputs.
 * @param {ActiveEffect} effect - The effect being configured
 * @returns {Array<{value: string, label: string}>}
 */
export function getEffectKeyOptions (effect) {
  const actor = getTargetActor(effect)
  if (actor?.system) {
    const flat = foundry.utils.flattenObject(actor.system.toObject())
    const keys = Object.keys(flat)
      .map(key => `system.${key}`)
      .filter(isSanctionedEffectKey)
    if (keys.length) {
      return keys.map(key => ({ value: key, label: labelForKey(key, actor) }))
    }
  }

  // No actor context (unowned item) or nothing matched (e.g. Party actors):
  // offer the full curated list
  return Object.entries(CONFIG.DCC.activeEffectKeyLabels)
    .map(([value, labelKey]) => ({ value, label: game.i18n.localize(labelKey) }))
}

/**
 * renderActiveEffectConfig hook: inject/update the key datalist and point
 * every change-row key input at it. Runs on every render, so rows added
 * via the sheet's own add-change control pick the datalist up too.
 * @param {ActiveEffectConfig} app - The effect config application
 * @param {HTMLElement} element - The application's root element
 */
export function onRenderActiveEffectConfig (app, element) {
  const options = getEffectKeyOptions(app.document)
  if (!options.length) return

  const listId = `${app.id}-effect-key-list`
  let datalist = element.querySelector('datalist.dcc-effect-key-list')
  if (!datalist) {
    datalist = document.createElement('datalist')
    datalist.className = 'dcc-effect-key-list'
    datalist.id = listId
    element.appendChild(datalist)
  }
  datalist.replaceChildren(...options.map(({ value, label }) => {
    const option = document.createElement('option')
    option.value = value
    if (label) option.label = label
    return option
  }))

  for (const input of element.querySelectorAll('input[name^="system.changes."][name$=".key"]')) {
    input.setAttribute('list', listId)
  }
}
