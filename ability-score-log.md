# Ability Score Change Log — Design Sketch

Optional (world-setting gated) tracking of ability score changes with a reason,
a per-actor history log, recovery expectations, and one-click "Healed" revert.

## Why

Ability scores in DCC/MCC change for many reasons with *different recovery rules*:

| Cause | Recovery (per core book) |
|---|---|
| Monster/trap ability damage | 1 pt per night's rest, 2 pts per day of bed rest |
| Spellburn (Str/Agl/Sta; MCC glowburn) | Same as ability damage — "lost ability scores heal back at the normal rate" |
| Luck spend (thief/halfling) | Regenerates `level` points per night, up to natural max |
| Luck spend/burn (everyone else) | **Does not heal** — permanent barring divine intervention |
| Roll the Body survival | **Permanent** −1 to Str/Agl/Sta (random) |
| Saved from bleeding out | **Permanent** −1 Stamina + scar |
| Corruption / disapproval | **Permanent** barring magical restoration |

Players (and judges) lose track of which points come back when. The system should
remember for them.

## Existing scaffolding (already in main — unused)

The data layer for this feature is **already in place**:

- `module/data/actor/base-actor.mjs:134` — `abilityLog` ArrayField:
  `{ timestamp, ability, change, type, source, newValue }`. Nothing writes to it yet.
- `module/data/fields/ability-field.mjs:20-22` — per-ability `spent` (voluntary loss)
  and `damage` (involuntary loss) NumberFields. Also unused.
- `module/__integration__/data-models.test.js:600` — integration test already exercises
  round-tripping `abilityLog` entries.

## Data model changes

Extend the `abilityLog` entry schema in `base-actor.mjs` (additive, no migration needed
since the array is empty everywhere):

```javascript
abilityLog: new ArrayField(new SchemaField({
  id: new StringField({ required: true }),        // foundry.utils.randomID(), needed to target entries for heal/delete
  timestamp: new NumberField({ integer: true }),
  ability: new StringField(),                     // str, agl, sta, per, int, lck
  change: new NumberField({ integer: true }),     // negative = loss, positive = gain
  maxChange: new NumberField({ integer: true, initial: 0 }), // nonzero when the gain also raised max (permanent blessings)
  type: new StringField(),                        // see "Reason types" below
  source: new StringField(),                      // free text: spell name, monster, etc.
  newValue: new NumberField({ integer: true }),   // value after the change
  healed: new BooleanField({ initial: false }),   // set when reverted via the log viewer
  healedTimestamp: new NumberField({ integer: true, nullable: true })
}), { initial: [] })
```

### Reason types

Defined as `CONFIG.DCC.abilityLogTypes` in `module/config.js` (key → i18n label),
each with a *recovery class* used for display:

| type | recovery class | shown as |
|---|---|---|
| `damage` | `rest` | "Heals 1/night, 2/day bed rest" |
| `spellburn` | `rest` | same (covers MCC glowburn) |
| `luckSpend` | `luckRegen` or `permanent` | derived from actor class: thief/halfling → "Regenerates {level}/night"; otherwise "Permanent (Luck does not heal)" |
| `rollTheBody` | `permanent` | "Permanent injury (Roll the Body)" |
| `bleedOut` | `permanent` | "Permanent (saved from bleeding out)" |
| `corruption` | `permanent` | "Permanent (corruption/disapproval)" |
| `heal` | — | a restoration (positive change; also written by the Healed button) |
| `otherTemporary` | `rest` | "Temporary — heals 1/night, 2/day bed rest"; note **required** explaining why |
| `otherPermanent` | `permanent` | "Permanent"; note **required** explaining why |
| `manual` | `unknown` | "—" (fallback for untyped direct edits that bypass the dialog) |

Recovery class is **derived at render time** (from `type` + actor class for Luck), not
stored — so class changes and future rule modules stay correct retroactively.

### `spent` / `damage` fields

Leave them out of v1. The log is the source of truth; if we later want an at-a-glance
"12 (−3 spellburn)" tooltip on the sheet, compute it from unhealed log entries rather
than maintaining parallel counters that can drift.

## Setting

`module/settings.js`:

```javascript
game.settings.register('dcc', 'enableAbilityScoreLog', {
  name: 'DCC.SettingEnableAbilityScoreLog',
  hint: 'DCC.SettingEnableAbilityScoreLogHint',
  scope: 'world',
  type: Boolean,
  default: false,
  config: true
})
```

No `requiresReload` — the sheet checks the setting at render time.

## UX

### 1. Editing an ability score (setting ON)

Mirror the existing `hit-points-config.js` pattern (click HP → `HitPointsConfig`
ApplicationV2 dialog). In `templates/actor-partial-pc-common.html` (the inline
`abilityScore` partial at line 206) and the NPC equivalent:

- When the setting is on, render the `value` input `readonly` with a
  `data-action="editAbilityScore"` (cursor: pointer), keeping `max` editable as-is.
- Clicking opens **`AbilityScoreConfig`** (`module/ability-score-config.js`), a small
  ApplicationV2 form dialog:

```text
┌─ Strength — Bonnie the Wizard ────────────────┐
│ Current: 12   Max: 12                          │
│ New value: [ 9 ]   (or delta: [-3])            │
│                                                │
│ Reason:                                        │
│  (•) Spellburn                                 │
│  ( ) Ability damage (monster, trap, …)         │
│  ( ) Luck spend            [Luck only]         │
│  ( ) Roll the Body injury                      │
│  ( ) Saved from bleeding out (Stamina)         │
│  ( ) Corruption / disapproval                  │
│  ( ) Healing / recovery                        │
│  ( ) Temporary change (note why)               │
│  ( ) Permanent change (note why)               │
│                                                │
│ Source/note: [ Invoke Patron________ ]         │
│                                                │
│ [x] Also adjust Max          [gains only]      │
│                                                │
│ Recovery: Heals 1/night, 2/day bed rest        │  ← updates live with radio choice
│                                                │
│              [ Apply ]                         │
└────────────────────────────────────────────────┘
```

- The radio list is filtered contextually: `luckSpend` only for `lck`; `bleedOut`
  preselected default only for `sta`; `spellburn` only for str/agl/sta (and shown for
  all physical stats in MCC worlds where glowburn allows any). The two generic
  "Temporary change" / "Permanent change" options always appear last — they cover
  everything the rule-specific reasons don't (curses, magic items, quest effects,
  judge rulings) while still recording the one fact the log exists to answer: does
  this heal or not. For both, the Source/note field is **required** (Apply disabled
  until filled) so the "why" is always captured.
- **Gains work too** — e.g. "a god blessed me with a permanent +2 Str" is a positive
  delta with `otherPermanent` and a note. When the change is a *gain*, an
  "Also adjust Max" checkbox appears (default **checked** for permanent types,
  unchecked for temporary): a permanent blessing raises the natural maximum alongside
  the value, so the new ceiling is correct for all later Healed-cap math. Temporary
  boosts (e.g. a potion) leave max alone and are naturally clipped back when they
  expire.
- On submit, **one** `actor.update()` writes both the new value and the appended log
  entry, passing `{ dcc: { abilityLogged: true } }` in update options so the fallback
  hook (below) doesn't double-log.

Setting OFF → inputs behave exactly as today; zero behavior change.

### 2. Automatic logging from existing flows

These flows already know the reason, so no dialog — just append a typed entry:

- **Spellburn** — both apply sites: `module/actor.js:1560` (roll modifier callback)
  and `module/item.js:343` (spell check). One entry per burned ability,
  `type: 'spellburn'`, `source` = spell/patron name. Covers MCC glowburn for free
  (the `item.js:330` comment already notes glowburn *is* spellburn).
- **Luck spend** — `module/actor.js:1445`, `type: 'luckSpend'`, `source` = what it
  modified (e.g. the roll name).
- (Later, optional) Lay on Hands ability restoration → `type: 'heal'`.

### 3. Fallback: direct/manual edits

A `preUpdateActor` hook (alongside the existing ones in `module/dcc.js:1095`):
if the setting is on, a `system.abilities.*.value` change arrives, and
`options.dcc?.abilityLogged` is not set, append a `type: 'manual'` entry recording the
delta. This catches macros, modules (dcc-qol, xcc, …), and GM bar edits without
breaking them — they still work, they just get logged with reason "Other".

(Why log-in-hook rather than block-and-prompt: ApplicationV2 `preUpdate` can't await a
dialog without cancelling the update, and silently rewriting other modules' updates is
hostile. Log everything, prompt only on sheet clicks.)

### 4. The log viewer

A small scroll/book icon button in the `.ability-scores` block header
(`actor-partial-pc-common.html:248`), `data-action="viewAbilityLog"`, opening
**`AbilityScoreLogDialog`** (ApplicationV2, pattern: `fleeting-luck.js`):

```text
┌─ Ability Score Log — Bonnie the Wizard ──────────────────────────────────┐
│ Date         Ability  Change  Reason       Source         Recovery       │
│ ──────────────────────────────────────────────────────────────────────── │
│ 2026-06-12   Str      −3      Spellburn    Invoke Patron  1/night  [Healed] │
│ 2026-06-12   Lck      −2      Luck spend   Attack roll    Permanent  [Healed] │
│ 2026-06-10   Sta      −1      Roll the Body  —            Permanent  [Healed] │
│ 2026-06-09   Agl      −2      Spellburn    Magic Missile  ✓ healed 2026-06-10 │
│                                                              [🗑 per row, GM] │
└──────────────────────────────────────────────────────────────────────────┘
```

- Rows sorted newest-first; healed rows dimmed with a checkmark instead of the button.
- **Healed** button: restores `min(ability.max, value + |change|)` — i.e. caps at max —
  marks the entry `healed: true` + `healedTimestamp`, in a single `update()` with the
  `abilityLogged` options flag. It does **not** delete the row (history is the point).
- Permanent-class entries still offer Healed (divine intervention happens) but behind a
  `DialogV2.confirm` ("This loss is normally permanent — restore anyway?").
- Positive entries (heals, blessings, awards) have no Healed button — you don't heal
  a gain. Recording a revoked blessing is just a new negative entry (or GM delete).
- GM-only trash icon per row for bookkeeping mistakes; players can only mark Healed.
- Empty state: localized "No ability score changes recorded."

Timestamps: store `Date.now()`; display world calendar later if ever needed.

## Files touched

| File | Change |
|---|---|
| `module/data/actor/base-actor.mjs` | extend `abilityLog` entry schema (`id`, `healed`, `healedTimestamp`) |
| `module/config.js` | `DCC.abilityLogTypes` + recovery-class map |
| `module/settings.js` | register `enableAbilityScoreLog` |
| `module/ability-score-config.js` | **new** — edit dialog (pattern: `hit-points-config.js`) |
| `module/ability-score-log.js` | **new** — log viewer dialog + `logAbilityChange(actor, entry)` helper + Healed/delete actions |
| `module/actor-sheet.js` | `editAbilityScore` / `viewAbilityLog` actions; pass setting flag into context |
| `templates/actor-partial-pc-common.html` | readonly+action on value input when enabled; log button |
| `templates/actor-partial-npc-common.html` | same (or PC-only for v1 — see open questions) |
| `templates/dialog-ability-score-config.html` | **new** |
| `templates/dialog-ability-score-log.html` | **new** |
| `module/actor.js` | log spellburn (`:1560`) and luck spend (`:1445`) |
| `module/item.js` | log spellburn (`:343`) |
| `module/dcc.js` | `preUpdateActor` fallback logger |
| `lang/en.json` + translations | new `DCC.AbilityLog*` keys |
| `styles/dcc.scss` | log dialog table, dimmed healed rows, log button |

## Edge cases

- **Max changes too**: only `value` edits go through the dialog; `max` edits stay free
  (level-up bookkeeping shouldn't be ceremonious). The fallback hook could log max
  changes as `manual` — proposed: don't, keep noise down.
- **Healed when value has since changed**: restore is relative (`value + |change|`),
  capped at max — not "set back to `newValue − change`" — so interleaved changes
  compose correctly.
- **Double-heal**: guarded by `healed` flag.
- **Active Effects on abilities**: AEs modify derived values, not `value`; the log only
  tracks the base `value`, so no interaction. The existing ability-effects icons
  (`actor-partial-pc-common.html:216`) already cover AE visibility.
- **Dependent modules** (dcc-qol, xcc, mcc-classes, dcc-crawl-classes): they update
  abilities via `actor.update()`; with the setting on they get `manual` log entries,
  no breakage. Export `logAbilityChange()` on `game.dcc` so they can opt in with
  proper types (MCC glowburn, plastic surgery, etc.).
- **Log growth**: unbounded array on the actor. Fine in practice (entries are tiny);
  GM delete covers cleanup. Revisit only if it ever matters.

## Open questions

1. NPC sheets too, or PC-only for v1? (Lean: PC-only; monsters' stat changes are
   rarely worth a paper trail.)
2. Should the log viewer also be reachable from a header control (sheet kebab menu)
   in addition to the inline button?
3. Chat card on Healed (public "Bonnie recovers 2 Str")? Nice flavor, cheap to add.

## Test plan

- Unit (`module/__tests__/`): `logAbilityChange` appends well-formed entries; Healed
  caps at max and sets flags; recovery-class derivation (thief Luck vs wizard Luck);
  fallback hook skips when `abilityLogged` flag present; setting off → no hook writes;
  `otherTemporary`/`otherPermanent` reject submission with an empty note.
- Integration: extend `data-models.test.js:600` round-trip for the new entry fields.
- E2E: enable setting, click Str, pick Spellburn, apply −3, open log, mark Healed,
  verify value restored and row dimmed.

## Implementation order

1. Schema extension + config types + setting + i18n keys (mechanical, low risk)
2. `logAbilityChange` helper + unit tests
3. Edit dialog + sheet wiring (PC template)
4. Log viewer dialog + Healed/delete
5. Auto-logging in spellburn/luck-spend paths + fallback hook
6. SCSS, E2E, dependent-module smoke check
