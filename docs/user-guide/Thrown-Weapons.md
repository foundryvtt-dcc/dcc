# Thrown Weapons

Some melee weapons — daggers, handaxes — can also be thrown. Instead of creating a second weapon item (which would make your inventory look like you own two), mark the weapon as throwable and the sheet generates a **thrown attack row** for it automatically.

## Setting Up a Thrown Weapon

1. Edit the weapon (click the pencil icon on the Equipment tab)
2. In the **Attack Distance** section, make sure **Melee** is checked
3. Check **Can Be Thrown**
4. Enter the weapon's range bands in **Range** (e.g., `10/20/30`)

## The Shadow Row

Once **Can Be Thrown** is set, a second row appears directly under the weapon in the Melee Weapons list, named "*Weapon* (thrown)". It shows the thrown to-hit (your missile attack bonus), thrown damage, and range — and has its own attack button.

- Click the **weapon's own row** to attack in melee, exactly as before.
- Click the **shadow row** to throw it: the roll uses your missile attack bonus, and range penalties apply automatically when you have a token targeted.

The shadow row is not a separate item: it can't be edited or deleted, doesn't add weight, and always stays in sync with the weapon — rename or delete the dagger and the row follows.

## Quantity

Weapon rows also show a quantity control, so a bandolier of six throwing daggers can be one item with quantity 6. Weight is multiplied by quantity for encumbrance.
