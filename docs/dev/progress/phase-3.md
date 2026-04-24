# Phase 3 — Attack / Damage / Crit / Fumble + Cruft Slices

> Archive of session-by-session detail for Phase 3: routing
> `DCCActor.rollWeaponAttack` and its chained
> `rollToHit` / `rollDamage` / `rollCritical` / `rollFumble` calls
> through the adapter, plus legacy-branch retirements (Group D) and
> parallel cruft-removal slices (Group C). See
> [`docs/dev/ARCHITECTURE_REIMAGINED.md §7 Phase 3`](../ARCHITECTURE_REIMAGINED.md)
> + [`docs/02-slice-backlog.md`](../../02-slice-backlog.md) for the
> slice plan and [`00-progress.md`](../../00-progress.md) for current
> state + open questions.

---

## Session 1 — 2026-04-18 (Spellburn dialog scaffold)

Phase 3 kickoff. No attack migration yet; this session built the
adapter-side Spellburn dialog scaffold that both the wizard cast path
(today) and the attack / damage dialog path (future session) can share,
and closed open question #6 (Spellburn dialog integration).

- **`module/adapter/roll-dialog.mjs`** — new file.
  `promptSpellburnCommitment(actor, spellItem)` displays a
  `DialogV2.wait` prompt with three number inputs (Str / Agl / Sta),
  each clamped to `[0, currentAbilityValue]`. Commit → returns a lib
  `SpellburnCommitment` (`{str, agl, sta}`); Cancel / close → returns
  `null`. Module header JSDoc lays out the broader role — Phase 3
  future sessions will extend this file (not replace it) when the
  attack / damage dialog needs its own prompt.
- **`module/actor.js`** — `rollSpellCheck` dispatcher gains a
  Spellburn-dialog bridge in the wizard / elf branch. When
  `castingMode === 'wizard' && !isCleric`, after the spell-loss
  pre-check, the dispatcher now checks `options.showModifierDialog
  && !options.spellburn && !this.isNPC` and awaits
  `promptSpellburnCommitment` when all three conditions hold. On
  cancel (null) the cast early-returns verbatim to how
  `RollModifierDialog.close` aborted the legacy path. On commit the
  returned commitment is set as `options.spellburn` and the cast
  falls through to `_rollSpellCheckViaAdapter` — which already knew
  how to thread `spellburn` to `buildSpellCheckArgs` and apply
  ability-score changes via the existing `onSpellburnApplied` bridge
  (session-5 plumbing).
- **i18n** — four new keys landed in all 7 languages
  (en / de / es / fr / it / pl / cn): `DCC.SpellburnCommit`,
  `DCC.SpellburnDialogPrompt`, `DCC.SpellburnDialogTitle`,
  `DCC.SpellburnDialogTitleForSpell`. `compare-lang` reports 876
  keys / 0 missing / 0 extra across every locale.
- **Tests**:
  - `module/__tests__/adapter-spell-check.test.js` — now 35 tests
    (up from 31). Imports `vi.mock('../adapter/roll-dialog.mjs')` so
    each test can drive `promptSpellburnCommitment.mockResolvedValue`
    deterministically without rendering DialogV2. New cases:
    `wizard cast with showModifierDialog prompts spellburn and
    forwards the commitment`; `wizard cast with showModifierDialog
    aborts when the dialog is canceled`; `wizard cast with preset
    options.spellburn bypasses the dialog`; `wizard cast on an NPC
    actor bypasses the spellburn dialog`.
  - 794 Vitest tests pass (up from 790). `npm run format` clean,
    `npm run compare-lang` clean.
  - Playwright spec NOT extended this session — the adapter-dispatch
    spec asserts on `logDispatch` console output, which the
    Spellburn dialog bridge doesn't directly emit.

**Scope decisions (Phase 3 session 1):**

- **Slice (a) — dialog-adapter — picked over (b) attack-formula and
  (c) hook translation.** The session-start prompt's guidance:
  "Lean (a) if lib wave-3 isn't ready." `module/vendor/dcc-core-lib/`
  is pinned at 0.4.0 where all `src/combat/*.ts` still import
  `LegacyRollModifier`; wave-3 has not shipped. Landing the dialog
  first unblocks BOTH spellburn (immediate regression fix) AND the
  attack / damage dialog (future session) and builds reusable
  scaffolding before the larger attack work commits to a shape.
- **OQ6 resolved via (b) dialog-adapter, NOT (a) dispatcher
  carve-out.** Carve-out would have routed `showModifierDialog` back
  to `_rollSpellCheckLegacy` — shipping quickly but undoing the
  session-2 wizard migration for every right-click cast. Dialog-
  adapter preserves the full adapter pipeline and gives a template
  for the attack dialog.
- **DialogV2 over Handlebars+custom-UI.** The legacy Spellburn term
  uses a Handlebars partial with +/- buttons that update a display
  showing the post-burn stat in real time. DialogV2 with simple
  number inputs is a UX regression vs that, but dramatically simpler
  to build and test, and matches how the rest of the system's modal
  prompts already work.
- **NPC short-circuit.** The legacy `DCCSpellburnTerm` was only
  built on PC-path casts. Mirroring that: NPCs never see the prompt.

---

## Session 2 — 2026-04-18 (first attack migration slice)

Phase 3 session 2 — first attack migration slice landed.

- **Dispatcher in `DCCActor.rollToHit`.** New `_canRouteAttackViaAdapter`
  gate routes through the adapter when ALL of:
  - `options.showModifierDialog` falsy
  - `options.backstab` falsy
  - `weapon.system.twoWeaponPrimary` / `twoWeaponSecondary` both falsy
  - `actor.system.details.attackBonus` has no `d` (no actor-side deed die)
  - `weapon.system.toHit` has no `d` (weapon-side to-hit is simple numeric)
  - `game.settings.get('dcc', 'automateDamageFumblesCrits')` truthy

  Any failure → `_rollToHitLegacy` (the pre-dispatcher body verbatim).
  Both branches call `logDispatch('rollWeaponAttack', ...)` as the
  first line (same permanent-infrastructure contract as Phase 1/2).
- **`_rollToHitViaAdapter`.** Structurally mirrors legacy for Foundry
  compatibility: builds the same `terms` array (action die + `+toHit`
  compound, NPC attack adjustment if present), fires the
  `dcc.modifyAttackRollTerms` hook, builds + evaluates a `Roll` via
  `game.dcc.DCCRoll.createRoll` (preserves chat rendering). After
  evaluation the natural d20 feeds into the lib's `makeAttackRoll` with
  a deterministic sync roller (`() => d20RollResult`) and an
  `AttackInput` built from `buildAttackInput(actor, weapon)`. The lib's
  `isCriticalThreat` / `isFumble` / `appliedModifiers` populate a new
  `libResult` field on the return object; `rollWeaponAttack` surfaces
  it as `flags['dcc.libResult']` on the chat flags.
- **`module/adapter/attack-input.mjs`** — new file.
  - `buildAttackInput(actor, weapon)` returns `{ attackType,
    attackBonus, actionDie, threatRange, abilityModifier }`. For the
    happy-path slice, `attackBonus` carries the fully-summed
    `weapon.system.toHit` (which already bakes in class attack bonus
    + ability mod + adjustments via
    `computeMeleeAndMissileAttackAndDamage` + `DCCItem.prepareBaseData`),
    and `abilityModifier` stays at 0 to avoid double-counting.
  - `normalizeLibDie` converts Foundry-style `'1d20'` to the lib's
    `'d20'`.
  - `parseToHitBonus` parses the leading signed integer from
    weapon `toHit` strings; returns 0 for malformed input.
- **Tests** (`module/__tests__/adapter-weapon-attack.test.js` — 9
  cases): gate truth-table, adapter dispatch asserts `libResult`
  flag populated with `die/bonus/totalBonus/attackType=melee/
  isCriticalThreat=false/isFumble=false/modifiers[]`, legacy dispatch
  asserts hook fires with same terms + no `libResult`.
- **Browser test status.** Playwright `phase1-adapter-dispatch.spec.js`
  extended with `rollWeaponAttack` describe block (4 new): simple
  weapon happy-path → adapter + libResult, backstab → legacy, deed
  die → legacy, automate off → legacy. All 26 tests pass against
  live v14 Foundry (verified 2026-04-18, 3.0 min run).

---

## Session 3 — 2026-04-18 (hook-translation bridge)

Phase 3 session 3 — hook-translation bridge landed.

- **`hookTermsToBonuses(addedTerms)`** in `module/adapter/attack-input.mjs`.
  Converts `dcc.modifyAttackRollTerms`-injected terms into lib
  `RollBonus[]` entries. Only `type === 'Modifier'` terms with a
  pure signed-integer `formula` (regex `/^[+-]?\d+$/`) are translated;
  `Die` / `Compound` entries and dice-bearing formulas (`'1d3'`) are
  skipped — the lib's flat-modifier bonus kind can't represent them.
  Each emitted bonus has `category: 'circumstance'`, `source.type:
  'other'`, no `condition` (always applies), and the hook-provided
  label as `source.name`.
- **Dispatcher wiring in `_rollToHitViaAdapter`.** Snapshots
  `terms.length` before `Hooks.call('dcc.modifyAttackRollTerms', …)`,
  slices `terms.slice(termsLengthBefore)` after, translates via
  `hookTermsToBonuses`, and assigns `attackInput.bonuses` when the
  translator emits anything. The Foundry `Roll` still rolls the
  original + hook-mutated terms end-to-end (chat total is unchanged);
  the bridge is additive — it gives the lib enough context to sum
  `totalBonus` to match.
- **`libResult.bonuses` flag field added.** `_rollToHitViaAdapter`
  now attaches the translated bonus list as `libResult.bonuses`
  alongside `libResult.modifiers`. `modifiers` is the lib's
  aggregate `appliedModifiers` (a single `{source: 'bonuses',
  value: N}` entry collapses all computed bonuses); `bonuses` is
  the per-term breakdown preserved with labels.

**Scope decisions:**

- **In-place mutations of `terms[0].formula`** (dcc-qol long-range
  `DiceChain.bumpDie`) are NOT translated this session. Observable
  divergence: `libResult.die` may report `d20` when the Foundry
  roll actually evaluated on `d16`. Session 4 closed this.
- **Module attribution.** Hook-added terms carry no `moduleId`,
  so all translated bonuses are emitted with `source: { type:
  'other', name: <label> }`. When the wave-3 modifier redesign
  ships, session-N can upgrade this to `category: 'module'` /
  `moduleId` on the tagged union.
- **Non-happy-path routing unchanged.** `_rollToHitLegacy` still
  handles backstab / two-weapon / deed / automate-off cases
  verbatim.
- **Tests** (`module/__tests__/adapter-weapon-attack.test.js` — 5
  new cases, 14 total): `hookTermsToBonuses` unit coverage, adapter
  path surfaces pushed `{type:'Modifier', formula:'-1'}` term as
  `libResult.bonuses[0]`, no-hook case emits empty `bonuses: []`.
  808 Vitest tests pass (up from 803).
- **Browser test status.** Session 2's 4 weapon-attack Playwright
  cases stay green — observational change to adapter-result flag
  only; no new dispatch branches.

---

## Session 4 — 2026-04-18 (long-range dice-chain translation)

Phase 3 session 4 — long-range dice-chain translation landed.

- **Post-hook re-read of `terms[0].formula` in `_rollToHitViaAdapter`.**
  After `dcc.modifyAttackRollTerms` fires, captures the action-die
  term's current `formula`. If a listener rewrote it (e.g. dcc-qol's
  long-range `DiceChain.bumpDie('1d20') === '1d16'`), normalizes via
  `normalizeLibDie` and assigns to `attackInput.actionDie` before
  invoking `makeAttackRoll`. The Foundry `Roll` already used the
  bumped die; this just keeps the lib's view in sync.
- **`normalizeLibDie` exported** from `module/adapter/attack-input.mjs`
  (was a local helper). The dispatcher calls it directly so the same
  Foundry → lib die-shape conversion is used for both the initial
  build (`buildAttackInput`) and the post-hook re-read.
- **Closes session 3's observational divergence.** Previously
  `libResult.die` could report `'d20'` while the Foundry roll
  evaluated on `d16`; now both agree. The `strictCriticalHits`
  branch already adjusts `critRange` from the post-evaluate
  `attackRoll.formula` so threat-range math is unaffected.
- **Tests** (`module/__tests__/adapter-weapon-attack.test.js` — 3
  new cases, 17 total): `normalizeLibDie` unit coverage, post-hook
  bump round-trip, no-op when the hook leaves `terms[0]` alone.
  811 Vitest tests pass (up from 808).

---

## Session 5 — 2026-04-19 (first damage-migration slice)

Phase 3 session 5 — first damage-migration slice landed.

- **Dispatcher in `DCCActor.rollWeaponAttack`.** The inline damage
  block is now a one-liner `const damageDispatch = await
  this._rollDamage(...)` that destructures `damageRoll` /
  `damageInlineRoll` / `damagePrompt` / `libDamageResult` back into
  the caller. `_rollDamage` is the dispatcher;
  `_canRouteDamageViaAdapter` is the gate.
- **Gate (`_canRouteDamageViaAdapter`).** Routes through the adapter
  when ALL of:
  - `attackRollResult.libResult` is present (the attack itself went
    through `_rollToHitViaAdapter`)
  - `options.backstab` falsy (backstab-damage swap stays legacy)
  - damage formula is a string that doesn't contain `[` (skips
    per-term flavors like `1d6[fire]+1d6[cold]`)
  - `parseDamageFormula(formula)` returns non-null (single die +
    optional flat modifier, e.g. `1d8`, `1d6+2`, `d4-1`)

  Any failure → `_rollDamageLegacy` (the pre-split body verbatim).
  Both branches call `logDispatch('rollDamage', ...)` as the first
  line.
- **`_rollDamageViaAdapter`.** Structurally mirrors legacy for
  Foundry compatibility: builds a `Compound` DCC term, evaluates via
  `game.dcc.DCCRoll.createRoll`, clamps minimum to 1, builds the
  `damage-applyable` anchor + breakdown span exactly like legacy.
  After evaluation, extracts the natural die result from
  `damageRoll.dice[0].total`, wraps it in a sync roller
  (`() => naturalDamage`), and calls the lib's `rollDamage` with a
  `DamageInput` built from `buildDamageInput(parseDamageFormula(formula))`.
  The lib owns the classification / breakdown; the adapter exposes
  the result as `libDamageResult` on the return shape, which
  `rollWeaponAttack` surfaces as `flags['dcc.libDamageResult']`.
- **`module/adapter/damage-input.mjs`** — new file.
  - `parseDamageFormula(formula)` extracts `{diceCount, die, modifier}`
    from simple `NdM[+K]` strings; returns `null` for multi-die,
    per-term flavors, `@ab` substitutions, or empty input. Regex:
    `/^\s*(\d*)d(\d+)\s*([+-]\s*\d+)?\s*$/i`.
  - `buildDamageInput(parsed)` folds the flat modifier into
    `strengthModifier` — for the simplest-damage slice, the damage
    formula already bakes in the strength modifier, so we pass the
    single combined value and leave `deedDieResult` / `magicBonus` /
    `backstabMultiplier` unset.
- **`_rollDamageLegacy`.** Preserved verbatim from the pre-split
  inline body: handles per-term flavors via Foundry native `Roll`;
  simple formulas via `DCCRoll.createRoll`; clamps minimum 1.
- **Pre-existing test-mock quirk (discovered).** The shared
  `__mocks__/dcc-roll.js` declares `createRoll` as `static async`,
  but production `module/dcc-roll.js:17` is sync. Session 5 tests
  install sync stubs on `game.dcc.DCCRoll.createRoll` rather than
  touch the shared mock (see the test-file docstring for rationale).
- **Tests** (`module/__tests__/adapter-weapon-damage.test.js` — 10
  cases): `parseDamageFormula` unit accept/reject; `buildDamageInput`
  unit; gate truth-table; adapter + legacy dispatch branches; minimum-1
  clamp; per-term-flavor legacy routing. 821 Vitest tests pass (up
  from 811).
- **Browser test status.** Playwright extended: happy-path +
  backstab tests now additionally assert `rollDamage` log line; new
  multi-damage-type `1d6[fire]+1d6[cold]` case validates per-term-flavor
  gate. 27 tests pass against live v14 Foundry (2026-04-19, 3.2 min).

---

## Session 6 — 2026-04-19 (crit + fumble migration)

Phase 3 session 6 — crit + fumble migration landed.

- **Dispatchers in `DCCActor.rollWeaponAttack`.** The inline crit and
  fumble blocks are now one-liners — `const critDispatch = await
  this._rollCritical(...)` / `const fumbleDispatch = await
  this._rollFumble(...)`. `_rollCritical` / `_rollFumble` are the
  dispatchers; `_canRouteCritViaAdapter` / `_canRouteFumbleViaAdapter`
  are the gates.
- **Gates.** Both route through the adapter when ALL of:
  - `attackRollResult.libResult` is present (attack went adapter)
  - `ctx.automate` is true (`automateDamageFumblesCrits`)

  Any failure → legacy.
- **`_rollCriticalViaAdapter`.** Structurally mirrors the legacy
  crit block: builds a `Compound` DCC term, evaluates via
  `game.dcc.DCCRoll.createRoll`, looks up the crit-table entry via
  `getCritTableResult`. After evaluation, extracts the natural die
  from `critRoll.dice[0].total`, wraps it in a sync roller, and
  calls the lib's `rollCritical` with a `CriticalInput` built from
  `buildCriticalInput({ critDie, luckModifier, critTableName })`.
  Result surfaces as `flags['dcc.libCritResult']`.
- **`_rollFumbleViaAdapter`.** Same pattern. Builds the Foundry
  fumble roll (PC fumble die +/- luck, or fixed `1d10` for NPCs
  with `useNPCFumbles`), evaluates, replays the natural die through
  the lib's `rollFumble` with `fumbleDieOverride` set. Result
  surfaces as `flags['dcc.libFumbleResult']`.
- **`module/adapter/crit-fumble-input.mjs`** — new file.
  `buildCriticalInput({ critDie, luckModifier, critTableName })` and
  `buildFumbleInput({ fumbleDie, luckModifier })` normalize dice and
  set `fumbleDieOverride` so the lib rolls the exact die Foundry used.
- **Chat-flag shape.**
  - `flags['dcc.libCritResult'] = { critDie, natural, total,
    critTable, modifiers }`.
  - `flags['dcc.libFumbleResult'] = { fumbleDie, natural, total,
    modifiers }`.
- **Tests** (`module/__tests__/adapter-weapon-crit-fumble.test.js`
  — 13 cases): gate truth-tables, adapter + legacy dispatch for
  crits and fumbles, NPC fumble die swap. 834 Vitest pass (up from
  821). Playwright extended with crit + fumble describe blocks (5
  new tests); 33 e2e tests pass against live v14 Foundry.
- **Session-reuse fixture added to dispatch spec** (bonus
  infrastructure). The new worker-scoped `sessionPage` fixture logs
  in ONCE per worker; dispatch-spec tests drop from ~7-13 s to
  ~0.5-1 s each.

---

## Session 7 — 2026-04-19 (NPC damage-bonus through adapter)

Routed the NPC damage-bonus adjustment through the adapter with
correct attribution. The dispatcher previously folded the appended
`±N` adjustment into `strengthModifier` (silently misattributed to
Strength in the lib breakdown). Session 7 keeps `rollWeaponAttack`
baking the adjustment into the formula (so `_rollDamageLegacy` keeps
working unchanged) but threads the raw `npcDamageAdjustment` as an
option into `_rollDamage`. The adapter path's
`buildDamageInput(parsed, { npcDamageAdjustment })` now peels the
adjustment off `strengthModifier` and surfaces it as a `RollBonus`
(`source: { type: 'other', id: 'npc-attack-damage-bonus' }`) on
`bonuses[]`. The lib's `rollDamage` aggregates that into a
`{ source: 'bonuses', amount: N }` breakdown entry on
`flags['dcc.libDamageResult']` instead of crediting Strength. PCs
unaffected. 838 Vitest tests pass (up from 834 — 4 new) + 34
Playwright dispatch tests pass (33 prior + 1 new: NPC with
`attackDamageBonus.melee.adjustment` asserts `amount === 2` + no
Strength entry).

---

## Session 8 — 2026-04-19 (PC magic weapon bonus through adapter)

Broadened the damage gate to route PC magic weapon bonuses through
the adapter with correct attribution. `item.js` appends the
weapon's `damageWeaponBonus` (e.g. `'+1'` for a +1 sword) onto the
derived damage formula, producing two trailing integer modifiers
(`1d8+2+1` = str +2, magic +1). Session 5's `parseDamageFormula`
only accepted a single modifier; session 8 extends the parser to
sum any number of flat integer modifiers, and adds
`extractWeaponMagicBonus(weapon)` — returns a non-negative integer
(0 for non-magical weapons), `null` for dice-bearing (`+1d4`) or
cursed (negative) bonuses. `_canRouteDamageViaAdapter` adds the
magic-bonus check; `_rollDamageViaAdapter` forwards the bonus as
an option into `buildDamageInput`, which peels it off
`strengthModifier` and sets `input.magicBonus`. The lib's
`rollDamage` surfaces the bonus as `{ source: 'magic', amount: N }`
on `libDamageResult.breakdown`, alongside (not folded into) the
Strength entry. Dice-bearing + cursed weapon bonuses continue to
fall to legacy. 866 Vitest pass (up from 856 — 10 new) + 71
Playwright (70 + 1 new: "PC with +1 magic weapon routes via adapter
+ magic breakdown entry").

---

## Vendor sync — 2026-04-19, `58d9621` (dcc-core-lib 0.4.1)

Brought in backstab fix + post-review API cleanup (`canBackstab` /
`isBackstabTriggeredRaw` split, `critSource` tag,
`getBackstabAttackBonus` returns `number | undefined`). Adapter-side
minimal cleanup: `_rollDamageViaAdapter` dropped `subtotal` +
`multiplier` from `libDamageResult` (lib fields removed); Playwright
"populates dcc.libDamageResult" assertion rewritten to the equivalent
`total === Math.max(1, baseDamage + modifierDamage)`; stale
`backstabMultiplier` docstring reference cleared.

---

## Session 9 — 2026-04-19 (thief backstab through adapter)

Followed on from the `dcc-core-lib@0.4.1` sync, which brought in the
RAW backstab rewrite: `AttackInput.isBackstab: true` drives an
auto-crit inside `makeAttackRoll` (matches legacy Foundry behavior),
`DamageResult.subtotal` + `.multiplier` removed (new damage pipeline
has no multiplier concept), `AttackResult.critSource` added
(`"threat-range" | "backstab-auto" | "natural-max"`).

Both Phase 3 attack-gate + damage-gate now accept `options.backstab`.
`_rollToHitViaAdapter` pushes the Table 1-9 bonus term identically
to legacy (chat-render consistency + hook-visibility), then surfaces
the bonus as a `RollBonus` with `id: 'class:backstab'`,
`source: { type: 'class', id: 'thief' }` on `attackInput.bonuses`
so `libResult.total` matches the Foundry Roll. `attackInput.isBackstab`
triggers the lib's auto-crit. `rollWeaponAttack` already swaps
`damageRollFormula` to `weapon.system.backstabDamage` (legacy
behavior) before reaching `_rollDamage`, so the damage adapter sees
the alternate die as a normal formula. Chat flag: `libResult.bonuses`
now carries the full bonuses list (previously hook-added only);
`libResult.critSource` is surfaced for crit-table selection.
868 Vitest pass (up from 866 — +2 new).

---

## Session 10 — 2026-04-19 (A3: deed-die adapter route)

Routed warrior / dwarf deed-die attacks through the adapter. New
`parseDeedAttackBonus` helper in `module/adapter/attack-input.mjs`
recognizes deed-die-bearing toHit / attackBonus strings (e.g.
`+1d3+0`, `+d4-1`, `1d3+2+1`) — a single die expression at the
start, optionally followed by any number of flat integer modifiers.
`buildAttackInput` uses it to populate `AttackInput.deedDie` (lib
normalized: `d3`) and the flat `attackBonus` separately.
`_canRouteAttackViaAdapter` was relaxed: dice in actor `attackBonus`
or weapon `toHit` are now permitted as long as `parseDeedAttackBonus`
matches them; pathological / mixed-dice / weapon-side die patterns
still fall to legacy. `_rollToHitViaAdapter` builds a sequenced roller
closure that returns `attackRoll.dice[0].total` first (the lib's
`evaluateRoll` for the d20) then `attackRoll.dice[1].total` (the
lib's `rollDeedDie` for the deed). Deed-die return fields populate
identically to the legacy path. New chat-flag fields on
`dcc.libResult`: `deedDie`, `deedNatural`, `deedSuccess`. Lib's
`onDeedAttempt` event fires. 874 Vitest pass (up from 868 — +6 net)
+ 73 Playwright (71 + 2 new: warrior-deed-die attack + damage via
adapter; warrior-deed-die libResult shape).

A3 closes — backstab + NPC + magic-weapon + deed-die attack paths
all route via adapter for the common case.

---

## Session 11 — 2026-04-19 (A4: two-weapon fighting)

Routed two-weapon fighting through the adapter.
`_canRouteAttackViaAdapter` dropped the `twoWeaponPrimary ||
twoWeaponSecondary` exclusion; the adapter inherits the
dice-chain-bumped `weapon.system.actionDie` (e.g. `1d16[2w-primary]`)
that `item.js:prepareBaseData` already computes per the
agility-tier matrix, plus the adjusted `weapon.system.critRange`.
`normalizeLibDie` strips the bracket flavor tag so the lib's
`actionDie` is `'d16'` and `makeAttackRoll` computes the attack on
the bumped die.

**Design choice (lib-vs-rules):** we deliberately do NOT set
`AttackInput.twoWeaponPenalty`. The lib's `getTwoWeaponPenalty`
returns flat `-1` (halfling) / `-2` (other) — that's a different
ruleset than DCC RAW, which uses dice-chain reductions on the action
die instead of flat penalties. Setting both would double-count. The
lib's `twoWeaponPenalty` field is OPTIONAL; omitting it is the
correct integration. Future lib enhancement could add a dice-chain
mode for full DCC parity.

New chat-flag fields on `dcc.libResult`: `isTwoWeaponPrimary`,
`isTwoWeaponSecondary` — observability for downstream consumers.
Halfling fumble note in `rollWeaponAttack` already triggers off
`attackRollResult.fumble` which the adapter populates correctly.
875 Vitest pass (up from 874 — +2 new) + 75 Playwright (73 + 2:
two-weapon-primary attack + damage via adapter, two-weapon-secondary
libResult populates die / isTwoWeaponSecondary).

**Group A is closed** — A1 (simplest weapon), A2 (backstab), A3
(deed die), A4 (two-weapon) all route via adapter for the common
case. Group D (`_rollToHitLegacy` retirement) unblocks.

---

## Session 12 — 2026-04-19 (A5: drop automate-damage gate)

Dropped the `automateDamageFumblesCrits` gate check on
`_canRouteAttackViaAdapter`. That setting gates whether
`rollWeaponAttack` dispatches downstream damage / crit / fumble
rolls — not the attack-side adapter's correctness. The downstream
gates already check `ctx.automate` defensively, so with the setting
off the attack routes via adapter (populating `dcc.libResult`)
while downstream falls back to the inline-roll-text prompt with no
lib call. First of three slices (A5 / A6 / A7) broadening the
attack gate toward exhaustiveness so D1 (`_rollToHitLegacy`
retirement) is a mechanical collapse. 877 Vitest (unchanged count
— one prior "legacy fires when automate off" rewritten to expect
adapter dispatch + `libResult` populated) + 77 Playwright.

---

## Session 13 — 2026-04-19 (A6: route showModifierDialog path)

Routed the `options.showModifierDialog` path through the adapter.
`_canRouteAttackViaAdapter` dropped its `if
(options.showModifierDialog) return false` exclusion.
`_rollToHitViaAdapter` now threads `damageTerms` into
`DCCRoll.createRoll` (mirroring the legacy branch at `if
(options.showModifierDialog && weapon.system?.damage)`) so the
dialog can modify both attack and damage in one step. The
`attackRoll.options.modifiedDamageFormula` extraction already lived
in the adapter body unchanged, so the dialog's user-modified damage
formula flows through to `rollWeaponAttack` identically to legacy.
Dialog-modified attack-term values (e.g. user bumps a Modifier from
`+0` to `+2`) affect `attackRoll.total` but aren't reflected in
`libResult.bonuses`; `warnIfDivergent` surfaces the mismatch and
Foundry's total remains authoritative for chat. 878 Vitest (up
from 877 — +2) + 77 Playwright (unchanged count — legacy →
adapter rewrite).

---

## Session 14 — 2026-04-19 (A7: dice-bearing attack bonus / toHit)

Dropped the non-deed dice-bearing `attackBonus` / `toHit`
exclusion. `_canRouteAttackViaAdapter` now returns `true`
unconditionally — the gate is exhaustive; every runtime input
routes via adapter. `_rollToHitLegacy` is dead code pending D1
retirement. Patterns the deed parser can't handle (leading flat +
trailing die like `+2+1d3`, multiple dice like `+1d3+1d4`) flow
through the adapter with Foundry's Roll evaluating the dice
natively; `buildAttackInput` takes the leading integer via
`parseToHitBonus` for the lib's flat `attackBonus`, dropping
trailing dice — consistent with `hookTermsToBonuses`'s documented
drop of dice-bearing hook terms. `warnIfDivergent` surfaces the
mismatch; Foundry's `attackRoll.total` remains chat-authoritative.
Third of three gate-broadening slices (A5 / A6 / A7); **D1
unblocks as a mechanical collapse**. 878 Vitest (unchanged — two
prior "legacy fires" assertions rewritten to expect adapter) + 79
Playwright (77 + 2: dice-mid-string toHit routes via adapter;
two-handed weapon attack routes via adapter).

---

## Session 15 — 2026-04-19 (D1: retire `_rollToHitLegacy`)

Mechanical collapse: `_canRouteAttackViaAdapter` (always `true`
post-A7) and `_rollToHitLegacy` (dead code post-A7) both deleted;
`_rollToHitViaAdapter`'s body folded into `rollToHit`. The adapter
body is now the one and only path — Foundry's `DCCRoll.createRoll`
owns chat rendering + `dcc.modifyAttackRollTerms` verbatim, the
lib's `makeAttackRoll` owns classification + `appliedModifiers`.
`logDispatch('rollWeaponAttack', 'adapter', …)` stays (permanent
per Playwright adapter-dispatch spec). First Group-D retirement.
Downstream gates (`_canRouteDamageViaAdapter`,
`_canRouteCritViaAdapter`, `_canRouteFumbleViaAdapter`) are
unchanged — they still gate on `attackRollResult?.libResult` which
remains meaningful for the early-return `{rolled:false}` case +
hook-cancelled `proceed === false` return. 878 Vitest (unchanged —
test file header rewritten) + 80 Playwright (79 + 1 retirement
guard: `_rollToHitLegacy`, `_canRouteAttackViaAdapter`, and
`_rollToHitViaAdapter` are absent from the actor prototype).

---

## Session 16 — 2026-04-20 (D2 crit + fumble retirement)

Paired retirement: both `_canRouteCritViaAdapter` /
`_canRouteFumbleViaAdapter` gates only disqualified the `!automate`
case (the `libResult` check was defensive — `_rollCritical` /
`_rollFumble` are only reached when `attackRollResult.crit` /
`.fumble` is set, which post-D1 implies a populated `libResult`).
The `!automate` branch had no lib work to do (nothing rolls, so
nothing to feed `rollCritical` / `rollFumble`), so both gates + both
legacy bodies + both `_rollXxxViaAdapter` aliases collapsed into
unified single-path `_rollCritical` / `_rollFumble` methods that
branch on `ctx.automate` internally:
- `automate` on → build Foundry Roll, feed natural die into lib,
  surface `libCritResult` / `libFumbleResult` as before.
- `automate` off → render `[[/r formula # …]]` inline-roll template,
  no Roll evaluated, no lib call, no libXResult in the return shape.

`logDispatch('rollCritical', 'adapter', …)` + `logDispatch('rollFumble',
'adapter', …)` stay. Second Group-D retirement; damage (D2 damage
c+d residual) still awaits a gate-broadening slice before it can
collapse the same way. 874 Vitest (-4 net: deleted 4 gate-specific
tests + 1 "legacy fires when attack went legacy" test + rewrote 2
"legacy fires when automate off" tests as single-path inline-template
assertions, added 1 D2 retirement guard) + 81 Playwright (80 + 1:
D2 retirement guard asserts all six retired symbols absent from
actor prototype).

---

## Session 17 — 2026-04-20 (D2 damage sub-slice b: trailing bracket flavors)

First of the three D2 damage gate-broadening sub-slices before the
damage gate is exhaustive enough for collapse. Previously
`damageRollFormula.includes('[')` rejected every formula with a
bracket — blanket, regardless of position. That caught both per-term
flavor patterns (`1d6[fire]+1d6[cold]` — which genuinely need legacy
because the lib's `DamageInput` shape is single-typed) and trailing
single-bracket patterns (which only differ from plain formulas in
that the chat renderer should display the flavor label).

The gate now rejects only the real per-term case via
`/\d+d\d+\[/.test(...)` (die-immediately-followed-by-bracket —
matches legacy's `hasPerTermFlavors` branch), then peels any trailing
`[flavor]` via the new `peelTrailingFlavor` helper in
`module/adapter/damage-input.mjs` before calling `parseDamageFormula`.
`_rollDamageViaAdapter` uses the same peel to split the cleaned
formula + flavor before feeding them into `DCCRoll.createRoll`'s
`Compound` term's `formula` / `flavor` fields — identical shape to
what `_rollDamageLegacy` produces for the same input, so chat
rendering is unchanged.

879 Vitest (875 + 4 new) + 82 Playwright (81 + 1: trailing
bracket-flavor formula → routes via adapter). **Remaining D2 damage
sub-slices:** (a) unparseable formulas — extend parser or accept
lossless passthrough; (c) multi-type per-term formulas — STOP AND
ASK (lib's DamageInput is single-typed); (d) dice-bearing / cursed
`damageWeaponBonus` — STOP AND ASK.

---

## Session 18 — 2026-04-20 (D2 damage sub-slice a: unparseable passthrough)

Second of the D2 damage gate-broadening sub-slices. Previously
`parseDamageFormula(...) === null` rejected every formula the parser
couldn't digest. That caught real runtime cases: lance's
`doubleIfMounted` which produces `(1d8)*2+3`; homebrew weapons with
custom `config.damageOverride` formulas; exotic multi-die weapons
with native `1d8+1d4` shape. None have a lossless translation to the
lib's single-die-plus-flat-modifier `DamageInput` shape, so the gate
rejection forced them to legacy.

Sub-slice (a) drops that rejection + handles the parse-null case
with a lossless passthrough: the Foundry Roll still evaluates via
`DCCRoll.createRoll` (same anchor, same chat rendering), but the lib
call is skipped and `libDamageResult` is populated with a passthrough
shape — `{ damageDie: null, natural: null, baseDamage: null,
modifierDamage: null, total: damageRoll.total, breakdown: [],
passthrough: true }`. The `passthrough: true` marker tells downstream
consumers the breakdown is deliberately empty.

New `buildPassthroughDamageResult(damageRoll)` helper in
`module/adapter/damage-input.mjs`. Extracted `_buildLibDamageResult`
out of the via-adapter body so the parseable branch stays compact.
Gate simplified: removed `parseDamageFormula === null` rejection;
kept defensive `damageRollFormula.trim() === ''` rejection for
empty strings.

Only one D2 damage rejection now remains: the
`extractWeaponMagicBonus === null` branch for dice-bearing / cursed
`damageWeaponBonus` — sub-slice (d), STOP AND ASK. 882 Vitest (879
+ 3) + 83 Playwright (82 + 1: `(1d8)*2+3` via `damageOverride` routes
via adapter, both dispatch lines log `adapter`,
`dcc.libDamageResult.passthrough === true`).

---

## Session 19 — 2026-04-20 (D2 damage c + d combined: retire `_rollDamageLegacy`)

Combined slice for sub-slices (c) and (d): the session-start prompt
framed both as "STOP AND ASK" on the lib shape, but the
`@moonloch/dcc-core-lib@0.6.0` vendor sync (two commits prior) had
already extended `DamageInput`:
- `magicBonus` explicitly documented as "positive (magic) or negative
  (cursed) — surfaced in breakdown as `source: 'magic' | 'cursed'`".
- New `extraDamageDice[{count, die, flavor?, source?}]` slot covering
  both dice-bearing magic weapon bonuses (e.g. `+1d4`, `+1d6[fire]`)
  and multi-type per-term damage formulas (e.g.
  `1d6[fire]+1d6[cold]` splits as base `d6` + extra
  `{count:1, die:'d6', flavor:'cold'}`).

**Adapter changes:**
- New `parseMultiTypeFormula(formula)` helper tokenizes per-term
  flavored formulas into a base + `extras[]` array. First
  positive-sign dice term becomes the base; subsequent dice terms
  feed `extraDamageDice`. Integer terms sum into `modifier`.
- `extractWeaponMagicBonus` replaced by `parseWeaponMagicBonus` —
  new structured output: `{ kind: 'none' | 'flat' | 'dice', ... }`
  or `null` for unrecognized shapes. Positive flat → `magicBonus > 0`;
  negative flat (cursed) → `magicBonus < 0`; dice-bearing → single
  `extraDamageDice[]` entry. Unrecognized shapes fall to passthrough.
- `buildDamageInput(parsed, opts)` extended: negative `magicBonus`
  passes through unchanged (was dropped via `> 0` guard);
  `opts.extraDamageDice` passes through verbatim.
- `_rollDamage` consolidated into a single path. Rendering forks on
  `/\d+d\d+\[/`: per-term flavors → native `new Roll(formula,
  getRollData())`; else → `DCCRoll.createRoll([{type:'Compound',
  flavor, formula}])` with `peelTrailingFlavor` for single trailing
  bracket.
- New private `_structureDamageInput(weapon, formula, options)`
  helper picks between three structurers or returns `null` so the
  caller falls back to `buildPassthroughDamageResult`.
- `_buildLibDamageResult` now uses a sequenced-natural roller
  closure (`let idx = 0; naturals[idx++] ?? 0`) rather than a
  constant-returning closure, so multi-die damage formulas line up
  each lib `evaluateRoll` call with its corresponding
  `damageRoll.dice[i].total`.

**Collapse:**
- `_canRouteDamageViaAdapter`, `_rollDamageLegacy`, and
  `_rollDamageViaAdapter` all deleted.
- `logDispatch('rollDamage', 'adapter', ...)` stays.

883 Vitest (882 + 1 net) + 86 Playwright (83 + 3 net: multi-type,
cursed, dice-bearing, D2 damage retirement guard; rewrote
`multi-damage-type → legacy` as `→ adapter` with per-term-flavor
breakdown assertions). Third Group-D retirement; **all three D2
retirements complete** — Group D attack / crit / fumble / damage
retirements all done.

`rollDamage` single-path now has feature parity + lib-attributable
breakdown for every common DCC weapon shape. The only route that
still falls through to the passthrough shape is truly unparseable
formulas (mounted lance `doubleIfMounted`, homebrew `damageOverride`,
mixed flat+dice bonuses like `+1+1d4`) — they route via adapter but
with `libDamageResult.passthrough: true` + empty breakdown.

---

## Cruft slices (Group C)

### C3 — 2026-04-20 (halfling i18n-localize dispatch audit)

Closed the halfling i18n-localize dispatch remnants. The historical
bug (`actor.js:1725` per `ARCHITECTURE_REIMAGINED.md §2`) had
`actor.system.class.className === game.i18n.localize('DCC.Halfling')`
which silently breaks in non-English locales. That site was fixed
pre-refactor; C3's audit confirmed **zero** residual `X ===
game.i18n.localize(...)` dispatch patterns in `module/` source. The
single match in `module/migrations.js:235` is the legitimate
inverse-direction helper (localize on the LEFT — maps legacy
localized className data back to internal class IDs during world
migration). New vitest `class-dispatch-i18n-guard.test.js` greps
source for the anti-pattern and fails the suite if it reappears.
`EXTENSION_API.md` gained a "Conventions for modules reading actor
data" section documenting the `system.details.sheetClass` →
canonical English ID rule. 875 Vitest (was 874, +1 new guard).
Playwright unchanged — pure-source-audit slice.

### C1 — 2026-04-20 (retire `critText` / `fumbleText` shims) — also Session 20

Three lines in `module/actor.js` (2 in `rollWeaponAttack`'s main
messageData block + 1 in `rollCritical`'s standalone messageData
block) emitted `critText: critResult` + `fumbleText: fumbleResult`
as "Legacy name for dcc-qol compatibility" aliases of the canonical
`critResult` / `fumbleResult` fields. Audit (`module/`, `templates/`,
schemas, vitest, Playwright, sibling modules) confirmed only one
external live consumer: `dcc-qol/scripts/hooks/attackRollHooks.js:283-284`,
which reads `messageData.system.critText` / `fumbleText` verbatim.
XCC's `critText` / `fumbleText` occurrences are unrelated local
variable names.

Shim deletion: 3 lines dropped from `module/actor.js`; no other
DCC-side changes. dcc-qol fix (2-line rename:
`critText`→`critResult`, `fumbleText`→`fumbleResult`) documented
as a sibling-module migration recipe in `EXTENSION_API.md` for the
dcc-qol maintainer to land on their schedule. Timing constraint:
pre-shim-removal dcc-qol versions keep working against DCC releases
that still emit the shims; after the shim removal ships, a
still-reading-`critText` dcc-qol would silently display empty
strings in the "automated crit/fumble details" chat-card section.

883 Vitest (unchanged — no vitest referenced the shim fields) + 87
Playwright (86 + 1 regression guard: `C1 cruft: critText/fumbleText
shims retired from rollWeaponAttack messageData` hooks
`dcc.rollWeaponAttack`, captures `messageData.system`, asserts
`'critResult' in system` + `'fumbleResult' in system` stay `true`
while `'critText' in system` + `'fumbleText' in system` flip to
`false`).

### C2 — 2026-04-23 (prune pre-V14 migrations)

V14 landed at DCC `0.66.0` (commit `86eb440`, 2025-12-04); the
V13/ApplicationV2 upgrade was `0.60.0`. The floor Tim confirmed for
this slice is `0.66` — V14-only systems never need to migrate worlds
below that point because a pre-V14 DCC release is required to open
them anyway.

Deleted all seven version-gated branches from `module/migrations.js`
(3 in `migrateActorData`: `<= 0.17` cleric disapproval flags,
`<= 0.50` attackHitBonus copy, `< 0.65` speed.base; 4 in
`migrateItemData`: `<= 0.11` equipped, `<= 0.21` inheritActionDie,
`<= 0.22` castingMode wizard, `< 0.51` damageOverride). Both
helpers dropped their now-unused `currentVersion` reads.

**Data-driven checks stay** — `luckyRoll` → `birthAugur` backfill,
default alignment, `critRange` / `disapproval` string→number
coercion, the `sheetClass`-from-`className` legitimate
inverse-direction helper (protected by C3's
`class-dispatch-i18n-guard.test.js`), and the V14 AE numeric-mode →
string-type conversion.

Added explicit lower-bound guard in `module/dcc.js`'s
`checkMigrations`: a new `MINIMUM_SUPPORTED_VERSION = 0.66` constant;
if `currentVersion !== null && currentVersion !== 0 && currentVersion
< MINIMUM_SUPPORTED_VERSION`, we emit a permanent
`ui.notifications.error` (new i18n key
`DCC.MigrationUnsupportedVersion`) directing the user to open the
world in a pre-V14 DCC release (0.65.x) first — and bail out before
calling `migrations.migrateWorld`. `NEEDS_MIGRATION_VERSION` stays
at `0.67`.

i18n key translated across all 7 languages (cn/de/es/fr/it/pl + en
source); `npm run compare-lang` clean. New regression guard
`module/__tests__/migrations-version-gate-guard.test.js` greps
`migrations.js` for any `currentVersion` numeric comparison against
a literal below `0.66` and fails if one reappears — mirrors C3's
pattern.

**Post-review hardening (same session, after automated review
flagged two issues):**

1. **Fresh-world false-positive (P0).** The setting's registered
   default at `module/settings.js:20` is `default: 0` (not `null`),
   so `game.settings.get` returns `0` for a brand-new world. The
   initial guard used `currentVersion !== null && currentVersion <
   MINIMUM_SUPPORTED_VERSION`, which fires on `0`. Fixed by treating
   `0` and `null` equivalently as "fresh / never migrated" and only
   blocking non-zero pre-0.66 versions.
2. **Regex gap (P1).** The anti-pattern regex used
   `(?:<=?|>=?|==|!=)` which misses strict-equality operators.
   Tightened to `(?:<=?|>=?|===?|!==?)` and added positive-sample +
   negative-sample meta-tests so the regex itself is tested.

Beyond the fixes: the policy decision was extracted into a pure
`classifyMigrationDecision(currentVersion)` helper in
`migrations.js` (returns `'skip' | 'block' | 'run'`); the two
version constants are now exported from the same module as the
single source of truth. `checkMigrations` in `dcc.js` is a thin
orchestrator. That split enabled behavioral unit tests (8 cases
covering fresh / pre-V14 / V14-floor / ceiling). The notification's
interpolated values use `.toFixed(2)` so the decimal separator
doesn't drift in locales that format numbers with a comma. +1
Playwright assertion: a live v14 world boots past the floor without
emitting a `DCC.MigrationUnsupportedVersion` error.

Tests: 917 Vitest (891 pre-slice + 8 behavioral classifier + 11
positive-regex + 6 negative-regex + 1 file-scan = 26 net new).
95 Playwright e2e.
