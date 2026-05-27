/**
 * Sample/Example Data for Character Creation
 *
 * FAN-MADE CONTENT - NOT OFFICIAL DCC RPG MATERIAL
 *
 * This module provides example data inspired by old-school fantasy RPGs
 * for testing and demonstration purposes. These are original creations
 * and are NOT from any published game system.
 *
 * For official DCC RPG data, use the separate dcc-official-data package.
 */
// =============================================================================
// Example Birth Augurs (Fan-Made)
// =============================================================================
/**
 * Example birth augur data for testing.
 * These are original fan-made entries, not official DCC content.
 * Roll 1d30 to select a birth augur.
 */
export const SAMPLE_BIRTH_AUGURS = [
    { roll: 1, name: "Child of Frost", affects: "All attack rolls", effectType: "attack-all" },
    { roll: 2, name: "Iron Fist", affects: "Melee attack rolls", effectType: "attack-melee" },
    { roll: 3, name: "Eagle Eye", affects: "Missile fire attack rolls", effectType: "attack-missile" },
    { roll: 4, name: "Street Fighter", affects: "Unarmed attack rolls", effectType: "attack-unarmed" },
    { roll: 5, name: "Born in the Saddle", affects: "Mounted attack rolls", effectType: "attack-mounted" },
    { roll: 6, name: "Scarred Veteran", affects: "Damage rolls", effectType: "damage-all" },
    { roll: 7, name: "Bear's Strength", affects: "Melee damage rolls", effectType: "damage-melee" },
    { roll: 8, name: "Steady Hand", affects: "Missile fire damage rolls", effectType: "damage-missile" },
    { roll: 9, name: "Ancestral Blade", affects: "Attack and damage rolls for 0-level starting weapon", effectType: "starting-weapon" },
    { roll: 10, name: "Nimble Fingers", affects: "Skill checks (including thief skills)", effectType: "skill-check" },
    { roll: 11, name: "Wary Mind", affects: "Find/disable traps", effectType: "find-trap" },
    { roll: 12, name: "Keen Senses", affects: "Find secret doors", effectType: "find-secret-door" },
    { roll: 13, name: "Mystic Blood", affects: "Spell checks", effectType: "spell-check" },
    { roll: 14, name: "Tempest Born", affects: "Spell damage", effectType: "spell-damage" },
    { roll: 15, name: "Holy Touched", affects: "Turn unholy checks", effectType: "turn-unholy" },
    { roll: 16, name: "Blessed Constitution", affects: "Magical healing", effectType: "magical-healing" },
    { roll: 17, name: "Fortune's Child", affects: "Saving throws", effectType: "saving-throw-all" },
    { roll: 18, name: "Quick Reflexes", affects: "Saving throws to escape traps", effectType: "saving-throw-trap" },
    { roll: 19, name: "Hardy Soul", affects: "Saving throws against poison", effectType: "saving-throw-poison" },
    { roll: 20, name: "Cat's Grace", affects: "Reflex saving throws", effectType: "saving-throw-reflex" },
    { roll: 21, name: "Ox's Endurance", affects: "Fortitude saving throws", effectType: "saving-throw-fortitude" },
    { roll: 22, name: "Strong Willed", affects: "Willpower saving throws", effectType: "saving-throw-will" },
    { roll: 23, name: "Phantom Step", affects: "Armor Class", effectType: "armor-class" },
    { roll: 24, name: "Lightning Reflexes", affects: "Initiative", effectType: "initiative" },
    { roll: 25, name: "Vigorous Health", affects: "Hit points (applies at each level)", effectType: "hit-points" },
    { roll: 26, name: "Deadly Precision", affects: "Critical hit tables (modifier doubled)", effectType: "critical-table" },
    { roll: 27, name: "Dark Blessing", affects: "Corruption rolls", effectType: "corruption" },
    { roll: 28, name: "Cursed Star", affects: "Fumbles (modifier doubled)", effectType: "fumble-table" },
    { roll: 29, name: "Silver Tongue", affects: "Number of languages", effectType: "languages" },
    { roll: 30, name: "Fleet Footed", affects: "Speed (each +1/-1 = +5'/-5' speed)", effectType: "speed" },
];
// =============================================================================
// Example Occupations (Fan-Made)
// =============================================================================
/**
 * Example occupation data for testing.
 * These are original fan-made entries, not official DCC content.
 * Roll 1d100 to select an occupation.
 */
export const SAMPLE_OCCUPATIONS = [
    { roll: 1, name: "Potion Brewer", trainedWeapon: "Staff", tradeGoods: "Vial of reagents" },
    { roll: 2, name: "Beast Handler", trainedWeapon: "Club", tradeGoods: "Mule" },
    { roll: 3, name: "Plate Smith", trainedWeapon: "Hammer (as club)", tradeGoods: "Steel helm" },
    { roll: 4, name: "Star Reader", trainedWeapon: "Dagger", tradeGoods: "Brass telescope" },
    { roll: 5, name: "Hair Cutter", trainedWeapon: "Razor (as dagger)", tradeGoods: "Mirror" },
    { roll: 6, name: "Temple Keeper", trainedWeapon: "Staff", tradeGoods: "Prayer beads" },
    { roll: 7, name: "Honey Farmer", trainedWeapon: "Staff", tradeGoods: "Pot of honey" },
    { roll: 8, name: "Iron Worker", trainedWeapon: "Hammer (as club)", tradeGoods: "Iron tongs" },
    { roll: 9, name: "Meat Cutter", trainedWeapon: "Cleaver (as axe)", tradeGoods: "Salted pork" },
    { roll: 10, name: "Wagon Guard", trainedWeapon: "Short sword", tradeGoods: "Wool blanket" },
    { roll: 11, name: "Curd Maker", trainedWeapon: "Cudgel (as staff)", tradeGoods: "Wheel of cheese" },
    { roll: 12, name: "Boot Maker", trainedWeapon: "Awl (as dagger)", tradeGoods: "Leather scraps" },
    { roll: 13, name: "Snake Oil Seller", trainedWeapon: "Dagger", tradeGoods: "Fancy hat" },
    { roll: 14, name: "Barrel Maker", trainedWeapon: "Crowbar (as club)", tradeGoods: "Small cask" },
    { roll: 15, name: "Fruit Seller", trainedWeapon: "Knife (as dagger)", tradeGoods: "Basket of apples" },
    { roll: 16, name: "Pickpocket", trainedWeapon: "Dagger", tradeGoods: "Lockpicks" },
    { roll: 17, name: "Ditch Worker", trainedWeapon: "Shovel (as staff)", tradeGoods: "Bucket" },
    { roll: 18, name: "Pier Hand", trainedWeapon: "Pole (as staff)", tradeGoods: "Fishing net" },
    { roll: 19, name: "Stout Herbalist", trainedWeapon: "Cudgel (as staff)", tradeGoods: "Copper vial" },
    { roll: 20, name: "Stout Smith", trainedWeapon: "Hammer (as club)", tradeGoods: "Silver ore, 1 oz." },
    { roll: 21, name: "Stout Carpenter", trainedWeapon: "Chisel (as dagger)", tradeGoods: "Hardwood, 5 lbs." },
    { roll: 22, name: "Stout Shepherd", trainedWeapon: "Staff", tradeGoods: "Goat" },
    { roll: "23-24", name: "Stout Tunneler", trainedWeapon: "Pick (as club)", tradeGoods: "Oil lamp" },
    { roll: 25, name: "Stout Fungus Grower", trainedWeapon: "Shovel (as staff)", tradeGoods: "Canvas sack" },
    { roll: 26, name: "Stout Vermin Hunter", trainedWeapon: "Club", tradeGoods: "Wire snare" },
    { roll: "27-28", name: "Stout Mason", trainedWeapon: "Hammer", tradeGoods: "Granite block" },
    { roll: 29, name: "Fey Potter", trainedWeapon: "Staff", tradeGoods: "Clay, 2 lbs." },
    { roll: 30, name: "Fey Advocate", trainedWeapon: "Quill (as dart)", tradeGoods: "Leather journal" },
    { roll: 31, name: "Fey Candle Maker", trainedWeapon: "Scissors (as dagger)", tradeGoods: "Beeswax candles, 12" },
    { roll: 32, name: "Fey Hawk Keeper", trainedWeapon: "Dagger", tradeGoods: "Trained hawk" },
    { roll: "33-34", name: "Fey Woodsman", trainedWeapon: "Staff", tradeGoods: "Healing herbs" },
    { roll: 35, name: "Fey Glass Smith", trainedWeapon: "Hammer (as club)", tradeGoods: "Glass marbles" },
    { roll: 36, name: "Fey Sailor", trainedWeapon: "Shortbow", tradeGoods: "Compass" },
    { roll: 37, name: "Fey Scholar", trainedWeapon: "Dagger", tradeGoods: "Ink and quill" },
    { roll: "38-47", name: "Tiller", trainedWeapon: "Pitchfork (as spear)", tradeGoods: "Chicken", isFarmer: true },
    { roll: 48, name: "Card Reader", trainedWeapon: "Dagger", tradeGoods: "Fortune cards" },
    { roll: 49, name: "Dice Roller", trainedWeapon: "Club", tradeGoods: "Loaded dice" },
    { roll: 50, name: "Sewer Worker", trainedWeapon: "Trowel (as dagger)", tradeGoods: "Wading boots" },
    { roll: "51-52", name: "Cemetery Keeper", trainedWeapon: "Shovel (as staff)", tradeGoods: "Lantern" },
    { roll: 53, name: "Street Beggar", trainedWeapon: "Sling", tradeGoods: "Wooden bowl" },
    { roll: 54, name: "Smallfolk Poulterer", trainedWeapon: "Hand axe", tradeGoods: "Salted chicken" },
    { roll: 55, name: "Smallfolk Cloth Dyer", trainedWeapon: "Staff", tradeGoods: "Dyed linen, 2 yards" },
    { roll: 56, name: "Smallfolk Mitten Maker", trainedWeapon: "Awl (as dagger)", tradeGoods: "Mittens, 3 pairs" },
    { roll: 57, name: "Smallfolk Wanderer", trainedWeapon: "Sling", tradeGoods: "Lucky charm" },
    { roll: 58, name: "Smallfolk Hat Maker", trainedWeapon: "Scissors (as dagger)", tradeGoods: "Fancy hats, 2" },
    { roll: 59, name: "Smallfolk Boatman", trainedWeapon: "Knife (as dagger)", tradeGoods: "Rope, 20'" },
    { roll: 60, name: "Smallfolk Banker", trainedWeapon: "Short sword", tradeGoods: "3 gp, 15 sp, 100 cp", startingFunds: 550 },
    { roll: 61, name: "Smallfolk Peddler", trainedWeapon: "Short sword", tradeGoods: "15 sp", startingFunds: 150 },
    { roll: 62, name: "Smallfolk Drifter", trainedWeapon: "Club", tradeGoods: "Tin cup" },
    { roll: 63, name: "Village Healer", trainedWeapon: "Club", tradeGoods: "Blessed water" },
    { roll: 64, name: "Herb Gatherer", trainedWeapon: "Club", tradeGoods: "Dried herbs" },
    { roll: 65, name: "Goat Herder", trainedWeapon: "Staff", tradeGoods: "Loyal hound" },
    { roll: "66-67", name: "Game Hunter", trainedWeapon: "Shortbow", tradeGoods: "Fox pelt" },
    { roll: 68, name: "Bonded Servant", trainedWeapon: "Staff", tradeGoods: "Silver pendant" },
    { roll: 69, name: "Court Fool", trainedWeapon: "Dart", tradeGoods: "Motley clothes" },
    { roll: 70, name: "Gem Cutter", trainedWeapon: "Dagger", tradeGoods: "Polished stone worth 15 gp" },
    { roll: 71, name: "Key Maker", trainedWeapon: "Dagger", tradeGoods: "Precision tools" },
    { roll: 72, name: "Wandering Monk", trainedWeapon: "Club", tradeGoods: "Prayer book" },
    { roll: 73, name: "Sellsword", trainedWeapon: "Longsword", tradeGoods: "Padded armor" },
    { roll: 74, name: "Trader", trainedWeapon: "Dagger", tradeGoods: "3 gp, 10 sp, 50 cp", startingFunds: 450 },
    { roll: 75, name: "Grain Miller", trainedWeapon: "Club", tradeGoods: "Bag of grain" },
    { roll: 76, name: "Street Singer", trainedWeapon: "Dagger", tradeGoods: "Wooden flute" },
    { roll: 77, name: "Minor Noble", trainedWeapon: "Longsword", tradeGoods: "Signet ring worth 8 gp" },
    { roll: 78, name: "Foundling", trainedWeapon: "Club", tradeGoods: "Tattered blanket" },
    { roll: 79, name: "Stable Hand", trainedWeapon: "Staff", tradeGoods: "Saddle" },
    { roll: 80, name: "Brigand", trainedWeapon: "Short sword", tradeGoods: "Studded leather" },
    { roll: 81, name: "Cord Maker", trainedWeapon: "Knife (as dagger)", tradeGoods: "Hemp rope, 50'" },
    { roll: 82, name: "Copyist", trainedWeapon: "Dart", tradeGoods: "Blank scrolls, 5" },
    { roll: 83, name: "Spirit Talker", trainedWeapon: "Mace", tradeGoods: "Incense bundle" },
    { roll: 84, name: "Thrall", trainedWeapon: "Club", tradeGoods: "Odd trinket" },
    { roll: 85, name: "Contraband Runner", trainedWeapon: "Sling", tradeGoods: "Hidden pocket cloak" },
    { roll: 86, name: "Foot Soldier", trainedWeapon: "Spear", tradeGoods: "Wooden shield" },
    { roll: "87-88", name: "Knight's Page", trainedWeapon: "Longsword", tradeGoods: "Iron helm" },
    { roll: 89, name: "Tithe Collector", trainedWeapon: "Longsword", tradeGoods: "80 cp", startingFunds: 80 },
    { roll: "90-91", name: "Fur Trapper", trainedWeapon: "Sling", tradeGoods: "Rabbit pelts" },
    { roll: 92, name: "Street Rat", trainedWeapon: "Stick (as club)", tradeGoods: "Worn cup" },
    { roll: 93, name: "Cart Builder", trainedWeapon: "Club", tradeGoods: "Handcart" },
    { roll: 94, name: "Cloth Weaver", trainedWeapon: "Dagger", tradeGoods: "Embroidered tunic" },
    { roll: 95, name: "Sorcerer's Aide", trainedWeapon: "Dagger", tradeGoods: "Dusty tome" },
    { roll: "96-100", name: "Lumber Jack", trainedWeapon: "Handaxe", tradeGoods: "Firewood bundle" },
];
// =============================================================================
// Default Data Object
// =============================================================================
/**
 * Default character creation data using fan-made content.
 * Use this for testing or when official data isn't available.
 *
 * For official DCC RPG data, use the dcc-official-data package instead.
 */
export const DEFAULT_CHARACTER_CREATION_DATA = {
    birthAugurs: SAMPLE_BIRTH_AUGURS,
    occupations: SAMPLE_OCCUPATIONS,
};
// =============================================================================
// Helper Functions
// =============================================================================
/**
 * Check if a roll matches an occupation entry.
 * Handles both single numbers and ranges like "23-24".
 */
export function occupationMatchesRoll(occupation, roll) {
    if (typeof occupation.roll === "number") {
        return occupation.roll === roll;
    }
    // Handle range like "23-24"
    const parts = occupation.roll.split("-");
    const min = parseInt(parts[0] ?? "0", 10);
    const max = parseInt(parts[1] ?? parts[0] ?? "0", 10);
    return roll >= min && roll <= max;
}
/**
 * Find an occupation by roll value.
 */
export function findOccupationByRoll(occupations, roll) {
    return occupations.find((o) => occupationMatchesRoll(o, roll));
}
/**
 * Find a birth augur by roll value.
 */
export function findBirthAugurByRoll(augurs, roll) {
    return augurs.find((a) => a.roll === roll);
}
/**
 * Get the effect type ID for programmatic use.
 */
export function getBirthAugurEffectType(augur) {
    return augur.effectType ?? "unknown";
}
// =============================================================================
// Example XP Thresholds (Fan-Made)
// =============================================================================
/**
 * Standard XP progression thresholds.
 * XP needed to reach each level (index 0 = level 1).
 *
 * This is a fan-made approximation for testing purposes.
 * Official DCC data should be loaded from dcc-official-data.
 */
const STANDARD_XP = [10, 50, 110, 190, 290, 410, 550, 710, 890, 1090];
/**
 * Slower XP progression for more powerful races (e.g., elves).
 * Requires 20% more XP at each level.
 */
const SLOW_XP = [12, 60, 132, 228, 348, 492, 660, 852, 1068, 1308];
/**
 * Sample XP thresholds for all core classes.
 * These are fan-made approximations for testing.
 */
export const SAMPLE_XP_THRESHOLDS = [
    { classId: "warrior", thresholds: STANDARD_XP },
    { classId: "wizard", thresholds: STANDARD_XP },
    { classId: "cleric", thresholds: STANDARD_XP },
    { classId: "thief", thresholds: STANDARD_XP },
    { classId: "dwarf", thresholds: STANDARD_XP },
    { classId: "elf", thresholds: SLOW_XP },
    { classId: "halfling", thresholds: STANDARD_XP },
];
//# sourceMappingURL=sample-data.js.map