# Party Sheet

You can create an Actor of type "Party" to represent your party. This actor allows you to drag and drop other actors onto the Party Sheet, so you can move and manage them as one.

Useful for overland maps, or for funnels. A party could represent all the PCs controlled by a player in a funnel.

## Creating a Party Actor
![Party Actor Create](images/party_sheet_create_party.png)

## Adding Actors to the Party
You drag actors from the Actors tab onto the Party Sheet.
![Party Sheet](images/party_sheet.png)

## Changing the Party Portrait
The party's own portrait appears next to its name at the top of the party sheet. Click it to choose a new image. This is separate from the party token's image, which you change with Configure Prototype Token in the sheet header.

## Editing Actors in the Party
You can click the avatar image of an actor on the party sheet to open their character sheet. Alternatively, there is a button that is a person with a gear in the lower right of each actor. Click that to open the regular actor sheet for that actor.
![Party Actor Edit](images/party_sheet_edit_member.png)

## Removing Actors from the Party
There is a button that is a person with an X in the lower right of each actor on the party sheet. Click that to remove the actor from the party.
![Party Actor Remove](images/party_sheet_remove_member.png)

## Giving Items to Party Members
Drag an item onto a member's row on the party sheet to add it to that character's inventory.

- From another character's sheet, or from a member's weapon icon on the party sheet, the item is **moved**: it is added to the target member and removed from the character it came from.
- From the Items sidebar or a compendium, the item is **copied**; the original stays where it was.

The Party actor has no inventory of its own. Dropping an item on an empty part of the party sheet, away from the member rows, shows a notice and leaves the item where it was. Drop it on a member row or on a character sheet instead.

## Rolling Party Initiative
The Initiative button (d20 icon) at the top of the party sheet rolls initiative for the party and adds the party token to the combat tracker. The roll uses the initiative formula of the party's best member — the one with the highest initiative bonus (ties broken by Agility) — including any initiative die changes from that member's equipped weapon (for example a two-handed weapon's d16).

The party token must be placed in the current scene before rolling; the party sheet will warn you if it isn't.

## Notes and Active Effects
The party sheet has a **Notes** tab for free-form text about the party. It has no Effects tab: a Party actor has no statistics of its own, and effects on it would never apply to its members. Dropping an Active Effect onto the party sheet shows a notice and does nothing; drop it on the member's own sheet instead. See [Active Effects](Active-Effects.md).

## Using the Party Actor on the map
You can drag the Party Actor onto the map, and it will create a token for the party. You can then move the token around the map to represent the position of the party.

By default only the GM can move that token: a new Party actor grants players no permission. Give a player **Owner** permission on the Party actor (Actor Configuration → Permissions) if they should move the party token during travel — Owner also makes the token count as a vision source for that player under **Vision From All Owned Tokens**.

You can then double-click this to see the party sheet. You can use the gear on the token on the map to set it's icon.

## Using individual tokens on the map
You can still drag individual actors onto the map, and they will create their own tokens. You can then move them around the map individually.

When a player runs several characters this way, the **Vision From All Owned Tokens** setting (on by default) keeps all of their characters visible and selectable even while one token is selected — see [System Settings](System-Settings.md).

You can use the topmost box when you right-click a token to edit their hp - you can type expressions like '-2' or '+2' to make incremental changes to their HP.

![Individual Token ](images/token_edit_hp.png)

## Gathering and Deploying Party Tokens

The party sheet header has a **Gather / Deploy** button (only a GM sees it). What it does is decided when you click, based on the party's saved state: with no gathered members it collects the party's member tokens from the current scene and replaces them with a single party token, so you can move the whole group at once; with members already gathered, it puts them back down. The button label and icon never change — only the action does.

- When you have member tokens selected, gathering takes exactly those. If you have nothing selected, it takes every party member token on the current scene.
- A party token that Foundry left selected after you dropped it onto the scene does not count as a selection: gathering still takes every member token on the scene.
- Foreign tokens in the selection are left untouched.
- Member tokens without **Link Actor Data** are skipped: the party token can only stand in for linked members, so an unlinked member token stays where it is.
- The next click then deploys: it places the members back around the party token. Each member gets a fresh token id, but its vision, light, size, elevation, flags and actor link are preserved.
- Gathering and deploying need at least a linked party token (or linked members) to work with; both follow the party's normal visibility and ownership.

### Travelling between scenes

You can gather the party on one scene and deploy it on another: gather on the first scene, move the party to the target scene, place a **linked** party token of this party there, and press Deploy. The system only removes the party token and never touches other scenes.

### Things to know

- **GM only.** Players never see the button and cannot start a swap.
- **Movement and vision follow the party actor's permissions.** The party token is GM-only out of the box; give a player **Owner** on the Party actor if they should move it (and see through it) while the party travels.
- **Deploy needs a linked party token on the scene you are viewing.** If the party has an older token created before actor data linking — an *unlinked* token — enable **Link Actor Data** in that token's configuration first. The system reports the situation and stops; it will not rewrite or duplicate the token for you.
- **One gather at a time.** Gather again only after deploying; the action follows the saved state.
- **Combat is protected.** Member tokens in a running combat are skipped, and you cannot deploy while the party token is in a running combat.
- **Levels must match.** Gathering uses the scene level you are currently viewing. If the remaining member tokens or the party token sit on a different level, the action stops without changing anything. Deploying always uses the party token's current level.
- **A failed swap may need a manual look.** If an operation fails partway, the system restores what it can and warns you. Inspect the tokens and the saved snapshots manually before trying again — reloading the page does not repair the state.

## The party token's health bar

The party token shows a read-only health bar that sums the current hit points of the party's members. It updates live as members take damage or heal, and as you add or remove members. It is display only: editing the bar never distributes damage or healing to the members.
