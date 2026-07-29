# Journal Roll Links

You can put clickable ability checks, saving throws, and skill checks in journal entries, item descriptions, and chat messages. Type the link syntax into any rich text editor and it renders as a button-style link. Clicking it rolls for the actors of your selected tokens, or for your assigned character if you have no token selected. All the usual roll behavior applies (modifiers, Ctrl/Cmd-click roll dialog, etc.).

## Syntax

| Link | Result |
|------|--------|
| `[[/check agl 10]]` | DC 10 Agility check |
| `[[/check lck]]` | Luck check (roll-under by default) |
| `[[/save ref 15]]` | DC 15 Reflex save — the chat card shows Success/Failure against the DC |
| `[[/skill sneakSilently dc=12]]` | DC 12 Sneak Silently skill check |
| `[[/save frt 15]]{resist the poison}` | Custom link text |

* **Ability keys**: `str`, `agl`, `sta`, `per`, `int`, `lck` — full English names also work (e.g. `[[/check agility 10]]`).
* **Save keys**: `ref`, `frt` (or `fort`), `wil` — full names also work.
* **Skill keys**: the skill's id on the actor (e.g. `sneakSilently`, `findSecretDoors`) or the exact name of a skill item the actor owns. If the clicking actor doesn't have the skill, they get a warning.
* A bare number is the DC. You can also write options explicitly: `[[/check ability=agl dc=10]]`.
* Luck checks are roll-under by default; use `[[/check lck rollUnder=false]]` for a roll-high Luck check.

## Requesting rolls from players

As GM, each roll link shows an extra chat-bubble icon. Clicking it posts the roll link to chat as a roll request. Each player can then click the link in chat and the roll happens with *their* character — handy for calling for a save from the whole party.

If the syntax is invalid (say, a typo in the ability key), the text is left as-is in the journal so you can spot and fix the mistake.
