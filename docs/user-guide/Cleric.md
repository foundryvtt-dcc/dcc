# Cleric

## Setting Up a Cleric

First, select the "Cleric" sheet type:

1. Click the **Toggle Controls** button (three vertical dots) in the title bar
2. Click **Configure Sheet**
3. In the **This Sheet** dropdown, select **Cleric**
4. Click **Save Sheet Configuration**

## Cleric Tab

The Cleric tab has the cleric-specific skills, such as Lay on Hands, Divine Aid, and Turn Unholy.

![Cleric Tab Skills](images/cleric_tab_skills.png)

As your cleric accrues disapproval from failed spells, the disapproval number on this tab will go up. You can adjust or reset it manually.

If your cleric's deity has their own disapproval table that you have created, you can choose that here.

There is also a handy reference chart for those skills on this tab.

Cleric spells are on the Spells tab.

![Cleric Spells Tab](images/cleric_spells_tab.png)

## Creating World-Local Disapproval Tables

You can create custom disapproval tables specific to your world or deity. The system will automatically find and add world tables to the dropdown if their name contains "Disapproval" (or the localized equivalent in your language).

### Step 1: Create a RollTable

1. Click on the **RollTables** tab in the sidebar
2. Click **Create RollTable**
3. Fill in the table details:
   - **Name**: Must contain "Disapproval" in the name (e.g., "Cthulhu Disapproval", "Lord of All Smiths Disapproval", or just "Disapproval")
   - **Description**: Optional description of the deity or table
   - **Roll Formula**: Leave blank or set to any formula - it is not used (the system automatically rolls based on the spell check result)
4. Add table results in the **Results** section:
   - **IMPORTANT**: Your first result should have a minimum range of **-500** (or lower) to catch all low rolls
   - **IMPORTANT**: Your last result should have a maximum range of **500** (or higher) to catch all high rolls
   - For each row in the disapproval table, click **Add Result**
   - Set the **Range** to match the DCC disapproval table (e.g., 1-1, 2-3, 4-5, etc.)
   - Set the **Text** to the disapproval effect for that range
   - Example ranges:
     - First result: `-500 to 1` (catches all rolls of 1 or below)
     - Middle results: `2-3`, `4-5`, `6-8`, etc.
     - Last result: `16 to 500` (catches all rolls of 16 or above)
5. Click **Create RollTable** to save

**Why these ranges?** The disapproval roll formula is `(natural spell check roll)d4 - luck modifier`. For example, if you rolled a natural 3 on your spell check with -1 luck, the disapproval roll is `3d4 - (-1)` = `3d4 + 1`, which can range from 4 to 13. Using wide ranges like -500 to 500 ensures all possible results are covered.

### Step 2: Select the Table on Your Cleric

1. Open your Cleric's character sheet
2. Go to the **Cleric** tab
3. In the **Disapproval Table** dropdown, your world table will appear automatically if it contains "Disapproval" in its name
4. Select your custom table from the dropdown
5. The table is now ready to roll when disapproval is incurred

The system will automatically find and list your world table in the dropdown. If you rename the table and remove "Disapproval" from the name, it will be removed from the dropdown automatically.

### Tips

- The table name **must contain "Disapproval"** to appear in the dropdown (e.g., "Zeus Disapproval", "Disapproval of Ares")
- Create a separate RollTable for each deity's disapproval effects
- Each Cleric can select their own deity's disapproval table
- The dropdown updates automatically when you create, rename, or delete tables
- Tables are rollable by clicking the **Disapproval Range** label or dragging it to the hotbar
- If you have the Core Book module, it includes the standard disapproval table automatically
- Works with localized versions of "Disapproval" in other languages (e.g., "Ungnade" in German, "Désapprobation" in French)

## Creating Cleric Ability Roll Tables

By default, cleric abilities (Turn Unholy, Lay on Hands, Divine Aid) roll a spell check and show a simple pass/fail result. If you want detailed results from a roll table (like the tables in the DCC RPG rulebook), you can create your own world RollTables and configure the system to use them.

If you have the **Core Book module** installed, these tables are included automatically and no setup is needed.

### Step 1: Create a RollTable

1. Click on the **RollTables** tab in the sidebar
2. Click **Create RollTable**
3. Fill in the table details:
   - **Name**: A descriptive name (e.g., "Turn Unholy", "Lay on Hands", "Divine Aid")
   - **Roll Formula**: Leave blank — the system uses the spell check result to look up the table row
4. Add table results in the **Results** section. Each row maps a spell check total to its effect:
   - Click **Add Result** for each row
   - Set the **Range** to match the spell check totals from the DCC RPG rulebook
   - Set the **Text** to the effect description
   - **IMPORTANT**: Your first result should have a minimum range of **1** to catch low rolls
   - **IMPORTANT**: Your last result should have a high maximum range (e.g., **40**) to catch high rolls with bonuses

   Example for Turn Unholy:
   - `1 to 11`: No effect
   - `12 to 13`: Turned 1d4 HD of unholy creatures, etc.
   - `14 to 19`: Greater effect...
   - `20 to 40`: Maximum effect...
5. Click **Create RollTable** to save

### Step 2: Configure the System Setting

1. Go to **Game Settings** → **Configure Settings** → **System Settings**
2. Check **Manual Compendium Configuration** and save
3. The settings page will reload with additional fields. Find the field for your ability:
   - **Turn Unholy Table**
   - **Lay on Hands Table**
   - **Divine Aid Table**
4. Type the **exact name** of your world RollTable into the field
5. Click **Save Changes**

The system will now look up your world table when that ability is rolled. The table result text will be displayed in the chat card instead of the simple "Success." / "Failure." message.

### Tips

- The table name in the setting must **exactly match** the world RollTable name (case-sensitive)
- Each ability needs its own RollTable — they have different result ranges and effects
- When a table is configured, fumbles (natural 1) always use the lowest table result, and crits (natural 20) add the cleric's level to the roll before looking up the result
- You can remove a table by clearing the setting field and saving — the system will fall back to the simple pass/fail display
- If you later install the Core Book module, set the settings back to "Automatic" by unchecking Manual Compendium Configuration

