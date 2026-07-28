# Death Clock

## Overview

The Death Clock implements the DCC death and dying rules for player characters. Enable it through **System Settings → Enhanced Combat → Enable death clock for PCs** (off by default).

Per the rules, a 1st-level or higher character reduced to 0 hit points collapses and begins **bleeding out**: they can be healed on the round they dropped or within their level in rounds afterward. Level 0 characters die immediately at 0 hit points.

## The clock

When a player character drops to 0 HP they gain the **Dying** condition carrying the countdown, and the drop is announced in chat. In combat, the tracker shows the rounds remaining next to their name at the end of the action-dice pips, and each round advance burns one round — when the countdown reaches 0, that round is the character's **final chance** (announced in chat); one more round and they die.

Death is applied exactly as if the judge had clicked the combat tracker's skull button: the dead status overlay on the token, and the combatant marked defeated.

## Saving a character

**Healing while bleeding out** (raising them above 0 HP before the clock runs out) saves the character — at the price the rules demand: a **permanent loss of 1 Stamina** (recorded in the ability score log when that feature is enabled, including any knock-on max-HP change) and a **terrible scar**, announced in chat.

**Healing a dead character** above 0 HP revives them with no penalty — this is the judge's manual override.

## Recovering the body

Every death announcement carries a judge-only **Roll the Body** button, implementing the "recovering the body" rule. If an ally reaches the body within an hour (the judge's call), click it to make the dead character's roll-under Luck check — posted as a normal Luck check card:

- **Success** — they were merely knocked out: they wake with 1 hit point, gain the **Groggy** condition for the next hour (−4 to all rolls), and the success card prompts the judge to **Roll Ability Loss (1d3)**: a permanent −1 to Strength, Agility, or Stamina (1–3 on the die), announced with the chart and applied automatically.
- **Failure** — the character is truly dead.

## The Death Clock tracker

Open the **Death Clock** tool from the [DCC Tools sidebar tab](System-Settings.md) (it appears there while the setting is enabled). It lists every character currently bleeding out, with their portrait and rounds remaining — players can look, the controls are judge-only:

- **Advance Round** — the manual out-of-combat tick: every bleeding-out character loses one round, with the usual final-chance warning and death resolution. Use it when the party is out of initiative but the clock should still run.
- **+ / −** — adjust an individual clock by a round.
- **Stabilize** (medkit) — stop a clock with no penalty, for when the judge rules the character is out of danger without formal healing.
- **Mark as dead** (skull) — resolve the clock as death immediately, with the Roll the Body prompt.

The tracker updates live as characters drop, are healed, or die. The Dying and Groggy conditions can also be applied or removed manually from the token's right-click status menu.
