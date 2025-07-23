# Creating a Spell

You need to create two things for a rollable spell to work.

1) You need to create an "Item" of type "Spell".

2) You need to create a Rollable Table for the spell results.

You then link the Rollable Table's UUID to the Item so the spell knows what to roll.

To get the Rolltable Table's UUID, click on the little book icon right after the table's name in the RollTable's titlebar.
Note that in versions pre v0.50.12, you'll need to edit the pasted-in-UUID to be only the UUID, and not include `RollTable.`.

If you want it to show the Spell data in the chat when rolled, add that to the description at the top of the Rollable Table.

If you want that format to match the Core Book Spells, the HTML for that is in the [Creating Spell Tables](Creating-Spell-Tables.md) wiki entry.

## Creating the Spell Item:
<img width="348" alt="image" src="https://github.com/user-attachments/assets/a9a0a821-acfb-4722-a366-74c5738472a1">


## Creating the Rollable Table:
<img width="320" alt="image" src="https://github.com/user-attachments/assets/32ab3565-9511-4910-b15e-a4000569bd4b">

## Copying the UUID value:
<img width="324" alt="image" src="https://github.com/user-attachments/assets/09ecdebf-8bcf-4e08-ac74-bb815e521adf">

## Pasting in the UUID into the Result Table field of the Spell Config:

<img width="487" alt="image" src="https://github.com/user-attachments/assets/38e78af5-4205-479a-9c17-eb22c86ed60b">

## Spell data in the description of the Rollable Table that will appear in chat when spell is cast:
<img width="356" alt="image" src="https://github.com/user-attachments/assets/b4927390-f7a3-4209-8ec8-f81223db9972">
 
