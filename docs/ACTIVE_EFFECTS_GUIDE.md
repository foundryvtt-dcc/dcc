# DCC Active Effects Guide

Active Effects in the DCC system allow you to create temporary or permanent modifications to character attributes. This guide explains how to use them through the new Effects tab UI.

## Overview

Active Effects can modify any numeric value on an actor's data. They can come from:
- Conditions (e.g., stunned, blessed, cursed)
- Magic items (e.g., +1 Strength while equipped)
- Spell effects (e.g., -2 to next attack)
- Class abilities or other sources

## Accessing Effects

### On Actor Sheets
1. Open any character sheet (player or NPC)
2. Click the **"Effects"** tab
3. Use the **"Create Effect"** button to add new effects

### On Item Sheets
1. Open any item (weapon, armor, equipment, etc.)
2. Click the **"Effects"** tab
3. Use the **"Create Effect"** button to add effects that will apply when the item is equipped

## Common Use Cases

### Example 1: "-2 to next attack" (Temporary Penalty)

To create an effect that gives -2 to the next attack:
1. Go to the actor's **Effects** tab
2. Click **"Create Effect"**
3. In the effect editor:
   - Name: "-2 Attack Penalty"
   - Add two changes:
     - Key: `system.details.attackHitBonus.melee.adjustment`, Mode: Add, Value: -2
     - Key: `system.details.attackHitBonus.missile.adjustment`, Mode: Add, Value: -2
   - Set duration as needed (e.g., 1 round)

### Example 2: "+1 Str while equipped" (Magic Item Effect)

To create a magic item that grants +1 Strength while equipped:
1. Open the item and go to its **Effects** tab
2. Click **"Create Effect"**
3. In the effect editor:
   - Name: "Strength Enhancement"
   - Add change: Key: `system.abilities.str.value`, Mode: Add, Value: 1
   - Enable **"Transfer to Actor"** (should be enabled by default for items)
4. The effect will automatically apply when the item is equipped and remove when unequipped

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
- `system.attributes.ac.value` - Armor Class
- `system.attributes.ac.otherMod` - AC Other Modifier
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
- `system.attributes.critical.die` - Critical Hit Die
- `system.attributes.fumble.die` - Fumble Die

## Effect Modes

Active Effects support different modes of application:

- **Add**: Adds the value to the current attribute (most common)
- **Multiply**: Multiplies the attribute by the value
- **Override**: Replaces the attribute with this value
- **Upgrade**: Uses the higher of current value or effect value
- **Downgrade**: Uses the lower of current value or effect value
- **Custom**: For special DCC-specific effects (requires module support)

## Duration

Effects can have various durations:
- **Permanent**: Always active (good for magic items)
- **Temporary**: Active for a specific duration
- **Until Rest**: Lasts until the character rests
- **Special**: Custom duration tracking

## Tips

1. **Stacking**: Multiple effects with the same attribute key will stack if using "Add" mode
2. **Equipment**: Effects on items only apply when the item is equipped (for armor/weapons)
3. **Order of Operations**: Effects are applied in this order: Custom → Multiply → Add → Upgrade/Downgrade → Override
4. **Testing**: Use the browser console to check `actor.system` to find the exact path for attributes

## Advanced Usage

### Conditional Effects
Some effects might only apply in certain situations. While the base system doesn't support complex conditionals, you can:
- Create multiple effects and enable/disable them as needed
- Use the Custom mode with module support for complex logic

### Dice Chain Modifications
DCC's unique dice chain system may require special handling. For effects that modify dice (e.g., reducing action dice), consider using the Custom mode or creating specific implementations.

## Troubleshooting

If an effect isn't working:
1. Check the attribute key is spelled correctly (case-sensitive)
2. Ensure the effect is not disabled
3. For item effects, verify the item is equipped
4. Check the console for any error messages
5. Verify the value is appropriate for the mode (numbers for Add/Multiply)