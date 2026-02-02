# Active Effects

Active Effects allow you to create temporary or permanent modifications to character attributes. They can represent conditions, magic item bonuses, spell effects, or any other modifier that changes a character's statistics.

## Overview

Active Effects can modify any numeric value on an actor's data. They can come from:

- **Conditions** (e.g., stunned, blessed, cursed)
- **Magic items** (e.g., +1 Strength while equipped)
- **Spell effects** (e.g., -2 to next attack)
- **Class abilities** or other sources

## Accessing Effects

### On Actor Sheets

1. Open any character sheet (player or NPC)
2. Click the **Effects** tab
3. Use the **Create Effect** button to add new effects

### On Item Sheets

1. Open any item (weapon, armor, equipment, etc.)
2. Click the **Effects** tab
3. Use the **Create Effect** button to add effects that will apply when the item is equipped

## Creating an Effect

When you create a new effect, you can configure:

- **Name**: A descriptive name for the effect
- **Icon**: An image to represent the effect
- **Changes**: The actual modifications to apply (see Common Attribute Keys below)
- **Duration**: How long the effect lasts
- **Disabled**: Toggle the effect on/off without deleting it

### Adding Changes

Each change consists of:

- **Attribute Key**: The path to the value you want to modify
- **Change Mode**: How to apply the modification (Add, Multiply, Override, etc.)
- **Effect Value**: The value to use for the modification

## Common Use Cases

### Example 1: "-2 to next attack" (Temporary Penalty)

1. Go to the actor's **Effects** tab
2. Click **Create Effect**
3. In the effect editor:
   - Name: "-2 Attack Penalty"
   - Add two changes:
     - Key: `system.details.attackHitBonus.melee.adjustment`, Mode: Add, Value: -2
     - Key: `system.details.attackHitBonus.missile.adjustment`, Mode: Add, Value: -2
   - Set duration as needed (e.g., 1 round)

### Example 2: "+1 Str while equipped" (Magic Item Effect)

1. Open the item and go to its **Effects** tab
2. Click **Create Effect**
3. In the effect editor:
   - Name: "Strength Enhancement"
   - Add change: Key: `system.abilities.str.value`, Mode: Add, Value: 1
   - Enable **Transfer to Actor** (should be enabled by default for items)
4. The effect will automatically apply when the item is equipped and remove when unequipped

## Effect Icons on Ability Scores

When an effect modifies an ability score, a small icon appears in the upper-right corner of that ability's box on the character sheet. Hovering over the icon shows the effect name and value, making it easy to see at a glance which abilities are being modified.

## Dragging and Copying Effects

Effects can be dragged between actors and items to create copies:

- **From Item to Actor**: Drag an effect from an item's Effects tab onto an actor sheet
- **From Actor to Actor**: Drag an effect from one actor's Effects tab onto another actor sheet
- **From Actor to Item**: Drag an effect from an actor's Effects tab onto an item sheet
- **From Item to Item**: Drag an effect from one item's Effects tab onto another item sheet

When you drag an effect, a **copy** is created on the target - the original effect remains on the source. This is useful for:

- Sharing standard effects between characters
- Creating template effects on items that can be copied to actors
- Quickly applying the same condition to multiple characters

### Using the DCC Effects Compendium

The DCC system includes a built-in **DCC Effects** compendium with ready-to-use effects for common bonuses and penalties. To use it:

1. Open the **Compendiums** tab in the sidebar
2. Find **DCC Effects** under the system compendiums
3. Browse the available effects (organized by type: AC, Attack, Damage, Initiative, Saves, Skills)
4. Drag any effect directly onto an actor to apply it

The compendium includes effects for:
- **AC Bonuses/Penalties** (+1 to +5, -1 to -5)
- **Attack Bonuses/Penalties** (melee and missile, +1 to +5, -1 to -5)
- **Damage Bonuses/Penalties** (melee and missile, +1 to +5, -1 to -5)
- **Dice Chain Effects** (Action Die +1d/-1d, Crit Die +1d, Luck Die +1d)
- **Initiative Bonuses/Penalties** (+1 to +5, -1 to -5)
- **Save Bonuses/Penalties** (Fortitude, Reflex, Will, +1 to +5, -1 to -5)
- **Thief Skill Bonuses** (+1 to +5 for all thief skills)

### Creating Your Own Effect Library

You can also create custom effects and organize them:

1. Create one or more items (equipment type works well) to serve as "containers"
2. Name them descriptively (e.g., "Combat Conditions", "Spell Effects", "Status Conditions")
3. Add all your commonly-used effects to these items
4. When you need an effect, drag it from the library item onto your actor

You can organize your library items in a Compendium for easy access across worlds.

### Using DFreds Convenient Effects

If you have the [DFreds Convenient Effects](https://foundryvtt.com/packages/dfreds-convenient-effects) module installed, you can create custom effects that work with DCC actors. This module provides a convenient UI for managing and applying effects, and any effects you create using DCC attribute keys will apply correctly to your characters.

## Common Attribute Keys

### Ability Scores
- `system.abilities.str.value` - Current Strength
- `system.abilities.str.max` - Maximum Strength
- `system.abilities.agl.value` - Current Agility
- `system.abilities.sta.value` - Current Stamina
- `system.abilities.per.value` - Current Personality
- `system.abilities.int.value` - Current Intelligence
- `system.abilities.lck.value` - Current Luck

### Combat Attributes
- `system.attributes.ac.value` - Armor Class (use this if auto-calculate AC is OFF)
- `system.attributes.ac.otherMod` - AC Other Modifier (use this if auto-calculate AC is ON)
- `system.attributes.hp.value` - Current HP
- `system.attributes.hp.max` - Maximum HP
- `system.attributes.hp.temp` - Temporary HP
- `system.attributes.speed.value` - Movement Speed
- `system.attributes.init.value` - Initiative Bonus
- `system.attributes.init.otherMod` - Initiative Other Modifier

### Attack & Damage Modifiers
- `system.details.attackHitBonus.melee.adjustment` - Melee Attack Bonus
- `system.details.attackDamageBonus.melee.adjustment` - Melee Damage Bonus
- `system.details.attackHitBonus.missile.adjustment` - Missile Attack Bonus
- `system.details.attackDamageBonus.missile.adjustment` - Missile Damage Bonus

### Saving Throws
- `system.saves.frt.otherBonus` - Fortitude Save Bonus
- `system.saves.ref.otherBonus` - Reflex Save Bonus
- `system.saves.wil.otherBonus` - Will Save Bonus

### Class-Specific
- `system.class.spellCheckOtherMod` - Spell Check Bonus
- `system.class.luckDie` - Luck Die (for Thieves/Halflings)
- `system.class.backstab` - Backstab Bonus (for Thieves)
- `system.attributes.critical.die` - Critical Hit Die
- `system.attributes.fumble.die` - Fumble Die

### Thief Skills
- `system.skills.sneakSilently.value` - Sneak Silently
- `system.skills.hideInShadows.value` - Hide In Shadows
- `system.skills.pickPockets.value` - Pick Pockets
- `system.skills.climbSheerSurfaces.value` - Climb Sheer Surfaces
- `system.skills.pickLock.value` - Pick Lock
- `system.skills.findTrap.value` - Find Trap
- `system.skills.disableTrap.value` - Disable Trap
- `system.skills.forgeDocument.value` - Forge Document
- `system.skills.disguiseSelf.value` - Disguise Self
- `system.skills.readLanguages.value` - Read Languages
- `system.skills.handlePoison.value` - Handle Poison
- `system.skills.castSpellFromScroll.value` - Cast Spell From Scroll

### Other Skills
- `system.skills.detectSecretDoors.value` - Detect Secret Doors (Elves)
- `system.skills.sneakAndHide.value` - Sneak and Hide (Halflings)

## Effect Modes

Active Effects support different modes of application:

- **Add**: Adds the value to the current attribute (most common)
- **Multiply**: Multiplies the attribute by the value
- **Override**: Replaces the attribute with this value
- **Upgrade**: Uses the higher of current value or effect value
- **Downgrade**: Uses the lower of current value or effect value
- **Dice Chain**: DCC-specific mode that moves dice along the dice chain (see below)
- **Custom**: For special DCC-specific effects (requires module support)

### Dice Chain Mode

The **Dice Chain** effect mode is a DCC-specific feature that adjusts dice expressions along the DCC dice chain:

**The Dice Chain:** d3 → d4 → d5 → d6 → d7 → d8 → d10 → d12 → d14 → d16 → d20 → d24 → d30

**How to use:**
1. Set the **Change Mode** to "Dice Chain"
2. Set the **Value** to the number of steps to move:
   - **1** = move up one step (e.g., d20 becomes d24)
   - **-1** = move down one step (e.g., d20 becomes d16)
   - **2** = move up two steps (e.g., d20 becomes d30)

**Target Fields for Dice Chain:**
| Field | Attribute Key |
|-------|---------------|
| Action Die | `system.attributes.actionDice.value` |
| Critical Die | `system.attributes.critical.die` |
| Fumble Die | `system.attributes.fumble.die` |
| Luck Die | `system.class.luckDie` |

**Example: -1d to Action Die (Penalty)**
1. Create a new effect
2. Add a change:
   - Key: `system.attributes.actionDice.value`
   - Mode: Dice Chain
   - Value: -1
3. This will reduce the character's action die by one step (e.g., d20 → d16)

**Pre-made Effects:** The DCC Effects compendium includes ready-to-use dice chain effects:
- Action Die +1d / -1d
- Crit Die +1d
- Luck Die +1d

## Duration

Effects can have various durations:

- **Permanent**: Always active (good for magic items)
- **Temporary**: Active for a specific duration
- **Until Rest**: Lasts until the character rests
- **Special**: Custom duration tracking

## Tips

1. **Stacking**: Multiple effects with the same attribute key will stack if using "Add" mode
2. **Equipment**: Effects on items only apply when the item is equipped (for armor/weapons)
3. **Order of Operations**: Effects are applied in this order: Custom, Multiply, Add, Upgrade/Downgrade, Override
4. **Testing**: Use the browser console to check `actor.system` to find the exact path for attributes

## NPC-Specific Behavior

NPCs handle some Active Effects differently from PCs due to their simplified stat blocks.

### Effects Applied at Roll Time (Not Shown on Sheet)

The following effects are applied when the NPC makes a roll, but are **not** reflected in the NPC sheet's displayed values:

- **Attack Bonuses** (`system.details.attackHitBonus.melee.adjustment`, `system.details.attackHitBonus.missile.adjustment`)
- **Damage Bonuses** (`system.details.attackDamageBonus.melee.adjustment`, `system.details.attackDamageBonus.missile.adjustment`)

This is because NPCs don't have calculated melee/missile totals like PCs do - each NPC attack has its own to-hit and damage values. The effect bonuses are added to the roll when the attack is made.

### Effects That Work the Same as PCs

These effects are applied normally and displayed on the NPC sheet:

- **Armor Class** (`system.attributes.ac.value` or `system.attributes.ac.otherMod`)
- **Initiative** (`system.attributes.init.value` or `system.attributes.init.otherMod`)
- **Saving Throws** (`system.saves.frt.otherBonus`, `system.saves.ref.otherBonus`, `system.saves.wil.otherBonus`)
- **Hit Points** (`system.attributes.hp.value`, `system.attributes.hp.max`)
- **Speed** (`system.attributes.speed.value`)

## Troubleshooting

If an effect isn't working:

1. Check the attribute key is spelled correctly (case-sensitive)
2. Ensure the effect is not disabled
3. For item effects, verify the item is equipped
4. Check the console for any error messages
5. Verify the value is appropriate for the mode (numbers for Add/Multiply)
