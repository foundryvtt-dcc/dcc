# Roll Requests

As Judge you can ask a specific character for an ability check or skill check — with an optional DC — without touching their sheet. This is the DCC take on the old "Let Me Roll That for You" module.

## Requesting a roll

1. Open the **DCC tab** in the right-hand sidebar (the DCC logo) and click **Request Roll**. If you have a PC token selected on the scene, that character is preselected.
2. Pick the **Character** you want to roll.
3. Pick the **Check** — the six ability checks come first, followed by the character's class skills (e.g. Thief skills) and any custom skills from their Skills tab.
4. Optionally enter a **DC**.
5. Click **Request Roll**.

A card is posted to chat naming the character and showing a roll link, e.g. *"Judge asks Torvald to roll: DC 10 Agility Check"*.

## Making the roll

The player who owns that character clicks the link on the chat card and the check rolls exactly as if they had clicked it on their sheet — the roll modifier dialog (Ctrl/Cmd-click), action dice, and all other roll behavior apply. If a DC was set, the result card shows the DC and whether the roll **succeeded or failed**.

Only owners of the requested character can trigger the roll (the GM also can, since GMs own every actor). Anyone else clicking the link gets a permission warning.

## Notes

* A Luck check requested *without* a DC keeps its normal roll-under behavior. Requesting a Luck check *with* a DC turns it into a roll-high check against that DC.
* Table-driven skills (Divine Aid, Turn Unholy, Lay on Hands) resolve on their result table, so any DC entered for them is ignored.
* Roll request cards are built on the same syntax as [Journal Roll Links](Journal-Roll-Links.md) — the card body is a `[[/check ...]]` or `[[/skill ...]]` link targeted at the character via `actor=<uuid>`, which you can also write by hand in journals.
