// Namespace DCC Configuration Values
const DCC = {}

// ASCII Artwork
DCC.ASCII = `_______________________________
______  _____  _____ 
|  _  \\/  __ \\/  __ \\
| | | || /  \\/| /  \\/
| | | || |    | |    
| |/ / | \\__/\\| \\__/\\
|___/   \\____/ \\____/
_______________________________`

/**
 * The set of Ability Scores used within the system
 * @type {Object}
 */
DCC.abilities = {
  str: 'DCC.AbilityStr',
  agl: 'DCC.AbilityAgl',
  sta: 'DCC.AbilitySta',
  per: 'DCC.AbilityPer',
  int: 'DCC.AbilityInt',
  lck: 'DCC.AbilityLck'
}

/**
 * The set of Ability Score Modifiers used within the system
 * @type {Object}
 */
DCC.abilities.modifiers = {
  3: -3,
  4: -2,
  5: -2,
  6: -1,
  7: -1,
  8: -1,
  9: 0,
  10: 0,
  11: 0,
  12: 0,
  13: 1,
  14: 1,
  15: 1,
  16: 2,
  17: 2,
  18: 3,
  19: 3,
  20: 4,
  21: 4,
  22: 5,
  23: 5,
  24: 6
}

/* -------------------------------------------- */

/**
 * Character alignment options
 * @type {Object}
 */
DCC.alignments = {
  l: 'DCC.AlignmentL',
  n: 'DCC.AlignmentN',
  c: 'DCC.AlignmentC'
}

/* -------------------------------------------- */

/**
 * Character saving throws
 * @type {Object}
 */
DCC.saves = {
  ref: 'DCC.SavesReflex',
  frt: 'DCC.SavesFortitude',
  wil: 'DCC.SavesWill'
}

/* -------------------------------------------- */

/**
 * Item entity types
 * @type {Object}
 */
DCC.items = {
  weapon: 'DCC.Weapon',
  ammunition: 'DCC.Ammunition',
  armor: 'DCC.Armor',
  equipment: 'DCC.Equipment',
  mount: 'DCC.Mount',
  spell: 'DCC.Spell',
  treasure: 'DCC.Treasure'
}

/* -------------------------------------------- */

/**
 * This Object defines the various lengths of time which can occur in D&D5e
 * @type {Object}
 */
DCC.timePeriods = {
  inst: 'DCC.TimeInst',
  turn: 'DCC.TimeTurn',
  round: 'DCC.TimeRound',
  minute: 'DCC.TimeMinute',
  hour: 'DCC.TimeHour',
  day: 'DCC.TimeDay',
  month: 'DCC.TimeMonth',
  year: 'DCC.TimeYear',
  perm: 'DCC.TimePerm',
  spec: 'DCC.Special'
}

/* -------------------------------------------- */

/**
 * This describes the ways that an ability can be activated
 * @type {Object}
 */
DCC.abilityActivationTypes = {
  none: 'DCC.None',
  action: 'DCC.Action',
  minute: DCC.timePeriods.minute,
  hour: DCC.timePeriods.hour,
  day: DCC.timePeriods.day,
  special: DCC.timePeriods.spec
}

/* -------------------------------------------- */

// Creature Sizes
DCC.actorSizes = {
  tiny: 'DCC.SizeTiny',
  sm: 'DCC.SizeSmall',
  med: 'DCC.SizeMedium',
  lg: 'DCC.SizeLarge',
  huge: 'DCC.SizeHuge',
  grg: 'DCC.SizeGargantuan'
}

DCC.tokenSizes = {
  tiny: 1,
  sm: 1,
  med: 1,
  lg: 2,
  huge: 3,
  grg: 4
}

/* -------------------------------------------- */

/**
 * The set of equipment types for armor, clothing, and other objects which can ber worn by the character
 * @type {Object}
 */
DCC.equipmentTypes = {
  light: 'DCC.EquipmentLight',
  medium: 'DCC.EquipmentMedium',
  heavy: 'DCC.EquipmentHeavy',
  bonus: 'DCC.EquipmentBonus',
  natural: 'DCC.EquipmentNatural',
  shield: 'DCC.EquipmentShield',
  clothing: 'DCC.EquipmentClothing'
}

/* -------------------------------------------- */

/**
 * The valid currency denominations supported by the 5e system
 * @type {Object}
 */
DCC.currencies = {
  pp: 'DCC.CurrencyPP',
  gp: 'DCC.CurrencyGP',
  ep: 'DCC.CurrencyEP',
  sp: 'DCC.CurrencySP',
  cp: 'DCC.CurrencyCP'
}

/* -------------------------------------------- */

DCC.distanceUnits = {
  none: 'DCC.None',
  self: 'DCC.DistSelf',
  touch: 'DCC.DistTouch',
  ft: 'DCC.DistFt',
  mi: 'DCC.DistMi',
  spec: 'DCC.Special',
  any: 'DCC.DistAny'
}

/* -------------------------------------------- */

/**
 * Configure aspects of encumbrance calculation so that it could be configured by modules
 * @type {Object}
 */
DCC.encumbrance = {
  currencyPerWeight: 50,
  strMultiplier: 15
}

/* -------------------------------------------- */

/**
 * This Object defines the types of single or area targets which can be applied in D&D5e
 * @type {Object}
 */
DCC.targetTypes = {
  none: 'DCC.None',
  self: 'DCC.TargetSelf',
  creature: 'DCC.TargetCreature',
  ally: 'DCC.TargetAlly',
  enemy: 'DCC.TargetEnemy',
  object: 'DCC.TargetObject',
  space: 'DCC.TargetSpace',
  radius: 'DCC.TargetRadius',
  sphere: 'DCC.TargetSphere',
  cylinder: 'DCC.TargetCylinder',
  cone: 'DCC.TargetCone',
  square: 'DCC.TargetSquare',
  cube: 'DCC.TargetCube',
  line: 'DCC.TargetLine',
  wall: 'DCC.TargetWall'
}

/* -------------------------------------------- */

/**
 * Map the subset of target types which produce a template area of effect
 * The keys are DCC target types and the values are MeasuredTemplate shape types
 * @type {Object}
 */
DCC.areaTargetTypes = {
  cone: 'cone',
  cube: 'rect',
  cylinder: 'circle',
  line: 'ray',
  radius: 'circle',
  sphere: 'circle',
  square: 'rect',
  wall: 'ray'
}

/* -------------------------------------------- */

// Healing Types
DCC.healingTypes = {
  healing: 'DCC.Healing',
  temphp: 'DCC.HealingTemp'
}

/* -------------------------------------------- */

/**
 * Enumerate the denominations of hit dice which can apply to classes
 * @type {Array.<string>}
 */
DCC.hitDieTypes = ['d4', 'd6', 'd8', 'd10', 'd12']

/* -------------------------------------------- */

/**
 * Character senses options
 * @type {Object}
 */
DCC.senses = {
  iv: 'DCC.SenseIV',
  us: 'DCC.SenseUS'
}

// Spell Levels
DCC.spellLevels = {
  1: 'DCC.SpellLevel1',
  2: 'DCC.SpellLevel2',
  3: 'DCC.SpellLevel3',
  4: 'DCC.SpellLevel4',
  5: 'DCC.SpellLevel5',
  6: 'DCC.SpellLevel6'
}

/* -------------------------------------------- */

// Condition Types
DCC.conditionTypes = {
  blinded: 'DCC.ConBlinded',
  charmed: 'DCC.ConCharmed',
  deafened: 'DCC.ConDeafened',
  diseased: 'DCC.ConDiseased',
  exhaustion: 'DCC.ConExhaustion',
  frightened: 'DCC.ConFrightened',
  grappled: 'DCC.ConGrappled',
  incapacitated: 'DCC.ConIncapacitated',
  invisible: 'DCC.ConInvisible',
  paralyzed: 'DCC.ConParalyzed',
  petrified: 'DCC.ConPetrified',
  poisoned: 'DCC.ConPoisoned',
  prone: 'DCC.ConProne',
  restrained: 'DCC.ConRestrained',
  stunned: 'DCC.ConStunned',
  unconscious: 'DCC.ConUnconscious'
}

// Languages
DCC.languages = {
  common: 'DCC.LanguagesCommon',
  draconic: 'DCC.LanguagesDraconic',
  dwarvish: 'DCC.LanguagesDwarvish',
  elvish: 'DCC.LanguagesElvish',
  giant: 'DCC.LanguagesGiant',
  goblin: 'DCC.LanguagesGoblin',
  gnoll: 'DCC.LanguagesGnoll',
  halfling: 'DCC.LanguagesHalfling',
  orc: 'DCC.LanguagesOrc',
  cant: 'DCC.LanguagesThievesCant'
}

// Character Level XP Requirements
DCC.CHARACTER_EXP_LEVELS = [
  0, 10, 50, 110, 190, 290, 410, 550, 710, 890, 1090
]

export default DCC
