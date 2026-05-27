/**
 * Narrative Encounter Templates
 *
 * Pre-built templates for non-combat encounters:
 * exploration, traps, puzzles, social, and environmental.
 */
/**
 * All available narrative templates, keyed by ID.
 */
export const NARRATIVE_TEMPLATES = {
    // =========================================================================
    // Exploration Templates
    // =========================================================================
    "explore-dark-passage": {
        id: "explore-dark-passage",
        category: "exploration",
        situation: "A dark passage stretches ahead. The flickering light of your torch reveals damp stone walls, and you hear the distant drip of water echoing from somewhere deeper within.",
        options: [
            {
                id: "proceed-carefully",
                text: "Proceed carefully, checking for traps",
                skillCheck: { ability: "int", dc: 10 },
                successOutcome: "Your cautious advance pays off. You spot a pressure plate in the floor and carefully step around it, continuing safely.",
                failureOutcome: "Despite your care, you miss a loose flagstone. It shifts under your weight with a grinding sound, but fortunately nothing happens—this time.",
            },
            {
                id: "rush-forward",
                text: "Move quickly through the passage",
                successOutcome: "You dash through the passage, boots splashing through puddles. The passage opens into a larger chamber ahead.",
            },
            {
                id: "listen-sounds",
                text: "Stop and listen to the sounds",
                skillCheck: { ability: "per", dc: 8 },
                successOutcome: "You still your breathing and focus. Beyond the dripping water, you detect faint scratching sounds from ahead—something alive lurks in the darkness.",
                failureOutcome: "You strain to hear, but the echoing drips mask any other sounds. The passage's acoustics make it impossible to determine what lies ahead.",
            },
        ],
    },
    "explore-ancient-door": {
        id: "explore-ancient-door",
        category: "exploration",
        situation: "An ancient stone door blocks your path. Strange runes are carved into its surface, and a faint magical glow pulses from within the carvings.",
        options: [
            {
                id: "examine-runes",
                text: "Study the runes carefully",
                skillCheck: { ability: "int", dc: 12 },
                successOutcome: "The runes are a warding incantation. You recognize the pattern—speaking the runes backwards should deactivate the seal. The door slides open with a rumble.",
                failureOutcome: "The runes swim before your eyes. You recognize fragments of ancient script but cannot piece together their meaning. The door remains sealed.",
            },
            {
                id: "force-door",
                text: "Try to force the door open",
                skillCheck: { ability: "str", dc: 15 },
                successOutcome: "With a tremendous heave, you break the ancient seal. The door grinds open, runes flickering and dying as the magic dissipates.",
                failureOutcome: "You throw your weight against the door, but the magical seal holds firm. The runes flare bright blue, and you feel a sharp shock run through your body.",
            },
            {
                id: "search-mechanism",
                text: "Search for a hidden mechanism",
                skillCheck: { ability: "agl", dc: 11 },
                successOutcome: "Running your fingers along the door frame, you find a concealed lever. A click, and the door swings silently open.",
                failureOutcome: "You search thoroughly but find only smooth stone. If there's a mechanism, it's too well hidden to find.",
            },
        ],
    },
    // =========================================================================
    // Trap Templates
    // =========================================================================
    "trap-pit": {
        id: "trap-pit",
        category: "trap",
        situation: "The floor gives way beneath your feet! You're falling into a pit trap lined with rusty spikes below.",
        options: [
            {
                id: "grab-edge",
                text: "Try to grab the edge",
                skillCheck: { ability: "agl", dc: 12 },
                successOutcome: "Your reflexes save you. You catch the lip of the pit and haul yourself back up, heart pounding. The spikes gleam wickedly below.",
                failureOutcome: "Your fingers scrape uselessly against the smooth stone as you tumble into the pit. The spikes bite deep.",
            },
            {
                id: "roll-clear",
                text: "Roll to the side",
                skillCheck: { ability: "agl", dc: 14 },
                successOutcome: "You throw yourself sideways, tucking into a roll. You hit solid ground as the pit yawns open where you stood a moment ago.",
                failureOutcome: "You try to dodge but the crumbling floor is too wide. You plummet downward into the darkness.",
            },
            {
                id: "brace-fall",
                text: "Brace for impact",
                skillCheck: { ability: "sta", dc: 10 },
                successOutcome: "You twist in midair, landing between the spikes in a crouch. Bruised but unimpaled, you climb out using the pit's rough walls.",
                failureOutcome: "The fall is too fast. You crash into the spikes with a sickening thud.",
            },
        ],
    },
    "trap-poison-needle": {
        id: "trap-poison-needle",
        category: "trap",
        situation: "As you open the chest, a needle springs from the lock mechanism, pricking your finger. A burning sensation begins spreading up your hand.",
        options: [
            {
                id: "suck-poison",
                text: "Suck out the poison immediately",
                skillCheck: { ability: "sta", dc: 10 },
                successOutcome: "You act fast, sucking at the wound and spitting out the tainted blood. The burning fades to a dull ache.",
                failureOutcome: "Despite your efforts, the poison has already entered your bloodstream. Your vision swims as the toxin takes hold.",
            },
            {
                id: "apply-tourniquet",
                text: "Apply a tourniquet above the wound",
                skillCheck: { ability: "int", dc: 11 },
                successOutcome: "Using your belt, you quickly bind your forearm tight. The poison's spread slows, giving your body time to fight it off.",
                failureOutcome: "In your panic, you tie the tourniquet too loose. The poison continues spreading through your veins.",
            },
            {
                id: "endure-poison",
                text: "Grit your teeth and endure it",
                skillCheck: { ability: "sta", dc: 14 },
                successOutcome: "You steel yourself against the burning. Your body fights the poison, and gradually the pain subsides. You're tougher than you look.",
                failureOutcome: "The poison overwhelms your system. You collapse, consciousness fading as the venom does its work.",
            },
        ],
    },
    // =========================================================================
    // Puzzle Templates
    // =========================================================================
    "puzzle-lever-sequence": {
        id: "puzzle-lever-sequence",
        category: "puzzle",
        situation: "Three levers protrude from the wall—iron, bronze, and gold. Above them, faded murals depict the sun rising, a crescent moon, and a star. The door ahead is sealed.",
        options: [
            {
                id: "logical-order",
                text: "Pull in logical order (sun, moon, star)",
                skillCheck: { ability: "int", dc: 10 },
                successOutcome: "Sun rises before moon, moon before stars appear. You pull iron, bronze, gold in sequence. With a satisfying click, the door unlocks.",
                failureOutcome: "You pull the levers in what seems like the right order, but the door remains sealed. Perhaps the murals mean something else entirely.",
            },
            {
                id: "reverse-order",
                text: "Pull in reverse order (star, moon, sun)",
                successOutcome: "Working backwards through the celestial cycle, you pull gold, bronze, then iron. The mechanism engages and the door swings open.",
            },
            {
                id: "examine-clues",
                text: "Look for additional clues",
                skillCheck: { ability: "int", dc: 12 },
                successOutcome: "Examining the murals closely, you notice the star is painted first, then moon, then sun. Following this sequence opens the door.",
                failureOutcome: "You study the murals intently but can't discern any additional pattern. The faded paint reveals nothing new.",
            },
        ],
    },
    "puzzle-riddle-door": {
        id: "puzzle-riddle-door",
        category: "puzzle",
        situation: "A stone face carved into the door speaks: 'I have cities, but no houses. I have mountains, but no trees. I have water, but no fish. I have roads, but no cars. What am I?'",
        options: [
            {
                id: "answer-map",
                text: "Answer: 'A map'",
                successOutcome: "The stone face smiles. 'Correct, traveler.' The door swings open, revealing the passage beyond.",
            },
            {
                id: "answer-dream",
                text: "Answer: 'A dream'",
                successOutcome: "The stone face considers for a long moment, then grudgingly opens. 'A creative answer... I'll allow it.'",
            },
            {
                id: "answer-death",
                text: "Answer: 'Death'",
                skillCheck: { ability: "per", dc: 14 },
                successOutcome: "The stone face's eyes widen. 'A philosopher! Not the answer I sought, but you've given me something to ponder.' The door opens.",
                failureOutcome: "The stone face scowls. 'Incorrect, and unimaginative. Try again when you've thought harder.'",
            },
        ],
    },
    // =========================================================================
    // Social Templates
    // =========================================================================
    "social-suspicious-guard": {
        id: "social-suspicious-guard",
        category: "social",
        situation: "A burly guard blocks your path, hand resting on his sword hilt. 'State your business,' he growls, eyeing your weapons suspiciously.",
        options: [
            {
                id: "honest-answer",
                text: "Tell the truth about your mission",
                skillCheck: { ability: "per", dc: 10 },
                successOutcome: "Something in your honest demeanor convinces the guard. He nods slowly and steps aside. 'Alright, but don't cause any trouble.'",
                failureOutcome: "The guard's eyes narrow. 'That sounds like a load of manure. Turn around and go back the way you came.'",
            },
            {
                id: "bluff",
                text: "Claim to be on official business",
                skillCheck: { ability: "per", dc: 14 },
                successOutcome: "You adopt an authoritative tone. The guard straightens, suddenly uncertain. 'My apologies, I didn't realize—please, proceed.'",
                failureOutcome: "The guard snorts. 'Nice try. I know everyone on official business, and you ain't one of them. Move along.'",
            },
            {
                id: "bribe",
                text: "Offer a few coins for his trouble",
                skillCheck: { ability: "per", dc: 12 },
                successOutcome: "The coins disappear into his palm. 'I didn't see nothing,' he mutters, stepping aside.",
                failureOutcome: "'You trying to bribe me?' The guard's voice rises dangerously. 'That's a serious offense around here.'",
            },
            {
                id: "intimidate",
                text: "Intimidate the guard into backing down",
                skillCheck: { ability: "str", dc: 13 },
                successOutcome: "You step forward, looming over the guard. Something in your eyes makes him reconsider. 'Fine, fine... go ahead.'",
                failureOutcome: "The guard laughs in your face. 'Trying to scare me? I've faced worse than you before breakfast.'",
            },
        ],
    },
    "social-merchant-haggle": {
        id: "social-merchant-haggle",
        category: "social",
        situation: "The merchant's eyes gleam as he names his price for the ancient artifact. 'Fifty gold pieces, and not a copper less!' The price seems outrageous.",
        options: [
            {
                id: "negotiate",
                text: "Negotiate for a better price",
                skillCheck: { ability: "per", dc: 12 },
                successOutcome: "After much back-and-forth, you settle on thirty gold pieces. The merchant grumbles but accepts, knowing he's still made a profit.",
                failureOutcome: "The merchant won't budge. 'Fifty gold, take it or leave it. I have other buyers interested.'",
            },
            {
                id: "point-flaws",
                text: "Point out flaws to lower the price",
                skillCheck: { ability: "int", dc: 14 },
                successOutcome: "You note a hairline crack and some corrosion. The merchant's smile falters. 'Fine, fine... forty gold. You drive a hard bargain.'",
                failureOutcome: "The merchant dismisses your observations. 'Those are signs of authenticity! If anything, they add value.'",
            },
            {
                id: "walk-away",
                text: "Start walking away",
                skillCheck: { ability: "per", dc: 10 },
                successOutcome: "'Wait!' the merchant calls. 'Perhaps... forty-five gold?' You've called his bluff.",
                failureOutcome: "The merchant shrugs as you leave. 'Your loss. Someone else will pay full price.' He seems unconcerned.",
            },
        ],
    },
    // =========================================================================
    // Environmental Templates
    // =========================================================================
    "env-rushing-river": {
        id: "env-rushing-river",
        category: "environmental",
        situation: "A fast-flowing river blocks your path. The water rushes past, cold and deep. Slippery rocks offer a treacherous crossing, or you could search for another way.",
        options: [
            {
                id: "ford-river",
                text: "Ford the river using the rocks",
                skillCheck: { ability: "agl", dc: 12 },
                successOutcome: "You leap from rock to rock, arms windmilling for balance. With a final jump, you reach the far bank, soaked but safe.",
                failureOutcome: "Your foot slips on a moss-covered rock. The current sweeps you downstream, bashing you against rocks before you drag yourself ashore.",
            },
            {
                id: "swim-across",
                text: "Swim across",
                skillCheck: { ability: "sta", dc: 14 },
                successOutcome: "You plunge in and swim hard against the current, finally hauling yourself out on the other side, gasping but victorious.",
                failureOutcome: "The current is stronger than you expected. It drags you under, and you barely make it to shore, coughing up water.",
            },
            {
                id: "search-crossing",
                text: "Search for a better crossing",
                skillCheck: { ability: "int", dc: 10 },
                successOutcome: "Following the bank, you find a fallen log spanning the river. You cross easily, staying dry.",
                failureOutcome: "You search up and down the bank but find nothing better. Time wasted, you return to the rocks.",
            },
        ],
    },
    "env-cave-in": {
        id: "env-cave-in",
        category: "environmental",
        situation: "The ceiling groans ominously. Cracks spread across the stone above you as dust rains down. The tunnel is about to collapse!",
        options: [
            {
                id: "run-forward",
                text: "Sprint forward through the danger",
                skillCheck: { ability: "agl", dc: 13 },
                successOutcome: "You burst into a sprint as rocks crash behind you. Diving forward, you clear the collapse zone just as the ceiling comes down.",
                failureOutcome: "You're not fast enough. A falling stone catches your shoulder, sending you sprawling as debris buries the passage behind you.",
            },
            {
                id: "run-back",
                text: "Retreat the way you came",
                skillCheck: { ability: "agl", dc: 11 },
                successOutcome: "You turn and flee. The collapse seals the way forward, but you escape unharmed.",
                failureOutcome: "Rocks fall around you as you run. One clips your leg, and you stumble out of the collapse zone with a limp.",
            },
            {
                id: "find-cover",
                text: "Find cover and brace yourself",
                skillCheck: { ability: "lck", dc: 12 },
                successOutcome: "You spot an alcove in the wall and press yourself into it. The collapse thunders past, leaving you in a pocket of safety.",
                failureOutcome: "You huddle against the wall, but there's no protection. Rocks pummel you from above as the ceiling gives way.",
            },
        ],
    },
};
/**
 * Get a random template from a specific category.
 */
export function getRandomTemplate(category) {
    const templates = Object.values(NARRATIVE_TEMPLATES).filter((t) => t.category === category);
    if (templates.length === 0) {
        return undefined;
    }
    const index = Math.floor(Math.random() * templates.length);
    return templates[index];
}
/**
 * Get a template by ID.
 */
export function getTemplateById(id) {
    return NARRATIVE_TEMPLATES[id];
}
/**
 * Get all templates in a category.
 */
export function getTemplatesByCategory(category) {
    return Object.values(NARRATIVE_TEMPLATES).filter((t) => t.category === category);
}
/**
 * Get all available categories.
 */
export function getAvailableCategories() {
    return ["exploration", "trap", "puzzle", "social", "environmental"];
}
//# sourceMappingURL=narrative-templates.js.map