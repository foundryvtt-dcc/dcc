# Custom Critical Hit Table

You can create a custom Critical Hit Table in your world.

## Creating the Table

1. Click the **Rollable Tables** tab in the sidebar
2. Click **Create Table**
3. Name the table with the format `Crit Table XXXX` where XXXX is the short name you want to use (e.g., "Crit Table DoomSword")
4. Click **Create Rollable Table**

![Critical Hit Table Creation](images/crit_table_creation.png)

## Adding Results

After creating the table, add results for each critical hit outcome:

1. Click the **+** button to add a result row
2. Set the **Range** for each result (e.g., 1-2, 3-4, etc.)
3. Enter the critical hit effect text in the **Details** field
4. Click **Update Roll Table** to save

## Using the Custom Table

Reference your custom crit table by its short name:

- **On Character**: Enter the short name (e.g., "DoomSword") in the **Crit Table** field in Combat Basics
- **On Weapon**: Enter the short name in the weapon's **Override Table** field to use it only for that weapon
