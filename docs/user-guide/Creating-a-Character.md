# Creating a player character

To create a character, log into FoundryVTT. 
 
Click the **Actors** Directory icon in the top right, it looks like a person.

Click **Create Actor**.

Name your character, make sure **Player** is selected as **Type**, and click **Create New Actor**.

![Create New Actor](docs/user-guide/images/create_actor_dialog.png)

Click **Sheet**. Choose your class from the drop down. I chose Wizard.


![Character Class Selection](docs/user-guide/images/character_class_selection.png)

Now you can start entering stats into the boxes. The **Character** tab is fairly straightforward. Each stat has a box for the current and maximum (or initial) value to allow tracking stat loss, spellburn, luck spend, etc.

Some boxes, such as attack bonuses, are calculated values that you can't change directly.

You can use the tabs along the top to add equipment, spells, or to adjust class-specific abilities.

## Equipment

In **Equipment**, you can create weapons, armor, etc., or you can drag them from the Core Book compendium if you own that and have it insalled:

![Core Book Compendium](docs/user-guide/images/core_book_compendium.png)

## Weapons
Click **Add** to add a Melee Weapon. You can quick-edit it on the Equipment tab, but most options are available when you click the pencil to edit it.

![Weapon Edit Dialog](docs/user-guide/images/weapon_edit_dialog.png)

This dialog looks intimidating, as it provides a lot of options to let you override regular values for specific weapons and custom character classes. But for most basic weapons and characters, you will not need to use this dialog, especially if you are dragging in items from the Compendium.

The system currently has no ability to work with the level-up for characters, so as your character levels up, you will need to apply those bonuses manually.

Thieves (or character sheets with Backstab enabled) are given an extra button next to their weapons for backstabs, which use the extra backstab damage if enabled and automatically roll a crit.

Unchecking the **Melee** checkbox indicates **Ranged** weapon which will be sorted sorted into its own section of the inventory, and range field will be shown instead of the notes summary.

Fields are provided to set the value of the weapon in Platinum, Electrum, Gold, Silver, and Copper pieces.

The `</> Config` option at the top of the sheet provides access to further customization, including disabling auto-calculations.

For a Warrior you can also set some options in the class tab. **Critical Threat Range** will make you crit on 19s, or 18s, or whatever you set it to. 

**Lucky Weapon** is not automated, it’s just a notes field.


## Armor
![Armor Edit Dialog](docs/user-guide/images/armor_edit_dialog.png)

**Armor** can be entered the same way. You can click the pencil next to it to enter the details. 

The checkbox next to an armor item can be unticked to unequip it. This will remove it from consideration for AC and fumble calculations if they are enabled.