# Roll Requests

As Judge you can ask one character, several characters, or the whole party for an ability check, saving throw, or skill check — with an optional DC — without touching their sheets. This is the DCC take on the old "Let Me Roll That for You" module.

## Requesting a roll

1. Open the **DCC tab** in the right-hand sidebar (the DCC logo) and click **Request Roll**. If you have PC tokens selected on the scene, those characters are preselected.
2. Tick the **Characters** you want to roll — one, several, or **All Players** to ask everyone at once. Selecting PC tokens on the scene before you open the dialog ticks all of them for you; with no tokens selected the dialog opens with nothing ticked and **Request Roll** stays disabled until you pick someone.
3. Pick the **Check** — the six ability checks come first, then the three saving throws (Reflex, Fortitude, Will), then the selected characters' class skills (e.g. Thief skills) and any custom skills from their Skills tabs.
4. Optionally enter a **DC**.
5. Click **Request Roll**.

A card is posted to chat naming the character and showing a roll link, e.g. *"Judge asks Torvald to roll: DC 10 Agility Check"*. Ask more than one character and you get a single card listing every character with their own roll link.

## Making the roll

The player who owns a character clicks that character's link on the chat card and the check rolls exactly as if they had clicked it on their sheet — the roll modifier dialog (Ctrl/Cmd-click), action dice, and all other roll behavior apply. If a DC was set, the result card shows the DC and whether the roll **succeeded or failed**.

Each player only gets a clickable link for **their own** characters. On a card asking several characters, the rows for everyone else's characters are shown as plain grey text, so there is no hunting for the right link and nothing to click by mistake. A player who owns more than one of the requested characters gets a live link for each of them, and you (the Judge) keep every row clickable so you can still roll on a player's behalf.

## Requesting rolls from a Scene Region (traps, hazards, thresholds)

A Region with an **Execute Script** behavior can ask for a roll the moment a token walks into it. Add the behavior to your Region, tick the **Token Moves In** event, and paste one of the recipes below.

### Read this first: region scripts run on *every* connected client

Foundry broadcasts region events to all clients, and the Execute Script behavior does **not** filter them — your script body runs once per connected player. Without a guard you get one roll (or one card) per person at the table. Core's own behaviors guard for exactly this reason, and your script must too.

Pick the guard by who should act:

* `if (!game.users.activeGM?.isSelf) return` — run once, on the Judge's client. Use this for anything that posts *as the Judge*, including roll requests.
* `if (!event.user.isSelf) return` — run on the client of whoever moved the token.

### Ask the player to roll (posts a request card)

The character's owner gets a clickable link and rolls it themselves, exactly as if you had used the Request Roll dialog:

```js
if (!game.users.activeGM?.isSelf) return           // one card, not one per player
const actor = event.data?.token?.actor
if (actor?.type !== 'Player') return               // ignore NPCs wandering through
await game.dcc.postRollRequest({ actor, checkValue: 'save:ref', dc: 15 })
```

`checkValue` takes the same namespaced values the dialog uses — `save:ref` / `save:frt` / `save:wil`, `check:agl` (any ability), or `skill:sneakSilently` / `skill:Nature Lore`. A skill the character does not have is skipped rather than posted.

To ask the whole party at once — say a collapsing ceiling — collect the actors and pass them together, and they arrive as a single card with one link each:

```js
if (!game.users.activeGM?.isSelf) return
const actors = [...region.tokens].map(t => t.actor).filter(a => a?.type === 'Player')
if (actors.length) await game.dcc.postRollRequest({ actors, checkValue: 'save:ref', dc: 15 })
```

### Roll it immediately (no player interaction)

For a hazard that just happens to you, roll on the character's behalf instead:

```js
if (!event.user.isSelf) return                     // one roll, not one per player
const actor = event.data?.token?.actor
if (!actor) return
await actor.rollSavingThrow('ref', { dc: 12, showDc: true })
```

The trade-off is player agency: this rolls without asking, so the player never gets to spend Luck or use a modifier dialog. Prefer the request card unless the roll is meant to be involuntary.

## Notes

* Only characters a player owns are listed — a roll request is a question put to a player, so retired PCs and Judge-authored Player actors with no owner are left out. Assign a player as **Owner** on a character's ownership tab to make it requestable.
* Abilities and saves are the same for everyone, so they are always offered. Skills are pooled across the characters you tick, so you can request a skill only some of them have — the card only lists the characters who actually have it, and you are told who was left out.
* A Luck check requested *without* a DC keeps its normal roll-under behavior. Requesting a Luck check *with* a DC turns it into a roll-high check against that DC.
* Table-driven skills (Divine Aid, Turn Unholy, Lay on Hands) resolve on their result table, so any DC entered for them is ignored.
* Roll request cards are built on the same syntax as [Journal Roll Links](Journal-Roll-Links.md) — the card body is a `[[/check ...]]` or `[[/skill ...]]` link targeted at the character via `actor=<uuid>`, which you can also write by hand in journals.
