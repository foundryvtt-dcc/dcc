/*
  Lankhmar Intriguing Items RollTable Generator

  This macro creates a d100 RollTable named "Lankhmar Intriguing Items"
  based on Appendix A from the Compendium of Secret Knowledge.
*/
async function createIntriguingItemsTable() {
  const TABLE_NAME = "Lankhmar Intriguing Items";

  // Check if the table already exists
  if (game.tables.getName(TABLE_NAME)) {
    ui.notifications.warn(`RollTable "${TABLE_NAME}" already exists.`);
    return;
  }

  const intriguingItems = {
    1: "Copper spoon", 2: "Bottle of Great Salt Marsh water", 3: "Mingol bone flute", 4: "Eel poison and a pair of water cobra-skin gloves", 5: "Ice serpent fur leggings", 6: "Swamp rat pouch", 7: "Black squid ink in a metal vial", 8: "Black toga", 9: "Aromatic herbs", 10: "Reversible white fur cloak", 11: "Five feet of black silk ribbon", 12: "Small browned iron fire pot", 13: "Bear cub skull", 14: "Two white ermine pelts", 15: "Smelly, unwashed jerkin", 16: "Long writing stylus", 17: "Pair of whore's gloves", 18: "2'-long roll of blank parchment", 19: "Skis and poles", 20: "Waterproof scroll case", 21: "Wineskin filled with Ilthmar strong wine", 22: "Spiked boots", 23: "Hand mirror", 24: "Short velvet whip", 25: "Eye patch", 26: "Decorative chamber pot", 27: "Walrus tusk hair brush", 28: "Pouch with hidden pocket", 29: "Stuffed rat", 30: "Pair of boots with a concealed stiletto sheath", 31: "Collapsible oar", 32: "Gray cloak", 33: "Expensive perfume", 34: "Caltrops", 35: "Camel bridle", 36: "Vial of anti-itch ointment", 37: "Warlock's hood", 38: "Cheap brooch", 39: "Piece of black chalk", 40: "Small bottle of burn balm", 41: "Silver bound purse (5 s.s. value)", 42: "Euphoric weed", 43: "Rat cage", 44: "Spiked dog collar", 45: "Rat-sized halberd", 46: "Sea Mingol pirate flag", 47: "Belaying pin (damage as club)", 48: "Single bronze horseshoe", 49: "Slave’s collar", 50: "Gold tooth (5 g.r. value)", 51: "Rabbit’s foot", 52: "Pair of silk stockings", 53: "Petrified plum", 54: "Verdigris-stained bronze sword", 55: "Dagger with decorative kitten-headed pommel", 56: "Tin of white face powder", 57: "Horse hair drawing brush", 58: "Pair of huntsman's boots", 59: "Cat’s collar with small bell", 60: "Single boar’s tusk", 61: "Four black candles", 62: "Silver plate (8 s.s. value)", 63: "Walking cane with spring-loaded spike in the tip", 64: "Set of lock picks", 65: "Scarlet cap", 66: "Pair of beggar’s crutches", 67: "Shark’s tooth necklace", 68: "Large vial of syrupy liquid", 69: "Red lace bustier", 70: "Cloth doll and 2d6 needles", 71: "Pretty toe ring (3 g.r. value)", 72: "Rat-skin cloak", 73: "Knuckle bones of a pimp", 74: "Pair of rat-skin gloves", 75: "Child’s doll", 76: "Small lyre", 77: "Courtesan’s red silk dress", 78: "Black tunic of a Lankhmar police constable", 79: "Wicked saw-edged knife", 80: "Steel helm with grimacing face visor", 81: "Long-burning torch (burns three hours)", 82: "Earthenware jar", 83: "Thieves’ Guild silver membership dagger", 84: "Barber-surgeon’s scalpel", 85: "Small brandy-filled cask", 86: "Pair of padded shoes", 87: "Branding iron", 88: "Belt with four throwing daggers", 89: "Unkempt reddish-gold wig", 90: "Bearskin cloak", 91: "Pair of wire cutters", 92: "Gray wizard’s beard in a jar", 93: "Mysterious idol", 94: "Skin of Quarmall mushroom wine", 95: "1d20 bronze agols", 96: "2d7 silver smerduks", 97: "Pair of gold rilk earrings (2 g.r. value)", 98: "Fake diamond-in-amber glulditch", 99: "Metal-capped Lankhmar constable’s cudgel", 100: "Weighted and wickedly-barbed Lankhmar constable’s dart"
  };

  const results = [];
  for (let i = 1; i <= 100; i++) {
    results.push({
      text: intriguingItems[i],
      range: [i, i],
      type: CONST.TABLE_RESULT_TYPES.TEXT,
      weight: 1
    });
  }

  await RollTable.create({
    name: TABLE_NAME,
    description: "A table of 100 intriguing items for DCC Lankhmar characters, from Appendix A.",
    results: results,
    formula: "1d100"
  });

  ui.notifications.info(`Successfully created RollTable: "${TABLE_NAME}"`);
}

createIntriguingItemsTable();
