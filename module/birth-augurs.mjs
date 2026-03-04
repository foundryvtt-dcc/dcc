/**
 * Canonical table of all 30 DCC birth augurs
 *
 * Each augur has:
 * - index: 1-30 (matches the d30 roll from the rulebook)
 * - key: camelCase identifier used for i18n lookup (DCC.BirthAugur.{key})
 * - effect: the effect type used by _getBirthAugurBonusFor() for automation
 *
 * Effect types automated in Phase 1:
 *   allAttack, meleeAttack, missileAttack, allDamage, meleeDamage, missileDamage,
 *   spellCheck, allSaves, reflexSave, fortSave, willSave, armorClass, initiative, speed
 *
 * Effect type 'none' means the augur is defined but not yet automated.
 */
export const BIRTH_AUGURS = [
  { index: 1, key: 'harshWinter', effect: 'allAttack' },
  { index: 2, key: 'theBull', effect: 'meleeAttack' },
  { index: 3, key: 'fortunateDate', effect: 'missileAttack' },
  { index: 4, key: 'raisedByWolves', effect: 'none' },
  { index: 5, key: 'conceivedOnHorseback', effect: 'none' },
  { index: 6, key: 'bornOnTheBattlefield', effect: 'allDamage' },
  { index: 7, key: 'pathOfTheBear', effect: 'meleeDamage' },
  { index: 8, key: 'hawkeye', effect: 'missileDamage' },
  { index: 9, key: 'packHunter', effect: 'none' },
  { index: 10, key: 'bornUnderTheLoom', effect: 'none' },
  { index: 11, key: 'foxsCunning', effect: 'none' },
  { index: 12, key: 'fourLeafedClover', effect: 'none' },
  { index: 13, key: 'seventhSon', effect: 'spellCheck' },
  { index: 14, key: 'theDwarvenStar', effect: 'none' },
  { index: 15, key: 'unholy', effect: 'none' },
  { index: 16, key: 'scepter', effect: 'none' },
  { index: 17, key: 'luckySign', effect: 'allSaves' },
  { index: 18, key: 'guardianAngel', effect: 'none' },
  { index: 19, key: 'survivedThePlague', effect: 'none' },
  { index: 20, key: 'struckByLightning', effect: 'reflexSave' },
  { index: 21, key: 'livedThroughFamine', effect: 'fortSave' },
  { index: 22, key: 'resistedTemptation', effect: 'willSave' },
  { index: 23, key: 'charmedHouse', effect: 'armorClass' },
  { index: 24, key: 'speedOfTheCobra', effect: 'initiative' },
  { index: 25, key: 'bountifulHarvest', effect: 'none' },
  { index: 26, key: 'warriorsBattle', effect: 'none' },
  { index: 27, key: 'markOfTheDemon', effect: 'none' },
  { index: 28, key: 'doomedToFail', effect: 'none' },
  { index: 29, key: 'twinned', effect: 'none' },
  { index: 30, key: 'wildChild', effect: 'speed' }
]

/**
 * Match birth augur text against the augur table to find the index.
 * Used by migration and PC parser to auto-detect augur from free-text.
 *
 * @param {string} text - The birth augur text to match
 * @returns {number|null} - The augur index (1-30) or null if no match
 */
export function matchAugurFromText (text) {
  if (!text || typeof text !== 'string') return null

  const normalizedText = text.toLowerCase().trim()
  if (!normalizedText) return null

  // Match patterns from the DCC rulebook birth augur descriptions
  // Order matters: more specific patterns (e.g. "melee damage") must come before
  // general patterns (e.g. "damage rolls") to avoid false matches.
  const patterns = [
    { index: 1, patterns: ['harsh winter', 'all attack rolls'] },
    { index: 2, patterns: ['the bull', 'melee attack rolls'] },
    { index: 3, patterns: ['fortunate date', 'missile fire attack rolls'] },
    { index: 4, patterns: ['raised by wolves', 'unarmed attack rolls'] },
    { index: 5, patterns: ['conceived on horseback', 'mounted'] },
    { index: 7, patterns: ['path of the bear', 'melee damage rolls'] },
    { index: 8, patterns: ['hawkeye', 'missile fire damage rolls'] },
    { index: 6, patterns: ['born on the battlefield', 'damage rolls'] },
    { index: 9, patterns: ['pack hunter', 'attack and damage rolls for 0-level'] },
    { index: 10, patterns: ['born under the loom', 'skill checks'] },
    { index: 11, patterns: ["fox's cunning", 'fox\u2019s cunning', 'find.+trap', 'disable.+trap'] },
    { index: 12, patterns: ['four-leafed clover', 'four leafed clover', 'find secret doors'] },
    { index: 13, patterns: ['seventh son', 'spell checks'] },
    { index: 14, patterns: ['the dwarven star', 'spell damage'] },
    { index: 15, patterns: ['unholy', 'turn unholy checks'] },
    { index: 16, patterns: ['scepter', 'healing spells'] },
    { index: 18, patterns: ['guardian angel', 'saves versus traps'] },
    { index: 19, patterns: ['survived the plague', 'saves versus poison'] },
    { index: 20, patterns: ['struck by lightning', 'reflex saving throws'] },
    { index: 21, patterns: ['lived through famine', 'fortitude saving throws'] },
    { index: 22, patterns: ['resisted temptation', 'willpower saving throws'] },
    { index: 17, patterns: ['lucky sign', 'saving throws'] },
    { index: 23, patterns: ['charmed house', 'armor class'] },
    { index: 24, patterns: ['speed of the cobra', 'initiative'] },
    { index: 25, patterns: ['bountiful harvest', 'hit points'] },
    { index: 26, patterns: ["warrior's battle", 'warrior\u2019s battle', 'critical hit tables'] },
    { index: 27, patterns: ['mark of the demon', 'corruption rolls'] },
    { index: 28, patterns: ['doomed to fail', 'fumbles'] },
    { index: 29, patterns: ['twinned', 'birdsong'] },
    { index: 30, patterns: ['wild child', 'speed\\b'] }
  ]

  for (const entry of patterns) {
    for (const pattern of entry.patterns) {
      if (normalizedText.match(new RegExp(pattern, 'i'))) {
        return entry.index
      }
    }
  }

  return null
}
