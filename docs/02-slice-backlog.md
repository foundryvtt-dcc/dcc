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

#### ~~D3c. Retire `SpellFumbleResult.patronTaint` flag + fumble-entry tag convention.~~ **CLOSED 2026-04-24 (session 23)**.
Lib PR to `dcc-core-lib@0.8.0` (breaking change) removed
`SpellFumbleResult.patronTaint` + the `effect.type === 'patron-taint'`
/ `effect.data.patronTaint === true` parsing in `rollSpellFumble` /
`rollSpellFumbleWithModifier`. Audit confirmed zero consumers:
lib orchestration (`spell-check.ts`) never reads the flag; DCC
system has no consumer; XCC's `fumbleResult` hits are combat-path
(unrelated); `dcc-qol` / `mcc-classes` / `dcc-crawl-classes` have
none; compendium content in `dcc-core-book` + `xcc-core-book`
has no fumble-table entry tagging taint. Pure dead-code removal.
DCC side: vendor-synced; +1 vitest guard asserting the flag is
absent from `rollSpellFumble` / `rollSpellFumbleWithModifier`
output (catches any regression if the parsing re-sneaks in). 925
Vitest + 98 Playwright green.

#### ~~D4(profile-override). Cross-class castingMode routing via lib `profileOverride`.~~ **DONE 2026-05-17 (session 24)**
Landed via `dcc-core-lib@0.9.0` (`SpellCheckOptions.profileOverride`,
commit `a453473`). Adapter folds two previously-excluded dispatcher
gates: wizard-castingMode spell on a Cleric actor (now routes via
adapter with wizard profile override), cleric-castingMode spell on a
non-cleric OR patron-bound actor (routes with cleric override).
`buildSpellCheckArgs` accepts `options.castingModeOverride` and
populates the synthetic classState slot for the override type.
`_castViaCalculateSpellCheck` threads `profileOverride: profile` on
every `libCalculateSpellCheck` call (no-op when override matches
derived profile). +3 vitest tests flipped, +2 Playwright cases.
930 Vitest + Playwright suite extended.

#### ~~D4(remainder). Naked spell-check + forceCrit + skill-table folds.~~ **DONE 2026-05-17 (session 25)**
Lib PR (`dcc-core-lib@0.10.0`, commit `77c95e2`) made
`SpellCastInput.spellbookEntry` optional — `castSpell` now runs
without a spellbook slot (skips manifestation override + mercurial
attach). All three remaining direct-reimpl branches folded:
- **Naked spell check** → new `_castNakedViaAdapter`. Routes
  through `libCastSpell` with a synthetic SpellDefinition + no
  spellbookEntry. Honors spellburn dialog (non-cleric / non-NPC),
  cleric disapproval, and `applyForceCritToFoundryRoll`. Chat emit
  via `renderSpellCheck` extended with `buildNakedSpellResultHtml`
  for the SpellCheck*NoTable indicator.
- **`options.forceCrit` (shift-click GM testing)** → shared
  `applyForceCritToFoundryRoll` helper. Mutates the Foundry Roll's
  natural to 20 (chat-visible) and the lib roller closure feeds
  the same value. Threaded through every adapter spell-check
  route.
- **Skill-table / disapproval-range skills (Turn Unholy,
  divineAid, layOnHands)** → new `_skillTableViaAdapter`. Re-uses
  the legacy term-builder (DCCRoll.createRoll), Foundry's
  RollTable lookup, and `SpellResult.addChatMessage` for the
  table-driven cases; the no-table disapproval-only path emits
  its own SpellCheck*NoTable indicator. `drainDisapproval` still
  applies via `actor.applyDisapproval(N)`.

Dispatcher updates: `!spellItem` routes to `_castNakedViaAdapter`
unconditionally; `rollSkillCheck` routes
`hasSkillTable || useDisapprovalRange` to `_skillTableViaAdapter`
(showModifierDialog + description-only stay legacy).
`_rollSpellCheckLegacy`'s naked branch removed (~110 lines).
933 Vitest + Playwright extended.

**Remaining `processSpellCheck` callers:**
- `DCCItem.rollSpellCheck` (line 376) — fires when the adapter
  declines for `noCasterProfile` or unknown castingMode. Spell-item
  + result-table path stays. Permanent stable surface per Phase 2
  close-out — no further fold planned.
- ~~`_rollSkillCheckLegacy` (line 1809) — fires only for
  `showModifierDialog && (hasSkillTable || useDisapprovalRange)`.~~
  **Closed 2026-05-17 at session 26 / Q7-phase1.** The dispatcher
  dropped its `!!options.showModifierDialog → legacy` clause;
  skill-table-with-dialog now routes through
  `_skillTableViaAdapter` (which has always forwarded `options`
  through `DCCRoll.createRoll`). Plain skill-with-dialog routes
  through `_rollSkillCheckViaAdapter`'s new
  `promptRollModifierDialog` branch.

#### ~~Q7-phase1. Generalized roll-modifier-dialog adapter scaffold + skill-check fold.~~ **DONE 2026-05-17 (session 26)**
New `promptRollModifierDialog(terms, opts)` in
`module/adapter/roll-dialog.mjs` — thin wrapper over
`game.dcc.DCCRoll.createRoll({ showModifierDialog: true })` that
reuses the existing `RollModifierDialog` UI. Returns
`{ actionDie, modifierTotal, formula, roll } | null` (null on
user cancel). Companion `parseRollIntoDieAndModifier` walks the
returned Foundry Roll's `terms[]`, picking the first Die as the
action die and summing signed numerics as a flat total.
`_rollSkillCheckViaAdapter` consumes it for the
`options.showModifierDialog` branch: overrides `definition.roll.die`
with the dialog's selection, suppresses `definition.roll.ability`
(the legacy Compound term already bakes ability mod into the
total), and feeds the user's flat total as a single
`dialog-modifier` situational modifier. `_buildSkillCheckLegacyTerms`
extracted as a shared helper consumed by the dialog branch, the
skill-table adapter, and `_rollSkillCheckLegacy` (eliminates the
term-builder duplication across all three call sites).
`_rollSkillCheckLegacy` is now strictly the no-die / description-
only fallback. 945 Vitest (+12 new) + Playwright extended (1 case
flipped, 1 new).

#### ~~Q7-phase2. Wizard / cleric spell-check modifier-dialog generalization.~~ **DONE 2026-05-17 (session 27)**
Landed via the same `promptRollModifierDialog` scaffold session 26
introduced. `roll-dialog.mjs` extended with an optional `spellburn`
descriptor that appends a Spellburn term to the dialog and captures
the chosen burn via the term's callback; the bespoke
`promptSpellburnCommitment` helper retired (was only consumed by the
wizard / naked spell-check routes, and the unified prompt now
surfaces Spellburn alongside Die / Compound / CheckPenalty / Other
Bonus — same shape `DCCItem.rollSpellCheck` builds for the legacy
path). New `_promptSpellCheckDialog` + `_applySpellCheckDialogToOptions`
helpers on `DCCActor` build the term list and fold the dialog result
back into `options` (Spellburn → `options.spellburn`; action die →
`options.actionDieOverride`; flat modifier total →
`options.dialogModifierTotal`). `_rollSpellCheckViaAdapter` invokes
the prompt for both wizard and cleric branches (post-dispatch-log so
cancels stay observable). `_castNakedViaAdapter` does the same for
naked checks. `_castViaCalculateSpellCheck` honors the new options by
overriding `input.actionDie` and feeding the user's modifier total as
a single `dialog-modifier` situational AFTER subtracting the lib's
auto-additive `casterLevel + abilityModifier` — keeps the rolled
total matching the legacy "trust the user's total" contract without
double-counting the level + ability the lib re-adds from `character`.
Naked path mirrors the same suppression: `suppressLibAuto` zeroes
`input.casterLevel` + `input.abilityModifier` when the dialog drives
the modifier list, and the existing `class.spellCheckOverride` shim
shares the same code path. 953 Vitest (+4 new in
`adapter-roll-dialog.test.js` covering the spellburn descriptor +
modifierTotal subtraction; 4 spell-check tests flipped to assert
against the unified prompt). Playwright +3 new cases (wizard /
cleric / naked showModifierDialog → adapter dispatch). Open question
#7 is now fully closed.

---

### Group E — Vertical slice for XCC/MCC validation (after Groups A + B)

Once the attack-side pattern is proven (Group A) and the first XCC
hack is closed (Group B), pick ONE vertical to take all the way
through Phases 4 → 5 → 6 for a single capability. Demonstrates the
full-stack approach works end-to-end with a real sibling consumer.

**Candidates (pick one at slice time):**

1. **Halfling vertical** — **STARTED 2026-05-18 (Phase 4 session 1).**
   Session 1 landed the `game.dcc.registerClassMixin` infrastructure +
   relocated `skills.sneakAndHide` off the monolithic Player schema
   onto a built-in DCC `'halfling'` mixin (see "Phase 4 — Active
   sub-arc" below for remaining sub-slices: more class-bound fields,
   class-id dispatch, halfling sheet-tab composition, variant
   registration).
2. ~~**Mercurial-magic vertical**~~ — **DONE 2026-05-18 (Group E
   session 1).** New `dcc.registerMercurialMagicTable(classKey,
   tableName)` Stable hook + `CONFIG.DCC.mercurialMagicTables`
   registry. Resolver shared between adapter cast path and legacy
   item-sheet button; xcc-core-book migration recipe in
   `EXTENSION_API.md` retires the per-roll monkey-patch. +5
   Vitest, +2 Playwright. Did NOT require Phase 4 schema work or
   Phase 5 sheet composition — purely an extension-surface fix that
   resolved the §2.4 critique.
3. **Single-class homebrew vertical** — pick a fan-made class (e.g.,
   from `dcc-crawl-classes`), rewire it as a class-mixin + sheet-part
   registration. Validates §2.8 homebrew extensibility. With the
   `registerClassMixin` infrastructure now in place, this becomes a
   thinner exercise — just register the mixin + add the sheet part.

---

### Phase 4 — Active sub-arc (halfling vertical, in progress)

> **Per-class component map:** `docs/dev/CLASS_DECOMPOSITION.md` —
> single-source doc explaining which extension API owns each class
> component (schema mixin / sheet part / defaults / starting items /
> lib progression / variant) and the per-class status. Read before
> relocating any class-bound concern; sessions 3+ all touch component
> 1 (schema mixin) only.

#### ~~Phase 4 session 1. `registerClassMixin` infrastructure + halfling `sneakAndHide` extraction.~~ **DONE 2026-05-18**
New stable extension helper `game.dcc.registerClassMixin(classId,
mixinFn)` in `module/extension-api.mjs` (companion
`applyClassMixins(schema)` invoked by `PlayerData.defineSchema()` in
deterministic-sorted classId order, **before** the existing
`dcc.definePlayerSchema` hook). `CONFIG.DCC.classMixins = {}` seeded
in `module/config.js`. `module/dcc.js`'s init registers a built-in
`'halfling'` mixin contributing `skills.sneakAndHide`; the static
halfling block in `player-data.mjs` is deleted. Foundry-smelling shape
(`system.skills.sneakAndHide`) stays intact (preserves §2.12).
Last-write-wins semantics match the mercurial-magic registry's
behavior. +11 Vitest, +3 Playwright. EXTENSION_API.md grew a new
Stable `game.dcc.registerClassMixin` row, refreshed the
`dcc.definePlayerSchema` row, and added a "Homebrew / sibling-module
recipe: registerClassMixin" migration entry.

#### ~~Phase 4 session 2. Dwarf `shieldBash` class-mixin extraction.~~ **DONE 2026-05-18**
New `'dwarf'` mixin in `module/dcc.js:init` contributes
`skills.shieldBash` (StringField label/ability/value + DiceField die
+ BooleanField useDeed). Mixed-field-type slice — confirms
`applyClassMixins` handles non-trivial shapes identically to the
static definition. `DiceField` imported into `dcc.js` from
`module/data/fields/_module.mjs`; static `shieldBash` block in
`player-data.mjs` removed (comment near the removed block now
documents both halfling + dwarf mixin-sourced fields together).
+1 Playwright case in `extension-api.spec.js` asserts both
default values AND resolved field types
(`dieFieldType === 'DiceField'`, `useDeedFieldType === 'BooleanField'`)
on a live Player document. 110 Playwright passed (was 109, +1);
966 Vitest unchanged (the registry mechanic was already covered in
session 1).

#### ~~Phase 4 session 3. Thief class-mixin extraction.~~ **DONE 2026-05-18**
Largest single-class relocation so far. New `'thief'` mixin in
`module/dcc.js:init` contributes the 12-skill block (sneakSilently /
hideInShadows / pickPockets / climbSheerSurfaces / pickLock /
findTrap / disableTrap / forgeDocument / disguiseSelf /
readLanguages / handlePoison / castSpellFromScroll) **plus** two
class-field mutations (`schema.class.fields.luckDie` =
`DiceField('1d3')`, `schema.class.fields.backstab` =
`StringField('0')`) — first mixin to touch both `schema.class.fields`
and `schema.skills.fields` on the same registration. An inline
`thiefSkill(label, ability)` helper compacts the 10 agl/int/per
skills that share the standard label/ability/value triple;
`handlePoison` deliberately omits `ability` (matches static body);
`castSpellFromScroll` carries its own DiceField die (`'1d10'`).
Static thief blocks (~62 lines for skills + 2 lines for class
fields) removed from `module/data/actor/player-data.mjs`; `DiceField`
import dropped from that file (was only used by the two now-relocated
thief fields). +1 Playwright case asserts all 12 skill fields, the
non-`agl` abilities, `handlePoison.ability` absence, the DiceField
type+initial on `castSpellFromScroll.die`, and the class fields'
types+initials. 966 Vitest green (unchanged); 112 Playwright passed
(was 110, +1 thief + 1 dwarf-flake recovered), 1 latent failure
(xcc-core-book DCCItemSheet override — unchanged from baseline).

#### ~~Phase 4 session 4. Cleric class-mixin extraction + shared built-in mixin table.~~ **DONE 2026-05-18**
Cleric mixin contributes 8 class fields (`spellCheck` NumberField,
`spellCheckAbility` StringField, `spellsLevel1–5` NumberFields,
`deity` nullable StringField, `disapproval` NumberField min=1 max=20,
`disapprovalTable` StringField) + 3 disapproval-range skills
(`divineAid` / `turnUnholy` / `layOnHands`) — `divineAid` extends
the shared `disapprovalSkill(label, extra)` helper with its own
`drainDisapproval` NumberField slot. Surfaced a latent gap: the
integration tests in `module/__integration__/data-models.test.js`
construct `PlayerData` directly without going through Foundry's
`init` hook, so the inline mixin registrations in `module/dcc.js`
weren't running for them. Three pre-existing assertions broke
(`class.disapproval=1`, `class.deity=null`, NumberField min/max).
Closed by extracting **all four built-in mixin functions** out of
`module/dcc.js` and into a new `module/built-in-class-mixins.mjs`
table + `registerBuiltInClassMixins(register)` helper consumed by
both the production init hook and the integration-test setup. Single
source of truth for built-in mixins; future sessions only edit the
table. +1 Playwright case in `extension-api.spec.js` reads from
`player.system._source` (raw, not derived) so the field-value
assertions stay valid even though `prepareDerivedData` overwrites
`class.spellCheck` and the cleric skills' `.value` with computed
strings. Field-type assertions confirm `NumberField` /
`StringField` / `BooleanField` survival through the mixin path. 966
Vitest unchanged; 113 Playwright passed (was 112, +1 cleric case);
1 latent failure (xcc-core-book DCCItemSheet override, unchanged
baseline).

#### ~~Phase 4 session 5. Warrior class-mixin extraction.~~ **DONE 2026-05-18**
Smallest remaining class block. New `'warrior'` entry in the
`BUILT_IN_CLASS_MIXINS` table contributes `class.luckyWeapon`
(nullable StringField, initial null) + `class.luckyWeaponMod`
(StringField, initial `'+0'`). No skills — warrior is the only DCC
class whose contribution is pure class-fields. +1 Playwright case
asserts the nullable initial, signed-string default, and field
types via `_source`. 966 Vitest unchanged; 114 Playwright passed
(was 113, +1 warrior).

#### ~~Phase 4 session 6. Wizard + elf class-mixin extraction (closes per-class arc).~~ **DONE 2026-05-18**
New `'wizard'` + `'elf'` entries in `BUILT_IN_CLASS_MIXINS` both
call a shared `attachWizardFields(schema)` helper that contributes
9 wizard class fields (knownSpells / maxSpellLevel /
spellCheckOtherMod / spellCheckDieOverride / spellCheckOverride /
patron / patronTaintChance / familiar / corruption HTMLField). The
elf mixin additionally replaces `skills.detectSecretDoors` with the
HeightenedSenses overrides (label='DCC.HeightenedSenses',
ability='int', value='+4') — the base body keeps the non-Elf
default; the elf mixin runs after the base body so the override
wins on the constructed schema. Static `class` block in
`module/data/actor/player-data.mjs` shrunk to a single `className`
StringField; static `skills` block to just `detectSecretDoors`.
`HTMLField` + `NumberField` imports dropped from `player-data.mjs`.
**All seven DCC classes mixin-source their fields** — component 1
of the Class Decomposition is complete. +2 Playwright cases. 966
Vitest unchanged; 116 Playwright passed (was 114, +2 wizard/elf
cases).

#### Phase 4 closure note
Component 1 of `docs/dev/CLASS_DECOMPOSITION.md` (schema mixins) is
done for every built-in DCC class. Phase 4 also delivered the
shared `module/built-in-class-mixins.mjs` table consumed by both
production init and integration-test setup (session 4). Phase 5
opened 2026-05-18 with the `registerClassDefaults` registry (see
"Phase 5 — Active sub-arc" below). Per the class-decomposition
plan, the per-class concerns moving in Phase 5:

1. **Sheet parts** — collapse the 7 class sheets in
   `module/actor-sheets-dcc.js` (+ partials at
   `templates/actor-partial-*.html`) into one `DCCSheet` that
   composes parts based on `character.classId`. New
   `game.dcc.registerSheetPart({ classId, tab, template,
   condition })` helper.
2. **Class identity + mechanical defaults** — extract the
   `_prepareContext` first-open blocks (lines `60 / 128 / 201 / 269
   / 346 / 518 / 595` in `actor-sheets-dcc.js`) into a
   `registerClassDefaults` registry. Includes the cross-class
   `useDeed` toggles for `skills.shieldBash`.
3. **Starting items** — `registerClassStartingItems` or fold into
   defaults registry. Today's only built-in case is the dwarf
   ShieldBash weapon auto-create at
   `module/actor-sheets-dcc.js:434-454`.

Phase 4's class-id dispatch sub-slice landed in session 7 (see
Completed). Remaining non-class-extraction work is Phase 5 territory:

- ~~**Class-id dispatch helper**~~ — **DONE 2026-05-18 (Phase 4
  session 7).** `DCCActor.classId` getter normalizes
  `system.details.sheetClass` to lowercase canonical ID
  (`'halfling'`, …); two halfling sites in `module/actor.js:3281`
  + `module/item.js:70` migrated. Remaining capitalized
  `sheetClass` comparisons (Elf / Cleric — `actor.js:182`,
  `actor.js:2180`, `actor.js:2481`, `dcc.js:746`) intentionally
  left for the Phase 5 `registerClassDefaults` work to migrate
  alongside the writer-side rewrite of `sheetClass`.
- **Class-defaults registry**, Phase 5 candidate — see
  `docs/dev/CLASS_DECOMPOSITION.md` §3.3 for the design notes
  (already documented).

#### Phase 4 session 4+ (future).
- ~~**Class-id dispatch helper**~~ — **DONE 2026-05-18 (Phase 4
  session 7).** `DCCActor.classId` getter; two halfling sites
  migrated. Future Elf / Cleric migrations bundled with the Phase
  5 `registerClassDefaults` writer-side rewrite of `sheetClass`.
- **Halfling / dwarf sheet-tab composition (Phase 5 work)** —
  collapse the class-specific sheets' tab/template definitions into
  `dcc.registerSheetPart({ classId, tab, template })` registrations.
  Out of scope for Phase 4.
- **Class-defaults registry, Phase 5 candidate.** Each class sheet's
  `_prepareContext` first-open block in `module/actor-sheets-dcc.js`
  bundles four distinct concerns: class identity (`className`,
  `classLink`, `sheetClass`, `mightyDeedsLink`), class mechanical
  defaults (`critRange`, `class.disapproval`, `attackBonusMode`,
  `addClassLevelToInitiative`, `spellCheckAbility`, `showBackstab`),
  skill activation (`skills.shieldBash.useDeed=true` for dwarves,
  `useDeed=false` for everyone else — the cross-class lines at
  `actor-sheets-dcc.js:72/141/213/282/359/531/606`), and starting
  items (the auto-created `ShieldBash` weapon at
  `actor-sheets-dcc.js:443-454`). These are sheet-first-open
  concerns, not schema concerns — they should NOT fold into
  `registerClassMixin` (which is correctly scoped to schema fields
  only). Natural target: a sibling `dcc.registerClassDefaults`
  registry (or equivalent) landing alongside `registerSheetPart` in
  Phase 5. Mechanical defaults will partly come from the lib's
  `registerClassProgression` once it's wired in Phase 6 (save
  bonuses / crit dies / action dies); the Foundry-side registry
  covers what's left (`sheetClass`, `attackBonusMode`, etc.) plus
  the "auto-create class starting items" surface that today is
  hardcoded per class sheet (a `registerClassStartingItems`
  registry could be split out, or rolled into the same defaults
  registry). Surfaced 2026-05-18 during the Phase 4 session 2
  conversation about the dwarf mixin's scope.
- **Halfling / dwarf variant-class registration with the lib
  (Phase 6 work)** — register the halfling / dwarf class
  progressions with `dcc-core-lib`'s class registry so save bonuses
  / crit dies / action dies derive from
  `lib.getSavingThrows('halfling', level)` etc., not from
  `levelData` packs alone. Out of scope for Phase 4.

---

### Phase 5 — Active sub-arc (sheet composition, in progress)

> **Per-class component map:** `docs/dev/CLASS_DECOMPOSITION.md` —
> single-source doc; Phase 5 covers components 2 (sheet parts), 3
> (class identity + mechanical defaults), 4 (skill activation toggles
> — folded into component 3 today), and 5 (starting items). Read
> before relocating any class-bound sheet concern.

#### ~~Phase 5 session 1. `registerClassDefaults` registry + 7 PC sheets migrated.~~ **DONE 2026-05-18**
New stable extension hook `game.dcc.registerClassDefaults(classId,
defaults)` + companion `applyClassDefaults(actor, classId)` helper
in `module/extension-api.mjs`; `CONFIG.DCC.classDefaults = {}` seeded
in `module/config.js`. Each entry packages `sheetClass` (capitalized
sentinel), `localize` (i18n keys), `enrichHtml` (i18n keys passed
through `TextEditor.enrichHTML`), and `literal` (scalar mechanical
defaults). `applyClassDefaults` returns `'initialized' | 'regenerated'
| 'unchanged'` so the dwarf sheet's still-inline ShieldBash
auto-create can gate on `'initialized'`. Seven built-in PC entries
seeded via `module/built-in-class-defaults.mjs`; all 7 PC sheets in
`module/actor-sheets-dcc.js` reduced to a single helper call (156
lines deleted). Generic sheet stays untouched (not class-bound, no
maintenance branch). +11 Vitest, +5 Playwright (helper exposure,
seed-table shape, lifecycle including maintenance regen).
983 Vitest green, 122 Playwright passed. **Latent gap surfaced
(NOT fixed):** the warrior + dwarf `class.mightyDeedsLink` and wizard
`class.spellcastingLink` / `class.spellburnLink` writes don't surface
on `system.class.*` because those fields aren't on the base Player
schema (only `class.classLink` is, via a sibling `dcc.definePlayerSchema`
hook). The legacy code wrote them anyway → silently stripped → my
refactor matches byte-for-byte. Follow-up tracked below.

#### ~~Phase 5 session 2. `registerClassStartingItems` for dwarf ShieldBash.~~ **DONE 2026-05-18**
New stable hook `game.dcc.registerClassStartingItems(classId, items)`
+ `applyClassStartingItems(actor, classId)` helper in
`module/extension-api.mjs`; `CONFIG.DCC.classStartingItems = {}`
seeded in `module/config.js`. Entry shape:
`{ nameKey, type, img?, system? }` — helper localizes `nameKey`
at apply time, dedupes against existing `(type, name)` matches,
batches missing entries into one `createEmbeddedDocuments` call,
returns created docs. Dwarf ShieldBash seed in
`module/built-in-class-starting-items.mjs`. All 7 PC sheets now
share identical `_prepareContext` shape (only the classId literal
differs); homebrew classes registering items through any PC sheet
subclass get them applied automatically. +13 Vitest, +5 Playwright.
996 Vitest green, 127 Playwright passed (1 latent xcc-core-book
failure, unchanged baseline).

#### ~~Phase 5 session 4. `registerSheetPart` + `DCCSheet` collapse.~~ **DONE 2026-05-18**
New stable hook `game.dcc.registerSheetPart(classId, descriptor)` in
`module/extension-api.mjs`; `CONFIG.DCC.sheetParts = {}` seeded in
`module/config.js`. Each entry is `{ parts, tabs }` mirroring
ApplicationV2's `PARTS` + `TABS` shape. Seeded for all 7 PC classes
via `module/built-in-sheet-parts.mjs`. New `DCCSheet` intermediate
base class in `module/actor-sheets-dcc.js` exposes inherited static
getters that resolve `CLASS_PARTS` + `CLASS_TABS` from
`CONFIG.DCC.sheetParts[this.CLASS_ID]`; the per-class subclasses
collapse to 4-line stubs pinning `static CLASS_ID`. All 7 sheet
classes stay registered (no UX regression for the "Configure
Sheet" picker). Sheet markup output unchanged (templates resolve
identically through the new mechanism). +6 Vitest, +5 Playwright.
1002 Vitest green; 134 Playwright passed (1 latent xcc-core-book
failure, unchanged baseline). Visual regression unrunnable in this
session's env (expects v12 baseline world).

#### ~~Phase 5 session 5. Migrate remaining capitalized `sheetClass` readers.~~ **DONE 2026-05-19**
Four mechanical rewrites of
`system.details.sheetClass === '<CapitalizedClass>'` →
`actor.classId === '<lowercase>'`: Elf at `module/actor.js:198`;
Cleric at `module/actor.js:2196`, `module/actor.js:2497`,
`module/dcc.js:775`. `actor-sheets-dcc.js` keeps its
`sheetClass !== 'Generic'` first-open check (Generic isn't
class-bound). Pure-refactor — `actor.classId` resolves to
`sheetClass.toLowerCase()`. +1 Vitest regression-guard test in
`class-dispatch-i18n-guard.test.js` that fails the suite if any
`sheetClass === '<CapitalizedClass>'` pattern re-appears in
module source. 1003 Vitest green.

#### ~~Phase 5 follow-up: register the link fields on the base schema.~~ **DONE 2026-05-18 (Phase 5 session 3)**
Closed by Phase 5 session 3. `classLink`, `mightyDeedsLink`,
`spellcastingLink`, `spellburnLink` added as `HTMLField({ initial:
'' })` to the static `class` SchemaField in `player-data.mjs`. The
sibling module's `classLink` registration via `dcc.definePlayerSchema`
still runs (last-write-wins) but the base-body declaration ensures
all four fields survive schema validation in every world
configuration. Templates `{{{system.class.<linkField>}}}` now render
the enriched HTML written by `applyClassDefaults`. +4 assertions in
integration test; +2 Playwright cases (end-to-end gap closure +
fresh-schema empty-string defaults).

---

### Phase 6 — Active sub-arc (lib-side class progression, in progress)

> Phase 6 wires `dcc-core-lib`'s class-progression registry from
> the Foundry system, so the lib's consumer APIs
> (`getSavingThrows`, `getCritDie`, `getSaveBonus`, etc.) return
> non-zero values for actors. The lib API has been there since
> before the vendor sync; the work is exposing it from the system
> + getting class progression payloads registered. Per
> `ARCHITECTURE_REIMAGINED.md §8.1`, the class progression data
> is copyrighted Goodman Games material living in the private
> `dcc-official-data` repo — the open-source DCC system ships
> only the registration surface. Content modules call it on their
> own schedule with their own data.

#### ~~Phase 6 session 1. Expose `registerClassProgression` / `registerClassProgressions` on `game.dcc.*`.~~ **DONE 2026-05-19**
Two-line addition to `module/dcc.js` importing the helpers from
the vendored lib
(`module/vendor/dcc-core-lib/data/classes/progression-utils.js`)
and adding them to the `game.dcc` object alongside the other
Phase 4/5 registry helpers. PR #720's "programmatic PC creation
produces inconsistent class config" item is *partially* closed:
plumbing ready. Full closure waits on a content module to invoke
the helper with a complete progression payload. +2 Vitest, +2
Playwright (uses fictional class data, no copyrighted material).
EXTENSION_API.md gets a paired Stable row. 1005 Vitest green.

#### ~~Phase 6 session 5. `registerVariant` for variant-class modules.~~ **DONE 2026-05-20**
Per `CLASS_DECOMPOSITION.md` §3.6 and
`ARCHITECTURE_REIMAGINED.md §7`. New
`game.dcc.registerVariant({ id, label, classes, sheetTheme? })` +
`game.dcc.getActiveVariant()` in `module/extension-api.mjs`.
World setting `dcc.activeVariant` (defaults to `'dcc'`) selects
which registered variant is live; when the active variant
declares a `sheetTheme`, `DCCActorSheet._onRender` adds it to the
sheet element via `applyActiveVariantSheetTheme(this.element)`.
The DCC system dogfoods its own helper by seeding the canonical
`'dcc'` variant (7 PC classes, no `sheetTheme`) via new
`module/built-in-variant.mjs` at `init`. Sibling variant modules
(XCC, MCC) ship a single `registerVariant({...})` call from their
own `init` hook declaring their class IDs + a `sheetTheme`. XCC's
`CONFIG.Actor.documentClass` override was retired 2026-05-18;
this slice closes the Phase 6 work. +23 Vitest tests
(extension-api.test.js), +2 Playwright cases
(extension-api.spec.js). **1053 Vitest green** (was 1030, +23).

#### ~~Phase 6 session 2. Compendium → lib-registry foundry-data-loader.~~ **DONE 2026-05-19**
`registerClassProgressionsFromPacks` in
`module/adapter/foundry-data-loader.mjs` walks
`CONFIG.DCC.levelDataPacks` at `dcc.ready`, parses each
`{ClassName}-{level}` item's `system.levelData` text, maps the
Foundry-system-paths onto the lib's `ProgressionLevelData`
shape, and calls `registerClassProgressions(...)`. Single
source of truth — content creators ship level data in their own
compendium packs via `CONFIG.DCC.levelDataPacks.addPack(...)`,
and both the level-change dialog AND the lib registry pick them
up automatically. Closes the remaining half of PR #720's
class-config item — `getSavingThrows`, `getCritDie`, etc. now
return non-zero values for actors in worlds where a content
module ships level data. +15 Vitest, +1 Playwright. 1020
Vitest green; 136 Playwright passed (was 135, +1 new). No class progression data
shipped from core (per §8.1; data stays in user-installed
content modules).

---

### Phase 7 — Active sub-arc (cleanup, in progress)

> Per `ARCHITECTURE_REIMAGINED.md §7`. Items 1 (`critText`/`fumbleText`
> shim retirement) and 2 (pre-V14 migration pruning) were already done
> in 2026-04 (C1 + C2 chore slices); item 5 (extract `module/ruleset/`)
> is a no-op because the directory doesn't exist on this branch.
> Remaining: piecemeal split of `module/dcc.js` (items 3 — done
> incrementally, one focused module per session) + split of
> `styles/dcc.scss` into partials + theme contract (item 4).

#### ~~Phase 7 session 1. Extract Handlebars helpers from `dcc.js`.~~ **DONE 2026-05-20**
Pure refactor — moves `add`, `stringify`, `distanceFormat`,
`dccPackExists` out of `module/dcc.js`'s init hook into a new focused
module `module/handlebars-helpers.mjs` exporting each helper
individually plus a `registerDCCHandlebarsHelpers()` entry-point the
init hook calls in place of the four inline
`Handlebars.registerHelper(...)` blocks. +12 Vitest tests in new
`module/__tests__/handlebars-helpers.test.js` (per-helper coverage +
a registration assertion against a mocked `Handlebars.registerHelper`);
+1 Playwright case in `extension-api.spec.js` asserting the four
helpers survive the extraction and produce identical outputs against
the live `Handlebars.helpers` table. **1065 Vitest green** (was 1053,
+12); **143 Playwright passed** + 1 latent xcc-core-book DCCItemSheet
override (unchanged baseline). Phase 6 session 5's "Playwright count
to be confirmed by post-slice full-suite run" retroactively closed at
142 pre-slice → 143 post-slice.

#### ~~Phase 7 session 2. Extract macro factories to `module/macros.mjs`.~~ **DONE 2026-05-20**
Pure refactor — moves the 13 `_createDCCXxxMacro` factories, the
`MACRO_FACTORIES` dispatch table (lifted out of the inline
`handlers` map inside the old `createDCCMacro` body so it can be
unit-tested independently), the `createDCCMacro` dispatcher,
`rollDCCWeaponMacro`, `getMacroActor`, and `getMacroOptions` out of
`module/dcc.js`'s body and into a focused module. `module/dcc.js`
shrinks from 1655 → 1255 lines (-400). The init hook keeps the
three end-user macro surface entries on `game.dcc.*` (de-facto-
stable per `EXTENSION_API.md`); `hotbarDrop` still calls
`createDCCMacro(data, slot)` — imported now instead of inlined.
+37 Vitest in new `module/__tests__/macros.test.js`. +1 Playwright
in `extension-api.spec.js` (`DCC macro factories
(createDCCMacro / rollDCCWeaponMacro / getMacroActor /
getMacroOptions) survive macros.mjs extraction`) — exercises the
runtime macro surface end-to-end via a stubbed
`actor.rollWeaponAttack`. **1102 Vitest green** (was 1065, +37);
**143 Playwright passed** + 2 failures (the latent xcc-core-book
DCCItemSheet override; the documented forceCrit shift-click
suite-only flake — passes in isolation, fired this run as it has
in Phase 6 sessions 1, 2, 4).

#### ~~Phase 7 session 3. Extract settings-table hooks to `module/settings-table-hooks.mjs`.~~ **DONE 2026-05-20**
Pure refactor — relocates the nine top-level
`Hooks.on('dcc.{register,set}XxxTable|Pack', ...)` handlers (was
`dcc.js:932–1019`) into a focused module exporting each handler
individually + a frozen `SETTINGS_TABLE_HOOKS` dispatch table + a
`registerSettingsTableHooks()` entry-point. The handlers cover:
`registerDisapprovalPack`, `registerCriticalHitsPack`,
`setDivineAidTable`, `setFumbleTable`, `setLayOnHandsTable`,
`registerLevelDataPack` (lazy-inits `CONFIG.DCC.levelDataPacks`),
`registerMercurialMagicTable` (per-class registry), the legacy
`setMercurialMagicTable` (first-write-wins + system-setting
override), and `setTurnUnholyTable`. `module/dcc.js` shrinks from
1254 → 1172 lines (-82 net including the new import line). The
hook names + their semantics are preserved verbatim — sibling
modules (dcc-core-book, xcc-core-book, …) emit the same hook
events and see the same `CONFIG.DCC.*` mutations land. +25 Vitest
tests in new `module/__tests__/settings-table-hooks.test.js`
(per-handler value tests + dispatch-table assertion + a
`registerSettingsTableHooks` test that wires Hooks.on for all
nine entries). +1 Playwright case in `extension-api.spec.js`
exercising each hook end-to-end against the live world (snapshots
the prior CONFIG state, fires each hook with a probe value, asserts
the matching mutation lands, then restores so downstream tests are
unaffected).

#### ~~Phase 7 session 4. Extract `processSpellCheck` to `module/spell-check-processor.mjs`.~~ **DONE 2026-05-21**
Pure refactor — relocates the ~200-line public stable-API function
`processSpellCheck` (was `dcc.js:637–842`) into a focused module.
The function is exported as a named symbol; `module/dcc.js` keeps
the `game.dcc.processSpellCheck` re-publication at init time
(Foundry-facing stable surface per §8.6, no contract change, no
deprecation path). The destination module reads
`game.dcc.SpellResult` / `game.dcc.FleetingLuck` rather than
importing them directly — mirrors the pattern in `module/actor.js`'s
spell-check paths and preserves the init-time `game.dcc`
registration order. `module/dcc.js` shrinks from 1172 → 970 lines
(-202 net including the new import line, the 5-line replacement
marker comment, and dropping `Roll` from the `/* global */`
declaration since the patron-taint `new Roll('1d100')` moved with
the function). +23 Vitest tests in new
`module/__tests__/spell-check-processor.test.js` (roll evaluation,
forceCrit mutation, fumble/crit detection per Player-only rule,
no-table HTML indicators, rollTable branches including the
crit-level-boost parseInt regression, patron taint roll path,
wizard/cleric automation side-effects, item.lastResult write-back).
+1 Playwright case in `extension-api.spec.js` (`DCC processSpellCheck
survives spell-check-processor.mjs extraction`) creates a temporary
Player, fires `game.dcc.processSpellCheck` against a real `1d20+5`
roll, asserts the resulting chat message carries the expected dcc.*
flags. **1150 Vitest green** (was 1127, +23); **145 Playwright
passed** + 2 failures (latent xcc-core-book DCCItemSheet override
at `extension-api.spec.js:420` — unchanged baseline, line shifted
from 320 because of new test insertion; NEW environmental flake
at `data-models.spec.js:138` from `mcc-core-book-welcome-dialog`
intercepting pointer events — sibling-module dialog state, not
slice-caused).

#### ~~Phase 7 session 8. Hex-literal → theme-variable migration + §7 theming-contract documentation.~~ **DONE 2026-05-28**
See entry in Completed slices below.

#### ~~Phase 7 session 9. Compendium-walk caching for the four table-loading sites + isolated fallback-order coverage backfill.~~ **DONE 2026-05-28**
See entry in Completed slices below.

#### ~~Phase 7 session 10. Extract `buildLibResultFlag` + `applyFleetingLuck` shared helpers from the four chat renderers.~~ **DONE 2026-05-29**
First of the three-slice PR #720 resilience batch. See entry in
Completed slices below.

---

## Completed slices

Move entries here as they land; keep the active queue scannable.

### Phase 7 (Cleanup)

- Phase 7 session 10 (2026-05-29): extract `buildLibResultFlag` +
  `applyFleetingLuck` shared helpers from `module/adapter/chat-renderer.mjs`
  (closes the PR #720 "four near-identical `dcc.libResult` flag
  payloads" resilience item; opens the three-slice resilience batch).
  Pure structural refactor — the four renderers
  (`renderAbilityCheck` / `renderSavingThrow` / `renderSkillCheck` /
  `renderSpellCheck`) each hand-rolled an identical `dcc.libResult`
  core projection (`die` / `natural` / `total` / `formula` /
  `critical` / `fumble` / `modifiers`) plus an identical guarded
  `FleetingLuck.updateFlags` block. The core is now owned by exported
  `buildLibResultFlag(result, extras = {})` (checks pass `{ skillId }`,
  spell passes `{ spellId, tier, spellLost, corruptionTriggered }`),
  and the luck update by exported `applyFleetingLuck(flags,
  foundryRoll)`. Flag consumed by key name, not order, so the
  on-message contract is unchanged. +10 Vitest in new
  `module/__tests__/chat-renderer.test.js`, +1 Playwright probe in
  `extension-api.spec.js`. **1272 Vitest green** (was 1262, +10);
  **155 Playwright passed** (was 154, +1), zero failures, clean
  5.8-min full suite.

- Phase 7 session 9 (2026-05-28): compendium-walk caching for the
  four table-loading sites (`loadDisapprovalTable` +
  `loadMercurialMagicTable` in `module/adapter/spell-input.mjs`,
  `getCritTableLink` + `getCritTableResult` in
  `module/utilities.js`) via a new
  `module/adapter/table-cache.mjs` module with four module-level
  `Map` caches and a `registerTableCacheInvalidation()` helper
  that wires `createRollTable` / `updateRollTable` /
  `deleteRollTable` to a global `clearAllTableCaches()`. Each
  loader consults its cache before falling through to a resolver
  helper that carries the unchanged pack-walk → world-fallback
  logic. `critTableLinkCache` stores the `@UUID[...]` prefix
  WITHOUT the trailing `{displayText}` so the same suffix can
  render with different labels at zero pack-walk cost;
  `critTableDocCache` stores the loaded RollTable doc and lets
  callers run `getResultsForRoll(roll.total)` per call. Cache
  scope is per-process; world reload starts the maps empty.
  Wired into `module/dcc.js` alongside the existing
  `registerSettingsTableHooks()` / `registerTableLoadingHooks()`
  / `registerChatAndHookWiring()` calls at module-init time.
  Pure refactor — cold-cache walks match pre-slice behavior
  byte-for-byte. The slice also closes the PR #720
  test-coverage-gap item "loadDisapprovalTable /
  loadMercurialMagicTable isolated fallback-order tests are
  missing" by backfilling +10 Vitest cases in
  `adapter-spell-check.test.js`. **1262 Vitest green** (was
  1227, +35: +16 in new `module/__tests__/table-cache.test.js`,
  +9 in `utilities.test.js`, +10 in
  `adapter-spell-check.test.js`). **154 Playwright passed**,
  zero failures — clean 5.9-min full suite. +1 Playwright probe
  (`DCC adapter table caches short-circuit pack walks and
  invalidate on world-RollTable events`) dynamic-imports the
  live cache module, asserts the four caches + dispatch table
  shape, then seeds each cache and confirms three real
  RollTable lifecycle paths (`Hooks.callAll('createRollTable',
  probeTable)`, `probeTable.update(...)`, `probeTable.delete()`)
  each drop every cache entry to size 0.

- Phase 7 session 8 (2026-05-28): hex-literal → theme-variable
  migration + `ARCHITECTURE_REIMAGINED.md §7` theming-contract
  documentation. Closes the styling-cleanup arc opened by session
  7. Twelve new `--system-*` CSS custom properties land in
  `styles/variables.css`: six theme-agnostic semantic colors
  (`--system-text-muted-color` `#666`, `--system-damage-color`
  `#8b0000`, `--system-rollable-hover-color` `#000`,
  `--system-flat-button-border-color` `#c9c7b8`,
  `--system-two-weapon-primary-color` `#4caf50`,
  `--system-two-weapon-secondary-color` `#d32f2f`) plus six
  tab-overflow dropdown vars paired with dark-theme overrides
  (`--system-tab-overflow-background` `#f0e8d8`/`#2a2a2a`,
  `--system-tab-overflow-border-color` `#8b7355`/`#444`,
  `--system-tab-overflow-text-color` `#4a3c2a`/`#ccc`,
  `--system-tab-overflow-hover-background` `#e0d5c0`/`#3a3a3a`,
  `--system-tab-overflow-hover-text-color` `#2a1f14`/`#fff`,
  `--system-tab-overflow-active-text-color`
  `var(--color-text-dark-primary)`/`#fff`). All 14 light-path
  hex literals across seven partials (`_base.scss`,
  `_dialogs.scss`, `_hit-points-dialog.scss`, `_skills.scss`,
  `_party-sheet.scss`, `_tabs.scss`, `_weapons.scss`) are
  replaced with the matching `var(...)` references. The 17-line
  `body.theme-dark & .sheet-tabs.responsive-tabs .tabs-overflow
  .tabs-overflow-menu` override block in `_tabs.scss` is deleted
  — the dark cascade now flows through variable overrides in
  `variables.css` rather than through a duplicate component
  selector. Compiled `dcc.css` shrinks 64,741 → 64,502 bytes
  (-239 net; still in the existing probe's 50-80KB range).
  `docs/dev/ARCHITECTURE_REIMAGINED.md §7` is expanded with a
  "Theming contract (`--system-*` CSS custom properties)"
  subsection documenting each variable's role, light + dark
  defaults, and the override pattern variants (XCC, MCC,
  homebrew) should use (variants override variable *values*,
  not component selectors). +1 Playwright case in
  `extension-api.spec.js` (`DCC theming-contract --system-*
  vars resolve to documented values in both themes`) asserts
  the contract end-to-end via `getComputedStyle()` reads
  against both `:root` and a transient `<div
  class="theme-dark">` probe — no live-theme flip needed.
  **1227 Vitest green** (unchanged — CSS not loaded in unit
  tests). **152 Playwright passed** + 1 environmental flake
  at `adapter-dispatch.spec.js:1898 halfling two-weapon
  fumble note round-trips through adapter` (navigation race
  during `rollWeaponAttack`; passes cleanly in isolation,
  1.2s; not slice-caused).

- Phase 7 session 7 (2026-05-22): split `styles/dcc.scss` into
  18 partials + a 34-line manifest. Opens the second Phase 7
  arc. Pure structural refactor — combined only adjacent
  sections so relative CSS rule order (and specificity tie
  outcomes) is preserved verbatim. Partial map: `_base.scss`
  (globals + fonts + `.dcc` common — 383 lines),
  `_journal.scss` (110), `_armor.scss` (36), `_chat.scss` (chat
  rolls + spell-check chat card + notes — 184),
  `_weapons.scss` (119), `_class-sheets.scss` (cleric +
  wizard/elf — 135), `_party-sheet.scss` (110),
  `_hit-points-dialog.scss` (40), `_items.scss` (items + item
  sheet + level item sheet — 249), `_config-dialogs.scss`
  (82), `_skills.scss` (49), `_tabs.scss` (233),
  `_entity-link.scss` (15), `_dialogs.scss` (roll modifier +
  fleeting luck + spell duel — 353), `_actor-sheet.scss` (596
  — largest partial), `_effects.scss` (effects + item-effects
  transfer — 162), `_level-change-dialog.scss` (9), and
  `_container-items.scss` (112). The new `dcc.scss` is a
  34-line manifest of `@use 'partial-name';` directives in
  source order with SCSS-style `//` line comments documenting
  the partial pattern. **Compiled `styles/dcc.css` is
  byte-identical to the pre-split build** (verified via
  baseline-snapshot diff). +1 Playwright case in
  `extension-api.spec.js` (`DCC compiled stylesheet survives
  the styles/dcc.scss split into 18 partials`) — fetches the
  served CSS, asserts HTTP 200, size in 50-80KB range, and 10
  representative selectors from across the partials all
  present. **1227 Vitest green** (unchanged — CSS isn't loaded
  into unit tests). **150 Playwright passed**, zero failures
  (11.9-min full suite). Visual-regression suite couldn't run
  in this V14 environment; the byte-identical CSS diff is
  stronger evidence than a pixel-comparison would be.

- Phase 7 session 6 (2026-05-22): extract chat / hook wiring from
  `dcc.js` to `module/chat-and-hook-wiring.mjs` — closes the
  `dcc.js` piecemeal-split arc. Pure refactor — relocates the
  eleven remaining `Hooks.on` / `Hooks.once` handlers
  (`hotbarDrop`, `renderChatMessageHTML`,
  `getChatMessageContextOptions`, `renderActorDirectory`,
  `preCreateActor`, `preCreateItem`, `applyActiveEffect`,
  `preUpdateActor`, `updateCombat`, `item-piles-ready`,
  `getProseMirrorMenuDropDowns`) into a focused module exporting
  each handler individually + a frozen
  `CHAT_AND_HOOK_WIRING_HOOKS` dispatch table (only
  `item-piles-ready` is once-only) + a
  `registerChatAndHookWiring()` entry-point. `module/dcc.js`
  shrinks from 737 → 475 lines (-262); the §Appendix A target
  of ~4–5 focused modules out of `dcc.js` is met. +43 Vitest in
  new `module/__tests__/chat-and-hook-wiring.test.js` (using
  `vi.mock` for the seven imported sibling modules so handlers
  run without a Foundry boot), +1 Playwright in
  `extension-api.spec.js` (`DCC chat- and hook-wiring ... survives
  chat-and-hook-wiring.mjs extraction`) exercising
  `onPreCreateActor` + `onPreCreateItem` + `onPreUpdateActor`
  end-to-end against a temporary Player probe. **1227 Vitest
  green** (was 1184, +43); **149 Playwright passed**, zero
  failures (13.1-min full suite — both prior-session flakes
  resolved by the follow-up fix commits `1935372` + `2973a13`).

- Phase 7 session 5 (2026-05-21): extract table-loading surface
  from `dcc.js` to `module/table-loading.mjs`. Pure refactor —
  relocates `setupCoreBookCompendiumLinks` + `registerTables` +
  `getSkillTable` + five hook handlers (`diceSoNiceReady`,
  `importAdventure`, plus the three world-RollTable lifecycle
  hooks `createRollTable` / `deleteRollTable` /
  `updateRollTable` that keep `CONFIG.DCC.disapprovalTables` in
  sync) into a focused module exporting each handler + a frozen
  `TABLE_LOADING_HOOKS` dispatch table + a
  `registerTableLoadingHooks()` entry-point. `module/dcc.js`
  shrinks from 970 → 737 lines (-233). +34 Vitest in new
  `module/__tests__/table-loading.test.js`, +1 Playwright in
  `extension-api.spec.js`. **1184 Vitest green** (was 1150,
  +34); **146 Playwright passed** + 2 failures (latent
  xcc-core-book DCCItemSheet override + NEW environmental
  network-suspension flake on `v14-features.spec.js:128`).

- Phase 7 session 4 (2026-05-21): extract `processSpellCheck` from
  `dcc.js` to `module/spell-check-processor.mjs`. Pure refactor —
  moves the ~200-line public stable-API function (was
  `dcc.js:637–842`) into a focused module; the function stays
  re-published on `game.dcc.processSpellCheck` at init time
  (Foundry-facing stable per §8.6, no contract change). The
  extracted module reads `game.dcc.SpellResult` /
  `game.dcc.FleetingLuck` rather than importing them directly,
  mirroring the pattern in `module/actor.js`'s spell-check paths.
  `module/dcc.js` shrinks from 1172 → 970 lines (-202). +23
  Vitest in new `module/__tests__/spell-check-processor.test.js`,
  +1 Playwright case in `extension-api.spec.js` (`DCC
  processSpellCheck survives spell-check-processor.mjs extraction`)
  exercising the no-table flag/HTML branch end-to-end against a
  temporary Player. **1150 Vitest green** (was 1127, +23). **145
  Playwright passed** + 2 failures (latent xcc-core-book
  DCCItemSheet override baseline; NEW environmental flake from
  `mcc-core-book-welcome-dialog` intercepting pointer events on
  `data-models.spec.js:138` — sibling-module dialog state, not
  slice-caused).

- Phase 7 session 3 (2026-05-20): extract settings-table hooks
  from `dcc.js` to `module/settings-table-hooks.mjs`. Pure
  refactor — relocates the nine top-level
  `Hooks.on('dcc.{register,set}Xxx{Pack,Table}', ...)` handlers
  (was `dcc.js:932–1019`) into a focused module exporting each
  handler individually + a frozen `SETTINGS_TABLE_HOOKS` dispatch
  table + a `registerSettingsTableHooks()` entry-point. Hook
  names + semantics preserved verbatim. +25 Vitest in new
  `module/__tests__/settings-table-hooks.test.js`, +1 Playwright
  in `extension-api.spec.js`. **1127 Vitest green** (was 1102,
  +25); **145 Playwright passed** + 1 latent xcc-core-book
  failure (unchanged baseline). `module/dcc.js` shrinks from
  1254 → 1172 lines (-82).

- Phase 7 session 2 (2026-05-20): extract macro factories from
  `dcc.js` to `module/macros.mjs`. Pure refactor — moves the 13
  `_createDCCXxxMacro` factories, the `MACRO_FACTORIES` dispatch
  table, `createDCCMacro`, `rollDCCWeaponMacro`, `getMacroActor`,
  and `getMacroOptions` out of `module/dcc.js`'s body and into a
  focused module. `module/dcc.js` shrinks from 1655 → 1255 lines
  (-400). Init hook keeps the three end-user macro surface
  entries on `game.dcc.*`; `hotbarDrop` still calls
  `createDCCMacro(data, slot)` — imported now instead of inlined.
  +37 Vitest in new `module/__tests__/macros.test.js`, +1
  Playwright in `extension-api.spec.js`. **1102 Vitest green**
  (was 1065, +37); **143 Playwright passed** + 2 failures (the
  latent xcc-core-book DCCItemSheet override + the documented
  forceCrit shift-click suite-only flake — passes in isolation,
  not slice-caused).

- Phase 7 session 1 (2026-05-20): extract Handlebars helpers from
  `dcc.js` to `module/handlebars-helpers.mjs`. Pure refactor — moves
  the four helpers (`add`, `stringify`, `distanceFormat`,
  `dccPackExists`) out of the init hook into a focused module
  exporting each helper individually plus a
  `registerDCCHandlebarsHelpers()` entry-point the init hook calls in
  place of the four inline `Handlebars.registerHelper(...)` blocks.
  Opens the Phase 7 cleanup arc; reconciles the Phase 7 work list
  (items 1+2 already done in 2026-04 C1+C2; item 5 is a no-op).
  +12 Vitest in new `module/__tests__/handlebars-helpers.test.js`,
  +1 Playwright in `extension-api.spec.js`. **1065 Vitest green**
  (was 1053, +12); **143 Playwright passed** + 1 latent xcc-core-book
  override (unchanged baseline).

### Phase 6 (Lib-side class progression + variant)

- Phase 6 session 5 (2026-05-20): `registerVariant` for variant
  rulesets (closes Phase 6).
  `game.dcc.registerVariant({ id, label, classes, sheetTheme? })`
  + `game.dcc.getActiveVariant()` in `module/extension-api.mjs`.
  `dcc.activeVariant` world setting (defaults to `'dcc'`)
  selects which registered variant is live; active variant's
  `sheetTheme` (when set) is added to the actor-sheet element
  via `applyActiveVariantSheetTheme(this.element)` in
  `DCCActorSheet._onRender`. New `module/built-in-variant.mjs`
  seeds the canonical `'dcc'` variant (7 PC classes, no
  `sheetTheme` — base CSS is already DCC). Sibling variant
  modules (XCC, MCC) ship a single `registerVariant({...})` call
  from their own `init` hook declaring their class IDs +
  `sheetTheme`. XCC retired its `CONFIG.Actor.documentClass`
  override 2026-05-18; this slice closes the Phase 6 variant
  work. +23 Vitest tests (`extension-api.test.js`), +2
  Playwright cases (`extension-api.spec.js`). 1053 Vitest green
  (was 1030, +23).

- Phase 6 session 2 (2026-05-19): compendium → lib-registry
  loader.
  `registerClassProgressionsFromPacks` in
  `module/adapter/foundry-data-loader.mjs` walks
  `CONFIG.DCC.levelDataPacks` at `dcc.ready`, parses each
  `{Class}-{level}` item's `system.levelData` text, builds
  `ClassProgression` objects, and registers them with the
  vendored lib. Closes the remaining half of PR #720's
  class-config item. +15 Vitest (parser, mapper, assembler —
  all with fictional placeholder values), +1 Playwright
  (structural-shape assertions only). 1020 Vitest green.
- Phase 6 session 1 (2026-05-19): expose
  `registerClassProgression` + `registerClassProgressions` on
  `game.dcc.*` via two new entries in `module/dcc.js`. The lib's
  registry + consumer APIs are already in the vendored bundle;
  this slice just makes the registration surface reachable from
  sibling content modules. No class progression data shipped from
  core (copyrighted Goodman Games material per §8.1; stays in
  private `dcc-official-data`). +2 Vitest, +2 Playwright (fictional
  test class). 1005 Vitest green.

### Phase 5 (Sheet composition + class defaults)

- Phase 5 session 5 (2026-05-19): migrate remaining capitalized
  `sheetClass` readers to `actor.classId`. Four sites (Elf at
  `actor.js:198`; Cleric at `actor.js:2196`, `actor.js:2497`,
  `dcc.js:775`) flipped. +1 Vitest regression guard. Phase 5
  sub-arc closes; remaining refactor work is Phase 6.
- Phase 5 session 4 (2026-05-18):
  `game.dcc.registerSheetPart` + `applyClassDefaults`-aware
  `DCCSheet` intermediate base. 7 PC sheet subclasses collapsed to
  4-line stubs pinning `static CLASS_ID`. New
  `module/built-in-sheet-parts.mjs` seeds all 7. `actor-sheets-dcc.js`
  466 → 235 lines (-49%). All 7 sheet classes stay registered; no
  UX regression. +6 Vitest, +5 Playwright. 1002 Vitest green.
- Phase 5 session 3 (2026-05-18): register the four link fields
  (`classLink`, `mightyDeedsLink`, `spellcastingLink`, `spellburnLink`)
  as `HTMLField({ initial: '' })` on the base Player schema in
  `player-data.mjs`. Closes the Phase 5 session 1 latent gap —
  `applyClassDefaults`'s `enrichHtml` writes now persist on
  `system.class.*` in every world configuration. Pure schema add.
  +4 assertions in integration test, +2 Playwright cases. 996
  Vitest green (unchanged — assertions extend an existing test);
  Playwright extended with end-to-end gap closure + fresh-schema
  empty-string defaults.
- Phase 5 session 2 (2026-05-18): `game.dcc.registerClassStartingItems`
  + `applyClassStartingItems` shipped;
  `module/built-in-class-starting-items.mjs` seeds the dwarf
  ShieldBash. Dwarf's inline ShieldBash auto-create block collapsed
  to a 2-line uniform pattern; all 7 PC sheets now share identical
  `_prepareContext` shape (only classId literal differs). +13 Vitest,
  +5 Playwright. 996 Vitest green; 127 Playwright passed (1 latent
  xcc-core-book failure, unchanged baseline).
- Phase 5 session 1 (2026-05-18): `game.dcc.registerClassDefaults` +
  `applyClassDefaults` shipped; `module/built-in-class-defaults.mjs`
  seeds 7 PC entries; all 7 PC sheets in `module/actor-sheets-dcc.js`
  reduced to a single helper call (156 lines deleted, 623 → 467).
  Dwarf's inline ShieldBash auto-create kept (`result === 'initialized'`
  gate) pending the session-2 starting-items registry. +11 Vitest,
  +5 Playwright. 983 Vitest green; 122 Playwright passed (1 latent
  xcc-core-book DCCItemSheet override, unchanged baseline). Latent
  schema gap surfaced for the warrior/dwarf/wizard link-fields →
  follow-up slice in active queue.

### Phase 4 (Halfling vertical kickoff)

- Phase 4 session 1 (2026-05-18): `game.dcc.registerClassMixin` +
  `applyClassMixins` shipped; `'halfling'` mixin contributes
  `skills.sneakAndHide`; static schema body slimmed by one block.
  +11 Vitest, +3 Playwright; EXTENSION_API.md entries + homebrew
  recipe added.
- Phase 4 session 2 (2026-05-18): `'dwarf'` mixin contributes
  `skills.shieldBash` (StringField + DiceField + BooleanField mix).
  Exercises mixed field types via the registry; static schema body
  slimmed by another block. +1 Playwright (no new Vitest needed —
  registry mechanic covered in session 1). 966 Vitest unchanged;
  110 Playwright passed.
- Phase 4 session 3 (2026-05-18): `'thief'` mixin contributes 12
  skill SchemaFields (via inline `thiefSkill(label, ability)`
  helper) + two `schema.class.fields` mutations (`luckDie` DiceField
  '1d3', `backstab` StringField '0'). First mixin to touch both the
  skills and class field namespaces on the same registration.
  `DiceField` import dropped from `player-data.mjs` (was only
  needed for the two now-relocated thief fields). +1 Playwright
  asserting field presence, non-`agl` abilities, `handlePoison.ability`
  omission, `castSpellFromScroll.die` DiceField type, and the class
  fields' types+initials. 966 Vitest unchanged; 112 Playwright
  passed (was 110, +1 thief +1 dwarf-flake recovered).
- Phase 4 session 4 (2026-05-18): `'cleric'` mixin contributes 8
  class fields + 3 disapproval-range skills. **Also** extracted all
  built-in mixin registrations from `module/dcc.js:init` into a new
  `module/built-in-class-mixins.mjs` table + `registerBuiltInClassMixins`
  helper consumed by both the production init hook AND the
  integration-test setup — closes a latent gap where mixin fields
  weren't reaching integration tests that construct `PlayerData`
  directly. +1 Playwright case (read from `_source` to dodge
  `prepareDerivedData` overwrites). 966 Vitest unchanged; 113
  Playwright passed (was 112, +1 cleric).
- Phase 4 session 5 (2026-05-18): `'warrior'` mixin contributes
  `class.luckyWeapon` (nullable StringField, initial null) +
  `class.luckyWeaponMod` (StringField, initial `'+0'`). Smallest
  remaining class block — no skills. +1 Playwright case. 966
  Vitest unchanged; 114 Playwright passed (was 113, +1 warrior).
- Phase 4 session 6 (2026-05-18): `'wizard'` + `'elf'` mixins both
  call a shared `attachWizardFields(schema)` helper (defined in
  `module/built-in-class-mixins.mjs`) contributing 9 wizard class
  fields. Elf mixin additionally replaces `skills.detectSecretDoors`
  with HeightenedSenses defaults. Static `class` block in
  `player-data.mjs` shrunk to `{ className }`; `HTMLField` +
  `NumberField` imports dropped. **All seven DCC classes
  mixin-source their fields** — component 1 of the Class
  Decomposition complete. +2 Playwright cases. 966 Vitest
  unchanged; 116 Playwright passed (was 114, +2 wizard/elf).
- Phase 4 session 7 (2026-05-18): `DCCActor.classId` getter
  normalizes `system.details.sheetClass` to the lowercase canonical
  identifier (`'halfling'`, …); returns `null` when unset. Two
  halfling-keyed string comparisons migrated to the accessor —
  `module/actor.js:3281` (rollWeaponAttack halfling two-weapon
  fumble note) and `module/item.js:70` (halfling agility-floor
  branch in two-weapon dice-penalty computation). Other capitalized
  `sheetClass` comparisons (Elf / Cleric in `actor.js:182`,
  `actor.js:2180`, `actor.js:2481`, `dcc.js:746`) left untouched
  — out of slice scope; they migrate opportunistically with the
  Phase 5 `registerClassDefaults` writer-side rewrite. +4 Vitest
  in `actor.test.js`, +1 Playwright case in `extension-api.spec.js`
  exercising the accessor end-to-end. 970 Vitest (was 966, +4); 117
  Playwright (was 116, +1). Closes the Phase 4 non-class-extraction
  sub-arc; Phase 5 work (sheet composition + class defaults +
  starting items) remains.

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
