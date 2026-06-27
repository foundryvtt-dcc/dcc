# Surfacing Multiple Action Dice — Design Exploration

> Status: **lib layer landed; system Phase 0 + Phase 1 (data + sheet chips)
> landed.** Branch `claude/multiple-action-dice-design-5vsxr8`.
> Author: design pass for cyface, 2026-06-25. Master-setting + consumer-impact
> pass added 2026-06-26. Lib primitives built/merged/vendored 2026-06-26.
> Phase 0 (master setting) + Phase 1 (derived `actionDice.list` + PC/NPC chip
> row) implemented 2026-06-26. **Next: Phase 2 — combat-tracker pips.**

## 0. Implementation status & handoff (read this first)

**What is DONE (lib layer):** The rules-correct primitives now live in
`@moonloch/dcc-core-lib` and are **already vendored into this repo** at
`module/vendor/dcc-core-lib/` (v0.12.0, commit `4a20286`, from
`moonloch/dcc-core-lib` PR #10, merged). They are purely additive — no existing
lib export changed — so nothing in the system behaves differently until the
system *calls* them. **Do not re-design these; import them.** Exported surface
(see `module/vendor/dcc-core-lib/combat/action-dice.js` + `types/combat.d.ts`):

| Export | Role |
|---|---|
| `parseActionDice(input, { className })` | `"1d20+4, 1d16*spell"` / `"2d20"` / array → `ActionDieSlot[]` (expands `Nd`, `+N`=rider, `+dice`=separator, `*tag`=use) |
| `classExtraActionDieUse(className)` | `"spell"` for **wizard only**, else `"any"` (elf/cleric are casters but unrestricted — verified vs core-book) |
| `nextActionDie(slots, state, action)` | next unspent eligible slot, or `null` (preset default + auto-spend) |
| `spendActionDie(state, index)` / `resetActionDice(slots, round)` / `isActionDiceStateCurrent(state, round)` | pure per-round budget state transitions |
| `actionDieRollTerms(slot)` | D2 reconciliation → `{ die, modifier, suppressAttackBonus }` |
| `actionMatchesUse(use, action)` | eligibility test |

Types: `ActionDieUse`, `ActionType`, `ActionDieSlot`, `ActionDiceState`,
`ActionDieRollTerms`.

**What is DONE (system layer — Phase 0 + Phase 1):**

- **Phase 0 — master setting.** `multipleActionDice` (world, default OFF,
  `requiresReload`) registered in `module/settings.js` with i18n in all seven
  lang files. `DCCActor.multipleActionDiceEnabled()` reads it defensively
  (absent/unregistered ⇒ off).
- **Phase 1 (data).** `DCCActor.prepareDerivedData` derives
  `system.attributes.actionDice.list` via the pure static
  `DCCActor.deriveActionDiceList({ enabled, authoring, className })` — returns
  `null` (no list written) when the setting is off, so the off-path is the
  untouched incumbent. Authoring string is read from `config.actionDice`
  (falls back to `attributes.actionDice.value`); `className` is `this.classId`
  so the wizard spells-only inference falls out for free. Covered by
  `module/__tests__/actor.test.js` (off ⇒ null; warrior/wizard/rider cases).
- **Phase 1 (sheet chips).** `prepareActionDiceContext(actor)` in
  `module/actor-sheet/presentation.mjs` exposes `showActionDiceChips`
  (= setting on **and** 2+ dice) + display-ready `actionDiceChips` (label via
  the new `actionDieLabel` Handlebars helper, localized tooltip, `restricted`
  flag). PC (`actor-partial-pc-common.html`) and NPC
  (`actor-partial-npc-common.html`) templates swap the single text box for the
  chip row only when `showActionDiceChips`; otherwise the existing input
  renders verbatim. Styling in `styles/_actor-sheet.scss` (`.action-dice-chips`
  / `.action-die-chip`). Covered by `actor-sheet-presentation.test.js` and
  `handlebars-helpers.test.js`.

Net: with the setting **off** (default) the sheets and derivation are
byte-identical to before; the chip row only appears once a table opts in and the
actor has multiple dice. No combat-tracker pips, no auto-spend, no roll-dialog
or chat changes yet.

**What is NOT started (system layer):** Phase 2 (combat-tracker pips +
auto-reset), Phase 3 (auto-spend + smart preset default + chat "Action N of M"),
Phase 4 (soft spells-only filtering). See §9.

**Where the truth lives today (so you don't re-derive it):** `config.actionDice`
is the authoring comma string and stays the single source of truth.
`actor-level-change.js` collapses it to the first die in
`attributes.actionDice.value`; `item.js` derives `item.system.actionDie` from
that single value. The whole roll path consumes one die today — the feature's job
is to stop discarding the rest (§11.1), gated behind the master setting (§8).

**First steps for a fresh session (Phase 2):** the derived
`system.attributes.actionDice.list` is already available on prepared actors when
the setting is on — Phase 2 consumes it to build per-combatant tracker pips. Wire
`combatTurn`/`combatRound` hooks to `resetActionDice`, persist
`combatant.flags.dcc.actionDice` round-state (§5), and render pips in the tracker
template. Keep every new branch behind `DCCActor.multipleActionDiceEnabled()`.

## TL;DR — recommendation

Treat the action die not as a string the player reads off their sheet, but as a
**per-round budget that the system tracks and spends for you**. Build it in three
layers, each shippable on its own.

**The whole feature lives behind a single master setting (`multipleActionDice`,
default OFF).** This is the load-bearing constraint, not a nicety: the only way to
get real playtesting is to let people opt in inside their own live games. With the
setting **off**, every code path, sheet, tracker, roll, and chat card behaves
**exactly as it does today** — no derived data is consumed, no UI changes, no
behavioral drift. With it **on**, the new approach activates. See **§8** for the
setting design and **§11** for why this also means **no content changes to
dcc-core-book, dcc-crawl-classes, or sibling modules** — we *derive and relocate*,
we don't re-author.

Build it in three layers, each shippable on its own and each gated behind the
master setting so tables that don't want it never see it:

1. **Data**: promote action dice from a flat `"1d20,1d16"` string to a small
   structured list (`die`, `modifier`, `use` tag) while keeping the string as the
   authoring shortcut. *(Foundation — invisible to users.)*
2. **Sheet**: replace the single tiny text box with an **action-dice chip row**
   that shows every die the actor has, right where attacks already live.
3. **Combat tracker**: show **action-die pips** per combatant that **auto-reset
   at the start of that combatant's turn** (Foundry already fires the turn/round
   hooks) and get **spent automatically** when an attack/spell/check is rolled.
   This is the headline feature — it lives where the judge already looks, so it's
   the thing that stops judges forgetting the troll gets two swings.

The wizard "second die is spells-only" caveat falls out of the `use` tag for free:
a spell-only die simply isn't offered as a preset for a weapon attack, and is
consumed when a spell check is rolled.

---

## 1. The mechanic and its caveats (rules grounding)

In DCC, a character's **action die** is normally `1d20`. Higher-level characters —
and many NPCs/monsters — get **more than one action die**, letting them take more
than one action in a round. A round is one trip through the initiative order; each
action die buys one action (attack, cast a spell, skill check, etc.).

Important wrinkles the system has to respect:

- **Dice differ in size.** Extra dice are often smaller: a high-level warrior might
  have `1d20, 1d16`. At the very top end you see things like `1d20+4, 1d20, 1d16`
  (three dice; the `+4` is the attack bonus riding on the first die, not a fourth
  die).
- **Class restrictions (verified against the core-book class text, 2026-06-26).**
  The **wizard is the *only* core class that restricts an extra action die**: "A
  wizard's first action die can be used for attacks or spell checks, but his second
  action die can only be used for spell checks." **Every other class is
  unrestricted**, including the casters:
  - **Elf** — explicitly *not* spell-only: "he can make two attacks, the first with
    a d20 attack roll and the second with a d14; or he may combine an attack with a
    spell check." (The natural trap is to lump the elf in with the wizard — RAW
    differs precisely here.)
  - **Cleric** — "can use his action dice for attack rolls or spell checks" (no
    first-vs-second distinction).
  - **Warrior / Dwarf** — "always use their action dice for attacks"; the extra die
    is a literal second *attack*.
  - **Thief** — "any normal activity, including attacks and skill checks."
  - **Halfling** — "attacks or skill checks."

  So only the wizard needs a `use: "spell"` tag on its extra die; for everyone else
  the extra die is `any`. A die still needs to know *what it may be spent on*, but
  the inference rule is narrow: **wizard ⇒ slots ≥ 1 are spell-only; all other
  classes ⇒ all slots `any`.**
- **The deed die is NOT an action die.** A warrior's Mighty Deed die (`d3`/`d4`…)
  rides on a single attack as a bonus; it does not grant an extra action. The
  design must keep these visually and structurally distinct so we don't imply a
  warrior with a deed die gets two attacks.
- **NPCs.** Stat blocks read e.g. `Act 2d20` or `Act 1d24+1d20`. The NPC parser
  already captures this into `config.actionDice`, but the NPC sheet only ever
  shows *one* die — so the second one is invisible at the table.

---

## 2. Where we are today (and why it falls short)

| Concern | Current state | Problem |
|---|---|---|
| Storage | `system.config.actionDice` = comma string `"1d20,1d16"` | Fine as authoring, but carries no per-die metadata (restriction, modifier) |
| PC sheet | One text box, `attributes.actionDice.value` | Only shows ONE die; the rest hide in the Config dialog |
| NPC sheet | One text box | Judge sees `1d20`, forgets the `Act 2d20` |
| Rolling | All dice offered as presets in the roll-modifier dialog | Nothing marks which die you already spent this round |
| Per-round tracking | **None** | Players and judges track "used my 2nd action yet?" in their heads |
| Wizard spells-only | **Not coded** | A `1d20,1d16` wizard can illegally make two attacks |
| Chat output | Roll HTML shows the die that was rolled | Doesn't say "action 2 of 2" or which slot was spent |

The raw capability (multiple dice, selectable as presets) exists. What's missing is
**surfacing** and **bookkeeping** — the system never says "you have a second action
waiting" or "you've used it."

---

## 3. Design principles

1. **Track, don't nag.** The system spends dice automatically as actions are rolled;
   it should rarely ask the user to do bookkeeping by hand.
2. **Surface at the point of use.** The reminder belongs in the combat tracker
   (judge) and the attack area (player), not in a config dialog.
3. **Off by default, behind one master switch.** The entire feature is gated by a
   single setting (`multipleActionDice`, default OFF). When off, the system runs
   today's code paths verbatim — not "a stripped-down new path that happens to look
   the same," but the *actual* existing path, so there is zero behavioral risk for
   tables that don't opt in. This is what makes in-the-wild playtesting safe. When
   on, a single character with `1d20` still sees *nothing new* (the per-die UI
   activates only for actors with 2+ dice); the master switch and the
   2+-dice check are independent gates.
4. **Don't break authoring.** `"1d20,1d16"` typed in Config must keep working; the
   structured model is derived from it.
5. **Respect the rules, gently.** Enforce wizard spells-only by *filtering presets*,
   not by hard-blocking — judges can always override (Ctrl-click escape hatch).

---

## 4. Options considered

### Option A — Sheet-only: chip row + smart preset default *(small)*
Replace the single text box with a chip row of all dice; when rolling, default the
action-die preset to the next *unspent* die and grey out spent ones. Tracking lives
on the actor for the current round.

- **Pros:** Cheap, no combat-tracker work, helps players immediately.
- **Cons:** Judges run monsters from the *combat tracker*, not open sheets — so the
  exact audience that forgets multiple dice (NPCs) is least helped. No shared
  reset signal.

### Option B — Combat-tracker pips with auto-reset *(medium, recommended core)*
Each combatant shows action-die pips in the tracker. Foundry's `combatTurn` /
`combatRound` hooks reset a combatant's pips at the start of *their* turn; rolling an
attack/spell/check spends a pip. Clicking a pip toggles it manually for off-turn
reactions and judge overrides.

- **Pros:** Lives exactly where the judge looks. Auto-reset means **zero manual
  bookkeeping**. Works identically for PCs and NPCs. Uses machinery Foundry already
  provides.
- **Cons:** More moving parts (combatant flags, hook wiring, tracker template).
  Only meaningful in combat (fine — that's where the mechanic matters).

### Option C — Full action-economy with enforced restriction tags *(large)*
Everything in B plus strict enforcement: spell-only dice are *unselectable* for
attacks, the system blocks a third action when only two dice exist, reactions and
free actions are modeled, etc.

- **Pros:** Most "correct."
- **Cons:** Heavy; risks bogging down play and fighting judges who want to bend
  rules. Over-engineered for the stated goal ("surface better without bogging down").

### Verdict
Ship **B as the core**, fold in **A's sheet chip row** (they share the same data),
and borrow only the *soft* restriction-filtering from C (filter presets by `use`
tag, never hard-block). This is the layered recommendation in the TL;DR.

---

## 5. Proposed data model

Keep `config.actionDice` as the **authoring string** (back-compat, NPC parser, hand
edits). Derive a structured list from it; persist live round-state on the combatant,
not the actor, so it's scoped to the encounter.

> **Master-switch gating.** The derived `actionDice.list` and all live round-state
> are only built/consumed when `multipleActionDice` is on. When the setting is off
> the system never reads `.list`; the roll path keeps using the single
> `attributes.actionDice.value` (the first die) exactly as today. Building `.list`
> is cheap and side-effect-free, so it may be computed unconditionally in
> `prepareData` and simply ignored when off — but **nothing downstream may branch on
> `.list` unless the setting is on.**

```jsonc
// Derived (computed in prepareData from the config string) — NOT hand-edited
system.actionDice.list = [
  { slot: 0, die: "1d20", modifier: 0,  use: "any"        }, // first die: anything
  { slot: 1, die: "1d16", modifier: 0,  use: "any"        }  // warrior: anything
]
// Wizard example, authored as "1d20,1d16*spell":
//   { slot: 1, die: "1d16", use: "spell" }    // spells only
```

**Authoring grammar (superset of today's comma string):**

```
1d20, 1d16                 → two unrestricted dice
1d20, 1d16*spell           → second die castable for spells only
1d20+4, 1d20, 1d16         → first die carries its own +4 rider (slot modifier; see D2)
Act 1d24+1d20  (NPC)       → parser already handles "+" as a separator
```

- `use` ∈ `any | spell | attack` (extensible: `mightyDeed`, `turnUndead`…).
- The `*tag` suffix is optional; absent ⇒ `any`. Fully backward compatible — every
  existing `"1d20,1d16"` parses to two `any` dice.
- **Spells-only is *inferred*, not authored.** The `*spell` grammar exists as an
  escape hatch, but we do **not** want to rewrite dcc-core-book's wizard
  level-data to add it (that would be a content change — see §11). Instead, the
  derivation tags the *extra* dice (slots ≥ 1) as `use: "spell"` **only when the
  actor is a wizard** — the single class RAW restricts (see §1; the elf and cleric
  are casters but their extra dice are unrestricted). So the existing unchanged
  `"1d20,1d16"` string on a wizard produces the correct spells-only second die for
  free, and on every other class produces two `any` dice. The lib owns this rule as
  a pure `classExtraActionDieUse(className)` helper (returns `"spell"` for `wizard`,
  `"any"` otherwise); the system applies it when building slots. The `*tag` suffix
  is reserved for one-off homebrew overrides.

**Live round-state (per combatant flag, auto-managed):**

```jsonc
combatant.flags.dcc.actionDice = {
  round: 7,                    // round these pips are valid for
  spent: [false, true]         // slot 1 has been used this round
}
```

Reset rule: on `combatTurn`/`combatRound`, if `flags.dcc.actionDice.round` ≠ current
round for the active combatant, set `spent` to all-false. Spend rule: when an
attack/spell/check resolves, mark the first matching unspent slot
(matching `use`) as spent.

---

## 6. Visual mockups

### 6a. Today (for contrast) — PC sheet, Combat Basics row

```
┌ Combat Basics ─────────────────────────────────────────────┐
│ Initiative Die [1d20]   Initiative [+1]                     │
│ Action Die     [1d20]   ← single box; the 1d16 is hidden    │
│ Crit Die       [1d8 ]   Attack Bonus [+1d3]                 │
└────────────────────────────────────────────────────────────┘
```

### 6b. Proposed — PC sheet action-dice chip row (warrior, level 5: 1d20, 1d14)

```
┌ Combat Basics ─────────────────────────────────────────────┐
│ Initiative Die [1d20]   Initiative [+1]                     │
│                                                             │
│ Action Dice   ( 1d20 )( 1d14 ) [+]      ← chips, click=roll │
│ Crit Die       [1d10]   Attack Bonus [+d4]  (Deed die)      │
└────────────────────────────────────────────────────────────┘
        │
        └ Each chip is clickable → rolls an attack/check with THAT die.
          Hover a chip → "Action die 2 — any action".
          The [+] opens the inline editor (no need to dig into Config).
```

Wizard variant (`1d20, 1d16*spell`) — the restriction shows on the chip:

```
│ Action Dice   ( 1d20 )( 1d16 ⊛ )        ← ⊛ = spells only   │
│                          └ tooltip: "Action die 2 — spells only" │
```

### 6c. Combat tracker — the centerpiece (judge's view, mid-encounter)

```
┌ Combat — Round 7 ──────────────────────────────────────────┐
│ ▸ 18  Grimjaw (Warrior 5)        ●●            1d20 1d14    │  ← 2 dice, both ready
│ ▸ 15  Cave Troll          ◀turn  ●○            Act 2d20     │  ← spent 1 of 2 this turn
│ ▸ 12  Zara (Wizard 4)            ●⊛            1d20 1d16⊛   │  ← die2 = spells-only (⊛)
│ ▸  9  Kobold                     ●             1d20         │  ← single die: just one pip
│ ▸  6  Sir Aldric (Warrior 3)     ●●            1d20 1d16    │
└────────────────────────────────────────────────────────────┘

Legend:  ● ready   ○ spent   ⊛ spells-only   ◀turn current combatant
Pips auto-reset at the start of each combatant's turn.
Click a pip to toggle manually (off-turn reactions, judge override).
Single-die actors show one pip (or none, if "hide single-die pips" is on).
```

The judge glances at the row and *sees* the troll still has a swing left this turn.
No memory required.

### 6d. Roll-modifier dialog — next-die default + spent marking

```
┌ Attack: Greataxe ──────────────────────────────────────────┐
│ Action Die:   ( 1d20 ✓used )  ( ▸1d14◂ )   ( 1d10 untrained)│
│                  greyed         default                     │
│ Attack Bonus: [ +3 ]   Deed Die: [ d4 ]                     │
│ Modifiers:    [ +0 ]   ☐ Spell Burn  ☐ Lucky               │
│                                   [ Roll Attack ]           │
└────────────────────────────────────────────────────────────┘

The dialog defaults the preset to the next UNSPENT die (1d14 here),
so a player swinging twice just clicks Roll twice and gets d20 then d14.
```

### 6e. NPC sheet — multiple dice made visible

```
┌ Cave Troll ────────────────────────────────────────────────┐
│ Init [+0]   AC [16]   HP [38]                               │
│ Action Dice  ( 1d20 )( 1d20 )   ← was a single "1d20" box   │
│ Attacks:  Claw +8 (1d6) ×2   Bite +8 (2d6)                  │
└────────────────────────────────────────────────────────────┘
```

### 6f. Chat card — name the action that was spent

```
┌ Grimjaw attacks with Greataxe ─────────────────────────────┐
│ Action 1 of 2 · die 1d20                                   │
│ To Hit: 1d20+3 = (17)+3 = 20   ✓ Hit                       │
│ Damage: 1d10+3 = 11                                        │
└────────────────────────────────────────────────────────────┘
┌ Grimjaw attacks with Greataxe ─────────────────────────────┐
│ Action 2 of 2 · die 1d14   ← system knows it's the 2nd swing│
│ To Hit: 1d14+3 = (9)+3 = 12    ✗ Miss                      │
└────────────────────────────────────────────────────────────┘
```

---

## 7. Step-by-step simulations

### Sim 1 — Player, warrior with two action dice (`1d20, 1d14`)

Grimjaw (Warrior 5) is up in initiative and wants to attack twice.

1. Grimjaw's turn begins → tracker pips reset to `●●`.
2. Player clicks the **Greataxe** attack. Roll dialog opens with the action die
   defaulted to **1d20** (first unspent). Player clicks **Roll Attack**.
3. Chat: *"Action 1 of 2 · die 1d20 — Hit, 11 damage."* Tracker pip → `●○`.
4. Player clicks **Greataxe** again. Dialog now defaults to **1d14** (1d20 shown
   greyed/✓used). Player clicks **Roll Attack**.
5. Chat: *"Action 2 of 2 · die 1d14 — Miss."* Tracker pip → `○○`.
6. Player ends turn. Next round, pips reset on Grimjaw's turn.

> Net player effort vs. today: **the same number of clicks**, but the player never
> has to remember the second die exists or which one to pick — it's the default.

### Sim 2 — Judge, NPC monster with `Act 2d20` (Cave Troll)

The thing judges forget most. The tracker carries it.

1. Troll's turn begins → pips reset to `●●`. The judge *sees* two pips.
2. Judge opens the troll's attacks, clicks **Claw** at PC #1. Resolves; pip → `●○`.
3. The remaining `●` is a standing visual reminder: *the troll still has an action.*
4. Judge clicks **Claw** (or **Bite**) at PC #2. Pip → `○○`.
5. If the judge tries a *third* action, both pips are spent — the dialog still lets
   them roll (soft rule) but the chat card reads *"Action 3 of 2 — over budget,"*
   a gentle flag rather than a block.

> Net judge effort: **zero bookkeeping.** The reminder is passive and visual; the
> judge can't miss the second pip the way they miss a number on a hidden sheet.

### Sim 3 — Wizard with a spells-only second die (`1d20, 1d16*spell`)

Zara (Wizard 4) wants to swing her dagger and then cast.

1. Zara's turn begins → pips `●⊛` (second pip marked spells-only).
2. Player clicks **Dagger** attack. The dialog offers **only 1d20** as a preset —
   the `1d16⊛` die is filtered out because a weapon attack can't use it. Rolls; the
   *any* die (1d20) is spent → `○⊛`.
3. Player casts **Magic Missile**. The spell-check dialog now offers the **1d16⊛**
   die (its `use:spell` matches). Rolls; spent → `○○`.
4. If Zara instead tried to attack *twice*, the second attack would find **no
   unspent attack-capable die** — the dialog warns *"No action die available for a
   weapon attack (your 1d16 is spells-only),"* and defaults to untrained/override.
   The judge can Ctrl-click to force it anyway.

> The spells-only rule is enforced by **what's offered**, not by a hard wall — the
> right thing happens by default, and the override escape hatch is always there.

### Sim 4 — The very-high-level case (`1d20+4, 1d20, 1d16`)

1. Turn begins → pips `●●●`; tracker shows `1d20 1d20 1d16`.
2. First attack defaults to **1d20** and auto-applies the **+4** carried on slot 0.
   Per **D2 (real per-die rider)**, `+4` is stored as `list[0].modifier` and is the
   authoritative per-die adjustment for this action: the roll is `1d20+4`, with the
   generic attack-bonus term suppressed for this slot so the bonus isn't applied
   twice.
3. Second attack defaults to the next **1d20** (no rider). Third to **1d16**.
4. Three pips, three clicks, no mental tracking of which die is next.

---

## 8. Settings (the master switch + sub-options)

The **master switch is the headline**. Everything else is a sub-option that only
has meaning when the master is on.

```
DCC System Settings → Combat
  ☐ Multiple action dice  (MASTER, default: OFF)   ← the opt-in for playtesters
  │     When OFF, every path below is dead and the system behaves exactly as it
  │     does today. When ON, the options below take effect.
  │
  ├─ ☑ Action-dice chips on sheets                 (default: on)
  ├─ ☑ Track action dice in combat tracker          (default: on)
  ├─ ☑ Auto-reset action dice at start of turn       (default: on)
  ├─ ☐ Hide pips for single-action-die actors        (default: on — declutter)
  ├─ ☐ Enforce spells-only dice as hard block         (default: off — soft filter)
  └─ ☐ Show "Action N of M" line in chat cards        (default: on)
```

**Why a master switch and not just the granular settings?** Three reasons:

1. **Safe opt-in for live playtesting.** Players can flip one setting in their own
   game, try it for a session, and flip it back with total confidence that "off"
   means "the build everyone else is running." Per-feature toggles don't give that
   all-or-nothing guarantee, and a half-on state is exactly the kind of thing that
   generates confusing bug reports.
2. **One guard to reason about.** Every gate in the code is `if
   (game.settings.get('dcc', 'multipleActionDice'))`. Reviewers and the E2E suite
   can prove "off ⇒ today's behavior" by checking a single flag, not six.
3. **Clean removal / GA path.** When the feature graduates, we flip the default and
   eventually inline the on-path; until then the off-path is the untouched
   incumbent.

**Implementation note — the off-path must be the *real* incumbent path, not a
parallel reimplementation.** The cheapest correct design keeps today's code exactly
as the `else` branch and adds the new behavior as the `if` branch, rather than
routing both through a new unified code path "that should be equivalent." Equivalent
is a claim; identical is a fact. Each guarded site (prepareData derivation, sheet
template, combat tracker, roll dialog presets, auto-spend, chat card, any lib call)
checks the master setting and falls through to the existing logic when off.

Everything degrades gracefully: with the master off you are byte-for-byte on today's
behavior; with it on but the sub-options off you get the data model and chip row
without the live tracking.

---

## 9. Suggested rollout (each phase independently shippable)

**Phase 0 — the master setting, first. ✅ DONE (2026-06-26).** Registered
`multipleActionDice` (world, default OFF, `requiresReload`) in `module/settings.js`
with i18n in all seven lang files, so every subsequent phase wires its gate into a
switch that already exists. Ships with no behavior change (the flag gates nothing
yet beyond the Phase-1 surface below).

1. **Phase 1 — data + sheet chips. ✅ DONE (2026-06-26).** Added the derived
   `actionDice.list` (via the pure static `DCCActor.deriveActionDiceList`, off ⇒
   `null`) and the chip row on PC and NPC sheets (display-only; the `[+]`/inline
   editor and click-to-roll are deferred to later phases). *Immediately fixes "the
   second die is invisible."* Gated behind the master setting; off ⇒ the existing
   single text box renders unchanged. The `*tag` authoring grammar is owned by the
   lib's `parseActionDice` (already vendored); wizard spells-only is inferred from
   `classId`, so no pack data changed.
2. **Phase 2 — combat-tracker pips + auto-reset.** Combatant flag, `combatTurn`/
   `combatRound` hooks, tracker template, click-to-toggle. *The judge-facing win.*
3. **Phase 3 — auto-spend + smart preset default + chat "Action N of M."** Wire
   roll resolution to spend a pip and default the dialog to the next unspent die.
4. **Phase 4 — soft spells-only filtering.** Filter presets by `use` tag; warn
   (don't block) when no compatible die remains.

**Lib layer — DONE (2026-06-26).** The mechanic-correct, lib-owned bits (which die
a roll *consumes*, restriction semantics, the per-die-rider reconciliation) now
live in `@moonloch/dcc-core-lib` and are vendored here — see §0 for the exported
surface. The tracker UI, sheet chips, and Foundry hook wiring stay in the system
(the phases above).

**Lib changes must be additive and opt-in at the call site.** Any new
`@moonloch/dcc-core-lib` capability (e.g. "given a list of action dice and a chosen
slot, return the roll terms") is *new surface* — the existing entry points the
system already calls keep their current signatures and behavior. When
`multipleActionDice` is off, the system calls the lib exactly as it does today
(single die in, same terms out), so a vendor-synced lib with the new functions
present changes nothing for non-opted-in tables. The new functions are only reached
from the master-on branch. This keeps the lib bump safe to vendor-sync ahead of, or
independently from, flipping the setting on.

---

## 10. Decisions (resolved)

Four choices gated implementation. All four are now **decided** (cyface,
2026-06-27); the chosen option is marked ✅ and the rest of this doc reflects them.

| # | Decision | Options | Decision | Blocks |
|---|----------|---------|----------|--------|
| D1 | **Spells-only enforcement** — what happens when someone aims a spells-only die at a weapon attack | (a) Soft filter: not offered as a preset, chat warns, Ctrl-click override always works · (b) Hard block: refused outright, no override · (c) Setting, default soft | **✅ (a) Soft filter** *(= recommended)* — trusts the judge, keeps the escape hatch | Phase 4 |
| D2 | **`1d20+4` modifier semantics** — what the `+4` on slot 0 is | (a) Display only: the existing attack bonus stays authoritative, list stores pure dice · (b) Real per-die rider: store `+4` as a slot modifier added on top | **✅ (b) Real per-die rider** *(overrides the recommended default)* — each slot can carry its own modifier; see reconciliation note below | Phase 1 |
| D3 | **Two-weapon fighting cost** — pips a TWF attack consumes | (a) One pip: one action that rolls two stepped-down dice · (b) Two pips: each weapon spends a die | **✅ (a) One pip** *(= recommended)* — matches RAW and the existing TWF model | Phase 3 |
| D4 | **Out-of-combat tracking** — budget when there's no encounter | (a) Chips only, no budget (no rounds to reset against) · (b) Track everywhere with a manual reset button | **✅ (a) Chips only** *(= recommended)* — no natural reset signal exists out of combat | Phase 1–2 |
| D5 | **Opt-in model** — how tables get the feature | (a) Always on once shipped · (b) Single master setting, default OFF, off ⇒ today's behavior exactly · (c) Per-feature settings only, no master | **✅ (b) Master setting, default OFF** (cyface, 2026-06-26) — required for safe in-the-wild playtesting; see §8 | Phase 0 (all) |

**D2 reconciliation (real per-die rider).** Because the `+4` is now a genuine slot
modifier rather than a cosmetic echo of the attack bonus, the implementation must
avoid **double-counting**:

- Store it as `actionDice.list[0].modifier = 4`, parsed from the `1d20+4` authoring
  token (and from NPC stat-block strings).
- The slot modifier is the **action die's own** bonus. It is applied to the roll
  *in place of, or reconciled with,* the actor-level attack bonus — not stacked
  blindly on top. Concretely: when a slot carries a modifier, treat that modifier as
  the authoritative per-die adjustment for that action and suppress the generic
  attack-bonus term for that slot, so `1d20+4` rolls `1d20+4` (not `1d20+4+4`).
- Slots without an explicit modifier (`1d20`, `1d16`) fall back to the normal
  attack-bonus / ability-modifier logic exactly as today.
- This needs a focused regression test: a `1d20+4, 1d20, 1d16` actor must roll
  `+4` on the first action and the actor's normal bonus on the second and third.

Carried-over confirmations (no real fork, just things to verify during build):

- **Reactions / off-turn actions.** DCC mostly lacks reactions; click-to-toggle on a
  pip covers the rare out-of-turn ability. Confirm nothing needs more than that.
- **Deed die separation.** Keep the warrior's Mighty Deed die clearly *out* of the
  action-dice chip row so no one reads it as an extra action.
- **Dwarf shield bash is not an action-die slot.** RAW: "A dwarf's shield bash is
  always in addition to his base action dice," and a dwarf with multiple action dice
  "still receive[s] only one shield bash each round." Model it (if at all) as a
  separate bonus attack, never as a pip in the action-dice budget.

---

## 11. Impact on data sources & consumers — *relocate and derive, don't re-author*

The guiding goal here matches cyface's instinct: **change as little downstream data
as possible.** The action-die value already lives in these places as a plain string;
the new feature should *read it from where it already is* and *render it somewhere
new*, not require every pack and module to be re-authored.

### 11.1 The data already supports this

Grounding fact from the current codebase: the multi-die comma string is **already
present** end-to-end. It is *not* something we have to introduce.

- **dcc-core-book / dcc-crawl-classes class level-data packs** set it directly in
  their `levelData` strings, e.g.
  `system.attributes.actionDice.value=1d20,1d14` (and `system.config.actionDice`).
  Multi-die rows like `1d20,1d20`, `1d20,1d20,1d14` already exist in the wizard /
  cleric / warrior level data.
- **`actor-level-change.js`** copies that string into `config.actionDice` and, when
  it contains a comma, stores **only the first die** back into
  `attributes.actionDice.value`.
- **`item.js`** derives `item.system.actionDie` from that single
  `attributes.actionDice.value` (or an override). The whole roll path consumes one
  die.

So today the second die is *parsed and discarded* at the actor-level-change step.
The new feature's job is to **stop discarding it** — derive `actionDice.list` from
the same string and surface the extra slots — not to add new authored data.

### 11.2 Consumer-by-consumer impact (target: zero content changes)

| Consumer | Reads action dice how | Change needed | Notes |
|---|---|---|---|
| **dcc-core-book** (class level-data, pregens) | `levelData` strings set `attributes.actionDice.value` / `config.actionDice` | **None** | The comma string is already there. We derive `.list` from it in the system. Wizard spells-only is **inferred from class** (§5), so we do *not* add `*spell` to pack data. |
| **dcc-crawl-classes** (97 level-data files) | Same `levelData` mechanism | **None** | Same as above. |
| **mcc-classes** | No action-die references found | **None** | Not a consumer. |
| **dcc-qol** | Only a test mock references it | **None** | No runtime dependency. |
| **xcc** (11 custom actor sheets) | Renders its own action-die box in custom sheet templates | **None required; opt-in later** | When the master setting is off, xcc sheets are untouched. When on, xcc keeps showing today's single box unless/until it adopts the shared chip partial — i.e. the feature *degrades to the first die* there, it doesn't break. Adopting the chip row in xcc is a follow-up, not a blocker. |
| **NPC / PC parsers** | Write `config.actionDice` from stat blocks | **None** | They already produce the comma string (PC parser turns `+` into `,`). The derivation reads it. |

The single structural rule that buys all those "None"s: **`config.actionDice`
(the comma string) stays the one source of truth, in the same field, set the same
way.** Everything new is *derived* from it inside the system's `prepareData`. Nobody
upstream has to learn a new schema.

### 11.3 The one real internal relocation

There is exactly one place where today's behavior actively *destroys* information we
now want: `actor-level-change.js` collapsing `1d20,1d14` down to its first die in
`attributes.actionDice.value`. Two options, both master-gated:

- **Preferred:** leave `attributes.actionDice.value` exactly as today (first die) so
  the off-path and every existing reader is untouched, and have the **derivation**
  read the *full* string from `config.actionDice` (which already retains all dice).
  This is a pure read-relocation: the multi-die truth is taken from `config`, the
  legacy single-die field is left alone. **No migration, no behavior change when
  off.**
- **Rejected:** widening `attributes.actionDice.value` to hold the whole list. That
  would ripple into every reader (`item.js`, the templates, xcc, mocks) and break the
  "off ⇒ identical" guarantee. Don't.

So the answer to "do we have to change core-book / other modules?" is: **no — we
relocate where the *system* reads the existing string (prefer `config.actionDice`,
which already keeps every die) and where it *renders* it (chip row, tracker pips),
and we infer the wizard restriction from class instead of authoring it.** The packs
and sibling modules keep their current data and only benefit once a table opts in.

### 11.4 Testing the guarantee

Because "off ⇒ today's behavior" is the whole safety story, the E2E/unit suites must
**prove** it, not assume it:

- A unit test asserting that with `multipleActionDice` off, an actor authored with
  `1d20,1d14` produces the **same** `item.system.actionDie` (`1d20`) and the same
  roll terms as on `main`.
- An E2E test toggling the setting on and confirming the chip row / pips appear, then
  off and confirming the single text box returns and a rolled attack is byte-identical.
- The D2 double-counting regression test (§10) run in **both** setting states.
