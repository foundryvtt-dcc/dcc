// DCC monster-classification config data.
//
// Extracted from `module/config.js` (Phase 7 — Appendix-A config.js
// shrinkage arc). These four tables drive the NPC stat-block parser's
// monster-type detection + crit-table selection; they are consumed only
// by `module/npc-parser.js` (via the `DCC.*` config object onto which
// `config.js` re-composes them, so the public `CONFIG.DCC` shape is
// unchanged). Pure data — no behavior lives here.

/**
 * Monster "looks humanoid" name hints. If an NPC stat block's name/traits
 * string contains any of these substrings, the parser classifies it as a
 * humanoid for crit-table selection.
 * @type {string[]}
 */
export const humanoidHints = [
  'acolyte',
  'agent',
  'assassin',
  'bandit',
  'beserker',
  'blade',
  'bugbear',
  'centaur',
  'club',
  'dagger',
  'deep one',
  'dimensional sailor',
  'fortune teller',
  'friar',
  'gnoll',
  'goblin',
  'hobgoblin',
  'hollow man',
  'huntress',
  'knight',
  'kindred',
  'kobold',
  'living statue',
  'lizardman',
  'magician',
  'mace',
  'man-at-arms',
  'noble',
  'ogre',
  'orc',
  'peasant',
  'sage',
  'serpent-man',
  'spear',
  'subhuman',
  'sword',
  'time traveler',
  'troglodyte',
  'witch'
]

/**
 * Substrings that mark an NPC as a giant-type monster.
 * @type {string[]}
 */
export const giants = [
  'cyclops',
  'giant'
]

/**
 * Substrings that look giant-ish (contain "giant") but are NOT giants
 * (e.g. "giant rat"). Used to veto a giant classification.
 * @type {string[]}
 */
export const giantsNotGiants = [
  'ant',
  'beetle',
  'centipede',
  'lizard',
  'rat',
  'scorpion',
  'snake'
]

/**
 * Monster critical-hit table + die by Hit Dice count and monster type.
 * Keyed first by HD count (0–21), then by monster type
 * (humanoid / dragon / demon / giant / undead / other).
 * @type {Object}
 */
export const monsterCriticalHits = {
  0: {
    humanoid: { table: 'III', die: 'd4' },
    dragon: { table: 'DR', die: 'd4' },
    demon: { table: 'DN', die: 'd3' },
    giant: { table: 'G', die: 'd4' },
    undead: { table: 'U', die: 'd4' },
    other: { table: 'M', die: 'd4' }
  },
  1: {
    humanoid: { table: 'III', die: 'd6' },
    dragon: { table: 'DR', die: 'd6' },
    demon: { table: 'DN', die: 'd4' },
    giant: { table: 'G', die: 'd4' },
    undead: { table: 'U', die: 'd6' },
    other: { table: 'M', die: 'd6' }
  },
  2: {
    humanoid: { table: 'III', die: 'd8' },
    dragon: { table: 'DR', die: 'd8' },
    demon: { table: 'DN', die: 'd4' },
    giant: { table: 'G', die: 'd4' },
    undead: { table: 'U', die: 'd6' },
    other: { table: 'M', die: 'd8' }
  },
  3: {
    humanoid: { table: 'III', die: 'd8' },
    dragon: { table: 'DR', die: 'd10' },
    demon: { table: 'DN', die: 'd4' },
    giant: { table: 'G', die: 'd4' },
    undead: { table: 'U', die: 'd8' },
    other: { table: 'M', die: 'd8' }
  },
  4: {
    humanoid: { table: 'III', die: 'd10' },
    dragon: { table: 'DR', die: 'd12' },
    demon: { table: 'DN', die: 'd4' },
    giant: { table: 'G', die: 'd4' },
    undead: { table: 'U', die: 'd8' },
    other: { table: 'M', die: 'd10' }
  },
  5: {
    humanoid: { table: 'III', die: 'd10' },
    dragon: { table: 'DR', die: 'd14' },
    demon: { table: 'DN', die: 'd6' },
    giant: { table: 'G', die: 'd4' },
    undead: { table: 'U', die: 'd10' },
    other: { table: 'M', die: 'd10' }
  },
  6: {
    humanoid: { table: 'IV', die: 'd12' },
    dragon: { table: 'DR', die: 'd16' },
    demon: { table: 'DN', die: 'd6' },
    giant: { table: 'G', die: 'd4' },
    undead: { table: 'U', die: 'd10' },
    other: { table: 'M', die: 'd12' }
  },
  7: {
    humanoid: { table: 'IV', die: 'd12' },
    dragon: { table: 'DR', die: 'd20' },
    demon: { table: 'DN', die: 'd8' },
    giant: { table: 'G', die: 'd4' },
    undead: { table: 'U', die: 'd12' },
    other: { table: 'M', die: 'd12' }
  },
  8: {
    humanoid: { table: 'IV', die: 'd14' },
    dragon: { table: 'DR', die: 'd20' },
    demon: { table: 'DN', die: 'd8' },
    giant: { table: 'G', die: 'd4' },
    undead: { table: 'U', die: 'd12' },
    other: { table: 'M', die: 'd14' }
  },
  9: {
    humanoid: { table: 'IV', die: 'd14' },
    dragon: { table: 'DR', die: 'd24' },
    demon: { table: 'DN', die: 'd10' },
    giant: { table: 'G', die: 'd4' },
    undead: { table: 'U', die: 'd14' },
    other: { table: 'M', die: 'd14' }
  },
  10: {
    humanoid: { table: 'IV', die: 'd16' },
    dragon: { table: 'DR', die: 'd24' },
    demon: { table: 'DN', die: 'd10' },
    giant: { table: 'G', die: 'd4' },
    undead: { table: 'U', die: 'd14' },
    other: { table: 'M', die: 'd16' }
  },
  11: {
    humanoid: { table: 'V', die: 'd16' },
    dragon: { table: 'DR', die: '2d14' },
    demon: { table: 'DN', die: 'd12' },
    giant: { table: 'G', die: 'd4' },
    undead: { table: 'U', die: 'd16' },
    other: { table: 'M', die: 'd16' }
  },
  12: {
    humanoid: { table: 'V', die: 'd20' },
    dragon: { table: 'DR', die: '2d14' },
    demon: { table: 'DN', die: 'd12' },
    giant: { table: 'G', die: 'd6' },
    undead: { table: 'U', die: 'd16' },
    other: { table: 'M', die: 'd20' }
  },
  13: {
    humanoid: { table: 'V', die: 'd20' },
    dragon: { table: 'DR', die: 'd30' },
    demon: { table: 'DN', die: 'd14' },
    giant: { table: 'G', die: 'd6' },
    undead: { table: 'U', die: 'd20' },
    other: { table: 'M', die: 'd20' }
  },
  14: {
    humanoid: { table: 'V', die: '2d10' },
    dragon: { table: 'DR', die: 'd30' },
    demon: { table: 'DN', die: 'd14' },
    giant: { table: 'G', die: 'd7' },
    undead: { table: 'U', die: 'd20' },
    other: { table: 'M', die: 'd20' }
  },
  15: {
    humanoid: { table: 'V', die: '2d10' },
    dragon: { table: 'DR', die: '2d16' },
    demon: { table: 'DN', die: 'd16' },
    giant: { table: 'G', die: 'd7' },
    undead: { table: 'U', die: 'd24' },
    other: { table: 'M', die: 'd20' }
  },
  16: {
    humanoid: { table: 'V', die: '2d12' },
    dragon: { table: 'DR', die: '2d16' },
    demon: { table: 'DN', die: 'd16' },
    giant: { table: 'G', die: 'd8' },
    undead: { table: 'U', die: 'd24' },
    other: { table: 'M', die: 'd24' }
  },
  17: {
    humanoid: { table: 'V', die: '2d12' },
    dragon: { table: 'DR', die: '2d20' },
    demon: { table: 'DN', die: 'd20' },
    giant: { table: 'G', die: 'd8' },
    undead: { table: 'U', die: 'd30' },
    other: { table: 'M', die: 'd24' }
  },
  18: {
    humanoid: { table: 'V', die: '2d14' },
    dragon: { table: 'DR', die: '2d20' },
    demon: { table: 'DN', die: 'd20' },
    giant: { table: 'G', die: 'd10' },
    undead: { table: 'U', die: 'd30' },
    other: { table: 'M', die: 'd24' }
  },
  19: {
    humanoid: { table: 'V', die: '2d14' },
    dragon: { table: 'DR', die: '3d20' },
    demon: { table: 'DN', die: 'd24' },
    giant: { table: 'G', die: 'd10' },
    undead: { table: 'U', die: 'd30' },
    other: { table: 'M', die: 'd30' }
  },
  20: {
    humanoid: { table: 'V', die: '3d10' },
    dragon: { table: 'DR', die: '3d20' },
    demon: { table: 'DN', die: 'd24' },
    giant: { table: 'G', die: 'd12' },
    undead: { table: 'U', die: 'd30' },
    other: { table: 'M', die: 'd30' }
  },
  21: {
    humanoid: { table: 'V', die: '3d10' },
    dragon: { table: 'DR', die: '4d20' },
    demon: { table: 'DN', die: 'd30' },
    giant: { table: 'G', die: 'd12' },
    undead: { table: 'U', die: 'd30' },
    other: { table: 'M', die: 'd30' }
  }
}
