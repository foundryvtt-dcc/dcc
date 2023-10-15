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
  0: -3,
  1: -3,
  2: -3,
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
  skill: 'DCC.Skill',
  treasure: 'DCC.Treasure'
}

/**
 * Spell casting modes
 */
DCC.castingModes = {
  generic: 'DCC.SpellCastingModeGeneric',
  wizard: 'DCC.SpellCastingModeWizard',
  cleric: 'DCC.SpellCastingModeCleric'
}

/**
 * Attack Bonus modes
 */
DCC.attackBonusModes = {
  flat: 'DCC.AttackBonusConfigModeFlat',
  manual: 'DCC.AttackBonusConfigModeManual',
  autoPerAttack: 'DCC.AttackBonusConfigModeAutoPerAttack'
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
 * The valid currency denominations supported by the DCC system
 * @type {Object}
 */
DCC.currencies = {
  pp: 'DCC.CurrencyPP',
  ep: 'DCC.CurrencyEP',
  gp: 'DCC.CurrencyGP',
  sp: 'DCC.CurrencySP',
  cp: 'DCC.CurrencyCP'
}

/**
 * The currencies supported by the DCC system ranked by value from low to high
 * @type {Array}
 */
DCC.currencyRank = [
  'cp', 'sp', 'gp', 'ep', 'pp'
]

/**
 * The currencies supported by the DCC system expressed in terms of the lowest denomination
 * @type {Object}
 */
DCC.currencyValue = {
  pp: 10000,
  ep: 1000,
  gp: 100,
  sp: 10,
  cp: 1
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

// The dice chain
DCC.DICE_CHAIN = [
  3, 4, 5, 6, 7, 8, 10, 12, 14, 16, 20, 24, 30
]

// Critical Hit and Disapproval Compendiums, Fumble table, and Mercurial Magic table
// Updated at runtime from settings
DCC.criticalHitPacks = null
DCC.disapprovalPacks = null
DCC.divineAidTable = null
DCC.fumbleTable = null
DCC.layOnHandsTable = null
DCC.mercurialMagicTable = null
DCC.turnUnholyTable = null

// List of available disapproval tables for the cleric sheet, generated from disapprovalPacks
DCC.disapprovalTables = {}

// Registry for skills that use a table lookup - maps skill name to config property
// System defaults defined here, modules can register their own
DCC.skillTables = {
  divineAid: 'divineAidTable',
  layOnHands: 'layOnHandsTable',
  turnUnholy: 'turnUnholyTable'
}

// Default actor images
DCC.defaultActorImages = {
  default: 'systems/dcc/styles/images/actor.webp'
}

// Default item tokens
DCC.defaultItemImages = {
  default: 'systems/dcc/styles/images/item.webp',
  armor: 'systems/dcc/styles/images/armor.webp',
  spell: 'systems/dcc/styles/images/spell.webp',
  treasure: 'systems/dcc/styles/images/coins.webp',
  weapon: 'systems/dcc/styles/images/weapon.webp'
}

// Default macro images
DCC.macroImages = {
  default: 'systems/dcc/styles/images/game-icons-net/dice-target.svg',
  defaultDice: 'systems/dcc/styles/images/game-icons-net/dice-twenty-faces-twenty.svg',

  ability: 'systems/dcc/styles/images/game-icons-net/dice-twenty-faces-twenty.svg',
  abilityRollUnder: 'systems/dcc/styles/images/game-icons-net/dice-twenty-faces-one.svg',
  str: 'systems/dcc/styles/images/game-icons-net/weight-lifting-up.svg',
  agl: 'systems/dcc/styles/images/game-icons-net/body-balance.svg',
  sta: 'systems/dcc/styles/images/game-icons-net/jumping-rope.svg',
  per: 'systems/dcc/styles/images/game-icons-net/charm.svg',
  int: 'systems/dcc/styles/images/game-icons-net/brain.svg',
  lck: 'systems/dcc/styles/images/game-icons-net/dice-twenty-faces-one.svg',

  attackBonus: 'systems/dcc/styles/images/game-icons-net/d4.svg',
  backstab: 'systems/dcc/styles/images/game-icons-net/backstab.svg',
  hitDice: 'systems/dcc/styles/images/game-icons-net/dice-six-faces-six.svg',
  initiative: 'systems/dcc/styles/images/game-icons-net/stairs-goal.svg',
  luckDie: 'systems/dcc/styles/images/game-icons-net/horseshoe.svg',

  applyDisapproval: 'systems/dcc/styles/images/game-icons-net/lightning-tear.svg',
  rollDisapproval: 'systems/dcc/styles/images/game-icons-net/lightning-branches.svg',

  savingThrow: 'systems/dcc/styles/images/game-icons-net/dodging.svg',
  ref: 'systems/dcc/styles/images/game-icons-net/dodging.svg',
  frt: 'systems/dcc/styles/images/game-icons-net/mighty-force.svg',
  wil: 'systems/dcc/styles/images/game-icons-net/psychic-waves.svg',

  skillCheck: 'systems/dcc/styles/images/game-icons-net/skills.svg',
  divineAid: 'systems/dcc/styles/images/game-icons-net/hand-of-god.svg',
  turnUnholy: 'systems/dcc/styles/images/game-icons-net/disintegrate.svg',
  layOnHands: 'systems/dcc/styles/images/game-icons-net/glowing-hands.svg',
  sneakSilently: 'systems/dcc/styles/images/game-icons-net/cloak-dagger.svg',
  pickPockets: 'systems/dcc/styles/images/game-icons-net/snatch.svg',
  pickLock: 'systems/dcc/styles/images/game-icons-net/lockpicks.svg',
  disableTrap: 'systems/dcc/styles/images/game-icons-net/box-trap.svg',
  disguiseSelf: 'systems/dcc/styles/images/game-icons-net/domino-mask.svg',
  handlePoison: 'systems/dcc/styles/images/game-icons-net/poison-bottle.svg',
  castSpellFromScroll: 'systems/dcc/styles/images/game-icons-net/scroll-unfurled.svg',
  hideInShadows: 'systems/dcc/styles/images/game-icons-net/hidden.svg',
  climbSheerSurfaces: 'systems/dcc/styles/images/game-icons-net/mountain-climbing.svg',
  findTrap: 'systems/dcc/styles/images/game-icons-net/wolf-trap.svg',
  forgeDocument: 'systems/dcc/styles/images/game-icons-net/scroll-quill.svg',
  readLanguages: 'systems/dcc/styles/images/game-icons-net/read.svg',
  sneakAndHide: 'systems/dcc/styles/images/game-icons-net/cloak-dagger.svg',
  shieldBash: 'systems/dcc/styles/images/game-icons-net/shield-bash.svg',
  findSecretDoors: 'systems/dcc/styles/images/game-icons-net/secret-door.svg',

  spellCheck: 'systems/dcc/styles/images/game-icons-net/bolt-spell-cast.svg',

  d3: 'systems/dcc/styles/images/game-icons-net/dice-six-faces-three.svg',
  d4: 'systems/dcc/styles/images/game-icons-net/d4.svg',
  d5: 'systems/dcc/styles/images/game-icons-net/dice-six-faces-five.svg',
  d6: 'systems/dcc/styles/images/game-icons-net/dice-six-faces-six.svg',
  d8: 'systems/dcc/styles/images/game-icons-net/dice-eight-faces-eight.svg',
  d10: 'systems/dcc/styles/images/game-icons-net/d10.svg',
  d12: 'systems/dcc/styles/images/game-icons-net/d12.svg',
  d20: 'systems/dcc/styles/images/game-icons-net/dice-twenty-faces-twenty.svg'
}

// Templates
DCC.templates = {
  defaultItemCard: 'systems/dcc/templates/chat-card-activate-item.html',
  rollModifierDialog: 'systems/dcc/templates/dialog-roll-modifiers.html',
  spellResult: 'systems/dcc/templates/chat-card-spell-result.html',
}

// Actor importer warning threshold
DCC.actorImporterPromptThreshold = 25

// Packs for finding items when importing actors
DCC.actorImporterItemPacks = [
  'dcc-core-book.dcc-core-ammunition',
  'dcc-core-book.dcc-core-armor',
  'dcc-core-book.dcc-core-equipment',
  'dcc-core-book.dcc-core-weapons',
  'dcc-core-book.dcc-core-mounts',
  'dcc-core-book.dcc-core-spells-wizard-1',
  'dcc-core-book.dcc-core-spells-wizard-2',
  'dcc-core-book.dcc-core-spells-wizard-3',
  'dcc-core-book.dcc-core-spells-wizard-4',
  'dcc-core-book.dcc-core-spells-wizard-5',
  'dcc-core-book.dcc-core-spells-cleric-1',
  'dcc-core-book.dcc-core-spells-cleric-2',
  'dcc-core-book.dcc-core-spells-cleric-3',
  'dcc-core-book.dcc-core-spells-cleric-4',
  'dcc-core-book.dcc-core-spells-cleric-5',
  'dcc-core-book.dcc-core-spells-patron'
]

// Name remappings for the actor importer
DCC.actorImporterNameMap = {
  'Hammer (as club)': ['Club'],
  'Razor (as dagger)': ['Dagger'],
  'Cleaver (as axe)': ['Axe'],
  'Cudgel (as staff)': ['Staff'],
  'Awl (as dagger)': ['Dagger'],
  'Crowbar (as club)': ['Club'],
  'Shovel (as staff)': ['Staff'],
  'Pick (as club)': ['Club'],
  'Quill (as dart)': ['Dart'],
  'Scissors (as dagger)': ['Dagger'],
  'Pitchfork (as spear)': ['Spear'],
  'Trowel (as dagger)': ['Dagger'],
  'Knife (as dagger)': ['Dagger'],
  'Stick (as club)': ['Club'],
  'Patron Bond/Invoke Patron': ['Patron Bond', 'Patron Bond (Self)', 'Patron Bond (Other)', 'Invoke Patron'],
  'Demon Summoning': ['Demon Summoning', 'Demon Summoning - No Patron', 'Demon Summoning - Patron', 'Demon Summoning - True Name'],
  Blessing: ['Blessing', 'Blessing Self', 'Blessing Ally', 'Blessing Object']
}

export default DCC
