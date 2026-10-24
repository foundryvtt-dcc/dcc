# Custom Mercurial Magic Table

You can create a custom Mercurial Magic table in your world (for a setting such as Umerica, or house rules) that will be used instead of the compendium table, even when the DCC Core Book module is installed.

## Creating the Table

1. Click the **Rollable Tables** tab in the sidebar
2. Click **Create Table**
3. Name the table exactly `Table 5-2: Mercurial Magic`
4. Click **Create Rollable Table**

## Adding Results

After creating the table, add results for each mercurial effect:

1. Click the **+** button to add a result row
2. Set the **Range** for each result. Mercurial Magic is a d100 roll modified by Luck, so cover at least 1-100 and extend the first and last rows below 1 and above 100 to catch Luck modifiers
3. Enter the effect text in the **Details** field
4. Click **Update Roll Table** to save

## How It Works

When a wizard rolls (or re-rolls) Mercurial Magic, either from the spell's Mercurial tab or on a first cast, the system checks for a world table named "Table 5-2: Mercurial Magic" first. If found, it uses that table. If not found, it falls back to the table configured under **Tables & Compendia** in the system settings, or the one registered by the DCC Core Book module.

A world table named exactly like the configured compendium table also takes precedence, so you can override a table you picked in the settings without renaming it.

Modules that register a Mercurial Magic table for a specific class (for example an XCC blaster) are checked the same way: a world table matching that class table's name wins over the compendium copy.

Spells that already have a mercurial effect recorded keep it. Use the **Reroll** option on the spell's Mercurial tab to draw a fresh result from the new table.
