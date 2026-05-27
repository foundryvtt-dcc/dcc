/**
 * Fan-Made Name Generation Data
 *
 * DISCLAIMER: This is FAN-MADE CONTENT, not official DCC RPG material.
 * These names are original creations for use with the dcc-core-lib.
 */
import { createDefaultRandomSource } from "../types/random.js";
/**
 * Fan-made human names.
 * Inspired by various medieval and fantasy traditions.
 */
const HUMAN_NAMES = {
    ancestry: "Human",
    firstNames: [
        // Shorter, common-folk names
        "Bram", "Cole", "Dara", "Finn", "Greta", "Holt", "Ivy", "Jace",
        "Kira", "Lorn", "Mira", "Nix", "Orin", "Pell", "Quinn", "Rook",
        "Sage", "Tarn", "Una", "Vance", "Wren", "Yara", "Zev",
        // Longer, more formal names
        "Aldric", "Brenna", "Corwin", "Desmond", "Elara", "Faelan",
        "Gareth", "Helena", "Isolde", "Jasper", "Kestrel", "Leander",
        "Morrigan", "Nestor", "Oriana", "Percival", "Rowena", "Silas",
        "Theron", "Ursula", "Vesper", "Warrick", "Yvaine", "Zephyr",
    ],
    epithets: [
        "the Bold", "the Brave", "the Clever", "the Dark", "the Fair",
        "the Grim", "the Hardy", "the Just", "the Kind", "the Lame",
        "the Lucky", "the Mad", "the Meek", "the Old", "the Pious",
        "the Quick", "the Red", "the Silent", "the Tall", "the Wanderer",
        "the Wise", "the Young", "One-Eye", "Greybeard", "Strongarm",
    ],
};
/**
 * Fan-made dwarf names.
 * Sturdy, earthy names with hard consonants.
 */
const DWARF_NAMES = {
    ancestry: "Dwarf",
    firstNames: [
        "Borin", "Dagni", "Durgan", "Fargrim", "Gundra", "Hilda",
        "Kolgrim", "Magni", "Nori", "Oda", "Ragni", "Sigrun",
        "Thorin", "Ulfgar", "Valdis", "Yngvi", "Brunhild", "Dolgrim",
        "Frida", "Grimjaw", "Helga", "Ingrid", "Jorunn", "Ketil",
        "Lofar", "Mjolnir", "Nordi", "Olga", "Rurik", "Skaadi",
        "Thrain", "Urist", "Volund", "Wulfric",
    ],
    epithets: [
        "Ironfoot", "Stonefist", "Deepdelver", "Goldseeker", "Hammerhand",
        "Axebiter", "Coalbeard", "Gemcutter", "Tunnelborn", "Forgefire",
        "Anvilstrike", "Cragborn", "Darkdelver", "Oreminer", "Rockbreaker",
        "Shieldwall", "Steelgrip", "Earthblood", "Mountainheart", "Copperkettle",
    ],
};
/**
 * Fan-made elf names.
 * Melodic, flowing names with soft sounds.
 */
const ELF_NAMES = {
    ancestry: "Elf",
    firstNames: [
        "Aelindra", "Caelum", "Elowen", "Faelith", "Galanis", "Ilyana",
        "Lirael", "Miravel", "Naelori", "Orovain", "Quelindra", "Sylvain",
        "Thalion", "Vaelori", "Ysolde", "Zephyrine", "Aeris", "Briniel",
        "Ciriael", "Daelis", "Eryniel", "Faelar", "Galadwen", "Helianthus",
        "Isilme", "Jorael", "Kaelindis", "Lorien", "Melisande", "Nymeria",
        "Orindel", "Phaedra", "Rhydian", "Seraphel", "Thessaly", "Ulindra",
    ],
    epithets: [
        "Starweaver", "Moonwhisper", "Dawnseeker", "Nightbloom", "Windwalker",
        "Leafsong", "Silverveil", "Thornshade", "Dewdancer", "Sunspire",
        "Mistwalker", "Starfall", "Willowshade", "Frostbloom", "Emberheart",
        "Skydancer", "Riverstone", "Shadowleaf", "Crystalgaze", "Autumnvale",
    ],
};
/**
 * Fan-made halfling names.
 * Homey, cheerful names often with nature references.
 */
const HALFLING_NAMES = {
    ancestry: "Halfling",
    firstNames: [
        "Arlo", "Bramble", "Clover", "Daisy", "Eldon", "Fern", "Garnet",
        "Hazel", "Iris", "Jasper", "Kip", "Lily", "Moss", "Nettle",
        "Olive", "Pepper", "Quill", "Robin", "Sorrel", "Tansy",
        "Umber", "Violet", "Willow", "Yarrow", "Basil", "Cherry",
        "Dodger", "Ember", "Finch", "Ginger", "Hickory", "Juniper",
        "Larkspur", "Marigold", "Nutmeg", "Poppy", "Reed", "Saffron",
    ],
    epithets: [
        "Goodbarrel", "Lightfoot", "Nimblefingers", "Quickstep", "Merryweather",
        "Applebottom", "Burrowdown", "Cloverheart", "Dimplecheek", "Fairmeadow",
        "Greenhill", "Hearthstone", "Ivybrook", "Kettlebell", "Lakeshire",
        "Mushroomer", "Nicefoot", "Oakbottom", "Puddlejump", "Rosybrook",
    ],
};
/**
 * Default name generation data with all ancestries.
 */
export const DEFAULT_NAME_DATA = {
    human: HUMAN_NAMES,
    dwarf: DWARF_NAMES,
    elf: ELF_NAMES,
    halfling: HALFLING_NAMES,
};
/**
 * Generate a random name for the given ancestry.
 *
 * @param ancestry - The ancestry/race to generate a name for
 * @param data - Name generation data (defaults to DEFAULT_NAME_DATA)
 * @param options - Generation options
 * @param random - Random source (defaults to createDefaultRandomSource())
 * @returns Generated name result
 */
export function generateName(ancestry, data = DEFAULT_NAME_DATA, options = {}, random = createDefaultRandomSource()) {
    const nameData = data[ancestry];
    const includeEpithet = options.includeEpithet ?? false;
    const epithetChance = options.epithetChance ?? 0.3;
    // Pick a random first name
    const firstName = random.pick(nameData.firstNames) ?? "Unknown";
    // Maybe pick an epithet
    let epithet;
    if (includeEpithet && nameData.epithets && nameData.epithets.length > 0) {
        // Use randomIndex to get a value 0-99, check against epithet chance percentage
        const roll = random.randomIndex(100);
        if (roll < epithetChance * 100) {
            epithet = random.pick(nameData.epithets);
        }
    }
    // Build full name
    const fullName = epithet ? `${firstName} ${epithet}` : firstName;
    // Only include epithet property if it has a value (exactOptionalPropertyTypes)
    const result = {
        firstName,
        fullName,
        ancestry: nameData.ancestry,
    };
    if (epithet) {
        result.epithet = epithet;
    }
    return result;
}
/**
 * Detect likely ancestry from occupation name.
 * Returns 'human' as default if no specific ancestry detected.
 *
 * @param occupation - The occupation string to analyze
 * @returns Detected ancestry
 */
export function detectAncestryFromOccupation(occupation) {
    const lower = occupation.toLowerCase();
    if (lower.includes("dwarf") || lower.includes("stout") || lower.includes("dwarven")) {
        return "dwarf";
    }
    if (lower.includes("elf") || lower.includes("fey") || lower.includes("elven")) {
        return "elf";
    }
    if (lower.includes("halfling") || lower.includes("smallfolk")) {
        return "halfling";
    }
    return "human";
}
/**
 * Generate a name based on the character's occupation.
 * Automatically detects ancestry from occupation keywords.
 *
 * @param occupation - The character's occupation
 * @param data - Name generation data
 * @param options - Generation options
 * @param random - Random source
 * @returns Generated name result
 */
export function generateNameForOccupation(occupation, data = DEFAULT_NAME_DATA, options = {}, random = createDefaultRandomSource()) {
    const ancestry = detectAncestryFromOccupation(occupation);
    return generateName(ancestry, data, options, random);
}
//# sourceMappingURL=names.js.map