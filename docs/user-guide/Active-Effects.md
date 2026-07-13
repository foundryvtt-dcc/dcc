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
- **Effect Value**: The value to use for the modification. This can be a plain number (e.g., `2`) or an `@`-variable reference to another actor attribute (e.g., `@system.abilities.lck.mod`). See [Using @-Variable References](#using--variable-references) below.

> **⚠️ Always target the modifier field, never the editable base value.**
>
> Many stats expose a dedicated *modifier* field whose only job is to receive
> Active Effects — for example `system.attributes.ac.otherMod` (not
> `ac.value`), `system.saves.ref.otherBonus` (not `ref.value`),
> `system.class.spellCheckOtherMod`, and **`system.skills.<skill>.otherMod`**
> (not `<skill>.value`). These fields are derived-only: the character sheet
> never submits them, so an effect can add to them freely without ever
> overwriting the number you typed in.
>
> If you instead point an `Add` effect at an editable base field (like a
> thief skill's `value`, or an ability score's `value`), the effect overlays
> the value you can edit on the sheet. While the effect is active, any manual
> edit to that field is discarded when the sheet saves — the system cannot
> tell your edit apart from the effect's contribution. Worse, on system
> versions before 0.70.17 every sheet save (which happens whenever you change
> *anything*, including the character's name, notes, portrait, or current HP)
> wrote the already-modified number back as the new base, making the value
> climb (or fall) permanently on its own. Targeting the
> `otherMod`/`otherBonus` field avoids all of this. When in doubt, look
> for a `*Mod` / `*Bonus` field on the stat and use that.
>
> Ability scores have their own modifier field:
> **`system.abilities.<ability>.otherMod`** (e.g.
> `system.abilities.str.otherMod`). An effect there shifts the *effective*
> score — and therefore the derived modifier — while the base score you
> type on the sheet stays fully hand-editable. Never target
> `system.abilities.*.value` or `.max` directly. **Hit Points still have no
> modifier field**, so for HP changes edit the value directly on the sheet.
> See [Troubleshooting](#troubleshooting) if a character's scores drifted
> on a system version before 0.70.17.

## Using @-Variable References

Instead of entering a static number as the Effect Value, you can reference another attribute on the actor using the `@` prefix. The reference will be resolved dynamically each time effects are applied, so the bonus updates automatically when the referenced attribute changes.

**Syntax**: `@path.to.property`

**Examples**:
- `@system.abilities.lck.mod` - The character's Luck modifier
- `@system.abilities.str.mod` - The character's Strength modifier
- `@system.abilities.per.value` - The character's Personality score

Note that `@`-references only *read* the referenced attribute, so it is safe to reference any path — including `.value` fields like the Personality score above. The restriction against `.value` fields applies to the **Attribute Key** the effect targets (see the warning above), not to the paths an effect value reads from.

If the referenced path doesn't exist or isn't a number, it resolves to `0`. A warning will be logged to the browser console (F12) to help diagnose typos in attribute paths.

**Important timing note**: `@`-variable references are resolved *before* other effects are applied. If another effect modifies the attribute you reference, the reference will see the *unmodified* value. In practice this only matters when two effects interact with the same attribute.

### @-Variable Use Case Ideas

| Goal | Key | Mode | Value |
|------|-----|------|-------|
| Add Luck mod to melee attacks | `system.details.attackHitBonus.melee.adjustment` | Add | `@system.abilities.lck.mod` |
| Add Luck mod to missile attacks | `system.details.attackHitBonus.missile.adjustment` | Add | `@system.abilities.lck.mod` |
| Add Luck mod to melee damage | `system.details.attackDamageBonus.melee.adjustment` | Add | `@system.abilities.lck.mod` |
| Add Personality mod to AC | `system.attributes.ac.otherMod` | Add | `@system.abilities.per.mod` |
| Add Luck mod to Reflex saves | `system.saves.ref.otherBonus` | Add | `@system.abilities.lck.mod` |
| Add Stamina mod to initiative | `system.attributes.init.otherMod` | Add | `@system.abilities.sta.mod` |
| Add Luck mod to spell checks | `system.class.spellCheckOtherMod` | Add | `@system.abilities.lck.mod` |
| Apply birth augur luck to AC (Charmed house) | `system.attributes.ac.otherMod` | Add | `@system.details.birthAugurLuckMod` |

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

### Example 2: "Add Luck modifier to melee attacks" (Dynamic Reference)

1. Go to the actor's **Effects** tab
2. Click **Create Effect**
3. In the effect editor:
   - Name: "Luck bonus to melee"
   - Add change: Key: `system.details.attackHitBonus.melee.adjustment`, Mode: Add, Value: `@system.abilities.lck.mod`
4. The value `@system.abilities.lck.mod` will automatically resolve to the character's current Luck modifier each time effects are applied. If the Luck score changes, the bonus updates automatically.

### Example 3: "Ring of Protection +1" (Magic Item Effect)

1. Open the item and go to its **Effects** tab
2. Click **Create Effect**
3. In the effect editor:
   - Name: "Ring of Protection +1"
   - Add change: Key: `system.attributes.ac.otherMod`, Mode: Add, Value: 1
   - Enable **Transfer to Actor** (should be enabled by default for items)
4. The effect will automatically apply when the item is equipped and remove when unequipped

### Example 4: "+1 Strength while equipped" (Magic Item Ability Bonus)

1. Open the item and go to its **Effects** tab
2. Click **Create Effect**
3. In the effect editor:
   - Name: "Strength +1"
   - Add change: Key: `system.abilities.str.otherMod`, Mode: Add, Value: 1
   - Enable **Transfer to Actor** (should be enabled by default for items)
4. While the item is equipped, the character's *effective* Strength — and Strength modifier — go up by 1. The base Strength score on the sheet stays hand-editable the whole time (spellburn, ability damage, and other base-score edits work normally), and unequipping the item removes the bonus cleanly.

Target the `otherMod` key, not `system.abilities.str.value` — on system versions before 0.70.17 an effect on the `value` field permanently corrupted the score, and on later versions it locks the score against hand-edits while active.

### Example 5: "Charmed house: Armor Class" (Birth Augur AC Bonus)

Birth augurs that modify a specific roll use the lucky roll modifier *frozen at character creation* — per the core rulebook (p. 19), this modifier does not change when Luck changes later. The DCC system stores this value at `system.details.birthAugurLuckMod`, which is populated automatically by the character parser.

To apply the "Charmed house: Armor Class" augur:

1. Go to the actor's **Effects** tab
2. Click **Create Effect**
3. In the effect editor:
   - Name: "Charmed house: Armor Class"
   - Add change: Key: `system.attributes.ac.otherMod`, Mode: Add, Value: `@system.details.birthAugurLuckMod`
4. The frozen birth augur luck modifier is added to AC, and stays fixed as the character's Luck score changes.

The same pattern works for any birth augur that modifies a specific roll — just target the appropriate attribute key (e.g., `system.details.attackHitBonus.melee.adjustment` for "The bull: Melee attack rolls") and use `@system.details.birthAugurLuckMod` as the value.

**Pre-made effects:** If the [DCC Core Book](https://foundryvtt.com/packages/dcc-core-book) module is installed, all of the automatable birth augur effects from the core book are already defined in the **DCC Core: Birth Augur Effects** compendium. Open the **Compendiums** sidebar, find that compendium, and drag the matching effect directly onto the actor.

## Effect Icons on Ability Scores

When an effect modifies an ability score, a small icon appears in the upper-right corner of that ability's box on the character sheet. Hovering over the icon shows the effect name and value, making it easy to see at a glance which abilities are being modified.

When the effect targets the `otherMod` field (the recommended key), the effective score is also shown in the corner of the ability box — the main number remains the editable base score, and you can keep editing it while the effect is active. If instead an effect targets the `value` field directly (not recommended), manual edits to that score are ignored on save (the effect controls the field) — disable the effect first if you need to change the base score.

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

Target the `otherMod` modifier field, **not** the `value` or `max` base fields (see the warning near the top of this page). An `otherMod` effect shifts the effective score and the derived ability modifier; the base score stays hand-editable while the effect is active.

- `system.abilities.str.otherMod` - Strength
- `system.abilities.agl.otherMod` - Agility
- `system.abilities.sta.otherMod` - Stamina
- `system.abilities.per.otherMod` - Personality
- `system.abilities.int.otherMod` - Intelligence
- `system.abilities.lck.otherMod` - Luck

Notes:
- The derived ability modifier (`.mod`) updates automatically from the effective score (base `value` + `otherMod`), so a +1 that crosses a modifier threshold (e.g. 15 → 16) raises the modifier too.
- `otherMod` does not shift `maxMod` (the `@maxLck`/`@maxStr` roll-data aliases) — that stays derived from the raw `max` score, which only permanent changes move.
- Spellburn and luck spending always consume the *base* score: a temporary `otherMod` bonus doesn't add burnable points (and a penalty doesn't remove them), and the thief/halfling Luck Die spend cap follows the base Luck score.
- For *permanent* changes — ability damage, spellburn, curses that should consume the base score — edit the score directly on the character sheet instead of using an effect.

### Combat Attributes
- `system.attributes.ac.otherMod` - AC Modifier (requires auto-calculate AC, which is on by default for PCs; also works for NPCs)
- `system.attributes.speed.otherMod` - Movement Speed Modifier (PCs)
- `system.attributes.init.otherMod` - Initiative Modifier

Hit Points (`system.attributes.hp.*`) have no modifier field — apply damage, healing, and maximum-HP changes directly on the sheet rather than through an Active Effect. Likewise, if you have turned auto-calculate AC off on a PC, adjust the AC number directly instead of using an effect.

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
Target the `otherMod` modifier field, **not** the `value` base (see the warning near the top of this page).
- `system.skills.sneakSilently.otherMod` - Sneak Silently
- `system.skills.hideInShadows.otherMod` - Hide In Shadows
- `system.skills.pickPockets.otherMod` - Pick Pockets
- `system.skills.climbSheerSurfaces.otherMod` - Climb Sheer Surfaces
- `system.skills.pickLock.otherMod` - Pick Lock
- `system.skills.findTrap.otherMod` - Find Trap
- `system.skills.disableTrap.otherMod` - Disable Trap
- `system.skills.forgeDocument.otherMod` - Forge Document
- `system.skills.disguiseSelf.otherMod` - Disguise Self
- `system.skills.readLanguages.otherMod` - Read Languages
- `system.skills.handlePoison.otherMod` - Handle Poison
- `system.skills.castSpellFromScroll.otherMod` - Cast Spell From Scroll

### Other Skills
- `system.skills.detectSecretDoors.otherMod` - Detect Secret Doors (Elves)
- `system.skills.sneakAndHide.otherMod` - Sneak and Hide (Halflings)
- Cleric skills also support a modifier: `system.skills.divineAid.otherMod`, `system.skills.turnUnholy.otherMod`, `system.skills.layOnHands.otherMod`
- Dwarf shield bash: `system.skills.shieldBash.otherMod`

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

> `system.attributes.actionDice.value` is the one exception to the "never
> target a `.value` field" rule: the character sheet edits action dice
> through a separate configuration field, so a Dice Chain effect on this key
> is never written back into the base value.

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

- **Armor Class** (`system.attributes.ac.otherMod`)
- **Initiative** (`system.attributes.init.otherMod`)
- **Saving Throws** (`system.saves.frt.otherBonus`, `system.saves.ref.otherBonus`, `system.saves.wil.otherBonus`)

Ability score `otherMod` effects (`system.abilities.<ability>.otherMod`) also work on NPCs — NPCs share the same ability schema as PCs.

As with PCs, do not target the editable base fields (`ac.value`, `init.value`, `hp.value`, `hp.max`, `speed.value`, or ability score `value`/`max`) — edit those directly on the NPC's stat block instead.

## Troubleshooting

### An effect keeps re-applying itself (a value climbs or falls on every edit)

**Symptoms**: You create an effect that adds to or subtracts from a stat — for example, a curse that subtracts 1 from `system.abilities.lck.value`. It applies correctly at first (Luck 12 → 11), but then the score drops *again* every time you change anything at all on the sheet: editing current HP, renaming the character, changing the portrait, typing in the Notes tab, leveling up. Before long the character is at 8 and falling.

**Cause**: The effect targets an *editable base field* rather than a dedicated modifier field. Whenever the sheet is saved (which happens on nearly any edit), the displayed — already modified — number is written back as the new base value, and the effect then applies again on top of it. Each save permanently bakes another application of the effect into the character.

> **Note**: System version 0.70.17 fixes the compounding itself — sheet saves no longer write effect-modified values back into the base. The guidance on this page still stands, though: while an effect targets an editable field, any manual edit you make to that field is discarded on save (the system can't tell your edit apart from the effect's contribution), so modifier fields remain the right target. Characters that drifted on earlier versions still need the manual repair below.

The fields affected are the ones you can type into on the sheet: ability scores (`system.abilities.*.value` and `.max`), Hit Points (`system.attributes.hp.*`), `system.attributes.ac.value`, `system.attributes.init.value`, `system.attributes.speed.value`, and thief/other skill `value` fields.

**To fix a character that has already drifted**:

1. Delete (or disable) the offending effect.
2. Manually re-enter the correct base value on the sheet. If you're unsure what it was, check earlier values in the chat log, or work backwards: each sheet save applied the effect one extra time.
3. Re-create the effect against the stat's modifier field instead — the `otherMod` / `otherBonus` / `adjustment` keys listed under [Common Attribute Keys](#common-attribute-keys).
4. If the stat has no modifier field (Hit Points), don't use an Active Effect for it — apply the change directly to the sheet and note its source in the effect's description or the Notes tab so you remember to remove it later. (Ability scores gained a modifier field — `system.abilities.<ability>.otherMod` — so recreate ability effects against that key.)

### An effect isn't applying at all

1. Check the attribute key is spelled correctly (case-sensitive)
2. Ensure the effect is not disabled
3. For item effects, verify the item is equipped
4. Check the console (F12) for any error messages
5. Verify the value is appropriate for the mode (numbers for Add/Multiply)
6. If the key is an `otherMod`-style field, confirm the related auto-calculation is enabled — for example, `system.attributes.ac.otherMod` on a PC only applies while auto-calculate AC is on
