# Armor Check Penalty: Investigation (#951)

Status: **investigation only, no code changes yet.** Decisions are needed on
the open questions at the end before a fix branch is cut.

## The report

[#951](https://github.com/foundryvtt-dcc/dcc/issues/951), "Compute Check
Penalty creates random numbers":

> If this flag is turned on, a random number is generated for the check
> penalty. If it is turned off, and a value is present in the Check Penalty
> field, no number is returned. This applies to both Strength and Agility
> checks. Regardless of the setup, no value is returned for a Reflex save.

The report contains three separate claims. Each is traced below against
`main` at `1587905` (v0.70.55). None of them was reproduced in a live world.
This is a code reading.

## How the check penalty works today

| Piece | Where | What it does |
|---|---|---|
| Actor config flag `computeCheckPenalty` | `templates/dialog-actor-config.html:93-97`, label `DCC.ComputeCheckPenaltyConfig` | Per-actor checkbox. Hint text: *"Compute Check Penalty based on equipped armor and apply it to checks"* (`lang/en.json:200`). |
| Computing the value | `module/actor.js:79-103` | Sums `checkPenalty` over equipped armor. Writes it to `system.attributes.ac.checkPenalty` **only when the flag is on**. When the flag is off, the field keeps whatever the user typed. NPCs have the flag forced off (`actor.js:67`). |
| Str/Agl ability check, no dialog | `module/actor/rolls-check-mixin.mjs:137`, `_buildCheckPenaltyAltRoll` at `:177-187` | The penalty is **not applied**. If the flag is on and the penalty is non-zero, it builds a second bare `Roll` of `mainTotal + penalty`. |
| Str/Agl ability check, modifier dialog | `rolls-check-mixin.mjs:240-246`, `:303-309` | Adds a `CheckPenalty` term, off by default, **only when the flag is on**. If the user leaves it off, the same alternative total is shown. |
| Chat rendering | `module/chat.js:197-201` | Renders the second roll via `toAnchor()` inside `DCC.AbilityCheckPenaltyNote`: *"If check penalty applies, total is {total}."* (`lang/en.json:629`) |
| Skill checks | `module/actor/rolls-skill-mixin.mjs:746-760`, `:884-893` | Applies the penalty for Sneak Silently / Climb Sheer Surfaces or any skill with `config.applyCheckPenalty`. **Does not check the flag.** It reads the field directly. |
| Spell checks | `module/actor/rolls-spell-mixin.mjs:334-339` | Uses the field when the spell item has `inheritCheckPenalty`. **Does not check the flag.** |
| Saving throws | `rollSavingThrow`, `rolls-check-mixin.mjs:726` | Never references the check penalty. |

History: the "show, don't apply" behavior for ability checks came from #585
(`54017e7`, Oct 2025): *"Update check penalty to not apply automatically and
show a message in chat instead."* That commit also introduced the
`computeCheckPenalty` gate on the note. The dcc-core-lib adapter refactor
(#720, `0b89f23`) carried it over as-is.

## Claim 1: "flag on → a random number is generated"

**Probably not random; most likely the display.**

With the flag on and armor that has a penalty, a Str/Agl check posts the note
"If check penalty applies, total is **X**", where X = this roll's total +
penalty. X therefore changes on every roll, and it is rendered with
`Roll#toAnchor()`, so it looks like an inline roll result, with the dice icon
and a clickable tooltip. A user expecting to see "−2" sees a varying,
roll-looking number instead.

This is working as designed since #585, but the presentation doesn't explain
itself: it never names the penalty, and it uses roll styling for a number
that wasn't rolled.

**Suggested fix:** render plain text that names the penalty, for example
*"With check penalty (−2): 11"*. Either drop the `toAnchor()` wrapper and the
bare `Roll`, or keep the roll and add the penalty value to the i18n string.
Translate the changed key into all language files.

**Caveat:** if the reporter means something else, such as the penalty field
itself showing a changing value, that would be a different bug. A quick
question on the issue would confirm it.

## Claim 2: "flag off + a value in the field → nothing"

**Real inconsistency.**

Both ability-check paths gate on `computeCheckPenalty`
(`rolls-check-mixin.mjs:180`, `:240`). With the flag off, a manually entered
penalty is ignored entirely on ability checks: no note, and no dialog term.

Skills and spell checks read the same field without consulting the flag. So
one actor can have a manually entered penalty apply to Sneak Silently but not
to a Strength check.

The underlying ambiguity is what the flag means:

- In `actor.js:101` it means **"compute the value from armor"**. Off means you
  enter it by hand.
- The hint text and the ability-check gates treat it as **"compute it *and*
  use it on checks"**.

**Recommendation:** make the flag mean "compute from armor" only. Ability
checks should use `ac.checkPenalty` whenever it is non-zero, whether it was
computed or entered by hand. That matches skills and spells. Concretely:

- Drop the `computeCheckPenalty` condition from `_buildCheckPenaltyAltRoll`
  (`:180`) and from the dialog term (`:240`).
- Reword `DCC.ComputeCheckPenaltyConfigHint` in every language. For example:
  *"Calculate Check Penalty from equipped armor. When off, the value entered
  on the sheet is used."*

**Side effect:** NPCs (flag forced off) with a non-zero manual penalty would
start showing the note on Str/Agl checks. That seems correct, but it's worth
knowing.

## Claim 3: "no value is returned for a Reflex save"

**Never implemented.** `rollSavingThrow` has never applied or displayed the
check penalty, before or after the lib refactor. If anything should happen
here, it's a new feature, not a regression.

**Open rules question:** does DCC RAW apply the armor check penalty to Reflex
saves? The answer decides whether to implement it, what to put on the save
path (applied, or "show, don't apply" like ability checks), and whether the
dcc-core-lib save definition needs a change. Per CLAUDE.md, check/save logic
belongs in the lib rather than the adapter.

## Open questions for the maintainer

1. **Claim 1:** reword the note to name the penalty and drop the roll styling? Exact wording?
2. **Claim 2:** redefine the flag as "compute from armor" only, so manual values apply to ability checks?
3. **Claim 3:** does the check penalty apply to Reflex saves in RAW? If so, applied or shown?
4. Reply on #951 first to confirm the reporter's "random number" is the alternative-total note?

## Test impact (for the eventual fix)

Per CLAUDE.md, the change must update unit and E2E specs together. Places to
check:

- `module/__tests__/` tests covering `_buildCheckPenaltyAltRoll` and the
  ability-check dialog terms. Search for `checkPenaltyRoll`, `CheckPenalty`,
  and `computeCheckPenalty`.
- `module/__integration__/adapter-ability-check.test.js` (sets
  `computeCheckPenalty: true`).
- `browser-tests/e2e/`: search for `AbilityCheckPenaltyNote` / "If check penalty
  applies" and for any chat-card assertions on the note's anchor markup.
- Add coverage for a manual penalty with the flag off (claim 2) and for the new
  note wording (claim 1).
