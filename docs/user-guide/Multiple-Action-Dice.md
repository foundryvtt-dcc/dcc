# Multiple Action Dice (Tracking)

Higher-level characters (and many monsters) act more than once per round, using
a list of action dice like `1d20,1d16` — see [Action Dice](Action-Dice.md) for
how to enter the list itself. The **multiple action dice** feature adds
optional, per-round *tracking* of those dice: the system spends a die for each
attack, spell, or check you roll during combat, shows which dice are left, and
resets the budget each round.

Everything here is opt-in. With the settings off, nothing about your game
changes.

## Settings

All of these are world settings (**Configure Settings → System Settings**):

| Setting | What it does |
|---------|--------------|
| **Multiple Action Dice** | Master switch. Turns on the per-die chips on actor sheets and everything below. |
| **Track Action Dice in Combat** | Shows spent/ready pips on the combat tracker (and live state on the sheet chips) for actors in the active combat. |
| **Auto-Reset Action Dice** | Resets each combatant's dice to ready at the start of their turn in a new round. |
| **Hide Single Action Die Pips** | Declutter: no pips for actors with only one action die. |

## How a round plays out

1. **You roll** an attack, spell check, skill check, or ability check while
   your actor is in the active combat.
2. The system **spends your next ready action die** automatically and the chat
   card shows an **"Action N of M · die"** line, so everyone can see which
   action this was and which die it used.
3. The **combat tracker pips** (● ready, ○ spent, ⊛ spells-only) and the
   **sheet chips** update live.
4. At the top of the next round your dice **reset to ready** (with auto-reset
   on; otherwise toggle them by hand).

Rolls made outside of combat are never tracked — there is no round to reset
them, so the dice always roll exactly as before.

## The sheet chips

With the master setting on, an actor with two or more action dice shows a chip
per die in **Combat Basics** on the front page of the sheet (replacing the
single action-die box; the dice themselves are edited in the `</>` Config
menu).

- **Out of combat** the chips are a simple listing of your dice — hover for
  each die's number and use-restriction.
- **During combat** (with tracking on) each chip gains a ● / ○ glyph matching
  the combat-tracker pips, and the GM or the actor's owner can **click a chip
  to toggle it** between spent and ready — for off-turn reactions, judge
  overrides, or fixing a mis-spend.

## Choosing which die a roll uses

Normally the system just uses your next ready die. To pick a different one,
**Ctrl/Cmd-click** the attack to open the roll dialog: during combat the
action-die presets there list each of your dice with its slot number and
ready/spent state. Pick one and the spend follows the die you actually rolled —
for example, save your `1d20` for a spell and swing with the `1d16` first.

If you roll a die that doesn't match any ready die (the untrained `1d10`, or a
hand-edited formula), the system falls back to spending the next ready die.

## Two-weapon fighting

A primary + off-hand pair is **one action** (see
[Two-Weapon Fighting](Two-Weapon-Fighting.md)): the first swing spends one die
and the matching off-hand attack in the same round is free, with the chat line
reading "two-weapon, same action". A third attack starts a new action on your
next die — at the correctly penalized die size for fighting with two weapons.

## Restricted dice

Some dice can only be used for certain things (a wizard's spells-only die,
marked ⊛). The roll dialog won't offer an ineligible die, and if the only dice
you have left are restricted the system warns you — but never blocks the roll;
the judge is always in charge.
