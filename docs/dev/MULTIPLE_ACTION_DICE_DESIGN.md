# Surfacing Multiple Action Dice — Design Exploration

> Status: **design / RFC** — no code yet. Branch `claude/multiple-action-dice-design`.
> Author: design pass for cyface, 2026-06-25.

## TL;DR — recommendation

Treat the action die not as a string the player reads off their sheet, but as a
**per-round budget that the system tracks and spends for you**. Build it in three
layers, each shippable on its own and each gated behind a setting so tables that
don't want it never see it:

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
- **Class restrictions.** A **wizard's** extra action dice can only be used to
  **cast spells**, never to make a second weapon attack. Warriors have no such
  restriction. So a die needs to know *what it may be spent on*.
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
3. **Zero-cost when off.** A single character with `1d20` should see *nothing new*.
   Everything below activates only when an actor has 2+ dice, and the live tracking
   is behind a setting.
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
1d20+4, 1d20, 1d16         → first die carries a +4 (attack bonus shorthand)
Act 1d24+1d20  (NPC)       → parser already handles "+" as a separator
```

- `use` ∈ `any | spell | attack` (extensible: `mightyDeed`, `turnUndead`…).
- The `*tag` suffix is optional; absent ⇒ `any`. Fully backward compatible — every
  existing `"1d20,1d16"` parses to two `any` dice.

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
   (`+4` is stored as the slot's `modifier`, applied on top of the normal attack
   bonus — or, if you prefer, treated purely as display and the existing attack
   bonus stays authoritative; see Open Questions.)
3. Second attack defaults to the next **1d20** (no rider). Third to **1d16**.
4. Three pips, three clicks, no mental tracking of which die is next.

---

## 8. Settings (keep it from bogging down)

```
DCC System Settings → Combat
  ☑ Track action dice in combat tracker        (default: on)
  ☑ Auto-reset action dice at start of turn     (default: on)
  ☐ Hide pips for single-action-die actors      (default: on — declutter)
  ☐ Enforce spells-only dice as hard block       (default: off — soft filter)
  ☐ Show "Action N of M" line in chat cards      (default: on)
```

Everything degrades gracefully: turn all of it off and you're back to today's
behavior, plus the nicer sheet chip row (which is itself just a prettier editor for
the same string).

---

## 9. Suggested rollout (each phase independently shippable)

1. **Phase 1 — data + sheet chips.** Add the derived `actionDice.list`, the `*tag`
   grammar (back-compat), and the chip-row editor on PC and NPC sheets. No tracking
   yet. *Immediately fixes "the second die is invisible."*
2. **Phase 2 — combat-tracker pips + auto-reset.** Combatant flag, `combatTurn`/
   `combatRound` hooks, tracker template, click-to-toggle. *The judge-facing win.*
3. **Phase 3 — auto-spend + smart preset default + chat "Action N of M."** Wire
   roll resolution to spend a pip and default the dialog to the next unspent die.
4. **Phase 4 — soft spells-only filtering.** Filter presets by `use` tag; warn
   (don't block) when no compatible die remains.

The mechanic-correct, lib-owned bits (which die a roll *consumes*, restriction
semantics) likely belong in `@moonloch/dcc-core-lib` so the rules live with the
roll logic; the tracker UI, sheet chips, and Foundry hook wiring stay in the system.

---

## 10. Decisions to make

Four choices gate implementation. Each has a recommended default so the project can
proceed without blocking; revisit before the phase that depends on it.

| # | Decision | Options | Recommended default | Blocks |
|---|----------|---------|---------------------|--------|
| D1 | **Spells-only enforcement** — what happens when someone aims a spells-only die at a weapon attack | (a) Soft filter: not offered as a preset, chat warns, Ctrl-click override always works · (b) Hard block: refused outright, no override · (c) Setting, default soft | **(a) Soft filter** — trusts the judge, won't fight rule-benders, keeps the escape hatch | Phase 4 |
| D2 | **`1d20+4` modifier semantics** — what the `+4` on slot 0 is | (a) Display only: the existing attack bonus stays authoritative, list stores pure dice · (b) Real per-die rider: store `+4` as a slot modifier added on top | **(a) Display only** — least risk of double-counting the bonus | Phase 1 |
| D3 | **Two-weapon fighting cost** — pips a TWF attack consumes | (a) One pip: one action that rolls two stepped-down dice · (b) Two pips: each weapon spends a die | **(a) One pip** — matches RAW and the existing TWF model | Phase 3 |
| D4 | **Out-of-combat tracking** — budget when there's no encounter | (a) Chips only, no budget (no rounds to reset against) · (b) Track everywhere with a manual reset button | **(a) Chips only** — no natural reset signal exists out of combat | Phase 1–2 |

Carried-over confirmations (no real fork, just things to verify during build):

- **Reactions / off-turn actions.** DCC mostly lacks reactions; click-to-toggle on a
  pip covers the rare out-of-turn ability. Confirm nothing needs more than that.
- **Deed die separation.** Keep the warrior's Mighty Deed die clearly *out* of the
  action-dice chip row so no one reads it as an extra action.
```
