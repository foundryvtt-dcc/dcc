# Custom Fumble Table

You can create a custom Fumble Table in your world that will be used instead of the compendium fumble table for PC fumbles.

## Creating the Table

1. Click the **Rollable Tables** tab in the sidebar
2. Click **Create Table**
3. Name the table exactly `Table 4-2: Fumbles`
4. Click **Create Rollable Table**

## Adding Results

After creating the table, add results for each fumble outcome:

1. Click the **+** button to add a result row
2. Set the **Range** for each result (matching the ranges in the core rulebook, typically 0-16+)
3. Enter the fumble effect text in the **Details** field
4. Click **Update Roll Table** to save

## How It Works

When a PC rolls a fumble, the system checks for a local world table named "Table 4-2: Fumbles" first. If found, it uses that table. If not found, it falls back to the fumble table configured in the compendium (from the DCC Core Book module if installed).

This allows you to:
- Customize fumble results for your campaign
- Use house rules for fumbles
- Create thematic fumble tables for specific adventures

## A Fumble Table for One Weapon

You can also give a single weapon its own fumble table, for example so firearms fumble on a table of misfires and jams:

1. Create a rollable table with any name (e.g. `Firearm Fumbles`), in the world or in a compendium
2. Open the weapon and type the table's name into the **Fumble Table** field in the **Critical / Fumble** box

Fumbles with that weapon are then drawn from that table. Only the table changes: the fumble die, the Luck modifier and any fumble adjustments are the same as for any other fumble, so build the table for the usual fumble range. This works for PC and NPC weapons. If no table with that name exists, the normal fumble table is used.

## Note on NPC Fumbles

NPC and monster fumbles use separate tables based on their crit table setting. See [NPC and Monster Fumbles](NPC-and-Monster-Fumbles.md) for details on how those work.