/**
 * Generate DCC Lankhmar RollTables
 * This macro creates the Spell Stipulations table from DCC Lankhmar.
 */

const packName = "dcc-lankhmar-tables"; // Change if you want to put it in a compendium

async function createSpellStipulationsTable() {
  const tableName = "Spell Stipulations";
  const existing = game.tables.getName(tableName);
  if (existing) {
    ui.notifications.warn(`Table "${tableName}" already exists.`);
    return;
  }

  const results = [
    { range: [1, 1], text: "Spell requires the caster be indoors when working its magic. Failure to do so results in a -1d penalty to the spell check die." },
    { range: [2, 2], text: "Spell requires the caster be outdoors when working its magic. Failure to do so results in a -1d penalty to the spell check die." },
    { range: [3, 3], text: "Spell requires the caster spellburn 1 point before casting it. This spellburn is in addition to any stated requirement in the spell’s description." },
    { range: [4, 4], text: "Spell’s casting time is extended. A spell that normally requires 1 action now requires 1 round. A spell with a 1-round casting time requires 1 turn. A spell with a 1-turn casting time requires 1 hour, etc. The judge has final say over how long the spellcasting process takes." },
    { range: [5, 5], text: "Spell is less effective when cast on a specific gender (player’s choice). The spell either suffers a -2 spell check penalty or the target gains a +2 saving throw bonus depending on the nature of the spell." },
    { range: [6, 6], text: "Spell is automatically lost for the day if the spell check fails, regardless of spell table notes." },
    { range: [7, 7], text: "Spell requires the caster have a personal belonging or physical piece of its target in order to be cast effectively. Lacking this sympathetic connection, the caster suffers a -4 penalty to his spell check." },
    { range: [8, 8], text: "Spell has no range and can only be cast by touching its target. If the spell normally has a range of touch, it can only be cast exactly 10’ away from the target." },
    { range: [9, 9], text: "Spell makes the caster ravenously hungry when cast. Until he eats, he is cranky and irritable and suffers a -2 penalty to Personality." },
    { range: [10, 10], text: "Spell requires the caster spend a point of Luck before working its magic." },
    { range: [11, 11], text: "Spell requires a quantity of the caster’s blood be shed to work its magic. Casting the spell inflicts hit point damage to the caster equal to its level; i.e., a 2nd-level spell does 2 points of damage to the caster." },
    { range: [12, 12], text: "Spell requires a large boiling cauldron filled with odd ingredients in order to be cast at full efficiency. The cauldron costs 10 gold rilks initially and each batch of ingredients costs 1d4×10 gold rilks. Casting the spell without these tools imparts a -1d penalty to the spell check." },
    { range: [13, 13], text: "Spell is thwarted by iron. If cast against a target wielding an iron weapon, the spell check suffers a -2 penalty. If the spell is cast against a subject clad in iron armor, the spell check suffers a -1d penalty. These penalties are not cumulative and only the largest applies." },
    { range: [14, 14], text: "Spell is weak and suffers either a -1 penalty to the spell check, a +1 bonus to the target’s saving throw, or a -1 per die penalty to damage rolls. The judge determines in what manner the spell is lacking and the appropriate modifier." },
    { range: [15, 15], text: "Spell requires the caster to sacrifice a creature with at least 1 HD to produce the spell’s effect. Failure to provide a sacrifice results in a -1d spell check penalty." },
    { range: [16, 16], text: "Spell causes advanced corruption when it occurs. The severity of the corruption is either increased by one step (a 1st- or 2nd-level spell causes moderate corruption for example) or a -2 modifier to the corruption table roll if the spell is 5th level." },
    { range: [17, 17], text: "Spell requires the caster to know the name of its target to be completely effective. Otherwise the spell check suffers a -1d penalty." },
    { range: [18, 18], text: "Spell can only be cast by shouting at the top of the caster’s lungs. No stealth is possible when casting it." },
    { range: [19, 19], text: "Spell cannot be cast while the caster is carrying any object made of metal. This includes precious metals as well as more mundane metallic substances." },
    { range: [20, 20], text: "Spell requires the caster to be a bloody wreck. Unless the caster’s current hit point total is 50% or less than his maximum, the spell check suffers a -1d penalty." },
    { range: [21, 21], text: "Spell requires the caster to consume a specially prepared and potentially toxic brew when casting it. This noxious liquid costs 2 gold rilks to prepare a single draught. When consumed, the caster must make a DC 8 Fort save of suffer 1 point of temporary Stamina damage." },
    { range: [22, 22], text: "Spell requires the caster to be elevated above the ground in order to correctly channel the magical forces. The caster cannot have even a single foot planted firmly on the ground and must be at least 2’ in the air to cast this spell without a -1d penalty." },
    { range: [23, 23], text: "Spell must be cast in complete darkness to be fully effective. Casting it in an area with even a single small flame is burning imparts a -1d penalty to the spell check." },
    { range: [24, 24], text: "Spell requires casting in bright daylight to be fully effective. Casting it in an area with even some gloom or shadows imparts a -1d penalty to the spell check." },
    { range: [25, 25], text: "Spell requires the caster to be assisted by another creature when casting this spell. The assistant holds certain props and materials while the caster invokes the spell’s power. The assistant must spend its action helping the caster for the spell to succeed. Otherwise, the spell automatically fails and is lost for the day." },
    { range: [26, 26], text: "Spell is cursed. A failed spell check when casting it automatically results in corruption as well as potential spell loss." },
    { range: [27, 27], text: "Spell will not function in a specific location. Roll 1d5 to determine the negating place: (1) inside a temple; (2) in a graveyard or burial ground; (3) while at sea; (4) underground; (5) in a private residence." },
    { range: [28, 28], text: "Spell is wildly inaccurate. There is a 25% chance that the target of the spell is randomly determined each time it is cast. The potential target can include allies, enemies, or the caster himself." },
    { range: [29, 29], text: "Spell is ineffective against animals. Natural animals are never affected by the spell’s magic." },
    { range: [30, 30], text: "Spell is ineffective against natives from a specific place of origin. Roll 1d5 to determine the inhabitants immune to the spell: (1) Lankhmarts; (2) Mingols; (3) Foresters of the Eight Cities; (4) Tribesmen of the Cold Waste; (5) Easterners." },
    { range: [31, 31], text: "Spell is overly complex. The caster must roll his action die twice when casting this spell and take the worse of the two results. Spellburn, Luck expenditure, and other modifiers are then applied to that roll." },
    { range: [32, 32], text: "Spell is physically taxing. The caster can cast it once per day without difficulty, but must make a DC 10 Fortitude save each subsequent time he attempts it during a 24-hour period. Failing this save results in the spell being lost for the day." },
    { range: [33, 33], text: "Spell requires the caster to recoup after invoking its power. The caster must rest for a number of rounds equal to the spell’s level after successfully casting it or suffer a -10 penalty to all spell checks performed during that time." },
    { range: [34, 34], text: "Spell is mentally draining when performed incorrectly. A failed casting of the spell inflicts 1 point of temporary Intelligence loss." },
    { range: [35, 35], text: "Spell requires the caster to remain motionless. No movement is allowed during the spell’s casting time. Taking even a single step causes the spell to automatically fail and be lost to the caster for the day." },
    { range: [36, 36], text: "Spell induces nausea when cast. The caster suffers a -2 penalty to all attacks, saving throws, skill checks, and spell checks for a number of rounds equal to the spell level after casting the spell, regardless of the success or failure of the spell check." },
    { range: [37, 37], text: "Spell requires the caster to stand boldly while casting it. The caster suffers a -2 penalty to his AC during the round(s) he casts the spell." },
    { range: [38, 38], text: "Spell formula is fixed and cannot be improved by spellburn. Luck may be spent to increase the spell check, however. Re-roll this stipulation if the spell requires spellburn to cast." },
    { range: [39, 39], text: "Spell is less effective against magical creatures. The caster suffers a -1d penalty to his spell check when invoking this spell against summoned, magically created, or creatures of extraordinary origin as determined by the judge." },
    { range: [40, 40], text: "Spell requires the caster to be a solitary practitioner. The spell’s effects can never be increased by ritual casting or otherwise cooperating with another wizard or spellcaster." },
    { range: [41, 60], text: "No special stipulations." },
    { range: [61, 61], text: "Spell requires the caster to utilize a pair of small mirrors to focus mystical forces." },
    { range: [62, 62], text: "Spell requires the caster to weave complex knots or braids into his or her hair or beard." },
    { range: [63, 63], text: "Spell requires an open flame be present in order to cast the spell." },
    { range: [64, 64], text: "Spell requires the caster to draw sigils and glyphs to conjure its power. Without the means to do so, the spell cannot be cast." },
    { range: [65, 65], text: "Spell requires the caster to dance an intricate series of steps and deft footwork." },
    { range: [66, 66], text: "Spell requires the caster eat a small live creature (insect, mouse, hatchling, etc.) to invoke its power." },
    { range: [67, 67], text: "Spell requires the caster to drink a foul broth of his own making before working its magic." },
    { range: [68, 68], text: "Spell requires loud chanting/singing to focus its magical power." },
    { range: [69, 69], text: "Spell requires at least a drop of the caster’s blood be spilled before invoking its energy." },
    { range: [70, 70], text: "Spell requires a strand of human hair be burned before casting the spell." },
    { range: [71, 71], text: "Spell requires a small ceremonial drum be beaten as the spell is cast." },
    { range: [72, 72], text: "Spell requires the caster to smoke a blend of uncommon herbs before working the spell’s magic." },
    { range: [73, 73], text: "Spell requires the caster to anoint himself with special oils while invoking its power." },
    { range: [74, 74], text: "Spell requires a small poppet to be used as a focus for its eldritch energy." },
    { range: [75, 75], text: "Spell requires the caster’s feet must be touching solid ground while casting it." },
    { range: [76, 76], text: "Spell requires a special rattle or tambourine be played as the incantation takes effect." },
    { range: [77, 77], text: "Spell requires the caster abstain from amorous activities for 24 hours before casting it." },
    { range: [78, 78], text: "Spell requires a bone flute be played as the spell is enacted." },
    { range: [79, 79], text: "Spell requires a brass ring be worn on the caster’s right hand to focus its power." },
    { range: [80, 80], text: "Spell requires an iron ring be worn on the caster’s left hand to focus its power." },
    { range: [81, 81], text: "Spell requires a prism of cut glass be held to the caster’s forehead to enhance his mental power while casting the spell." },
    { range: [82, 82], text: "Spell requires the caster to be stone cold sober when casting it." },
    { range: [83, 83], text: "Spell requires the caster to burn a colored candle when invoking its power." },
    { range: [84, 84], text: "Spell requires a perfectly straight coffin nail be held in the caster’s mouth while calling upon its magic." },
    { range: [85, 85], text: "Spell requires a special top be spun while the spell takes effect." },
    { range: [86, 86], text: "Spell requires the caster to pour water over his hands or otherwise immerse them while he casts the spell." },
    { range: [87, 87], text: "Spell requires a ceremonial dagger be used to cut the air around the caster when the spell is invoked." },
    { range: [88, 88], text: "Spell requires the caster to wear a pair of specially etched or embroidered bracers when he casts it." },
    { range: [89, 89], text: "Spell requires the caster wear a specially woven scarf or stole when working its magic." },
    { range: [90, 90], text: "Spell requires the caster to paint his bare flesh with odd-colored tinctures before casting the spell." },
    { range: [91, 91], text: "Spell requires the caster face a specific direction (north, towards the sea, looking skyward, etc.) when invoking its power. The direction is chosen by the player when this stipulation is rolled and must be approved by the judge." },
    { range: [92, 92], text: "Spell requires a pendulum or amulet be swung in the air as its magic takes effect." },
    { range: [93, 93], text: "Spell requires the caster to eat at least one meal containing meat within 1 hour prior to invoking its power." },
    { range: [94, 94], text: "Spell requires special odiferous incense be burned before the caster calls upon its power." },
    { range: [95, 95], text: "Spell requires seven specially carved stones be arranged in a mystical pattern in order to call forth its magic." },
    { range: [96, 96], text: "Spell requires the caster to be fully dressed when invoking its mystical energy." },
    { range: [97, 97], text: "Spell requires the caster to be completely undressed before working the spell’s magic." },
    { range: [98, 98], text: "Spell requires an arcane diagram be drawn in squid ink upon a piece of paper or parchment while the spell is being cast." },
    { range: [99, 99], text: "Spell has been mastered by the caster. Character has a +1d bonus when making his spell check with this spell." },
    { range: [100, 100], text: "Roll again twice." }
  ];

  await RollTable.create({
    name: tableName,
    formula: "1d100",
    results: results.map(r => ({
      type: "text",
      text: r.text,
      weight: 1,
      range: r.range,
      drawn: false
    }))
  });

  ui.notifications.info(`Table "${tableName}" created.`);
}

createSpellStipulationsTable();