# Creating Spell Tables

You can create **Rollable Tables** for Spells, Spell Manifestations, Spell Corruption, and Spell Misfires  so that you can roll Spell results from your character sheet. Click **Create Rollable Table** from the **Rollable Tables** tab.

![Spell Table](docs/user-guide/images/spell_table.png)

Under **Title**, name the table the name of the Spell. In **Table Description**, you can copy/paste this code if you want to have a nice display in the chat window when you cast a spell:


`<h1>SPELL NAME</h1>`

`<p><strong>Level:</strong> LEVEL </p>`

`<p><strong>Range:</strong> RANGE </p>`

`<p><strong>Duration:</strong> DURATION </p>`

`<p><strong>Casting Time:</strong> CASTING TIME </p>`

`<p><strong>Save:</strong> SAVE </p>`

`<p><strong>Page:</strong> PAGE # </p>`


`<p><br />SPELL FLAVOR TEXT`

`</p>`

`<br>`

`<br>`

`<strong>Manifestation:</strong>  @Compendium[world.COMPENDIUM NAME.SPELLNAME Manifestation]`

`<br>`

`<br>`

`<strong>Misfire:</strong>  @Compendium[world.COMPENDIUM NAME.SPELLNAME Misfire]`

`<br>`

`<br>`

`<strong>Corruption:</strong>  @Compendium[world.COMPENDIUM NAME.SPELLNAME Corruption]`


You need to edit the fields to match your spell. **You should reference your compendiums in lower case only. No capital letters.** Paste the table into the Table Data box and hit Generate.




