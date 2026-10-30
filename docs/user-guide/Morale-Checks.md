# Morale Checks

NPCs can roll a morale check: 1d20 plus their Will save, against DC 11. On a success the NPC stands firm; on a failure it flees. The system rolls and reports the result; when to call for a check, and what fleeing looks like at the table, is up to the judge.

## From the NPC sheet

The **Combat Basics** box on the NPC sheet has a **Morale** row. The value next to it is the morale modifier, which is the NPC's Will save; change the Will save to change it.

* **Click Morale** to roll.
* **Ctrl/Command-click Morale** to open the roll modifier dialog. It has a **Situational** line for the judge's adjustment (for example, a fearsome leader or a hopeless fight). The situational adjustment is capped at ±4; if you enter more, the roll uses the cap and a notification says so. See [Modifying Rolls with Ctrl/Command Click](Modifying-Rolls-or-using-Spellburn-with-Ctrl-Command-Click.md).

## From the combat tracker (GM only)

* **Right-click an NPC combatant → Morale Check** rolls for that NPC. Ctrl/Command-click the menu entry for the modifier dialog.
* **Encounter menu (⋮) → Morale Check (NPCs)** rolls for every NPC combatant that isn't marked defeated, posting one card each. Player characters and NPCs that [never check morale](#npcs-that-never-check-morale) are skipped, and an NPC with several combatants rolls once.

A morale check for a hidden combatant or hidden token is shown to the GM only, so it can't give away an NPC the players haven't seen.

## Prompt at half hit points

When damage takes an NPC from above half its hit points to half or below, the GM gets a whispered card: "*Name* is at half hit points or below," with a **Roll Morale** button. Nothing is rolled until the GM clicks (Ctrl/Command-click for the modifier dialog). An NPC dropped straight to 0 gets no prompt.

The prompt comes again if the NPC is healed above half and then damaged below it again. Turn it off for everyone with **Prompt morale checks at half HP** in [System Settings](System-Settings.md#combat-automation), or for one NPC with the card's **Don't Ask Again** button (see below).

## NPCs that never check morale

Some creatures fight to the death. Tick **Never checks morale** in the NPC's sheet configuration, or click **Don't Ask Again** on its half-HP prompt card, and that NPC:

* gets no half-HP prompt, and
* is skipped by **Morale Check (NPCs)**.

Clicking **Morale** on its sheet or on its combatant entry still rolls, since you asked for that roll directly.

For a token that isn't linked to its actor (most monsters), **Don't Ask Again** marks the actor in the Actors directory, so every token of that creature stops prompting. The exception is a token whose own sheet configuration has been saved: it keeps its own setting, so tick the box there. To undo, untick **Never checks morale** in the configuration.

## The chat card

The card shows the DC and the outcome (**Stands firm** or **Flees**), with the roll and a breakdown of the modifiers that went into it.
