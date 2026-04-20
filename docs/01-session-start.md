# Session Start Prompt — `refactor/dcc-core-lib-adapter`

> Paste the block below into a fresh Claude Code session to resume work
> on the refactor. Keep this file in sync with `docs/00-progress.md` —
> if the current phase or blockers change there, update this prompt too.

---

We're resuming a refactor on the DCC FoundryVTT system. Working dir:
`/Users/timwhite/FoundryVTT-Next/Data/systems/dcc` (git worktree,
branch `refactor/dcc-core-lib-adapter`). Run `nvm use` first — `.nvmrc`
pins Node 24.

**Read these first, in order:**
1. `docs/00-progress.md` — rolling handoff log. Update at session end.
2. `docs/02-slice-backlog.md` — prioritized executable worklist; the
   next slice(s) come from the top of the active queue.
3. `docs/dev/ARCHITECTURE_REIMAGINED.md` — read §2 (pain points the
   refactor addresses), §7 (the 7-phase plan), and §8.6 (legacy-path
   retirement principle — Foundry-facing API stays as thin wrappers,
   `_xxxLegacy` branches retire once gate is exhaustive).
4. `docs/dev/EXTENSION_API.md` — what sibling modules consume (stable /
   internal / dead).
5. `docs/dev/TESTING.md` — testing tiers; `#browser-tests-playwright`
   covers the e2e launch recipe (fvtt CLI installPath / dataPath /
   Node 24 / world name gotchas).
6. `/Users/timwhite/WebstormProjects/dcc-core-lib/docs/MODIFIERS.md`
   — lib-side design doc for the tagged-union `RollModifier` type the
   adapter emits and consumes.

**Status:** **Phase 1 closed. Phase 2 CLOSED 2026-04-18. Phase 3
sessions 1–4 all CLOSED 2026-04-18. Phase 3 sessions 5 (first
damage-migration slice), 6 (crit + fumble migration), 7 (NPC
damage-bonus adapter route with proper attribution), 8 (PC magic-
weapon-bonus damage adapter route), 9 (thief backstab adapter
route — A2), 10 (warrior / dwarf deed-die adapter route — A3),
and 11 (two-weapon adapter route — A4, closes Group A) all
CLOSED 2026-04-19. Vendor sync to
`@moonloch/dcc-core-lib@0.4.1` (backstab fix + post-review API
cleanup) landed 2026-04-19. Group B1 (`dcc.registerItemSheet`
extension hook) + B2 (`EXTENSION_API.md` pain-point cross-reference
+ §2.12 stated contract) CLOSED 2026-04-19. Phase 3 session 12
(A5, 2026-04-19) dropped the `automateDamageFumblesCrits` gate
check. Phase 3 session 13 (A6, 2026-04-19) routed the
`options.showModifierDialog` path through the adapter —
`damageTerms` now thread through to `DCCRoll.createRoll` so the
dialog can modify attack + damage in one step. Phase 3 session 14
(A7, 2026-04-19) dropped the non-deed dice-bearing
`attackBonus` / `toHit` exclusion: `_canRouteAttackViaAdapter`
returns `true` unconditionally. Phase 3 session 15 (D1,
2026-04-19) **retired `_rollToHitLegacy`** — mechanical collapse:
gate + legacy body deleted; `_rollToHitViaAdapter`'s body folded
into `rollToHit`. First Group-D retirement landed. Phase 3 session
16 (D2 crit + fumble, 2026-04-20) **retired `_rollCriticalLegacy`
+ `_rollFumbleLegacy`** — paired collapse: both gates were
defensive-only (the `!automate` case was the real non-adapter
branch, and it had no lib call to do), so both legacy bodies +
both `_canRoute…` gates + both `_rollXxxViaAdapter` aliases folded
into unified `_rollCritical` / `_rollFumble` methods that branch
on `ctx.automate` internally. Second Group-D retirement landed.
Phase 3 session 17 (D2 damage sub-slice b, 2026-04-20) **broadened
the damage gate to accept trailing bracket-flavor formulas**
(`1d6+2[Slashing]`, `2d4-1[Piercing]`). New `peelTrailingFlavor`
helper in `module/adapter/damage-input.mjs` splits the trailing
`[flavor]` off the formula before parsing; `_rollDamageViaAdapter`
feeds the stripped formula + flavor into `DCCRoll.createRoll`'s
`Compound` term for chat-rendering parity with legacy. Gate now
rejects only the genuine per-term-flavor case (`/\d+d\d+\[/`) —
`damageRollFormula.includes('[')` blanket check removed. Die-
immediately-followed-by-bracket (`1d8[Slashing]`) still falls to
legacy (matches legacy's `hasPerTermFlavors` native-Roll branch;
folding would require a separate call about Compound-vs-native
rendering equivalence). **Candidates for next session: D2 damage
sub-slice (a) — unparseable formulas (extend parser or lossless
passthrough); or (c) multi-type per-term formulas and (d) dice-
bearing / cursed magic bonuses (both STOP AND ASK for lib-vs-rules
design surfacing).**
Phase 2 close-out pinned two
decisions: (a) `game.dcc.processSpellCheck` is permanent stable API
— no deprecation, no shim, route migration is per-call-site and
incremental; (b) `_runLegacyPatronTaint` is permanent adapter
infrastructure — RAW alignment deferred to backlog. Phase 3
session 1 closed open question #6 via a dialog-adapter
(`module/adapter/roll-dialog.mjs` + `promptSpellburnCommitment`).
Phase 3 session 2 split `DCCActor.rollToHit` into a dispatcher +
`_rollToHitLegacy` + `_rollToHitViaAdapter`; the adapter path
routes the simplest-weapon happy-path through the lib's
`makeAttackRoll` while preserving `dcc.modifyAttackRollTerms` and
the Foundry chat render path. Phase 3 session 3 added
`hookTermsToBonuses` in `module/adapter/attack-input.mjs` — pushed
`Modifier` terms with pure signed-integer formulas flow into
`attackInput.bonuses` and surface as `libResult.bonuses` + an
aggregate `{source:'bonuses',…}` entry in `libResult.modifiers`.
Phase 3 session 4 closed the long-range gap:
`_rollToHitViaAdapter` re-reads `terms[0].formula` post-hook and
assigns it to `attackInput.actionDie` via `normalizeLibDie`, so
dcc-qol's `DiceChain.bumpDie` in-place mutation is reflected in
`libResult.die`. Phase 3 session 5 split
`DCCActor.rollWeaponAttack`'s inline damage block into
`_rollDamage` + `_canRouteDamageViaAdapter` + `_rollDamageViaAdapter`
+ `_rollDamageLegacy`. Simplest-damage happy-path (single-die
`NdM[+K]` + adapter-routed attack + no backstab + no per-term
flavors) flows through the lib's `rollDamage`; Foundry keeps the
Roll + chat total; the lib-owned breakdown surfaces as
`flags['dcc.libDamageResult']`. Phase 3 session 6 split the inline
crit + fumble blocks the same way: `_rollCritical` /
`_rollFumble` dispatchers gate on (attack-via-adapter + automate
on) and route through `_rollCriticalViaAdapter` /
`_rollFumbleViaAdapter`, which call the lib's `rollCritical` /
`rollFumble` after Foundry evaluates — results surface as
`flags['dcc.libCritResult']` / `flags['dcc.libFumbleResult']`. See
`docs/00-progress.md` for full rationale.

**Phase 3 session 7 (2026-04-19) routed NPC damage-bonus
adjustments through the adapter.** `rollWeaponAttack` still bakes
`npcDamageAdjustment` into the formula string (for legacy
compatibility) and threads the raw value as an option into
`_rollDamage`. `buildDamageInput` peels it back off
`strengthModifier` and surfaces it as a `RollBonus` on `bonuses[]`
(`source: { type: 'other', id: 'npc-attack-damage-bonus' }`), so
the lib's breakdown attributes it correctly rather than
misattributing as Strength.

**Phase 3 session 8 (2026-04-19) routed PC magic weapon bonuses
through the adapter.** `parseDamageFormula` extended to sum any
number of trailing flat integer modifiers (PC with +1 sword
produces `1d8+2+1`). New `extractWeaponMagicBonus(weapon)` helper
returns 0 for non-magical weapons, a positive integer for
`damageWeaponBonus: '+N'`, and `null` for dice-bearing (`+1d4`) or
cursed (negative) bonuses — the latter two fall to legacy.
`_canRouteDamageViaAdapter` gates on the helper;
`_rollDamageViaAdapter` passes the bonus as an option into
`buildDamageInput`, which peels it off `strengthModifier` and
sets `input.magicBonus`. The lib surfaces it as
`{ source: 'magic', amount: N }` on `libDamageResult.breakdown`
alongside (not merged with) the Strength entry.

**Phase 3 session 9 (2026-04-19) routed thief backstab through
the adapter.** Followed on from the `dcc-core-lib@0.4.1` sync:
`AttackInput.isBackstab: true` drives the lib's auto-crit
(matches legacy Foundry's `crit = !fumble && options.backstab`
semantic); `DamageResult.subtotal` + `.multiplier` removed
(the new damage pipeline has no multiplier concept);
`AttackResult.critSource` added. `_canRouteAttackViaAdapter` +
`_canRouteDamageViaAdapter` dropped their `options.backstab →
false` gates. `_rollToHitViaAdapter` pushes the Table 1-9 bonus
term pre-hook (same as legacy) then surfaces it as a RollBonus
with `id: 'class:backstab'`, `source: { type: 'class', id:
'thief' }` on `attackInput.bonuses`. `rollWeaponAttack` already
swaps `damageRollFormula = weapon.system.backstabDamage` before
reaching `_rollDamage`, so the damage adapter sees the alternate
die naturally. Chat flag: `libResult.bonuses` now carries the
full bonuses list (was hook-added only); `libResult.critSource`
is surfaced for downstream crit-table routing.

**Phase 2 + 3 sessions 1–9 infrastructure session 10 builds on:**

- `DCCActor.rollSpellCheck` + `DCCActor.rollToHit` +
  `DCCActor._rollDamage` + `DCCActor._rollCritical` +
  `DCCActor._rollFumble` are all dispatchers. The two-pass
  formula/evaluate pattern (spell side) and the adapter-path-with-
  legacy-roll pattern (attack side, session 2; damage side, session
  5; crit + fumble side, session 6) are the templates for future
  slices.
- Adapter modules: `module/adapter/{character-accessors,
  foundry-roller, chat-renderer, spell-input, spell-events,
  attack-input, attack-events, damage-input, crit-fumble-input,
  roll-dialog, debug}.mjs`. Session 2 added `attack-input.mjs`
  (buildAttackInput) + `attack-events.mjs` (stub — combat events
  wire later). Session 3 extended `attack-input.mjs` with
  `hookTermsToBonuses` (translator for hook-pushed Modifier
  terms). Session 4 exported `normalizeLibDie` so the dispatcher
  can normalize post-hook `terms[0].formula` mutations. Session 5
  added `damage-input.mjs` (`parseDamageFormula` +
  `buildDamageInput` — translates a Foundry weapon damage formula
  into the lib's `DamageInput`). Session 6 added
  `crit-fumble-input.mjs` (`buildCriticalInput` +
  `buildFumbleInput` — translate weapon + luck state into the
  lib's `CriticalInput` / `FumbleInput`). Session 8 extended
  `damage-input.mjs` with `extractWeaponMagicBonus` + multi-mod
  `parseDamageFormula` so `DamageInput.magicBonus` gets
  populated for PC +N magic weapons.
- `module/adapter/roll-dialog.mjs` (added session 1) currently
  exports `promptSpellburnCommitment` only. When the attack /
  damage dialog needs its own prompt, **extend this file** — don't
  add a parallel `attack-dialog.mjs`. Open question #7 tracks the
  eventual generalization into a full roll-modifier dialog.
- `@moonloch/dcc-core-lib@0.4.0` vendored at
  `module/vendor/dcc-core-lib/`. Wave-1 modifier redesign covers
  checks / skills / dice / cleric; **combat subsystems still use
  `LegacyRollModifier` pending wave 3.** Session 2's attack bridge
  emits `LegacyRollModifier[]` via `makeAttackRoll`'s
  `appliedModifiers`; downstream consumers surface it through
  `flags['dcc.libResult'].modifiers`. Session 3 surfaces the
  per-bonus breakdown as `flags['dcc.libResult'].bonuses` so
  hook-injected penalties retain their labels. Session 4 keeps
  `flags['dcc.libResult'].die` in sync with the Foundry-evaluated
  die when hooks bump `terms[0].formula` in place. Session 5's
  damage bridge uses the lib's native `DamageResult.breakdown[]`
  shape — no legacy-modifier translation needed — and surfaces it
  as `flags['dcc.libDamageResult']`. Session 6's crit + fumble
  bridges surface `CriticalResult.roll.modifiers` /
  `FumbleResult.roll.modifiers` (lib-native `RollModifier[]`) on
  `flags['dcc.libCritResult'].modifiers` /
  `flags['dcc.libFumbleResult'].modifiers`.
- `module/adapter/debug.mjs` + `logDispatch('rollXxx',
  'adapter'|'legacy', details)` is PERMANENT. Sessions 2 + 5 + 6
  wired `logDispatch('rollWeaponAttack', ...)`,
  `logDispatch('rollDamage', ...)`, `logDispatch('rollCritical',
  ...)`, and `logDispatch('rollFumble', ...)` in both branches.
  Every future `_xxxViaAdapter` / `_xxxLegacy` must do the same.
- **Baseline (post-session-17 / D2 sub-slice b):** 879 Vitest tests
  pass, 82 Playwright e2e tests pass against live v14 Foundry.
  Dispatch-spec subset runs in ~40 s thanks to the session-reuse
  fixture; full Playwright suite runs in ~8 min.

**This session's goal:** **Phase 3 D2 damage — continue broadening
the damage gate toward exhaustive so `_rollDamageLegacy` can
retire (the last of the three D2 retirements). Sub-slice (b) —
trailing bracket flavors — landed in session 17. Next up: (a)
unparseable formulas (mechanical), (c) multi-type per-term
flavors (STOP AND ASK), or (d) dice-bearing / cursed
`damageWeaponBonus` (STOP AND ASK).**

Sessions 2–14 landed all of Group A (simplest-weapon, backstab,
deed dice, two-weapon, automate-off, modifier dialog, dice-bearing
toHit). Every common-case attack surfaces a lib-native result on
chat flags (`dcc.libResult` / `dcc.libDamageResult` /
`dcc.libCritResult` / `dcc.libFumbleResult`). Sessions 15 (D1) +
16 (D2 crit + fumble) retired the attack / crit / fumble legacy
branches and collapsed their dispatchers into single paths. Session
17 (D2 damage sub-slice b) broadened the damage gate to accept
trailing bracket-flavor formulas via the new `peelTrailingFlavor`
helper in `module/adapter/damage-input.mjs`.

**The damage gate is still the only one left.** Unlike crit /
fumble (whose gates were defensive-only),
`_canRouteDamageViaAdapter` makes real per-case rejections —
multi-type `[fire]+1d6[cold]`, unparseable formulas, dice-bearing
or cursed magic bonuses. Sub-slice (b) (trailing bracket flavors)
landed session 17; sub-slices (a), (c), (d) remain. See the
"Session slice — D2 damage" section below for the per-rejection
breakdown + stop-and-ask triggers. Each sub-slice is potentially
its own session; don't try to batch them all at once.

**A4 design note (lib-vs-rules, relevant precedent):** the lib's
`getTwoWeaponPenalty` returns flat `-1`/`-2`, but DCC RAW uses
dice-chain reductions on the action die instead. We deliberately
do NOT set `AttackInput.twoWeaponPenalty`; the bumped `actionDie`
from `item.js:prepareBaseData` flows through, and the lib computes
the attack on the bumped die. This is the canonical example of the
"don't silently translate divergence" rule. The D2 damage slice has
several similar forks — surface each one.

Phase 3 as a whole is the largest migration so far:
`rollWeaponAttack` → `makeAttackRoll` + `rollDamage` + `rollCritical`
+ `rollFumble`. All four core lib calls have adapter paths.
`rollToHit` / `_rollCritical` / `_rollFumble` are **single paths**
(legacy retired). `_rollDamage` is the last dispatcher pending
collapse.

**Critical integration point:** `dcc.modifyAttackRollTerms` is
dcc-qol's main hook. Since D1 it fires only inside `rollToHit`
(the single-path adapter body), before the Roll evaluates. Phase 3
has fully bridged it: pushed `Modifier` terms reflect into
`attackInput.bonuses` (`libResult.bonuses` + the `{source:'bonuses',…}`
aggregate on `libResult.modifiers`), and in-place mutations of
`terms[0].formula` reflect into `attackInput.actionDie`
(`libResult.die`). dcc-qol's two active handlers
(`applyFiringIntoMeleePenalty`, `applyRangeChecksAndPenalties` at
`../../modules/dcc-qol/scripts/hooks/listeners.js:25-27`) are both
observationally faithful through the adapter path.

### Session slice — D2 damage (`_rollDamageLegacy` retirement)

**The next Phase 3 slice.** Damage is the last of the three D2
legacy-branch retirements (attack D1 landed session 15, crit +
fumble D2 landed session 16). Unlike those two, the damage gate
has real per-case rejections — it's NOT a mechanical collapse.

**Read first:**

1. `docs/00-progress.md` — Phase 3 session 17 entry (D2 damage
   sub-slice b — bracket flavors), session 16 entry (D2 crit +
   fumble context), C3 audit entry, baseline test counts (879
   Vitest, 82 Playwright e2e at session 17 close).
2. `docs/02-slice-backlog.md` "D2 damage. Retire `_rollDamageLegacy`
   — pending gate-broadening" entry — lists the real rejections the
   gate still makes after sub-slice (b) (multi-type
   `[fire]+1d6[cold]` formulas, unparseable
   `parseDamageFormula(...) === null` formulas, dice-bearing or
   cursed `damageWeaponBonus` via `extractWeaponMagicBonus(...) ===
   null`) — each routes a real class of runtime inputs to legacy.
3. `module/actor.js` `_rollDamage` / `_canRouteDamageViaAdapter` /
   `_rollDamageViaAdapter` / `_rollDamageLegacy`.
4. `module/adapter/damage-input.mjs` — `parseDamageFormula`,
   `buildDamageInput`, `extractWeaponMagicBonus`,
   `peelTrailingFlavor`.
5. `/Users/timwhite/WebstormProjects/dcc-core-lib/docs/MODIFIERS.md`
   — if RAW alignment questions surface for specific damage
   cases (e.g. multi-type), check whether lib already supports them.

**The work:**

This slice is a *batch* — each real gate rejection is its own
sub-slice. The batch order (easiest → hardest per the backlog
entry):

a) **Unparseable `parseDamageFormula(...) === null` formulas** —
   extend the parser, or accept the formula as a lossless
   passthrough (lib's `libDamageResult.breakdown` may be empty /
   lossy but `libDamageResult.total` matches Foundry's Roll).
~~b) **Bracket-flavor formulas** (`1d6+2[Slashing]`)~~ —
   **DONE (session 17)**: `peelTrailingFlavor` in
   `module/adapter/damage-input.mjs` peels the trailing `[...]` off
   before parsing; `_rollDamageViaAdapter` plumbs the flavor into
   `DCCRoll.createRoll`'s `Compound` term. Gate rejects only the
   genuine per-term case (`/\d+d\d+\[/`). Die-immediately-followed-
   by-bracket (`1d8[Slashing]`) still falls to legacy.
c) **Multi-type per-term formulas** (`1d6[fire]+1d6[cold]`) —
   **STOP AND ASK before silently translating.** The lib's
   `DamageInput` shape may or may not support multi-typed rolls;
   per the `feedback_lib_vs_rules_stop_and_verify.md` memory, don't
   paper over divergence with adapter translation. Surface what
   you find to Tim.
d) **Dice-bearing / cursed `damageWeaponBonus`** — lib's
   `DamageInput.magicBonus` is an integer; extending to dice or
   negative values is a lib-shape decision. **STOP AND ASK** before
   changing either side.

Once each rejection is broadened OR accepted-as-passthrough, the
gate is exhaustive (always returns true when the defensive
`attackRollResult?.libResult` check passes). At that point, the
D2 damage collapse runs on the same pattern as D1 / D2 crit-fumble:
delete gate + legacy body + adapter alias, fold the adapter body
into `_rollDamage`, delete `_canRouteDamageViaAdapter`.

**Per-slice dispatch logging.** Every `_rollXxxViaAdapter` call
invokes `logDispatch('rollDamage', 'adapter', …)` (permanent
per `project_dcc_phase1_dispatch_logging.md` memory + the
Playwright adapter-dispatch spec's assertions). Don't remove.

**Per-slice browser test extension.** Per CLAUDE.md refactor-slice
rules, every slice adds at least one new Playwright assertion —
for damage gate broadening, extend `phase1-adapter-dispatch.spec.js`
`rollDamage` describe block with a new case per sub-slice. Sub-slice
(b) added `trailing bracket-flavor formula → routes via adapter` at
`phase1-adapter-dispatch.spec.js:1550`. The existing "multi-damage-
type formula → legacy" test at `phase1-adapter-dispatch.spec.js:1330`
becomes the first one rewritten when sub-slice (c) lands.

Do NOT: touch data-model slimming (Phase 4) or sheet composition
(Phase 5). Do NOT break `dcc.modifyAttackRollTerms` — it has
external consumers in dcc-qol. Do NOT silently translate lib-vs-
rules divergence — surface it instead.

**Before touching Phase 3 code, confirm the repo is green:**

- `npm test` — 879 Vitest tests + dice-gated integration at
  session 17 close. Final check before any commit.
- `npm run test:unit` — mock-only; runs in every environment.
- `npm run test:integration` — integration project. Skips if Foundry
  isn't detected (via `FOUNDRY_PATH`, `.foundry-dev/`, or
  `~/Applications/foundry-14`).
- **Dice-engine-gated tests** only run if `.foundry-dev/client/dice/`
  exists. `ls .foundry-dev/client/dice` — missing → run
  `npm run setup:foundry` once. Otherwise the dice cases **skip**
  (not fail); the status line shows `N passed | M skipped`.

**Browser tests (required for refactor slices — 82 Playwright
e2e pass at session 17 close):** see
`docs/dev/TESTING.md#browser-tests-playwright` for the full recipe.
TL;DR — with the fvtt CLI's `installPath` / `dataPath` pointed at
`foundry-14` / `FoundryVTT-Next` (verify via
`npx @foundryvtt/foundryvtt-cli configure view`):

```
nvm use 24
nohup npx @foundryvtt/foundryvtt-cli launch --world=v14 \
  >/tmp/foundry-v14.log 2>&1 & disown
cd browser-tests/e2e && npm test
```

Close any manual Foundry browser tab first — a logged-in Gamemaster
disables the Playwright login and tests hang for 11 s each.

**Constraints for Phase 3 work:**

- Small commits; each leaves the system in a working state.
- Four sibling modules must keep working:
  `../../modules/{dcc-qol,xcc,mcc-classes,dcc-crawl-classes}`. The
  stable surface in `EXTENSION_API.md` is load-bearing —
  `dcc.modifyAttackRollTerms` is dcc-qol's primary integration point;
  `game.dcc.DCCRoll.cleanFormula` + `game.dcc.DiceChain.{bumpDie,
  calculateCritAdjustment, calculateProportionalCritRange}` are
  XCC's attack/crit scaffolding. Preserve all of it.
- Attack / crit / fumble gates + legacy bodies are **already
  retired** (sessions 15 + 16). `_canRouteDamageViaAdapter` is
  the only gate still present; mirror any truth-table changes into
  `module/__tests__/adapter-weapon-damage.test.js` +
  `browser-tests/e2e/phase1-adapter-dispatch.spec.js`.
- The pre-commit hook runs `npm run format && git add . && npm test`
  — the `git add .` sweeps untracked files; stash or `.gitignore`
  them first.

**Remaining open questions** (tracked in `00-progress.md`):
- #2 package-name discrepancy — resolved in spirit by vendoring, can
  be closed out.
- #3 dead `dcc.update` hook — coordinate with XCC maintainer before
  Phase 4.
- #4 stabilizing undocumented `game.dcc.*` pieces — **Phase 3 is when
  this matters**; formal stabilization should land alongside the
  first attack-migration session.
- ~~#5 patron-taint RAW alignment~~ — closed at Phase 2 close.
- ~~#6 spellburn dialog integration~~ — closed at Phase 3 session 1.
- #7 wizard adapter-path modifier-dialog coverage beyond Spellburn
  — revisit after attack/damage dialog slice generalizes the
  `roll-dialog.mjs` scaffold.

Start by reading the five docs above, then run `npm test` to confirm
the repo is green before touching anything.
