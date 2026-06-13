# Charged Magic Items

You can turn any Equipment item into a charged magic item — like a wand of magic missiles — by attaching a spell to it and giving it charges.

## Creating a Charged Magic Item

1. Create (or open) an **Equipment** item — for example, "Wand of Magic Missiles".
2. Drag a **Spell** from the Items Directory, a compendium, or another sheet onto the equipment item's sheet. The spell appears in the **Charged Magic Item** section. The attached spell is a snapshot — later changes to the original spell do not affect the item.
3. Set the **Charges** (remaining / maximum). Set the maximum to 0 if the item should not track charges (an at-will item).
4. Optionally set a **Spell Check Override** (e.g. `+5`). When set, the item always casts at this flat bonus. When left empty, the attached spell's own configuration applies — a spell with *Inherit Spell Check* enabled casts with the wielder's spell check.

To replace the attached spell, drop a different spell onto the sheet. To remove it, click the **×** next to the spell's name.

## Casting from the Item

Add the item to a character's inventory. On the **Equipment** tab, items with an attached spell show a wand button — click it to cast. The tooltip shows the remaining charges.

- A charge is spent on every cast, whether or not the spell check succeeds.
- Casting is blocked when the item is out of charges.
- Cancelling the roll dialog does not spend a charge.
- Magic item casts never trigger wizard spell loss or cleric disapproval — the charge is the cost.

The spell check results table, manifestations, and critical/fumble handling all work just like casting the spell normally.
