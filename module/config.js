// Namespace DCC Configuration Values
export const DCC = {};

// ASCII Artwork
DCC.ASCII = `_______________________________
______  _____  _____ 
|  _  \\/  __ \\/  __ \\
| | | || /  \\/| /  \\/
| | | || |    | |    
| |/ / | \\__/\\| \\__/\\
|___/   \\____/ \\____/
_______________________________`;


/**
 * The set of Ability Scores used within the system
 * @type {Object}
 */
DCC.abilities = {
  "str": "DCC.AbilityStr",
  "agl": "DCC.AbilityAgl",
  "sta": "DCC.AbilitySta",
  "per": "DCC.AbilityPer",
  "int": "DCC.AbilityInt",
  "lck": "DCC.AbilityLck",
};

/**
 * The set of Ability Score Modifiers used within the system
 * @type {Object}
 */
DCC.abilities.modifiers = {
  "3": -3,
  "4": -2,
  "5": -2,
  "6": -1,
  "7": -1,
  "8": -1,
  "9": 0,
  "10": 0,
  "11": 0,
  "12": 0,
  "13": 1,
  "14": 1,
  "15": 1,
  "16": 2,
  "17": 2,
  "18": 3,
};

/* -------------------------------------------- */

/**
 * Character alignment options
 * @type {Object}
 */
DCC.alignments = {
  'l': "DCC.AlignmentL",
  'n': "DCC.AlignmentN",
  'c': "DCC.AlignmentC",
};

/* -------------------------------------------- */

/**
 * Character saving throws
 * @type {Object}
 */
DCC.saves = {
  'ref': "DCC.SavesReflex",
  'frt': "DCC.SavesFortitude",
  'wil': "DCC.SavesWill",
};

/* -------------------------------------------- */

/**
 * This Object defines the various lengths of time which can occur in D&D5e
 * @type {Object}
 */
DCC.timePeriods = {
  "inst": "DCC.TimeInst",
  "turn": "DCC.TimeTurn",
  "round": "DCC.TimeRound",
  "minute": "DCC.TimeMinute",
  "hour": "DCC.TimeHour",
  "day": "DCC.TimeDay",
  "month": "DCC.TimeMonth",
  "year": "DCC.TimeYear",
  "perm": "DCC.TimePerm",
  "spec": "DCC.Special"
};


/* -------------------------------------------- */

/**
 * This describes the ways that an ability can be activated
 * @type {Object}
 */
DCC.abilityActivationTypes = {
  "none": "DCC.None",
  "action": "DCC.Action",
  "minute": DCC.timePeriods.minute,
  "hour": DCC.timePeriods.hour,
  "day": DCC.timePeriods.day,
  "special": DCC.timePeriods.spec,
};

/* -------------------------------------------- */


DCC.abilityConsumptionTypes = {
  "ammo": "DCC.ConsumeAmmunition",
  "attribute": "DCC.ConsumeAttribute",
  "material": "DCC.ConsumeMaterial",
  "charges": "DCC.ConsumeCharges"
};


/* -------------------------------------------- */

// Creature Sizes
DCC.actorSizes = {
  "tiny": "DCC.SizeTiny",
  "sm": "DCC.SizeSmall",
  "med": "DCC.SizeMedium",
  "lg": "DCC.SizeLarge",
  "huge": "DCC.SizeHuge",
  "grg": "DCC.SizeGargantuan"
};

DCC.tokenSizes = {
  "tiny": 1,
  "sm": 1,
  "med": 1,
  "lg": 2,
  "huge": 3,
  "grg": 4
};

/* -------------------------------------------- */

/**
 * Classification types for item action types
 * @type {Object}
 */
DCC.itemActionTypes = {
  "mwak": "DCC.ActionMWAK",
  "rwak": "DCC.ActionRWAK",
  "msak": "DCC.ActionMSAK",
  "rsak": "DCC.ActionRSAK",
  "save": "DCC.ActionSave",
  "heal": "DCC.ActionHeal",
  "abil": "DCC.ActionAbil",
  "util": "DCC.ActionUtil",
  "other": "DCC.ActionOther"
};

/* -------------------------------------------- */

DCC.itemCapacityTypes = {
  "items": "DCC.ItemContainerCapacityItems",
  "weight": "DCC.ItemContainerCapacityWeight"
};

/* -------------------------------------------- */

/**
 * Enumerate the lengths of time over which an item can have limited use ability
 * @type {Object}
 */
DCC.limitedUsePeriods = {
  "day": "DCC.Day",
};


/* -------------------------------------------- */

/**
 * The set of equipment types for armor, clothing, and other objects which can ber worn by the character
 * @type {Object}
 */
DCC.equipmentTypes = {
  "light": "DCC.EquipmentLight",
  "medium": "DCC.EquipmentMedium",
  "heavy": "DCC.EquipmentHeavy",
  "bonus": "DCC.EquipmentBonus",
  "natural": "DCC.EquipmentNatural",
  "shield": "DCC.EquipmentShield",
  "clothing": "DCC.EquipmentClothing",
};


/* -------------------------------------------- */

/**
 * The set of Armor Proficiencies which a character may have
 * @type {Object}
 */
DCC.armorProficiencies = {
  "lgt": DCC.equipmentTypes.light,
  "med": DCC.equipmentTypes.medium,
  "hvy": DCC.equipmentTypes.heavy,
  "shl": "DCC.EquipmentShieldProficiency"
};


/* -------------------------------------------- */

/**
 * Enumerate the valid consumable types which are recognized by the system
 * @type {Object}
 */
DCC.consumableTypes = {
  "ammo": "DCC.ConsumableAmmunition",
  "potion": "DCC.ConsumablePotion",
  "poison": "DCC.ConsumablePoison",
  "food": "DCC.ConsumableFood",
  "scroll": "DCC.ConsumableScroll",
  "wand": "DCC.ConsumableWand",
  "rod": "DCC.ConsumableRod",
  "trinket": "DCC.ConsumableTrinket"
};

/* -------------------------------------------- */

/**
 * The valid currency denominations supported by the 5e system
 * @type {Object}
 */
DCC.currencies = {
  "pp": "DCC.CurrencyPP",
  "gp": "DCC.CurrencyGP",
  "ep": "DCC.CurrencyEP",
  "sp": "DCC.CurrencySP",
  "cp": "DCC.CurrencyCP",
};

/* -------------------------------------------- */


// Damage Types
DCC.damageTypes = {
  "acid": "DCC.DamageAcid",
  "bludgeoning": "DCC.DamageBludgeoning",
  "cold": "DCC.DamageCold",
  "fire": "DCC.DamageFire",
  "force": "DCC.DamageForce",
  "lightning": "DCC.DamageLightning",
  "necrotic": "DCC.DamageNecrotic",
  "piercing": "DCC.DamagePiercing",
  "poison": "DCC.DamagePoison",
  "psychic": "DCC.DamagePsychic",
  "radiant": "DCC.DamageRadiant",
  "slashing": "DCC.DamageSlashing",
  "thunder": "DCC.DamageThunder"
};

/* -------------------------------------------- */

DCC.distanceUnits = {
  "none": "DCC.None",
  "self": "DCC.DistSelf",
  "touch": "DCC.DistTouch",
  "ft": "DCC.DistFt",
  "mi": "DCC.DistMi",
  "spec": "DCC.Special",
  "any": "DCC.DistAny"
};

/* -------------------------------------------- */


/**
 * Configure aspects of encumbrance calculation so that it could be configured by modules
 * @type {Object}
 */
DCC.encumbrance = {
  currencyPerWeight: 50,
  strMultiplier: 15
};

/* -------------------------------------------- */

/**
 * This Object defines the types of single or area targets which can be applied in D&D5e
 * @type {Object}
 */
DCC.targetTypes = {
  "none": "DCC.None",
  "self": "DCC.TargetSelf",
  "creature": "DCC.TargetCreature",
  "ally": "DCC.TargetAlly",
  "enemy": "DCC.TargetEnemy",
  "object": "DCC.TargetObject",
  "space": "DCC.TargetSpace",
  "radius": "DCC.TargetRadius",
  "sphere": "DCC.TargetSphere",
  "cylinder": "DCC.TargetCylinder",
  "cone": "DCC.TargetCone",
  "square": "DCC.TargetSquare",
  "cube": "DCC.TargetCube",
  "line": "DCC.TargetLine",
  "wall": "DCC.TargetWall"
};


/* -------------------------------------------- */


/**
 * Map the subset of target types which produce a template area of effect
 * The keys are DCC target types and the values are MeasuredTemplate shape types
 * @type {Object}
 */
DCC.areaTargetTypes = {
  cone: "cone",
  cube: "rect",
  cylinder: "circle",
  line: "ray",
  radius: "circle",
  sphere: "circle",
  square: "rect",
  wall: "ray"
};


/* -------------------------------------------- */

// Healing Types
DCC.healingTypes = {
  "healing": "DCC.Healing",
  "temphp": "DCC.HealingTemp"
};


/* -------------------------------------------- */


/**
 * Enumerate the denominations of hit dice which can apply to classes in the D&D5E system
 * @type {Array.<string>}
 */
DCC.hitDieTypes = ["d6", "d8", "d10", "d12"];


/* -------------------------------------------- */

/**
 * Character senses options
 * @type {Object}
 */
DCC.senses = {
  "bs": "DCC.SenseBS",
  "dv": "DCC.SenseDV",
  "ts": "DCC.SenseTS",
  "tr": "DCC.SenseTR"
};


/* -------------------------------------------- */

/**
 * The set of skill which can be trained in D&D5e
 * @type {Object}
 */
DCC.skills = {
  "acr": "DCC.SkillAcr",
  "ani": "DCC.SkillAni",
  "arc": "DCC.SkillArc",
  "ath": "DCC.SkillAth",
  "dec": "DCC.SkillDec",
  "his": "DCC.SkillHis",
  "ins": "DCC.SkillIns",
  "itm": "DCC.SkillItm",
  "inv": "DCC.SkillInv",
  "med": "DCC.SkillMed",
  "nat": "DCC.SkillNat",
  "prc": "DCC.SkillPrc",
  "prf": "DCC.SkillPrf",
  "per": "DCC.SkillPer",
  "rel": "DCC.SkillRel",
  "slt": "DCC.SkillSlt",
  "ste": "DCC.SkillSte",
  "sur": "DCC.SkillSur"
};


/* -------------------------------------------- */

DCC.spellPreparationModes = {
  "always": "DCC.SpellPrepAlways",
  "atwill": "DCC.SpellPrepAtWill",
  "innate": "DCC.SpellPrepInnate",
  "pact": "DCC.PactMagic",
  "prepared": "DCC.SpellPrepPrepared"
};

DCC.spellUpcastModes = ["always", "pact", "prepared"];


DCC.spellProgression = {
  "none": "DCC.SpellNone",
  "full": "DCC.SpellProgFull",
  "half": "DCC.SpellProgHalf",
  "third": "DCC.SpellProgThird",
  "pact": "DCC.SpellProgPact",
  "artificer": "DCC.SpellProgArt"
};

/* -------------------------------------------- */

/**
 * The available choices for how spell damage scaling may be computed
 * @type {Object}
 */
DCC.spellScalingModes = {
  "none": "DCC.SpellNone",
  "cantrip": "DCC.SpellCantrip",
  "level": "DCC.SpellLevel"
};

/* -------------------------------------------- */


/**
 * Define the set of types which a weapon item can take
 * @type {Object}
 */
DCC.weaponTypes = {
  "simpleM": "DCC.WeaponSimpleM",
  "simpleR": "DCC.WeaponSimpleR",
  "martialM": "DCC.WeaponMartialM",
  "martialR": "DCC.WeaponMartialR",
  "natural": "DCC.WeaponNatural",
  "improv": "DCC.WeaponImprov"
};


/* -------------------------------------------- */

/**
 * Define the set of weapon property flags which can exist on a weapon
 * @type {Object}
 */
DCC.weaponProperties = {
  "amm": "DCC.WeaponPropertiesAmm",
  "hvy": "DCC.WeaponPropertiesHvy",
  "fin": "DCC.WeaponPropertiesFin",
  "fir": "DCC.WeaponPropertiesFir",
  "foc": "DCC.WeaponPropertiesFoc",
  "lgt": "DCC.WeaponPropertiesLgt",
  "lod": "DCC.WeaponPropertiesLod",
  "rch": "DCC.WeaponPropertiesRch",
  "rel": "DCC.WeaponPropertiesRel",
  "ret": "DCC.WeaponPropertiesRet",
  "spc": "DCC.WeaponPropertiesSpc",
  "thr": "DCC.WeaponPropertiesThr",
  "two": "DCC.WeaponPropertiesTwo",
  "ver": "DCC.WeaponPropertiesVer"
};

// Spell Levels
DCC.spellLevels = {
  0: "DCC.SpellLevel0",
  1: "DCC.SpellLevel1",
  2: "DCC.SpellLevel2",
  3: "DCC.SpellLevel3",
  4: "DCC.SpellLevel4",
  5: "DCC.SpellLevel5",
  6: "DCC.SpellLevel6",
  7: "DCC.SpellLevel7",
  8: "DCC.SpellLevel8",
  9: "DCC.SpellLevel9"
};

/**
 * Define the standard slot progression by character level.
 * The entries of this array represent the spell slot progression for a full spell-caster.
 * @type {Array[]}
 */
DCC.SPELL_SLOT_TABLE = [
  [2],
  [3],
  [4, 2],
  [4, 3],
  [4, 3, 2],
  [4, 3, 3],
  [4, 3, 3, 1],
  [4, 3, 3, 2],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1]
];

/* -------------------------------------------- */

// Polymorph options.
DCC.polymorphSettings = {
  keepPhysical: 'DCC.PolymorphKeepPhysical',
  keepMental: 'DCC.PolymorphKeepMental',
  keepSaves: 'DCC.PolymorphKeepSaves',
  keepSkills: 'DCC.PolymorphKeepSkills',
  mergeSaves: 'DCC.PolymorphMergeSaves',
  mergeSkills: 'DCC.PolymorphMergeSkills',
  keepClass: 'DCC.PolymorphKeepClass',
  keepFeats: 'DCC.PolymorphKeepFeats',
  keepSpells: 'DCC.PolymorphKeepSpells',
  keepItems: 'DCC.PolymorphKeepItems',
  keepBio: 'DCC.PolymorphKeepBio',
  keepVision: 'DCC.PolymorphKeepVision'
};

/* -------------------------------------------- */

/**
 * Skill, ability, and tool proficiency levels
 * Each level provides a proficiency multiplier
 * @type {Object}
 */
DCC.proficiencyLevels = {
  0: "DCC.NotProficient",
  1: "DCC.Proficient",
  0.5: "DCC.HalfProficient",
  2: "DCC.Expertise"
};

/* -------------------------------------------- */


// Condition Types
DCC.conditionTypes = {
  "blinded": "DCC.ConBlinded",
  "charmed": "DCC.ConCharmed",
  "deafened": "DCC.ConDeafened",
  "diseased": "DCC.ConDiseased",
  "exhaustion": "DCC.ConExhaustion",
  "frightened": "DCC.ConFrightened",
  "grappled": "DCC.ConGrappled",
  "incapacitated": "DCC.ConIncapacitated",
  "invisible": "DCC.ConInvisible",
  "paralyzed": "DCC.ConParalyzed",
  "petrified": "DCC.ConPetrified",
  "poisoned": "DCC.ConPoisoned",
  "prone": "DCC.ConProne",
  "restrained": "DCC.ConRestrained",
  "stunned": "DCC.ConStunned",
  "unconscious": "DCC.ConUnconscious"
};

// Languages
DCC.languages = {
  "common": "DCC.LanguagesCommon",
  "aarakocra": "DCC.LanguagesAarakocra",
  "abyssal": "DCC.LanguagesAbyssal",
  "aquan": "DCC.LanguagesAquan",
  "auran": "DCC.LanguagesAuran",
  "celestial": "DCC.LanguagesCelestial",
  "deep": "DCC.LanguagesDeepSpeech",
  "draconic": "DCC.LanguagesDraconic",
  "druidic": "DCC.LanguagesDruidic",
  "dwarvish": "DCC.LanguagesDwarvish",
  "elvish": "DCC.LanguagesElvish",
  "giant": "DCC.LanguagesGiant",
  "gith": "DCC.LanguagesGith",
  "gnomish": "DCC.LanguagesGnomish",
  "goblin": "DCC.LanguagesGoblin",
  "gnoll": "DCC.LanguagesGnoll",
  "halfling": "DCC.LanguagesHalfling",
  "ignan": "DCC.LanguagesIgnan",
  "infernal": "DCC.LanguagesInfernal",
  "orc": "DCC.LanguagesOrc",
  "primordial": "DCC.LanguagesPrimordial",
  "sylvan": "DCC.LanguagesSylvan",
  "terran": "DCC.LanguagesTerran",
  "cant": "DCC.LanguagesThievesCant",
  "undercommon": "DCC.LanguagesUndercommon"
};

// Character Level XP Requirements
DCC.CHARACTER_EXP_LEVELS =  [
  0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000,
  120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000]
;

// Challenge Rating XP Levels
DCC.CR_EXP_LEVELS = [
  10, 200, 450, 700, 1100, 1800, 2300, 2900, 3900, 5000, 5900, 7200, 8400, 10000, 11500, 13000, 15000, 18000,
  20000, 22000, 25000, 33000, 41000, 50000, 62000, 75000, 90000, 105000, 120000, 135000, 155000
];

// Configure Optional Character Flags
DCC.characterFlags = {
  "powerfulBuild": {
    name: "DCC.FlagsPowerfulBuild",
    hint: "DCC.FlagsPowerfulBuildHint",
    section: "Racial Traits",
    type: Boolean
  },
  "savageAttacks": {
    name: "DCC.FlagsSavageAttacks",
    hint: "DCC.FlagsSavageAttacksHint",
    section: "Racial Traits",
    type: Boolean
  },
  "elvenAccuracy": {
    name: "DCC.FlagsElvenAccuracy",
    hint: "DCC.FlagsElvenAccuracyHint",
    section: "Racial Traits",
    type: Boolean
  },
  "halflingLucky": {
    name: "DCC.FlagsHalflingLucky",
    hint: "DCC.FlagsHalflingLuckyHint",
    section: "Racial Traits",
    type: Boolean
  },
  "initiativeAdv": {
    name: "DCC.FlagsInitiativeAdv",
    hint: "DCC.FlagsInitiativeAdvHint",
    section: "Feats",
    type: Boolean
  },
  "initiativeAlert": {
    name: "DCC.FlagsAlert",
    hint: "DCC.FlagsAlertHint",
    section: "Feats",
    type: Boolean
  },
  "jackOfAllTrades": {
    name: "DCC.FlagsJOAT",
    hint: "DCC.FlagsJOATHint",
    section: "Feats",
    type: Boolean
  },
  "observantFeat": {
    name: "DCC.FlagsObservant",
    hint: "DCC.FlagsObservantHint",
    skills: ['prc','inv'],
    section: "Feats",
    type: Boolean
  },
  "reliableTalent": {
    name: "DCC.FlagsReliableTalent",
    hint: "DCC.FlagsReliableTalentHint",
    section: "Feats",
    type: Boolean
  },
  "remarkableAthlete": {
    name: "DCC.FlagsRemarkableAthlete",
    hint: "DCC.FlagsRemarkableAthleteHint",
    abilities: ['str','dex','con'],
    section: "Feats",
    type: Boolean
  },
  "weaponCriticalThreshold": {
    name: "DCC.FlagsCritThreshold",
    hint: "DCC.FlagsCritThresholdHint",
    section: "Feats",
    type: Number,
    placeholder: 20
  }
};

// Configure allowed status flags
DCC.allowedActorFlags = [
  "isPolymorphed", "originalActor"
].concat(Object.keys(DCC.characterFlags));