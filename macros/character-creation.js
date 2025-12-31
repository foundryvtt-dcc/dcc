// DCC Lankhmar Character Generator - Full Suite (Steps 1, 1.5, 2, 3, 4, & 8)
// Step 1: Rolls 3d6 for abilities, allows swapping.
// Step 1.5: Choose Class (Warrior, Thief, Wizard), updates sheet, sets Level 1 stats, AND rolls Hit Points.
// Step 2: Rolls Birth Augur (filtering out Cleric results).
// Step 3: Rolls Place of Origin, Benison, and Doom.
// Step 4: Rolls for starting languages based on Origin, Class, and Intelligence.
// Step 8: Rolls for an Intriguing Item and adds it to inventory.
// Includes PATCH to fix "match is not a function" migration error.

// --- SYSTEM PATCH START ---
// Prevents crash when updating birthAugur or languages if they exist as objects instead of strings
const PlayerModel = CONFIG.Actor.dataModels?.Player;
if (PlayerModel && PlayerModel.prototype.migrateData) {
    const originalMigrate = PlayerModel.prototype.migrateData;
    PlayerModel.prototype.migrateData = function() {
        if (this.details?.birthAugur && typeof this.details.birthAugur === 'object') {
            this.details.birthAugur = this.details.birthAugur.value || "";
        }
        if (this.details?.languages && typeof this.details.languages === 'object') {
            this.details.languages = this.details.languages.value || "";
        }
        return originalMigrate.apply(this, arguments);
    };
}
// --- SYSTEM PATCH END ---

// --- DATA DICTIONARIES ---

const benisonDescriptions = {
  "Accepted Freelance Thief* (4 Luck)": "<b>Accepted Freelance Thief* (4 Luck):</b> The Thieves’ Guild of Lankhmar has bestowed an informal license to the PC allowing him to operate in the city without fear of retribution. The PC is still expected to give the Guild a 25% cut of any illicitly-acquired wealth or face a revocation of status. So long as the PC keeps his end of the agreement, he is allowed to engage in criminal activity. Female thieves, forbidden by custom to be members of the Guild, may possess this benison.",
  "Agent of a Supernatural Entity (4 Luck)": "<b>Agent of a Supernatural Entity (4 Luck):</b> The character begins play as a patron’s agent (see Judge’s Guide to Nehwon p. 29), serving an entity of his choosing. The judge has final say on whether the chosen patron is appropriate and can veto the player’s choice if deemed inappropriate or problematic. The PC begins with a d10 patron die.",
  "Artificer’s Gift* (1 Luck)": "<b>Artificer’s Gift* (1 Luck):</b> The PC has acquired one of the curious devices manufactured in the Eastern Lands, an ingenious item perhaps crafted by the great Gorex himself. This item is a small contraption or weapon that integrates springs, clockworks, mirrors, lenses, or other advanced (by Nehwonian standards) technology. Examples include a ring with a concealed needle dipped in poison, a dagger with a spring-loaded blade, a telescope, or a collapsible climbing pole.",
  "Berserker* (3 Luck)": "<b>Berserker* (3 Luck):</b> The PC can go into a wild frenzy for a number of rounds equal to twice his level each day. These frenzied rounds don’t need to be consecutive, but the PC must make a DC 10 Will save to end his berserker state prematurely. During this berserk rage, the PC gains +2 to attack rolls, damage rolls, and saving throws against fear. While in a rage, the PC cannot spend Luck to heal himself.",
  "Direction Wise (1 Luck)": "<b>Direction Wise (1 Luck):</b> The PC always knows in which direction north lies regardless of impediments (including magical confusion). It is extremely difficult for the PC to become lost.",
  "Excellent Outdoorsman (3 Luck)": "<b>Excellent Outdoorsman (3 Luck):</b> The PC gains a +1d bonus when attempting to hunt, track, construct shelters, or otherwise live for extended periods in the outdoors. When in his native environment, the bonus increases to +2d.",
  "Fearless* (2 Luck)": "<b>Fearless* (2 Luck):</b> The PC is so inured to facing death that he is no longer affected by mundane fear. He is immune to any fear-inducting effect caused by a natural source. The PC gains a +1d bonus when making saving throws against magical fear-causing effects.",
  "Fire Magician* (4 Luck)": "<b>Fire Magician* (4 Luck):</b> This benison is only for wizard PCs and must be re-rolled by other classes. The wizard begins play having studied under the formidable fire magicians of the Eastern Lands. He receives the benefits of the pyromancer specialization of the arcane affinity spell (see DCC RPG pp. 162-164) as if the recipient of spell check 16-19.",
  "Forest Fighter* (3 Luck)": "<b>Forest Fighter* (3 Luck):</b> The PC learned the arts of combat in dense woodlands and how to use the terrain to his advantage. He gains a +2 bonus to attack rolls and AC when fighting in a forested environment.",
  "Former Gladiator* (4 Luck)": "<b>Former Gladiator* (4 Luck):</b> The PC was a gladiator in the Mad Duke of Ool Hrusp’s arena. Roll 1d4: (1) adds +2 to number of hit points regained when spending Luck to heal; (2) +1 to attack rolls with a single weapon type; (3) gain +1 to AC when wearing leather armor or lesser protection; (4) can shield bash as if a dwarf.",
  "Former Wizard’s Pupil (5 Luck)": "<b>Former Wizard’s Pupil (5 Luck):</b> The PC begins play knowing one randomly-determined 1st-level spell. He rolls a d14 spell check die when attempting this magic. Armor check penalties apply to the spell check as normal and he can spellburn as if a wizard.",
  "Gambler* (1 Luck)": "<b>Gambler* (1 Luck):</b> The PC spent his formative years in the seedy gambling dens of Lankhmar. The PC gains a +2d bonus whenever making a skill check related to gambling. Optional: If playing Lankhmarian Rat-Snake, the player can re-roll the dice once during each of his turns.",
  "Gifted* (3 Luck)": "<b>Gifted* (3 Luck):</b> The PC adds +1 to any ability score of his choice. This bonus cannot bring the ability score above 18.",
  "Glorious Doom* (4 Luck)": "<b>Glorious Doom* (4 Luck):</b> Long ago, a witch-doctor prophesized the PC will die in a glorious manner. He might even be right! Whenever the PC makes a Luck check to roll over his body, he can roll twice and take the better result. However, should the PC ever die as a result of an event that the judge deems as glorious, he must make two Luck checks, taking the worse result.",
  "Good Reputation in Certain Circles (2 Luck)": "<b>Good Reputation in Certain Circles (2 Luck):</b> The PC is friendly with a specific organization or social class. Roll 1d10: (1) city guardsmen; (2) city watchmen and police; (3) a specific merchant’s guild; (4) a specific religion or faith; (5) minor nobles; (6) the Thieves’ Guild; (7) the Slayers’ Brotherhood; (8) city beggars; (9) the Whores’ Guild; (10) dockworkers and harbormasters.",
  "Healer (2 Luck)": "<b>Healer (2 Luck):</b> The PC has been trained in the healing arts. The PC’s Intelligence modifier or class level (whichever is greater) is added to the number of hit points the treated individual gains when recuperating. Also grants saving throws against poison and disease.",
  "Immigrant Upbringing (2 Luck)": "<b>Immigrant Upbringing (2 Luck):</b> Although raised in the city, the PC’s family comes from another culture. The PC can choose one free region-specific benison from any other Place of Origin with the judge’s approval.",
  "Kin to Horses* (2 Luck)": "<b>Kin to Horses* (2 Luck):</b> The PC is a prodigy when it comes to all matters equestrian. He gains a +1d modifier when making skill checks related to riding, caring for horses, and when mending or making tack. The PC also gains +2 to all attack rolls while mounted on horseback.",
  "Knows a Secret (1 Luck)": "<b>Knows a Secret (1 Luck):</b> The PC begins play knowing a useful or valuable secret. Roll 1d7: (1) true identity of an important figure; (2) a secret entrance; (3) a love nest; (4) shameful vices; (5) smuggling schedule; (6) buried treasure; (7) true name of a supernatural entity.",
  "Magic Scroll (3 Luck)": "<b>Magic Scroll (3 Luck):</b> The PC has acquired a magical spell inscribed on a scroll. The contents and casting mechanism are determined randomly (DCC RPG p. 373). Reroll if the PC isn’t a wizard, thief, or Former Wizard’s Pupil.",
  "Major Ally (3 Luck)": "<b>Major Ally (3 Luck):</b> The PC has a friend with extremely useful talents (trained warrior, freelance thief, apprentice wizard, etc.). The ally will occasionally agree to accompany a PC on his adventures, acting as a follower for a short time. Major allies are always 1st level.",
  "Martial Training (5 Luck)": "<b>Martial Training (5 Luck):</b> The character is trained in one particular type of weapon. When using this weapon he gains a +1d bonus to his deed die if a warrior. If not a warrior, he rolls a d3 deed die when wielding that type of weapon and can declare Mighty Deeds of Arms as if a warrior.",
  "Mingol Bow* (2 Luck)": "<b>Mingol Bow* (2 Luck):</b> The PC begins the game with a composite recurved Mingol bow (size of shortbow, range of longbow). It grants a +1 bonus to either attack rolls or damage rolls (player’s choice).",
  "Minor Ally (2 Luck)": "<b>Minor Ally (2 Luck):</b> The PC has a friend who possesses a minor, helpful talent (blacksmith, tailor, guttersnipe, etc.) and will occasionally aid the PC. A minor ally never has combat, thief, or magical skills, and won’t put themselves in harm’s way.",
  "Mountaineer* (2 Luck)": "<b>Mountaineer* (2 Luck):</b> The PC is adept at scaling rocky cliffs, perilous mountains, and snowy peaks. He enjoys a +1d bonus whenever climbing mountains, cliffs, ice walls, or other natural vertical surfaces. If the PC possesses the climb sheer surfaces skill, this benison imparts a +1d bonus to that skill as well.",
  "Noble Birth (2 Luck)": "<b>Noble Birth (2 Luck):</b> The PC hails from an upper class family. He enjoys the benefits of the Well-Heeled benison and gains a +1d bonus to all Personality rolls when dealing with those who know of and recognize his social standing. If he brings shame to the family, he gains the Major Foe doom.",
  "Owns a Horse* (2 Luck)": "<b>Owns a Horse* (2 Luck):</b> The PC begins play with a sturdy, fearless Mingol mount, loyal unto death. The horse has maximum hit points and the benefits of the Fearless benison.",
  "Owns a Ship (2 Luck)": "<b>Owns a Ship (2 Luck):</b> The PC begins play with a small river or ocean-going craft in his possession.",
  "Pirate Raid Veteran* (2 Luck)": "<b>Pirate Raid Veteran* (2 Luck):</b> The PC is acquainted with the operation of a sailing ship as per the Sea-Crafty benison and speaks an additional language above and beyond his starting tongue.",
  "Premonitions (4 Luck)": "<b>Premonitions (4 Luck):</b> The PC gains an inkling of danger to come. When making Luck checks to avoid surprise, the PC rolls twice, taking the better of the two results.",
  "Roaring Skald* (3 Luck)": "<b>Roaring Skald* (3 Luck):</b> The PC can spend an action and 1 Luck to perform a thunderous roaring chant. The song imparts a +1 bonus to attack rolls for all allies within 30’ for a number of rounds equal to the PC’s level (+2 for allies from the Cold Waste).",
  "Sea-Crafty (2 Luck)": "<b>Sea-Crafty (2 Luck):</b> The PC is adept at the sailing, maintenance, and navigation of sea-going vessels. All rolls pertaining to the operation of sailed or oar-powered ships made by the PC gain a +1d bonus.",
  "Senses the Supernatural* (3 Luck)": "<b>Senses the Supernatural* (3 Luck):</b> Whenever the PC encounters a supernatural creature that is attempting to masquerade as human, he can make a Luck check to determine if he senses something wrong with the creature’s guise.",
  "Singing Skald* (3 Luck)": "<b>Singing Skald* (3 Luck):</b> The PC gains all the benefits of the Healer benison plus a +1d bonus when making skill checks related to singing, performing, or playing music.",
  "Skilled in the Criminal Arts (5 Luck)": "<b>Skilled in the Criminal Arts (5 Luck):</b> The PC chooses three thief skills. A thief PC gains a permanent +1 bonus to the three chosen skills. If the PC is not a thief, he gains these skills with a +1 modifier.",
  "Split Soul Hero (4 Luck)": "<b>Split Soul Hero (4 Luck):</b> The PC and one other character in the party are two halves of a heroic whole. This benison allows each Split Soul PC to spend Luck with double the benefit to help the other. Each point of Luck grants a +2 bonus to the assisted PC’s roll. They can also spend permanent Luck to help one another.",
  "Stored Goods (1 Luck)": "<b>Stored Goods (1 Luck):</b> The PC begins play with 1d3×50 gold rilks’ worth of merchandise stored somewhere. If desperate for cash, the goods can be sold immediately at a loss of 50% of its value.",
  "Storyteller* (2 Luck)": "<b>Storyteller* (2 Luck):</b> The PC can consult his mental encyclopedia of stories for details applicable to his current situation. This benison allows the PC to roll a d24 when making a skill check to recall useful information pertaining to his culture or native environment.",
  "Survivor* (3 Luck)": "<b>Survivor* (3 Luck):</b> The PC receives a permanent +1 bonus to all Fort saves and begins play with an additional 1d3 hit points. In addition, he can “bleed out” when reduced to zero hit points for one more round than typical for his level.",
  "Tough (3 Luck)": "<b>Tough (3 Luck):</b> Whenever this PC spends 1 Luck to regain hit points during combat or spends a period recuperating outside of battle, he rolls his class hit die twice and takes the better result of the two.",
  "Trusted Contact (1 Luck)": "<b>Trusted Contact (1 Luck):</b> The PC has an inside source within an influential organization. Roll 1d8: (1) city constables; (2) Thieves’ Guild; (3) priesthood; (4) merchant’s guild; (5) street beggars; (6) Slayers’ Brotherhood; (7) Rainbow Palace; (8) Lankhmar’s Sorcerers’ Guild.",
  "Two-Weapon Fighter (4 Luck)": "<b>Two-Weapon Fighter (4 Luck):</b> The PC can wield two weapons in combat as if he were a halfling (see DCC RPG p. 60). However, both weapons need not be the same size.",
  "Urban Affinity* (3 Luck)": "<b>Urban Affinity* (3 Luck):</b> The PC enjoys a +1d bonus to all skill and ability rolls relating to his city of birth. Additionally, he can choose one of the following roll types to gain a +1 bonus to in urban settings: attack rolls, saving throws, or spell checks.",
  "Well-Heeled (1 Luck)": "<b>Well-Heeled (1 Luck):</b> The PC’s starting funds are increased 100%."
};

const doomDescriptions = {
  "Bad Reputation in Certain Circles": "<b>Bad Reputation in Certain Circles:</b> The PC has done something distasteful to members of a certain social group or profession. Members of that group are automatically unfriendly to the PC.",
  "Blackmailed": "<b>Blackmailed:</b> Someone knows of the PC’s offense and regularly solicits funds (1d10×10 gold rilks) from the character to remain silent.",
  "Blood Price on PC’s Head": "<b>Blood Price on PC’s Head:</b> The PC committed some great offense to the King of Kings, resulting in a bounty. He has any number of assassins and bounty hunters after him.",
  "Cursed": "<b>Cursed:</b> The PC begins the game under a dire curse. The curse is a minor one (see DCC RPG p. 438) and can be removed as normal.",
  "Dependent": "<b>Dependent:</b> The PC has a spouse, parent, sibling, child, or other individual he is responsible for. A PC who fails to care for a dependent suffers a permanent loss of Luck.",
  "Distinctive Appearance": "<b>Distinctive Appearance:</b> The PC possesses a certain trait or unique physical quirk that makes him easy to recognize and remember. If the PC is a thief, he suffers a -1d penalty on all disguise self checks.",
  "Enmity of the Slayers’ Brotherhood": "<b>Enmity of the Slayers’ Brotherhood:</b> The PC committed some horrible offense that has stirred the Slayers’ Brotherhood against him. If recognized, a squad of bloodthirsty warriors will soon be seeking the PC’s head.",
  "Escaped Gladiator": "<b>Escaped Gladiator:</b> The PC was sentenced to die in the Mad Duke’s game but escaped. He now has the Duke’s bounty hunters after him.",
  "Eunuch": "<b>Eunuch:</b> The PC is a eunuch and unable to sire children. Re-roll this result if the PC is female.",
  "Geased": "<b>Geased:</b> The PC either willingly or unwillingly had a geas placed upon him. The geas is a formidable one, akin to a major quest, and will likely take years to complete.",
  "Hatred of a Supernatural Entity": "<b>Hatred of a Supernatural Entity:</b> The PC has angered a force beyond mortal ken. At the start of each adventure, the judge makes a Luck check for the PC. If the check fails, the entity works against the PC.",
  "Hindered": "<b>Hindered:</b> The PC suffered an injury that affected one of his ability scores. His score is permanently reduced by 1 point. Roll 1d5: (1) Strength; (2) Agility; (3) Stamina; (4) Intelligence; (5) Personality.",
  "Illiterate": "<b>Illiterate:</b> The PC is incapable of reading or writing any language. Wizards with this doom do not possess spellbooks and employ some other mnemonic device.",
  "Inglorious Doom": "<b>Inglorious Doom:</b> Whenever the PC makes a Luck check when his body is rolled over, he must make two Luck checks and take the worse result.",
  "In Debt": "<b>In Debt:</b> The PC owes 3d6×100 gold rilks to a shady moneylender and is behind on his payments.",
  "Inept": "<b>Inept:</b> The PC was never able to master one aspect of his class and suffers a -1d penalty whenever attempting that ability, skill, or power.",
  "Magically Corrupted": "<b>Magically Corrupted:</b> The PC bears a trace of magical corruption. Roll 1d5: (1-3) Nehwonian Minor Corruption; (4-5) Nehwonian Major Corruption.",
  "Major Foe": "<b>Major Foe:</b> The PC has offended a person or small group of some importance or power (entire family, guild, gang, etc.). This foe strives to foil the PC’s plans.",
  "Minor Foe": "<b>Minor Foe:</b> The PC has offended a person of little importance or power (ex-lover, petty bureaucrat, etc.). The foe cannot usually directly challenge the PC, but can make life difficult.",
  "Outcast": "<b>Outcast:</b> The PC dwells outside his starting culture. The PC will never receive aid from his culture at large.",
  "Owes a Major Favor": "<b>Owes a Major Favor:</b> The PC owes a debt of gratitude to a benefactor who once helped the PC out of a serious predicament. The benefactor will eventually call the debt due.",
  "Owes a Minor Favor": "<b>Owes a Minor Favor:</b> The PC owes a small debt of gratitude. The benefactor will one day call in the owed favor and ask the PC for help.",
  "Poor Rider": "<b>Poor Rider:</b> The character suffers a -1d penalty whenever making skill checks related to equestrian matters, and suffers a -2 penalty to all rolls while on horseback.",
  "Poverty-Stricken": "<b>Poverty-Stricken:</b> The PC’s starting funds are reduced by 50%.",
  "Prone to Seasickness": "<b>Prone to Seasickness:</b> The PC cannot abide being at sea for longer than an hour. After this time, he suffers a -2 penalty to all rolls until he reaches dry land.",
  "Superstitious": "<b>Superstitious:</b> The PC strongly believes that a certain act always brings bad luck. A PC who acts against his beliefs suffers a -1d penalty to all his rolls until he performs a purification ritual.",
  "Tainted Bloodline": "<b>Tainted Bloodline:</b> The PC has an inhuman ancestor. He is considered to have the Distinctive Appearance doom. His blood is highly desirable by sorcerers.",
  "Uncivilized": "<b>Uncivilized:</b> The PC is unfamiliar with the morals of the big city. The character suffers a -1d penalty to all skill and ability checks when interacting with a city environment.",
  "Wanted by the Thieves’ Guild": "<b>Wanted by the Thieves’ Guild:</b> The PC likely committed the unpardonable offense of stealing in the Thieves’ Guild’s territory. Knife-wielding thieves will soon descend on the PC looking for blood."
};

// --- HELPER FUNCTIONS ---

async function getTargetActor() {
    if (canvas.tokens.controlled.length > 0) return canvas.tokens.controlled[0].actor;
    if (game.user.character) return game.user.character;
    
    if (game.user.isGM) {
        const actors = game.actors.filter(a => a.type === "Player");
        if (actors.length === 0) {
            ui.notifications.warn("No actors of type 'Player' found.");
            return null;
        }
        actors.sort((a, b) => a.name.localeCompare(b.name));

        const content = `
            <div class="form-group">
                <label>Select Character:</label>
                <select name="actorId" id="actor-select" style="width: 100%">
                    ${actors.map(a => `<option value="${a.id}">${a.name}</option>`).join('')}
                </select>
            </div>
        `;

        if (foundry.applications?.api?.DialogV2) {
            const actorId = await foundry.applications.api.DialogV2.prompt({
                window: { title: "Select Character" },
                content: content,
                ok: {
                    label: "Select",
                    callback: (event, button) => button.form.elements.actorId.value
                }
            });
            return actorId ? game.actors.get(actorId) : null;
        } else {
            return new Promise(resolve => {
                new Dialog({
                    title: "Select Character",
                    content: content,
                    buttons: {
                        ok: {
                            label: "Select",
                            callback: html => resolve(game.actors.get(html.find('#actor-select').val()))
                        }
                    },
                    default: "ok",
                    close: () => resolve(null)
                }).render(true);
            });
        }
    }
    ui.notifications.warn("Please select a character token.");
    return null;
}

function findDescription(map, lookupKey) {
    if (!lookupKey) return "None";
    if (map[lookupKey]) return map[lookupKey];
    const normalize = (str) => str.replace(/[\u2018\u2019]/g, "'").trim();
    const normalizedLookup = normalize(lookupKey);
    for (const [key, description] of Object.entries(map)) {
        if (normalize(key) === normalizedLookup) return description;
    }
    for (const [key, description] of Object.entries(map)) {
        if (key.toLowerCase().includes(lookupKey.toLowerCase()) || lookupKey.toLowerCase().includes(key.toLowerCase())) {
            return description;
        }
    }
    return lookupKey;
}

// --- STEP 8: INTRIGUING ITEMS ---

async function rollIntriguingItem(actor) {
    const tableName = "Lankhmar Intriguing Items";
    const table = game.tables.getName(tableName);

    if (!table) {
        ui.notifications.error(`RollTable "${tableName}" not found. Please create it first using the separate macro.`);
        // Still finish the character creation message
        ChatMessage.create({
            content: `✅ <strong>Character generation for ${actor.name} is complete!</strong><br>⚠️ Could not roll for Intriguing Item.`,
            speaker: ChatMessage.getSpeaker({ actor: actor })
        });
        return;
    }

    const draw = await table.roll();
    const result = draw.results[0];
    const itemName = result.name || result.description;

    const itemData = {
        name: itemName,
        type: "equipment",
        // Use a valid fallback icon
        img: result.img || "icons/svg/mystery-man.svg"
    };

    await actor.createEmbeddedDocuments("Item", [itemData]);

    ChatMessage.create({
        content: `<div class="dcc-lankhmar-creation">
            <h3>Step 8: Intriguing Item</h3>
            <p><strong>Roll:</strong> ${draw.roll.total}</p>
            <p><strong>Item:</strong> ${itemName}</p>
            <p><em>Item added to inventory.</em></p>
        </div>
        <br>
        ✅ <strong>Character generation for ${actor.name} is complete!</strong>`,
        speaker: ChatMessage.getSpeaker({ actor: actor })
    });
}

// --- STEP 4: LANGUAGES ---

async function rollLanguages(actor) {
    const intScore = actor.system.abilities.int.value;
    const intMod = actor.system.abilities.int.mod;
    const origin = actor.system.details.title.value;
    const className = actor.system.class.className;
    const isWizard = className === 'Wizard';

    const folderName = "Lankhmar Languages";
    const folder = game.folders.find(f => f.name === folderName && f.type === "RollTable");
    if (!folder) {
        ui.notifications.warn(`Folder "${folderName}" not found. Cannot roll for languages.`);
        return;
    }
    
    // Handle mismatch between Origin name and Table name for Eight Cities
    let tableName = `Languages (${origin})`;
    let table = folder.contents.find(t => t.name === tableName);
    
    if (!table && (origin === "The Land of the Eight Cities" || origin === "Land of the Eight Cities")) {
         table = folder.contents.find(t => t.name === "Languages (Land of the Eight Cities)") || 
                 folder.contents.find(t => t.name === "Languages (The Land of the Eight Cities)");
    }

    if (!table && intMod > 0) { // Only warn if we actually need the table
        ui.notifications.warn(`RollTable "${tableName}" not found. Cannot roll for additional languages.`);
    }

    let knownLanguages = [];
    let nativeLanguage = '';
    let easternLandsSpecial = null;

    // Determine Native Language(s)
    if (origin === "Lankhmar") {
        nativeLanguage = "High Lankhmarese";
    } else if (origin === "The Land of the Eight Cities" || origin === "Land of the Eight Cities") {
        nativeLanguage = "Kvarchish";
    } else if (origin === "The Cold Waste") {
        nativeLanguage = "Northspeak (Cold Tongue)";
    } else if (origin === "The Mingol Steppes") {
        nativeLanguage = "Mingol";
    } else if (origin === "The Eastern Lands") {
        const choices = ["Horborixic", "Desert-Talk"];
        const content = `
            <p>As a character from The Eastern Lands, you must choose a native tongue.</p>
            <div class="form-group">
                <label>Choose Native Language:</label>
                <select name="nativeLang">
                    <option value="${choices[0]}">${choices[0]}</option>
                    <option value="${choices[1]}">${choices[1]}</option>
                </select>
            </div>
        `;
        
        let chosenLang;
        if (foundry.applications?.api?.DialogV2) {
            chosenLang = await foundry.applications.api.DialogV2.prompt({
                window: { title: "Choose Native Language" },
                content: content,
                ok: {
                    label: "Confirm",
                    callback: (event, button) => button.form.elements.nativeLang.value
                }
            });
        } else {
            chosenLang = await new Promise(resolve => {
                new Dialog({
                    title: "Choose Native Language",
                    content: content,
                    buttons: { ok: { label: "Confirm", callback: html => resolve(html.find('[name="nativeLang"]').val()) } },
                    default: "ok",
                    close: () => resolve(null)
                }).render(true);
            });
        }

        if (chosenLang) {
            nativeLanguage = chosenLang;
            easternLandsSpecial = choices.find(c => c !== nativeLanguage);
        }
    }

    // Add native language
    if (nativeLanguage) {
        knownLanguages.push(nativeLanguage);
    }

    // Add Low Lankhmarese, but only if INT > 5
    if (intScore > 5) {
        knownLanguages.push("Low Lankhmarese");
    }

    // Add Thieves' Cant if Thief
    if (className === "Thief") {
        knownLanguages.push("Thieves' Cant");
    }

    const newLanguages = [];

    if (intMod > 0 && table) {
        const languageDie = isWizard ? '1d12' : '1d6';
        for (let i = 0; i < intMod; i++) {
            let newLang;
            let attempts = 0;
            
            do {
                const roll = new Roll(languageDie);
                await roll.evaluate();
                const rollValue = roll.total;
                
                if (origin === "The Eastern Lands" && rollValue === 4) {
                    newLang = easternLandsSpecial;
                } else {
                    const resultEntry = table.getResultsForRoll(rollValue)[0];
                    newLang = resultEntry.name || resultEntry.description;
                }
                
                attempts++;
                if (attempts > 20) { 
                    ui.notifications.error("Could not find a unique new language after 20 attempts. Aborting language rolls.");
                    break;
                }

            } while (knownLanguages.includes(newLang) || newLanguages.includes(newLang));
            
            if (newLang) {
                newLanguages.push(newLang);
            }
        }
    }

    const allLanguages = [...new Set([...knownLanguages, ...newLanguages])]; // Use Set to ensure no duplicates
    const languagesString = allLanguages.join(', ');

    await actor.update({ "system.details.languages": languagesString });

    let chatContent = `
        <div class="dcc-lankhmar-creation">
            <h3>Step 4: Languages</h3>
            <p><strong>Native Language(s):</strong> ${knownLanguages.length > 0 ? knownLanguages.join(', ') : 'None'}</p>
    `;
    if (newLanguages.length > 0) {
        const languageDie = isWizard ? '1d12' : '1d6';
        chatContent += `<p><strong>Additional Languages (${intMod} roll${intMod > 1 ? 's' : ''} on ${languageDie}):</strong> ${newLanguages.join(', ')}</p>`;
    } else if (intMod <= 0 && intScore > 5) {
        chatContent += `<p>Gains no additional languages from Intelligence.</p>`;
    } else if (intScore <= 5) {
        chatContent += `<p>Knows only their native tongue due to low Intelligence.</p>`;
    }
    chatContent += `<hr><p><strong>Total Known:</strong> ${languagesString}</p></div>`;

    ChatMessage.create({
        content: chatContent,
        speaker: ChatMessage.getSpeaker({ actor: actor })
    });
    
    await rollIntriguingItem(actor);
}

// --- STEP 3: ORIGIN, BENISON, DOOM ---

async function rollOrigin(actor) {
    const folderName = "Lankhmar Origin Tables";
    const folder = game.folders.find(f => f.name === folderName && f.type === "RollTable");

    if (!folder) {
        ui.notifications.error(`Folder "${folderName}" not found. Cannot roll Origin.`);
        return;
    }

    const table1_1 = folder.contents.find(t => t.name.includes("Table 1-1"));
    if (!table1_1) return ui.notifications.error("Table 1-1 not found.");

    const originDraw = await table1_1.roll();
    const originResult = originDraw.results[0];
    const originText = originResult.name || originResult.description; 
    const regionName = originText.split(" (")[0];

    const benisonTable = folder.contents.find(t => t.name.includes(regionName) && t.name.includes("Benisons"));
    const doomTable = folder.contents.find(t => t.name.includes(regionName) && t.name.includes("Dooms"));

    if (!benisonTable || !doomTable) return ui.notifications.error(`Could not find Benison/Doom tables for ${regionName}`);

    const luckMod = actor.system.abilities.lck.mod;

    const benisonRoll = new Roll(`1d20 + ${luckMod}`);
    await benisonRoll.evaluate();
    const benisonEntry = benisonTable.getResultsForRoll(benisonRoll.total)[0];
    const benisonName = benisonEntry ? (benisonEntry.name || benisonEntry.description) : "None";

    const doomRoll = new Roll(`1d20 - ${luckMod}`);
    await doomRoll.evaluate();
    const doomEntry = doomTable.getResultsForRoll(doomRoll.total)[0];
    const doomName = doomEntry ? (doomEntry.name || doomEntry.description) : "None";

    const benisonFull = findDescription(benisonDescriptions, benisonName);
    const doomFull = findDescription(doomDescriptions, doomName);

    const benisonsAndDoomsHTML = `<p>${benisonFull}</p><hr><p>${doomFull}</p>`;

    await actor.update({
        "system.details.title.value": regionName,
        "flags.dcc.benisonsAndDooms": benisonsAndDoomsHTML
    });

    const content = `
        <div class="dcc-lankhmar-origin">
            <h3>Step 3: Origin, Benison & Doom</h3>
            <div style="margin-bottom: 5px;"><strong>Origin:</strong> ${regionName}</div>
            <div style="font-size: 0.9em; color: #555; margin-bottom: 10px;">Luck Modifier: ${luckMod > 0 ? "+"+luckMod : luckMod}</div>
            <hr>
            <div style="margin-bottom: 5px;">
                <strong>Benison:</strong> ${benisonName}
                <div style="font-size: 0.8em; color: #444;">(Roll: ${benisonRoll.total})</div>
            </div>
            <div style="margin-bottom: 5px;">
                <strong>Doom:</strong> ${doomName}
                <div style="font-size: 0.8em; color: #444;">(Roll: ${doomRoll.total})</div>
            </div>
        </div>
    `;

    ChatMessage.create({
        content: content,
        speaker: ChatMessage.getSpeaker({ actor: actor })
    });

    await rollLanguages(actor);
}

// --- STEP 2: BIRTH AUGUR ---

async function rollBirthAugur(actor) {
    const birthAugurs = {
        1: { name: "Harsh winter", effect: "All attack rolls" },
        2: { name: "The bull", effect: "Melee attack rolls" },
        3: { name: "Fortunate date", effect: "Missile fire attack rolls" },
        4: { name: "Raised by wolves", effect: "Unarmed attack rolls" },
        5: { name: "Conceived on horseback", effect: "Mounted attack rolls" },
        6: { name: "Born on the battlefield", effect: "Damage rolls" },
        7: { name: "Path of the bear", effect: "Melee damage rolls" },
        8: { name: "Hawkeye", effect: "Missile fire damage rolls" },
        9: { name: "Pack hunter", effect: "Attack and damage rolls for 0-level weapon" },
        10: { name: "Born under the loom", effect: "Skill checks (including thief skills)" },
        11: { name: "Fox's cunning", effect: "Find/disable traps" },
        12: { name: "Four-leafed clover", effect: "Find secret doors" },
        13: { name: "Seventh son", effect: "Spell checks" },
        14: { name: "The raging storm", effect: "Spell damage" },
        15: { name: "Righteous heart", effect: "Turn unholy checks" },
        16: { name: "Survived the plague", effect: "Magical healing" },
        17: { name: "Lucky sign", effect: "Saving throws" },
        18: { name: "Guardian angel", effect: "Savings throws to escape traps" },
        19: { name: "Survived a spider bite", effect: "Saving throws against poison" },
        20: { name: "Struck by lightning", effect: "Reflex saving throws" },
        21: { name: "Lived through famine", effect: "Fortitude saving throws" },
        22: { name: "Resisted temptation", effect: "Willpower saving throws" },
        23: { name: "Charmed house", effect: "Armor Class" },
        24: { name: "Speed of the cobra", effect: "Initiative" },
        25: { name: "Bountiful harvest", effect: "Hit points (applies at each level)" },
        26: { name: "Warrior's arm", effect: "Critical hit tables" },
        27: { name: "Unholy house", effect: "Corruption rolls" },
        28: { name: "The Broken Star", effect: "Fumbles" },
        29: { name: "Birdsong", effect: "Number of languages" },
        30: { name: "Wild child", effect: "Speed (each +1 = +5' speed)" }
    };

    const excludedRolls = [9, 15, 16];
    let roll;
    let rollObj;
    do {
        rollObj = new Roll("1d30");
        await rollObj.evaluate();
        roll = rollObj.total;
    } while (excludedRolls.includes(roll));

    const augur = birthAugurs[roll];
    const luckMod = actor.system.abilities.lck.mod;
    const sign = luckMod >= 0 ? "+" : "";
    const resultText = `${augur.name}: ${augur.effect} (${sign}${luckMod})`;

    await actor.update({ "system.details.birthAugur": resultText });

    const content = `
        <div class="dcc-lankhmar-creation">
            <h3>Step 2: Birth Augur</h3>
            <div style="margin-bottom: 5px;"><strong>Roll:</strong> ${roll} (d30)</div>
            <hr>
            <div style="margin-bottom: 5px;"><strong>Augur:</strong> ${augur.name}</div>
            <div style="margin-bottom: 5px;"><strong>Effect:</strong> ${augur.effect}</div>
            <div style="margin-bottom: 5px;"><strong>Luck Mod:</strong> ${sign}${luckMod}</div>
        </div>
    `;
    ChatMessage.create({ content: content, speaker: ChatMessage.getSpeaker({ actor: actor }) });

    await rollOrigin(actor);
}

// --- STEP 1.5: CHOOSE CLASS & ROLL HP ---

async function rollWizardSpells(actor) {
    // 1. Find Level 1 Spells
    // Try World Items first (as per user "imported" comment)
    let availableSpells = game.items.filter(i => i.type === 'spell' && i.system.level === 1);
    
    // Fallback to Compendium if not enough world items
    if (availableSpells.length < 4) {
        const pack = game.packs.get("dcc.spells");
        if (pack) {
            const index = await pack.getIndex({fields: ["system.level"]});
            const spellIds = index.filter(i => i.system.level === 1).map(i => i._id);
            if (spellIds.length > 0) {
                const pickedIds = [];
                const count = Math.min(4, spellIds.length);
                while (pickedIds.length < count) {
                    const r = Math.floor(Math.random() * spellIds.length);
                    if (!pickedIds.includes(spellIds[r])) pickedIds.push(spellIds[r]);
                }
                availableSpells = await Promise.all(pickedIds.map(id => pack.getDocument(id)));
            }
        }
    } else {
        // Shuffle and pick 4 from world items
        availableSpells = availableSpells.sort(() => 0.5 - Math.random()).slice(0, 4);
    }

    if (availableSpells.length === 0) return;

    const spellData = availableSpells.map(spell => {
        const data = spell.toObject();
        delete data._id;
        return data;
    });

    await actor.createEmbeddedDocuments("Item", spellData);

    ChatMessage.create({
        content: `<div class="dcc-lankhmar-creation">
            <h3>Wizard Spells</h3>
            <p><strong>Spells Learned:</strong> ${spellData.map(s => s.name).join(", ")}</p>
        </div>`,
        speaker: ChatMessage.getSpeaker({ actor: actor })
    });
}

async function chooseClass(actor) {
    const classes = ["Warrior", "Thief", "Wizard"];
    
    const content = `
        <div class="form-group">
            <label>Select Class:</label>
            <select name="className" id="class-select" style="width: 100%">
                ${classes.map(c => `<option value="${c}">${c}</option>`).join('')}
            </select>
        </div>
        <p style="font-size: 0.9em; color: #666;">This will update the character sheet layout, set Level 1 stats, and roll Hit Points.</p>
    `;

    let selectedClass;

    if (foundry.applications?.api?.DialogV2) {
        selectedClass = await foundry.applications.api.DialogV2.prompt({
            window: { title: "Step 1.5: Choose Class" },
            content: content,
            ok: {
                label: "Confirm Class",
                callback: (event, button) => button.form.elements.className.value
            }
        });
    } else {
        selectedClass = await new Promise(resolve => {
            new Dialog({
                title: "Step 1.5: Choose Class",
                content: content,
                buttons: { ok: { label: "Confirm Class", callback: html => resolve(html.find('#class-select').val()) } },
                default: "ok",
                close: () => resolve(null)
            }).render(true);
        });
    }

    if (selectedClass) {
        const getMod = (score) => {
            if (score <= 3) return -3; if (score <= 5) return -2; if (score <= 8) return -1;
            if (score <= 12) return 0; if (score <= 15) return 1; if (score <= 17) return 2;
            return 3;
        };

        const aglMod = getMod(actor.system.abilities.agl.value);
        const intMod = getMod(actor.system.abilities.int.value);
        const perMod = getMod(actor.system.abilities.per.value);

        const updates = {
            "system.class.className": selectedClass,
            "system.details.sheetClass": selectedClass,
            "flags.core.sheetClass": `dcc.DCCActorSheet${selectedClass}`,
            "system.details.level.value": 1,
            "system.attributes.actionDice.value": "1d20",
            "system.config.computeSavingThrows": true
        };

        if (selectedClass === "Thief") {
            updates["system.attributes.hitDice.value"] = "1d6";
            updates["system.attributes.critical.die"] = "1d10";
            updates["system.attributes.critical.table"] = "II";
            // Set Class Bonuses instead of raw values
            updates["system.saves.ref.classBonus"] = 1;
            updates["system.saves.frt.classBonus"] = 1;
            updates["system.saves.wil.classBonus"] = 0;
            updates["system.class.luckDie"] = "1d3";
            updates["system.details.attackBonus"] = "+0";

            // Ask for Thieving Path
            const pathContent = `
                <div class="form-group">
                    <label>Thieving Path</label>
                    <select id="path" name="path" style="width: 100%">
                        <option value="Boss">Path of the Boss (Lawful)</option>
                        <option value="Assassin">Path of the Assassin (Chaotic)</option>
                        <option value="Swindler">Path of the Swindler (Neutral)</option>
                    </select>
                </div>
            `;
            
            let path;
            if (foundry.applications?.api?.DialogV2) {
                path = await foundry.applications.api.DialogV2.prompt({
                    window: { title: "Choose Thieving Path" },
                    content: pathContent,
                    ok: {
                        label: "Select",
                        callback: (event, button) => button.form.elements.path.value
                    }
                });
            } else {
                path = await new Promise(resolve => {
                    new Dialog({
                        title: "Choose Thieving Path",
                        content: pathContent,
                        buttons: {
                            ok: {
                                label: "Select",
                                callback: html => resolve(html.find("#path").val())
                            }
                        },
                        default: "ok",
                        close: () => resolve("Swindler")
                    }).render(true);
                });
            }

            let alignment = "n";
            let skills = {};

            if (path === "Boss") {
                alignment = "l";
                skills = {
                    "system.class.backstab": 0,
                    "system.skills.sneakSilently.value": 3 + aglMod,
                    "system.skills.hideInShadows.value": 1 + aglMod,
                    "system.skills.pickPockets.value": 3 + aglMod,
                    "system.skills.climbSheerSurfaces.value": 3 + aglMod,
                    "system.skills.pickLock.value": 1 + aglMod,
                    "system.skills.findTrap.value": 3 + intMod,
                    "system.skills.disableTrap.value": 3 + aglMod,
                    "system.skills.forgeDocument.value": 0 + aglMod,
                    "system.skills.disguiseSelf.value": 0 + perMod,
                    "system.skills.readLanguages.value": 0 + intMod,
                    "system.skills.handlePoison.value": 0,
                    "system.skills.castSpellFromScroll.die": "1d10"
                };
            } else if (path === "Assassin") {
                alignment = "c";
                skills = {
                    "system.class.backstab": 3,
                    "system.skills.sneakSilently.value": 3 + aglMod,
                    "system.skills.hideInShadows.value": 1 + aglMod,
                    "system.skills.pickPockets.value": 0 + aglMod,
                    "system.skills.climbSheerSurfaces.value": 1 + aglMod,
                    "system.skills.pickLock.value": 0 + aglMod,
                    "system.skills.findTrap.value": 0 + intMod,
                    "system.skills.disableTrap.value": 0 + aglMod,
                    "system.skills.forgeDocument.value": 0 + aglMod,
                    "system.skills.disguiseSelf.value": 3 + perMod,
                    "system.skills.readLanguages.value": 0 + intMod,
                    "system.skills.handlePoison.value": 3,
                    "system.skills.castSpellFromScroll.die": "1d10"
                };
            } else { // Swindler
                alignment = "n";
                skills = {
                    "system.class.backstab": 1,
                    "system.skills.sneakSilently.value": 1 + aglMod,
                    "system.skills.hideInShadows.value": 3 + aglMod,
                    "system.skills.pickPockets.value": 1 + aglMod,
                    "system.skills.climbSheerSurfaces.value": 3 + aglMod,
                    "system.skills.pickLock.value": 1 + aglMod,
                    "system.skills.findTrap.value": 1 + intMod,
                    "system.skills.disableTrap.value": 1 + aglMod,
                    "system.skills.forgeDocument.value": 3 + aglMod,
                    "system.skills.disguiseSelf.value": 0 + perMod,
                    "system.skills.readLanguages.value": 0 + intMod,
                    "system.skills.handlePoison.value": 0,
                    "system.skills.castSpellFromScroll.die": "1d10"
                };
            }

            updates["system.details.occupation.value"] = `Path of the ${path}`;
            updates["system.details.alignment"] = alignment;

            Object.assign(updates, skills);
        } else if (selectedClass === "Warrior") {
            updates["system.attributes.hitDice.value"] = "1d12";
            updates["system.attributes.critical.die"] = "1d12";
            updates["system.attributes.critical.table"] = "III"; // DCC RPG p. 43
            // Set Class Bonuses instead of raw values
            updates["system.saves.ref.classBonus"] = 1;
            updates["system.saves.frt.classBonus"] = 1;
            updates["system.saves.wil.classBonus"] = 0;
            updates["system.details.attackBonus"] = "1d3";
        } else if (selectedClass === "Wizard") {
            updates["system.attributes.hitDice.value"] = "1d4";
            updates["system.attributes.critical.die"] = "1d6";
            updates["system.attributes.critical.table"] = "I";
            // Set Class Bonuses instead of raw values
            updates["system.saves.ref.classBonus"] = 1;
            updates["system.saves.frt.classBonus"] = 0;
            updates["system.saves.wil.classBonus"] = 1;;
            updates["system.details.attackBonus"] = "+0";
        }

        await actor.update(updates);
        
        const staScore = actor.system.abilities.sta.value;
        const staMod = getMod(staScore);
        
        let classDie = "1d4";
        if (selectedClass === "Warrior") classDie = "1d12";
        if (selectedClass === "Thief") classDie = "1d6";
        
        const r1 = new Roll(`${classDie} + ${staMod}`);
        await r1.evaluate();
        const hp1 = Math.max(1, r1.total); 
        
        const r2 = new Roll(`1d4 + ${staMod}`);
        await r2.evaluate();
        const hp2 = Math.max(1, r2.total);
        
        const totalHP = hp1 + hp2;
        
        // Roll Starting Gold (DCC RPG p. 70)
        let goldFormula = "3d10";
        if (selectedClass === "Warrior") goldFormula = "5d12";

        const rGold = new Roll(goldFormula);
        await rGold.evaluate();
        const startingGold = rGold.total;

        await actor.update({
            "system.attributes.hp.value": totalHP,
            "system.attributes.hp.max": totalHP,
            "system.currency.gp": startingGold
        });

        ChatMessage.create({
            content: `<div class="dcc-lankhmar-creation">
                <strong>${actor.name}</strong> has chosen the path of the <strong>${selectedClass}</strong>.<br>
                <strong>Hit Points:</strong> ${totalHP} (Rolled ${classDie} [${hp1}] + 1d4 [${hp2}] with Sta Mod ${staMod})<br>
                <strong>Starting Funds:</strong> ${startingGold} Gold Rilks (Rolled ${goldFormula})
            </div>`,
            speaker: ChatMessage.getSpeaker({ actor: actor })
        });

        if (selectedClass === "Wizard") {
            await rollWizardSpells(actor);
        }

        await rollBirthAugur(actor);
    }
}

// --- STEP 1: ABILITY SCORES ---

async function applyScores(actor, rolls, swap1, swap2, abilityLabels, abilities) {
    if (swap1 !== "none" && swap2 !== "none" && swap1 !== swap2) {
      const temp = rolls[swap1];
      rolls[swap1] = rolls[swap2];
      rolls[swap2] = temp;
      
      ChatMessage.create({
        content: `<b>${actor.name}</b> swapped <b>${abilityLabels[swap1]}</b> and <b>${abilityLabels[swap2]}</b>.`,
        speaker: ChatMessage.getSpeaker({ actor: actor })
      });
    }

    const updates = {};
    for (let abi of abilities) {
      updates[`system.abilities.${abi}.value`] = rolls[abi];
      updates[`system.abilities.${abi}.max`] = rolls[abi];
    }
    
    await actor.update(updates);
    
    let finalContent = `<div class="dcc-lankhmar-creation"><h3>Step 1: Ability Scores</h3><ul>`;
    for (let abi of abilities) {
        finalContent += `<li><b>${abilityLabels[abi]}:</b> ${rolls[abi]}</li>`;
    }
    finalContent += `</ul></div>`;
    ChatMessage.create({ content: finalContent, speaker: ChatMessage.getSpeaker({ actor: actor }) });

    await chooseClass(actor);
}

// --- MAIN EXECUTION ---

const actor = await getTargetActor();
if (!actor) return;

const hasStats = Object.values(actor.system.abilities).some(a => a.value > 0);

if (hasStats) {
    let overwrite = false;
    
    if (foundry.applications?.api?.DialogV2) {
        overwrite = await foundry.applications.api.DialogV2.confirm({
            window: { title: "Overwrite Abilities?" },
            content: `<p><b>${actor.name}</b> already has ability scores. Are you sure you want to reroll and overwrite them?</p>`,
            yes: { label: "Overwrite", icon: "fas fa-check" },
            no: { label: "Cancel", icon: "fas fa-times" }
        });
    } else {
        overwrite = await new Promise(resolve => {
            new Dialog({
                title: "Overwrite Abilities?",
                content: `<p><b>${actor.name}</b> already has ability scores. Are you sure you want to reroll and overwrite them?</p>`,
                buttons: {
                    yes: { label: "Overwrite", icon: "fas fa-check", callback: () => resolve(true) },
                    no: { label: "Cancel", icon: "fas fa-times", callback: () => resolve(false) }
                },
                default: "no",
                close: () => resolve(false)
            }).render(true);
        });
    }
    
    if (!overwrite) return;
}

const abilities = ["str", "agl", "sta", "per", "int", "lck"];
const abilityLabels = {
  str: "Strength",
  agl: "Agility",
  sta: "Stamina",
  per: "Personality",
  int: "Intelligence",
  lck: "Luck"
};

let rolls = {};
let rollResults = [];
for (let abi of abilities) {
  let r = new Roll("3d6");
  await r.evaluate();
  rolls[abi] = r.total;
  rollResults.push({
    key: abi,
    label: abilityLabels[abi],
    total: r.total,
    formula: r.result
  });
}

let chatContent = `<div class="dcc-lankhmar-creation"><h3>Initial Rolls for ${actor.name}</h3><ul>`;
rollResults.forEach(r => {
    chatContent += `<li><b>${r.label}:</b> ${r.total} <span style="color:#777; font-size:0.8em">(${r.formula})</span></li>`;
});
chatContent += `</ul></div>`;
ChatMessage.create({ content: chatContent, speaker: ChatMessage.getSpeaker({ actor: actor }) });

const dialogContent = `
  <div style="margin-bottom: 10px;">
    <p><b>${actor.name}</b> rolled the following ability scores:</p>
    <ul style="list-style: none; padding: 0;">
      ${rollResults.map(r => `<li style="margin-bottom: 4px;"><strong style="width: 80px; display: inline-block;">${r.label}:</strong> ${r.total}</li>`).join("")}
    </ul>
    <hr>
    <p>You may swap <b>two</b> ability scores.</p>
    <div style="display: flex; gap: 10px; align-items: center;">
      <div style="flex: 1;">
        <label>Swap:</label>
        <select id="swap1" name="swap1" style="width: 100%;">
          <option value="none">-- None --</option>
          ${rollResults.map(r => `<option value="${r.key}">${r.label} (${r.total})</option>`).join("")}
        </select>
      </div>
      <div style="flex: 0 0 auto; padding-top: 15px;"><i class="fas fa-exchange-alt"></i></div>
      <div style="flex: 1;">
        <label>With:</label>
        <select id="swap2" name="swap2" style="width: 100%;">
          <option value="none">-- None --</option>
          ${rollResults.map(r => `<option value="${r.key}">${r.label} (${r.total})</option>`).join("")}
        </select>
      </div>
    </div>
  </div>
`;

if (foundry.applications?.api?.DialogV2) {
    await foundry.applications.api.DialogV2.prompt({
        window: { title: "Step 1: Ability Scores" },
        content: dialogContent,
        ok: {
            label: "Apply & Continue",
            icon: "fas fa-check",
            callback: async (event, button) => {
                const swap1 = button.form.elements.swap1.value;
                const swap2 = button.form.elements.swap2.value;
                await applyScores(actor, rolls, swap1, swap2, abilityLabels, abilities);
            }
        }
    });
} else {
    new Dialog({
      title: "Step 1: Ability Scores",
      content: dialogContent,
      buttons: {
        apply: {
          label: "<i class='fas fa-check'></i> Apply & Continue",
          callback: async (html) => {
            const swap1 = html.find("#swap1").val();
            const swap2 = html.find("#swap2").val();
            await applyScores(actor, rolls, swap1, swap2, abilityLabels, abilities);
          }
        }
      },
      default: "apply"
    }).render(true);
}