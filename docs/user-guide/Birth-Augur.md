# Birth Augur (Lucky Roll)

In DCC RPG, every character is born under a particular birth augur that modifies a specific game mechanic based on their luck modifier. The DCC system can now automate these modifiers for you.

## Selecting a Birth Augur

On the **Character** tab, the **Lucky Roll** section has a dropdown where you can select your character's birth augur from the full list of 30 options.

When you select a birth augur, the system will automatically apply the luck modifier to the appropriate computed value (attack rolls, saving throws, AC, etc.). The current modifier value is displayed below the dropdown.

The free-text field below the dropdown is kept for notes, custom text, or backwards compatibility with existing characters.

## Setting the Luck Modifier

The birth augur modifier is set via the **Birth Augur Luck Mod** field in the details section of the character. This should be the character's luck modifier at the time of character creation (their level-0 luck mod).

If you import a character via the PC parser, the system will attempt to auto-detect the birth augur from the lucky sign text and set the index automatically.

## Static vs Floating Mode

By RAW (Rules As Written), the birth augur modifier is locked at character creation — it uses the luck modifier the character had at level 0, regardless of any later changes to their luck score. This is the default **Static** mode.

Some groups house-rule that the birth augur modifier floats with the character's current luck score. To enable this:

1. Click the **Toggle Controls** button (three vertical dots) in the title bar
2. Click **Config**
3. Find the **Birth Augur Mode** dropdown
4. Change it from **Static (RAW)** to **Floating (House Rule)**

In **Floating** mode, the birth augur bonus will always use the character's current luck modifier instead of the stored birth augur luck mod value.

## Automated Augurs

The following 14 birth augurs are currently automated. Selecting one of these will modify the corresponding computed values on the character sheet:

| # | Birth Augur | Effect |
|---|-------------|--------|
| 1 | Harsh winter | All attack rolls (melee and missile) |
| 2 | The bull | Melee attack rolls |
| 3 | Fortunate date | Missile fire attack rolls |
| 6 | Born on the battlefield | All damage rolls (melee and missile) |
| 7 | Path of the bear | Melee damage rolls |
| 8 | Hawkeye | Missile fire damage rolls |
| 13 | Seventh son | Spell checks |
| 17 | Lucky sign | All saving throws |
| 20 | Struck by lightning | Reflex saving throws |
| 21 | Lived through famine | Fortitude saving throws |
| 22 | Resisted temptation | Willpower saving throws |
| 23 | Charmed house | Armor Class |
| 24 | Speed of the cobra | Initiative |
| 30 | Wild child | Speed (multiplied by 5 feet per modifier point) |

## Non-Automated Augurs

The remaining augurs (#4, 5, 9–12, 14–16, 18–19, 25–29) can be selected from the dropdown to record the character's birth augur, but their effects are not yet automated. You will need to apply these modifiers manually when they are relevant (e.g. during specific skill checks, when unarmed, when mounted, etc.).

## Interaction with Active Effects

Birth augur bonuses stack with Active Effects. For example, if a character has the "Charmed house" augur (+1 AC) and also has an Active Effect that adds +2 to AC, both bonuses will be applied.

## Existing Characters

Characters created before this feature was added will continue to work unchanged. Their free-text birth augur field is preserved. If the system can recognise the augur from the existing text, it will automatically set the birth augur index during migration. Otherwise, you can manually select the correct augur from the dropdown.

## Luck, Crits, Fumbles, and Turn Unholy

The system already applies the luck modifier to critical hits, fumbles, and turn unholy checks for all characters regardless of birth augur. This existing behaviour is unchanged — those bonuses are applied whether or not the character's birth augur matches those effects.
