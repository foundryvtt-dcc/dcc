/* global foundry, game, CONFIG */

import { critTableDocCache, critTableLinkCache } from './adapter/table-cache.mjs'

/**
 * Remove keys from an update data object that are overridden by active effects
 * Prevents form submission from persisting computed in-memory values,
 * which would cause effect values to accumulate over time (see #714)
 * @param {Actor} document - The actor document with overrides
 * @param {Object} updateData - The update data object to filter
 * @returns {Object} The filtered update data object
 */
export function removeActiveEffectOverrides (document, updateData) {
  const overrides = document.overrides
  if (overrides) {
    // Core stores effect overrides as a nested object (overrides.system.abilities.lck.value),
    // while DCC's derived-stat tracking adds flat dotted keys on top of it — flatten so both
    // forms are matched. updateData may itself be flat (FormDataExtended.object) or expanded
    // (DocumentSheetV2 submit data), so remove each key in whichever form it appears.
    for (const key of Object.keys(foundry.utils.flattenObject(overrides))) {
      if (key in updateData) {
        delete updateData[key]
      } else {
        foundry.utils.deleteProperty(updateData, key)
      }
    }
  }
  return updateData
}

/**
 * Read the special (roll-again) instruction from a mercurial-magic
 * TableResult. Flag-first: `flags.dcc.mercurial` with
 * `{ action: 'rollAgain', count, formula? }` (issue #339). Falls back to
 * a narrow text match covering the two core Table 5-2 entries ("Roll
 * again twice." at 99, and the 4d20 variant at 100+) so tables that
 * pre-date the flags still expand; the fallback can be dropped once
 * dcc-core-book ships flagged entries. `count` is clamped to 1..10
 * against malformed flag data.
 *
 * Shared by the item-sheet roll path (`item/spell-mixin.mjs`) and the
 * adapter table loader (`adapter/spell-input.mjs`, which maps it onto
 * the lib's `entry.special`).
 *
 * @param {Object} tableResult - a TableResult (or plain object in tests)
 * @returns {{action: String, count: Number, formula: String}|null} the
 *   expansion spec, or null for an ordinary (literal) entry
 */
export function getMercurialSpecial (tableResult) {
  const flag = tableResult?.flags?.dcc?.mercurial
  if (flag?.action === 'rollAgain') {
    // Canonicalize the user-authored formula to lowercase NdX(+M) with an
    // explicit count — the lib's parser requires exactly that shape, and a
    // near-miss like 'd6' or '1D8' would otherwise be swept up as flat
    // modifiers, making every sub-roll an identical constant.
    const match = /^(\d*)[dD]([1-9]\d*)([+-]\d+)?$/.exec(String(flag.formula || '').trim())
    return {
      action: 'rollAgain',
      count: Math.max(1, Math.min(10, parseInt(flag.count, 10) || 2)),
      formula: match ? `${match[1] || '1'}d${match[2]}${match[3] || ''}` : '1d100'
    }
  }

  const text = (tableResult?.description || '').trim()
  if (/^roll again twice/i.test(text)) {
    return {
      action: 'rollAgain',
      count: 2,
      formula: /4d20/.test(text) ? '4d20' : '1d100'
    }
  }

  return null
}

/**
 * Wrap a dcc-core-lib mercurial-effect description in HTML paragraphs.
 * The lib joins expanded (roll-again) sub-effect descriptions with a
 * plain `\n\n` (it is renderer-agnostic); browsers collapse that to a
 * space, so each chunk gets its own `<p>` here. A single-effect
 * description (no `\n\n`) comes back as one paragraph unchanged in
 * content.
 *
 * @param {string} description - lib `MercurialEffect.description`
 * @returns {string} HTML string, '' when the description is empty
 */
export function formatMercurialDescriptionHTML (description) {
  if (!description) { return '' }
  return description.split('\n\n').map((block) => `<p>${block}</p>`).join('')
}

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
 * Normalize an action-dice expression to a single die of its first term.
 * 'Act 2d20' means two d20 *actions*, so the per-roll die is always one die
 * of the first listed faces: '2d20' → '1d20', '1d20,1d16' → '1d20',
 * '1d24' → '1d24'. A flat rider on that first die is part of the roll and
 * is kept ('1d20+4' → '1d20+4'), but additional dice are separate actions
 * and are dropped ('1d20+1d16' → '1d20'). Used to mirror the config
 * authoring string onto `attributes.actionDice.value` (importers and
 * migration) and to derive per-roll weapon/spell dies.
 * @param {string} value - action dice expression (comma or plus separated)
 * @return {string} - single-die formula or an empty string if no die found
 */
export function getSingleActionDie (value) {
  const first = String(value || '').split(',')[0]
  const match = first.match(/d(\d+)/)
  if (!match) return ''
  // Rider: flat +N/-N terms directly after the die — but never the count of
  // a following die term ('+1d16' is another action, not a +1 rider).
  const after = first.slice(first.indexOf(match[0]) + match[0].length)
  const rider = after.match(/^(?:[+-]\d+(?!\d*d\d))+/)?.[0] ?? ''
  return `1d${match[1]}${rider}`
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
 * Add #damage flavor to inline dice rolls that are followed by "damage", "additional damage", or "extra damage".
 * This makes the rolls clickable as damage rolls in chat, enabling "Apply Damage" context option.
 * Only modifies rolls that don't already have a flavor and are specifically damage rolls.
 * @param {string} text - Text containing inline roll syntax like [[1d6]]
 * @returns {string} - Text with #damage added to damage rolls, e.g. [[1d6 #damage]] damage
 */
export function addDamageFlavorToRolls (text) {
  if (!text) return text
  // Match inline rolls that contain dice notation (XdY) but don't already have a # flavor
  // Only match when followed by optional horizontal whitespace and "damage" (with optional "additional" or "extra" prefix)
  // Uses positive lookahead to check for "damage" without consuming it
  // Uses [ \t] instead of \s to avoid matching across newlines/sentences
  return text.replace(/\[\[([^\]#]*\d+d\d+[^\]#]*)\]\](?=[ \t]*(?:additional[ \t]+|extra[ \t]+)?damage)/gi, '[[$1 #damage]]')
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

  // Check to see if this is the Elemental Crit/Fumble table.
  // `addPack` is idempotent (duplicate inserts are no-ops in
  // `TablePackManager.addPack`), so re-running on every EL crit while
  // the doc cache is warm is safe.
  if (critTableSuffix === 'EL') {
    critTableCanonical = 'Crit/Fumble Table EL'
    CONFIG.DCC.criticalHitPacks.addPack('dcc-core-book.dcc-monster-fumble-tables')
  }

  // Cache hit — the loaded RollTable doc is stable per session;
  // `getResultsForRoll(roll.total)` is cheap once the doc is in hand.
  let critTable = critTableDocCache.get(critTableCanonical)
  if (critTable === undefined) {
    critTable = await resolveCritTable(critTableCanonical)
    critTableDocCache.set(critTableCanonical, critTable)
  }

  if (critTable) {
    const critResult = critTable.getResultsForRoll(roll.total)
    return critResult[0] || 'Unable to find crit result'
  }
}

/**
 * Walk the configured critical-hit packs + world tables for a crit
 * table whose name starts with `critTableCanonical`. Returns the
 * loaded Foundry `RollTable` document, or `null` when no match is
 * found. Pulled out of `getCritTableResult` so the cache-miss path
 * is a single named call.
 */
async function resolveCritTable (critTableCanonical) {
  for (const criticalHitPackName of CONFIG.DCC?.criticalHitPacks?.packs || []) {
    if (!criticalHitPackName) continue
    const pack = game.packs.get(criticalHitPackName)
    if (!pack) continue
    const entry = pack.index.find((entity) => entity.name.startsWith(critTableCanonical))
    if (!entry) continue
    return await pack.getDocument(entry._id)
  }

  const worldCritTable = game.tables.find((entity) => entity.name.startsWith(critTableCanonical))
  if (worldCritTable) return worldCritTable

  return null
}

/**
 * Get a link to the crit table if available, otherwise return plain text
 * @param {string} critTableSuffix - The crit table suffix (e.g. "III", "IV")
 * @param {string} displayText - The text to display for the link
 * @returns {string} - A UUID link if the table is found, otherwise just the display text
 */
export async function getCritTableLink (critTableSuffix, displayText) {
  // Cache the resolved `@UUID[...]` prefix (without `{displayText}`)
  // so chat-card re-renders with different labels still get one walk.
  // A cached `null` means "no table found" and skips the rebuild.
  let uuidPrefix = critTableLinkCache.get(critTableSuffix)
  if (uuidPrefix === undefined) {
    uuidPrefix = resolveCritTableLink(critTableSuffix)
    critTableLinkCache.set(critTableSuffix, uuidPrefix)
  }

  if (uuidPrefix === null) return displayText
  return `${uuidPrefix}{${displayText}}`
}

/**
 * Walk the configured critical-hit packs + world tables for a crit
 * table whose name starts with the canonical form of
 * `critTableSuffix`. Returns the `@UUID[Compendium...|RollTable...]`
 * prefix (string) for the matching entry, or `null` when no match is
 * found. The caller concatenates `{displayText}` so the same suffix
 * can render with different labels.
 */
function resolveCritTableLink (critTableSuffix) {
  let critTableCanonical = 'Crit Table ' + critTableSuffix

  // Check to see if this is the Elemental Crit/Fumble table
  if (critTableSuffix === 'EL') {
    critTableCanonical = 'Crit/Fumble Table EL'
  }

  // Look up the crit table in compendium packs
  for (const criticalHitPackName of CONFIG.DCC?.criticalHitPacks?.packs || []) {
    if (!criticalHitPackName) continue
    const pack = game.packs.get(criticalHitPackName)
    if (!pack) continue
    const entry = pack.index.find((entity) => entity.name.startsWith(critTableCanonical))
    if (entry) {
      return `@UUID[Compendium.${criticalHitPackName}.${entry._id}]`
    }
  }

  // Try in the local world
  const worldCritTable = game.tables.find((entity) => entity.name.startsWith(critTableCanonical))
  if (worldCritTable) {
    return `@UUID[RollTable.${worldCritTable.id}]`
  }

  return null
}

/**
 * Resolve a RollTable from a path string
 * @param {string} tablePath - a world table name, or a compendium path like 'scope.pack-name.Table Name'
 * @returns {Promise<Object|null>} - the RollTable document, or null if not found
 */
export async function getTableFromPath (tablePath) {
  if (!tablePath) { return null }

  // Compendium paths have at least three components: scope, pack name, table name
  const pathComponents = tablePath.split('.')
  if (pathComponents.length >= 3) {
    const packName = pathComponents.slice(0, 2).join('.')
    const tableName = pathComponents.slice(2).join('.')
    const pack = game.packs.get(packName)
    if (pack) {
      const entry = pack.index.find((entity) => entity.name === tableName)
      if (entry) {
        return pack.getDocument(entry._id)
      }
    }
  }

  // Fall back to a world table by name
  return game.tables.getName(tablePath) || null
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

    // Fall back to searching world tables by name
    const worldTable = game.tables.find((entity) => entity.name.startsWith(fumbleTableName))
    if (worldTable) {
      const fumbleResult = worldTable.getResultsForRoll(roll.total)
      return fumbleResult[0] || 'Unable to find fumble result'
    }
  }
}
