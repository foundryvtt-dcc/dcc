# Rules Automation Policy

How far the system should go when automating a DCC rule, especially one that
depends on context outside the roll itself: an earlier attack, the round,
the target, what the judge ruled. Read this before picking up a rules-coverage
ticket (#975 and its children).

## The problem

Many rules depend on more than one roll or on table context. A halfling
fighting with two weapons only fumbles if **both** dice roll a natural 1
(#968). Armor check penalty applies to some checks and not others (#984).
Morale triggers on events like the first ally falling (#972).

Automating these means connecting rolls together. That gets brittle during
play: players click the wrong button, reroll, delete cards, attack out of
order, or play without the combat tracker. A wrong automatic outcome is worse
than no automation, because the table has to notice and undo it.

## Three tiers

Every rule sits in one of three tiers. A rule moves up a tier only when the
system actually **knows** the context it needs, not when it can guess.

### 1. Note (the default)

The roll stands as rolled. The chat card adds a conditional note: "If X,
then Y." The judge and players apply it.

- Examples: the armor check penalty note (`checkPenaltyNoteHtml`,
  `dcc.checkPenalty` flag), `DCC.HalflingTwoWeaponFumbleNote`.
- It cannot be wrong, so it is the right tier for anything that depends on
  context the system cannot see.

### 2. Offer (a button)

When a person can confirm the condition at a glance, the card adds a
one-click action, e.g. "Both dice were 1s → Roll fumble".

- Nothing happens until someone clicks, so a misclick costs one click.
- The button text states the condition being confirmed, not just the action.
- Use this tier for anything the system could infer but not prove.

### 3. Decide (automatic)

The system applies the rule itself, but only when the context is certain:

- both values come from the **same roll** (e.g. the lib's
  `rollTwoWeaponAttack` rolls both hands together), or
- the values come from the same combatant's turn in the same round of an
  **active combat** in the combat tracker.

Even then:

- The card says what was decided and why, e.g. "Fumble held: halfling
  two-weapon fighting, needs both dice to be 1s".
- There is a way to override it (a button, or the existing card controls).

## Guardrails for tracking across rolls

- **"Same round" comes only from the combat tracker**: combat id, round,
  and combatant. Never infer it from timestamps, message order, or "the last
  message from this actor".
- **Store pairing state on chat message flags, not on the actor.** Deleting
  a misclicked card should undo it. State is derived from the messages that
  exist, never accumulated on the actor where it can go stale.
- **If anything is ambiguous, fall back to the Note tier silently.** No
  active combat, a deleted partner card, a reroll, a different weapon, a
  different actor: show the note and don't guess.
- **Never trigger something irreversible from an inferred pairing.** Fumble
  table rolls, spell loss, HP changes, Luck spending, and similar consequences
  can be automatic only in the Decide tier with certain context. With
  inferred context, they stay at the Offer tier.
- **Prefer making it one roll over tracking two.** If a rule needs two dice
  that the rules roll together, roll them in one action (through the lib) so
  the context is certain, instead of linking two separate cards afterwards.
- **Anything above the Note tier sits behind a setting.** Defaults are
  decided per setting (#962). With the setting off, the rule falls back to
  the Note tier, not to silence.
- **Logic lives in the lib.** The rule itself (when does a halfling fumble)
  belongs in dcc-core-lib. The tier, flags, and card UI belong in the system.

## Checklist for a rules ticket

1. Which tier can this rule reach with certain context? With inferred context?
2. If it needs context from another roll, can the rolls become one roll?
3. Where does the context come from (same roll, combat tracker, message
   flags)? What happens when it's missing?
4. Is any consequence irreversible? If so, is the context certain?
5. Which setting gates it, and what does the card show with it off?
6. Do the card note, button, and decision text all go through i18n?
