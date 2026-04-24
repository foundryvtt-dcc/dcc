# Slice Backlog — `refactor/dcc-core-lib-adapter`

> Executable worklist for autonomous batch execution. Each slice is
> self-contained: scope, files, tests, stop conditions, and commit
> format. A fresh Claude session reading `docs/01-session-start.md` +
> this file should be able to execute the top N slices without human
> synthesis.

---

## How to consume

**Batch-slice mode:** one prompt = one batch of 2–3 slices from the top
of the backlog. Session starts fresh (`/clear`), reads
`docs/01-session-start.md` + this file, executes top-of-queue serially
(or in parallel where marked ✅ parallel-safe), commits each slice
independently under the auto-commit authorization in `CLAUDE.md`,
reports a single end-of-batch summary.

**Commit format:** `feat(adapter): Phase <N> session <M> — <slice title>`
matches established history. For retirement and cruft slices,
`refactor(adapter):` or `chore(cruft):` as appropriate.

**Every slice ends with:**
1. Full Vitest suite green (`npm test`)
2. Full Playwright e2e suite green (`cd browser-tests/e2e && npm test`
   — not just the dispatch spec; see `CLAUDE.md` refactor-slice rules)
3. At least one new browser-test assertion exercising the slice
4. `docs/00-progress.md` entry for the slice
5. `docs/01-session-start.md` status line updated
6. This file's slice marked done and moved to the Completed section

## Stop conditions (pause and ask)

- Any test goes red and fix requires non-mechanical investigation
  (>15 min or >1 debugging rabbit-hole)
- Gate-logic change is *semantic* (new branch kind) rather than
  *extension* (another variant of an existing branch)
- Any Foundry-facing API shape would change (`game.dcc.*` exports,
  `DCCActor` public methods, hook signatures, documented
  `CONFIG.DCC.*` paths) — see `ARCHITECTURE_REIMAGINED.md §8.6` and
  `EXTENSION_API.md`
- Any sibling module (`dcc-qol`, `xcc`, `mcc-classes`,
  `dcc-crawl-classes`) would need a code change
- Slice scope balloons past its backlog entry — don't silently expand
- Pre-commit hook rewrites code in ways that warrant review
- RAW-divergence decision surfaces (see Group D patron-taint entry)

## Retirement principle

Per `ARCHITECTURE_REIMAGINED.md §8.6`: Foundry-facing API stays as thin
wrappers indefinitely; internal `_xxxLegacy` branches and direct-reimpl
methods retire once adapter coverage is exhaustive for their call site.
Retirement is silent — no external consumer knows or cares.

---

## Active queue

### Group A — Phase 3 attack-gate completion (serial; `module/actor.js` conflicts)

These broaden the attack-dispatcher gate until coverage is exhaustive
for simplest-weapon, two-weapon, backstab, and deed-die paths.
Completion unblocks Group D retirement slices. Must serialize — all
touch `module/actor.js` dispatchers.

#### ~~A2. Backstab attack + damage through adapter~~ — **DONE 2026-04-19**
Landed as Phase 3 session 9 after the `dcc-core-lib@0.4.1` sync.
Both attack + damage gates dropped their `options.backstab → false`
exclusions; `AttackInput.isBackstab: true` drives the lib's auto-crit;
Table 1-9 attack bonus flows as a `class:backstab` RollBonus;
`libResult.critSource: 'backstab-auto'` surfaces for downstream
crit-table routing. The lib's new RAW model replaced the multiplier
approach with alternate damage dies on backstab-friendly weapons
(dagger, blackjack, blowgun, garrote) — no damage-side translation
needed since `rollWeaponAttack` already swaps
`damageRollFormula = weapon.system.backstabDamage` pre-gate.

#### ~~A3. Deed-die adapter route (warrior + dwarf)~~ — **DONE 2026-04-19**
Landed as Phase 3 session 10. New `parseDeedAttackBonus` helper in
`module/adapter/attack-input.mjs` recognizes deed-die-bearing toHit /
attackBonus strings (single die at start + any number of flat mods);
`buildAttackInput` populates `AttackInput.deedDie` (lib normalized:
`d3`) and the flat `attackBonus` separately. `_canRouteAttackViaAdapter`
relaxed to allow dice that match the parser; mismatched / mixed-dice /
weapon-side dice patterns still fall to legacy.
`_rollToHitViaAdapter` builds a sequenced roller closure that returns
the d20 first then the deed natural — Foundry's existing Compound term
already evaluates both dice together. Deed-die return fields populate
identically to legacy (`deedDieFormula`, `deedDieRollResult`,
`deedDieRoll`, `deedSucceed`); chat flag `libResult` gains `deedDie`,
`deedNatural`, `deedSuccess`. Lib's `onDeedAttempt` event fires.
6 new vitest tests (24 total in `adapter-weapon-attack.test.js`) +
2 new Playwright cases (warrior dispatch + libResult shape).

#### ~~A4. Two-weapon fighting through adapter~~ — **DONE 2026-04-19**
Landed as Phase 3 session 11. Far simpler than the backlog entry
suggested — turned out two-weapon attacks are NOT paired calls;
each weapon's `rollWeaponAttack` is invoked independently with the
weapon's `twoWeaponPrimary` / `twoWeaponSecondary` flag. The chat
rendering already produces one message per call (no shape change
needed). The penalty computation lives in
`item.js:prepareBaseData` — a dice-chain reduction on
`weapon.system.actionDie` plus complex crit-range adjustments per
agility tier. We dropped the gate exclusion; the bumped action die
flows through naturally and `normalizeLibDie` strips the bracket
flavor tag. **Lib-vs-rules design choice:** `getTwoWeaponPenalty`
returns flat `-1`/`-2` (different ruleset than DCC RAW); we
deliberately do NOT set `AttackInput.twoWeaponPenalty` — it
would double-count with the dice-chain reduction. New chat-flag
fields `isTwoWeaponPrimary`, `isTwoWeaponSecondary` for downstream
attribution. 1 new vitest test (added) + 1 rewritten ("legacy
fires" → "adapter fires") + 2 new Playwright cases.

#### ~~A5. Drop `automateDamageFumblesCrits` gate check~~ — **DONE 2026-04-19**
Landed as Phase 3 session 12. That setting gates whether
`rollWeaponAttack` dispatches downstream damage / crit / fumble
rolls, not the attack-side adapter's correctness. Downstream gates
(`_canRouteDamageViaAdapter`, `_canRouteCritViaAdapter`,
`_canRouteFumbleViaAdapter`) already check `ctx.automate`
defensively; with automate off, the attack routes via adapter
(populating `dcc.libResult`) while downstream stays on the inline-
roll-text fallback. One prior vitest + one prior Playwright
"legacy fires when automate off" assertion rewritten to expect
adapter dispatch.

#### ~~A6. Route `options.showModifierDialog: true` through adapter~~ — **DONE 2026-04-19**
Landed as Phase 3 session 13. `_canRouteAttackViaAdapter` dropped
the `showModifierDialog` exclusion; `_rollToHitViaAdapter`
threads `damageTerms` into `DCCRoll.createRoll` (mirroring the
legacy branch at `if (options.showModifierDialog &&
weapon.system?.damage)`). The dialog can modify attack + damage in
one step; `attackRoll.options.modifiedDamageFormula` extraction
already lived in the adapter body unchanged. Dialog-modified
attack-term values affect `attackRoll.total` but aren't reflected
in `libResult.bonuses`; `warnIfDivergent` surfaces the mismatch
and Foundry's total remains authoritative for chat.

#### ~~A7. Route dice-bearing attack bonus / toHit through adapter~~ — **DONE 2026-04-19**
Landed as Phase 3 session 14. `_canRouteAttackViaAdapter` now
returns `true` unconditionally — the gate is exhaustive.
Dice-bearing `attackBonus` / `toHit` patterns that the deed
parser can't handle (leading flat + trailing die, multiple dice)
flow through the adapter with Foundry's Roll evaluating the dice
natively; `buildAttackInput` takes the leading integer via
`parseToHitBonus`, dropping trailing dice — consistent with
`hookTermsToBonuses`'s documented drop of dice-bearing hook
terms. `warnIfDivergent` surfaces the mismatch; Foundry's
`attackRoll.total` remains chat-authoritative.

**Exit criterion for Group A: MET 2026-04-19 for A1–A7.**
`_canRouteAttackViaAdapter` returns `true` unconditionally —
the gate is exhaustive. `_rollToHitLegacy` is dead code; **D1
unblocks as a mechanical collapse**.

---

### Group B — Phase 3 XCC-win deliverable (✅ parallel-safe with Group A)

---

### Group C — Parallel cruft removal (✅ parallel-safe, independent)

Cheap Phase 7 wins per §2.7. Each is self-contained, touches files
unrelated to adapter work, and benefits from landing now rather than
waiting for Phase 7.

#### ~~C1. Retire `critText` / `fumbleText` compatibility shims~~ — **DONE 2026-04-20**
Landed as Phase 3 session 20 (chore-cruft slice). Audit found
three emit sites in `module/actor.js` (2 in `rollWeaponAttack`'s
messageData, 1 in `rollCritical`'s standalone messageData) and
exactly one live external consumer:
`dcc-qol/scripts/hooks/attackRollHooks.js:283-284`, which reads
`messageData.system.critText` / `fumbleText` verbatim. XCC's
`critText` / `fumbleText` occurrences are unrelated local variable
names. `module/chat.js`'s uses are also local variable names
reading from the canonical `message.system.critResult` /
`.fumbleResult`. The coordinated fix was resolved by Tim's
explicit direction: land the DCC shim removal + document the
dcc-qol migration recipe; dcc-qol ships the rename on its own
schedule. EXTENSION_API.md's sibling-module migration recipes
section gained a dcc-qol entry spelling out the 2-line rename
(`critText`→`critResult`, `fumbleText`→`fumbleResult`) plus the
timing constraint (pre-shim-removal dcc-qol versions keep
working; post-shim-removal dcc-qol needs the rename to avoid
empty crit/fumble details). +1 Playwright regression guard
(`C1 cruft: critText/fumbleText shims retired from
rollWeaponAttack messageData`) hooks `dcc.rollWeaponAttack`,
captures the `messageData.system` field presence, and asserts
the shims are absent while the canonical fields remain. 883
Vitest (unchanged — no vitest referenced the shim fields) +
87 Playwright (was 86, +1 regression guard).

#### ~~C2. Prune pre-V14 migrations~~ — **DONE 2026-04-23**
Landed as a chore(cruft) slice. V14 landed at DCC `0.66.0`
(`86eb440`, 2025-12-04); `0.66` is the confirmed supported floor.
Seven version-gated branches deleted from `module/migrations.js`
(3 actor: `<= 0.17` cleric disapproval flags, `<= 0.50`
attackHitBonus copy, `< 0.65` speed.base; 4 item: `<= 0.11`
equipped, `<= 0.21` inheritActionDie, `<= 0.22` castingMode wizard,
`< 0.51` damageOverride). Both helpers dropped their now-unused
`currentVersion` reads. Data-driven branches stay: `luckyRoll` →
`birthAugur`, default alignment, `critRange` / `disapproval`
string→number, `sheetClass`-from-`className` (the legitimate
inverse-direction helper protected by C3's guard), V14 AE
numeric-mode → string-type conversion. New explicit lower-bound
guard in `module/dcc.js`'s `checkMigrations`:
`MINIMUM_SUPPORTED_VERSION = 0.66`; pre-0.66 worlds trigger a
permanent `ui.notifications.error` (new i18n key
`DCC.MigrationUnsupportedVersion`, translated cn/de/es/fr/it/pl)
and bail before `migrations.migrateWorld` so they can't silently
skip deleted migrations. `NEEDS_MIGRATION_VERSION` stays at `0.67`.
New regression guard `migrations-version-gate-guard.test.js`
greps `migrations.js` for `currentVersion` comparisons against
literals below `0.66` (mirrors C3's pattern).

#### ~~C3. Delete halfling i18n-localize dispatch remnants~~ — **DONE 2026-04-20**
Landed as a chore(cruft) slice. Audit confirmed zero residual
`X === game.i18n.localize('DCC.<Class>')` dispatch patterns in
`module/` source (the single match in `module/migrations.js:235`
is the legitimate inverse-direction helper that maps localized
legacy `className` data back to internal class IDs during world
migration). EXTENSION_API.md gained a "Conventions for modules
reading actor data" section documenting the
`system.details.sheetClass` → canonical English ID rule, with the
anti-pattern example and the regression-guard reference. New
vitest `class-dispatch-i18n-guard.test.js` greps module source for
the anti-pattern and fails the suite if it reappears.

---

### Group D — Legacy-branch retirements

Per the §8.6 retirement principle. D1 landed 2026-04-19; D2+ remain.

#### ~~D1. Retire `_rollToHitLegacy`~~ — **DONE 2026-04-19**
Landed as Phase 3 session 15. Mechanical collapse:
`_canRouteAttackViaAdapter` (always `true` post-A7) and
`_rollToHitLegacy` (dead code post-A7) deleted;
`_rollToHitViaAdapter`'s body folded into `rollToHit`.
`logDispatch('rollWeaponAttack', 'adapter', …)` stays (permanent
per Playwright adapter-dispatch spec). Downstream gates still
check `attackRollResult?.libResult`, which remains meaningful for
the early-return `{rolled:false}` path + hook-cancelled
`proceed === false` path. +1 new Playwright regression guard
asserting `_rollToHitLegacy` / `_canRouteAttackViaAdapter` /
`_rollToHitViaAdapter` are absent from the actor prototype.

#### D2 crit + fumble. ~~Retire `_rollCriticalLegacy` + `_rollFumbleLegacy`~~ — **DONE 2026-04-20**
Landed as Phase 3 session 16. Paired collapse: both gates
(`_canRouteCritViaAdapter` / `_canRouteFumbleViaAdapter`) were
defensive — `_rollCritical` / `_rollFumble` are only reached when
`attackRollResult.crit` / `.fumble` is set, which post-D1 implies a
populated `libResult`. The real non-adapter branch was `!automate`,
and it had no lib work (nothing rolls, so nothing to feed the lib).
Both legacy bodies + both gates + both `_rollXxxViaAdapter` aliases
folded into unified `_rollCritical` / `_rollFumble` methods that
branch on `ctx.automate` internally: automate on → lib call +
`libXResult` populated; automate off → inline-roll template, no
lib, no `libXResult` in the return shape. +1 Playwright regression
guard + rewritten vitest coverage (-4 gate tests + -1 "legacy
fires" test + rewrote 2 "legacy fires when automate off" tests as
single-path inline-template assertions, +1 retirement guard).

#### ~~D2 damage. Retire `_rollDamageLegacy`~~ — **DONE 2026-04-20**
Landed as Phase 3 session 19. Combined slice for sub-slices (c)
and (d): `@moonloch/dcc-core-lib@0.6.0` had already extended
`DamageInput` (negative `magicBonus` for cursed + new
`extraDamageDice[{count, die, flavor?, source?}]` for dice-bearing
+ multi-type per-term) — the session-start "STOP AND ASK" framing
was resolved lib-side. Adapter changes: new `parseMultiTypeFormula`
splits `1d6[fire]+1d6[cold]` into base + extras; `parseWeaponMagicBonus`
replaces `extractWeaponMagicBonus` with structured
`{ kind: 'none' | 'flat' | 'dice', ... }`; `buildDamageInput`
extended for negative `magicBonus` + `extraDamageDice` passthrough.
`_rollDamage` collapsed to single path with per-term-flavor native
`new Roll` branching + sequenced-natural roller closure for
multi-die. Third Group-D retirement; **Group D attack /
crit / fumble / damage retirements all complete**. Vitest 883
(was 882, +1 net). Playwright 86 (was 83, +3 net: multi-type,
cursed, dice-bearing, D2 damage retirement guard; rewrote
`multi-damage-type → legacy` test).

#### ~~D3a. Patron-taint RAW alignment + retire `_runLegacyPatronTaint`.~~ **CLOSED 2026-04-24 (session 21)**.
Lib PR #6 / `dcc-core-lib@0.7.0` landed the two RAW triggers
(creeping chance + result-table-entry detection) plus the natural-1-
forces-row-1 rule; adapter wired `onPatronTaint` + persistence of
`newPatronTaintChance`; `_runLegacyPatronTaint` deleted. The
original D3 scope correctly noted the trigger ambiguity; D3a
resolved it in favor of RAW after reviewing the rulebook text +
example patron-spell result tables (Bobugbubilz's Tadpole
Transformation roll 1). 917 Vitest + 97 Playwright green.

#### ~~D3b-α. Per-patron taint manifestation table loader (adapter).~~ **CLOSED 2026-04-24 (session 22)**.
Investigation surfaced that 10 patron-taint `RollTable` documents
were already authored as compendium content:
`dcc-core-book/packs/dcc-core-spell-side-effect-tables` ships Azi
Dahaka / Bobugbubilz / Sezrekan / the King of Elfland / Three
Fates; `xcc-core-book/packs/xcc-core-spell-side-effect-tables`
ships Barzodi / Circe / Medea / Prometheus Firebringer / The
Amazing Rando. No content authoring needed — just a loader. New
`loadPatronTaintTable(actor)` in `module/adapter/spell-input.mjs`
(mirror of `loadDisapprovalTable`) walks `CONFIG.DCC.patronTaintPacks`
(a `TablePackManager` seeded with both packs in `module/dcc.js`)
matching `Patron Taint: ${actor.system.class.patron}` with a
case-insensitive tail fallback ("The King of Elfland" →
"the King of Elfland"), falls back to world tables. Loader
threaded into `_castViaCalculateSpellCheck`; paired `1d6`
manifestation pre-roll extends the two-pass deterministic roller
when a table is present. 924 Vitest (+7 new: 5 loader paths +
1 full acquisition integration + 1 existing-test restructure) +
98 Playwright (+1 new: compendium manifestation reaches chat).
Sibling-module packs can push `addPack(…)` on init.

#### ~~D3b-β. Mirror core patron-taint tables into `dcc-official-data` source.~~ **AUTHORED 2026-04-24 (session 22 follow-on), awaiting commit in the `dcc-official-data` repo.**
New `src/spells/patron-taints.ts` + a 3-line re-export in
`src/spells/index.ts` mirror the 5 core `dcc-core-book`
manifestation tables (Azi Dahaka, Bobugbubilz, Sezrekan, the King
of Elfland, Three Fates) as `PatronTaintTable` records keyed by
slug. Foundry's `[[/roll XdY]]` markup stripped back to plain
`[XdY]` dice notation; `<br />` and whitespace collapsed. New
`getPatronTaintTable(patron: string)` lookup helper (case-
insensitive + whitespace-tolerant). `tsc --noEmit` clean. No DCC-
system-side change needed — `dcc-core-book`'s compendium
RollTable documents remain the runtime source via
`CONFIG.DCC.patronTaintPacks`. Tim to commit on the
`dcc-official-data` side (auto-commit authorization scoped to the
DCC refactor branch doesn't extend to other repos). XCC has no
equivalent `xcc-official-data` source repo — the `xcc-core-book`
compendium JSON IS the source of truth there, so no β equivalent
for XCC.

#### ~~D3b-γ. Sibling-pack audit for patron-taint content.~~ **CLOSED 2026-04-24 (session 22 follow-on)**.
Audited both sibling modules:
- `mcc-classes` ships no compendium packs (class code only).
- `dcc-crawl-classes/packs/` contains no patron-taint RollTable
  JSON files.

No additional packs to register. The default
`CONFIG.DCC.patronTaintPacks` seed in `module/dcc.js` (core + xcc
side-effect packs) covers the full ecosystem. If a future sibling
module ships patron content, it can push its own pack via
`CONFIG.DCC.patronTaintPacks.addPack(…)` on init — documented in
`EXTENSION_API.md` alongside the existing `disapprovalPacks`
precedent when relevant.

#### D3c. Retire `SpellFumbleResult.patronTaint` flag + fumble-entry tag convention
- **Scope:** After D3a, the lib still emits
  `SpellFumbleResult.patronTaint: boolean` parsed from any fumble-
  table entry tagged `effect.type === 'patron-taint'` or
  `effect.data.patronTaint === true`. Nothing in the orchestration
  consumes this flag — it's dead in practice. Removal is a small
  lib-side breaking change (remove flag from result shape + remove
  tag parsing in `rollSpellFumble` / `rollSpellFumbleWithModifier`).
- **Stop-and-ask trigger:** audit sibling modules for any consumer
  reading `SpellFumbleResult.patronTaint` (none expected, but
  verify) AND audit `dcc-core-book` / `xcc-core-book` compendium
  fumble tables for any entry tagged with the taint effect (strip
  if found — the semantic never matched RAW).
- **Commit:** single lib PR + vendor sync + CHANGELOG breaking-
  change entry. No DCC-side adapter work needed.

#### D4. Fold direct-reimpl spell-check branches
- **Scope:** `rollSpellCheck` dispatcher has direct-reimpl branches
  for routes the adapter's two-pass pipeline didn't cover at Phase 2
  close (pre-built Roll + RollTable, forceCrit, skill-table spells
  like Turn Unholy). Evaluate which can route through the adapter
  now; retire the rest only after their specific capability lands.
- **Stop-and-ask trigger:** each branch evaluated separately —
  pause and ask for each.

---

### Group E — Vertical slice for XCC/MCC validation (after Groups A + B)

Once the attack-side pattern is proven (Group A) and the first XCC
hack is closed (Group B), pick ONE vertical to take all the way
through Phases 4 → 5 → 6 for a single capability. Demonstrates the
full-stack approach works end-to-end with a real sibling consumer.

**Candidates (pick one at slice time):**

1. **Halfling vertical** — slim halfling-specific fields out of
   Player schema (Phase 4 slice), add halfling-tab sheet composition
   (Phase 5 slice), register halfling as a class-mixin consumed by
   `mcc-classes`' halfling equivalent. Most architecturally
   informative — touches data model + sheet composition + mixin API.
2. **Mercurial-magic vertical** — fix the XCC "2 tables vs 1"
   problem (§2.4) by making mercurial table lookup variant-aware via
   a Phase 6-style variant config. Small, targeted XCC win.
3. **Single-class homebrew vertical** — pick a fan-made class (e.g.,
   from `dcc-crawl-classes`), rewire it as a class-mixin + sheet-part
   registration. Validates §2.8 homebrew extensibility.

**This entry is a placeholder** — pick the specific vertical via
explicit user decision before drafting its concrete slice list.

---

## Completed slices

Move entries here as they land; keep the active queue scannable.

### Phase 3 sessions 1–9 (2026-04-18 → 2026-04-19)

See `docs/00-progress.md` for details. Summary:
- Phase 3 session 1: Spellburn dialog-adapter
- Phase 3 session 2: first attack-migration slice (simplest happy-path)
- Phase 3 session 3: hook-translation bridge (`hookTermsToBonuses`)
- Phase 3 session 4: long-range dice-chain translation (`normalizeLibDie`)
- Phase 3 session 5: first damage-migration slice (simplest happy-path)
- Phase 3 session 6: crit + fumble migration (both adapter routes)
- Phase 3 session 7: NPC damage-bonus adjustment threaded through the
  adapter as a `RollBonus` so the lib breakdown attributes it correctly
  (was previously misattributed to Strength)
- Phase 3 session 8: PC magic weapon bonus (`damageWeaponBonus: '+N'`)
  threaded through the adapter as `DamageInput.magicBonus` so the lib
  breakdown carries a separate `source: 'magic'` entry; parser extended
  to sum multiple flat modifiers, new `extractWeaponMagicBonus` helper
  gates dice-bearing / cursed bonuses to legacy
- Phase 3 session 9: thief backstab through the adapter. Followed the
  `dcc-core-lib@0.4.1` sync (backstab fix + post-review API cleanup);
  `AttackInput.isBackstab: true` drives lib auto-crit; Table 1-9 bonus
  flows as a `class:backstab` RollBonus; `libResult.critSource`
  surfaced on chat flags; `libResult.bonuses` expanded to carry the
  full bonus list (not just hook-added).
- Phase 3 session 10 (A3): warrior / dwarf deed-die adapter route.
- Phase 3 session 11 (A4): two-weapon fighting adapter route (closes
  Group A's high-traffic paths).
- Phase 3 session 12 (A5): dropped `automateDamageFumblesCrits`
  attack-gate check. Downstream gates already check automate; attack-
  side adapter correctness is independent. First of three gate-
  broadening slices before D1 becomes a mechanical collapse.
- Phase 3 session 13 (A6): routed `options.showModifierDialog`
  through adapter. `damageTerms` thread into `DCCRoll.createRoll`
  (mirrors legacy when `showModifierDialog && weapon.system?.damage`).
  `modifiedDamageFormula` extraction already lived in the adapter
  body unchanged. `warnIfDivergent` handles user-modified term
  values; Foundry's total authoritative for chat.
- Phase 3 session 14 (A7): dropped non-deed dice-bearing
  `attackBonus` / `toHit` exclusion. `_canRouteAttackViaAdapter`
  returns `true` unconditionally — the gate is exhaustive.
  Patterns the deed parser can't handle flow through with Foundry
  evaluating the dice natively; lib sees the flat leading
  integer. `_rollToHitLegacy` is dead code pending D1. Added
  two-handed weapon attack Playwright coverage along the way.
- Phase 3 session 15 (D1): retired `_rollToHitLegacy`. Mechanical
  collapse — gate (`_canRouteAttackViaAdapter`, always `true`
  post-A7) and legacy body both deleted; `_rollToHitViaAdapter`'s
  body folded into `rollToHit`. First Group-D retirement. +1
  Playwright regression guard asserting the retired methods are
  absent from the actor prototype.
- Phase 3 session 19 (D2 damage c + d, combined slice): retired
  `_rollDamageLegacy` + `_canRouteDamageViaAdapter` +
  `_rollDamageViaAdapter`. Session-start prompt framed
  sub-slices (c) + (d) as "STOP AND ASK" on the lib shape, but
  `@moonloch/dcc-core-lib@0.6.0` had already extended
  `DamageInput` — explicit negative `magicBonus` (cursed) + new
  `extraDamageDice[{count, die, flavor?, source?}]` for
  dice-bearing magic + multi-type per-term. Adapter caught up:
  new `parseMultiTypeFormula` + `parseWeaponMagicBonus` (replaces
  `extractWeaponMagicBonus`) + extended `buildDamageInput`;
  `_rollDamage` collapsed to single path with per-term-flavor
  native `new Roll` branching. **All three D2 retirements are
  now complete.** 883 Vitest + 86 Playwright e2e pass.
- Phase 3 session 18 (D2 damage sub-slice a): accepted unparseable
  formulas as lossless passthrough. New
  `buildPassthroughDamageResult(damageRoll)` helper in
  `module/adapter/damage-input.mjs` produces
  `libDamageResult: { total, breakdown: [], passthrough: true,
  damageDie: null, natural: null, baseDamage: null, modifierDamage:
  null }` for formulas the parser can't digest. Gate drops the
  `parseDamageFormula === null` rejection; `_rollDamageViaAdapter`
  branches on parse result and skips the lib call for passthrough
  inputs. Lance `(1d8)*2+3`, multi-die `1d8+1d4`, custom
  `damageOverride` homebrew formulas now all route via adapter.
  `_buildLibDamageResult` extracted from the via-adapter body so
  the parseable branch stays compact. 882 Vitest tests pass (was
  879, +3) + 83 Playwright e2e (was 82, +1). Only sub-slice (d)
  dice-bearing / cursed magic bonuses remains before damage-gate
  exhaustiveness + D2 damage retirement — STOP AND ASK because
  lib's `DamageInput.magicBonus` is a non-negative integer.
- Phase 3 session 17 (D2 damage sub-slice b): broadened damage gate
  to accept trailing bracket-flavor formulas (`1d6+2[Slashing]`,
  `2d4-1[Piercing]`). New `peelTrailingFlavor` helper in
  `module/adapter/damage-input.mjs` splits the trailing `[...]`
  label before parsing; `_rollDamageViaAdapter` plumbs the flavor
  into `DCCRoll.createRoll`'s `Compound` term for chat-rendering
  parity with legacy. Gate now rejects only the genuine per-term
  case via `/\d+d\d+\[/` (die-immediately-followed-by-bracket —
  matches legacy's `hasPerTermFlavors` branch). 879 Vitest tests
  pass (was 875, +4) + 82 Playwright e2e (was 81, +1). Three more
  D2 damage sub-slices remain before retirement: (a) unparseable
  formulas, (c) multi-type per-term flavors — STOP AND ASK, (d)
  dice-bearing / cursed magic bonuses — STOP AND ASK.
- Phase 3 session 16 (D2 crit + fumble): retired
  `_rollCriticalLegacy` + `_rollFumbleLegacy` together. Both
  gates were defensive-only (the real non-adapter branch was
  `!automate`, and it had no lib work since nothing rolls); both
  legacy bodies + both gates + both `_rollXxxViaAdapter` aliases
  folded into unified `_rollCritical` / `_rollFumble` methods
  that branch on `ctx.automate` internally. Second Group-D
  retirement. +1 Playwright regression guard covering all six
  retired symbols.

### Docs slices

- B2 (2026-04-19): `EXTENSION_API.md` cross-referenced against
  `ARCHITECTURE_REIMAGINED.md §2.8–§2.12`; pain-point columns added
  to both surface tables; §2.12 Foundry-smelling-surface contract
  stated explicitly; recommendations grew schema-shape + future-hook
  guidance.

### Cruft slices

- C1 (2026-04-20): retired `critText` / `fumbleText` compatibility
  shims on `rollWeaponAttack` / `rollCritical` messageData.
  Canonical `critResult` / `fumbleResult` fields stay as the sole
  emit. Only external consumer was
  `dcc-qol/scripts/hooks/attackRollHooks.js:283-284`; a 2-line
  rename (`critText`→`critResult`, `fumbleText`→`fumbleResult`)
  documented as a sibling-module migration recipe in
  `EXTENSION_API.md`. +1 Playwright regression guard hooking
  `dcc.rollWeaponAttack` and asserting the shims are absent from
  `messageData.system`.

### Extension API slices

- B1 (2026-04-19): `game.dcc.registerItemSheet(types, SheetClass,
  options?)` shipped as stable extension API. Closes §2.5 / §2.11
  pain points. Helper at `module/extension-api.mjs`; DCC's own
  `DCCItemSheet` registration migrated to dogfood it. 9 unit tests
  + 3 Playwright e2e cases.
- B1-followup-2 (2026-04-19): `dcc.afterComputeSpellCheck` post-hook
  on `DCCActor.computeSpellCheck`. Retires XCC's `XCCActor`
  subclass + the `CONFIG.Actor.documentClass = XCCActor` global
  replacement at `xcc/module/xcc.js:171`. XCC migration recipe
  added to `EXTENSION_API.md` for the maintainer to consume.
  +2 unit tests + 1 Playwright case.

- B1-followup (2026-04-19): `game.dcc.registerActorSheet(types,
  SheetClass, options?)` Actor-side mirror. DCC's own 11 actor-sheet
  registrations migrated to dogfood the helper. Sibling-module
  migration is opt-in (XCC has 19 call sites, MCC 7,
  dcc-crawl-classes 9 — total 35 lines of boilerplate that can each
  collapse to a one-liner when their maintainers want to take it up).
  +7 unit tests + 3 Playwright cases.
