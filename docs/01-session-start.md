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
5. `docs/dev/CLASS_DECOMPOSITION.md` — per-class component map for the
   Phase 4–6 arc (which extension API owns schema mixins, sheet parts,
   defaults, starting items, lib progression, variants — plus per-class
   status table). Read before relocating any class-bound concern.
6. `docs/dev/TESTING.md` — testing tiers; `#browser-tests-playwright`
   covers the e2e launch recipe (fvtt CLI installPath / dataPath /
   Node 24 / world name gotchas).
7. `/Users/timwhite/WebstormProjects/dcc-core-lib/docs/MODIFIERS.md`
   — lib-side design doc for the tagged-union `RollModifier` type the
   adapter emits and consumes.

**Status:** **Phase 4 session 6 (2026-05-18) closed the per-class
extraction arc with wizard + elf.** New `'wizard'` + `'elf'` entries
in the shared `BUILT_IN_CLASS_MIXINS` table
(`module/built-in-class-mixins.mjs`) both call a new
`attachWizardFields(schema)` helper that contributes the 9 wizard
class fields (`knownSpells` / `maxSpellLevel` / `spellCheckOtherMod`
/ `spellCheckDieOverride` / `spellCheckOverride` / `patron` /
`patronTaintChance` / `familiar` / `corruption` HTMLField). The
elf mixin **also** overrides `skills.detectSecretDoors` with the
HeightenedSenses defaults (`label='DCC.HeightenedSenses'` /
`ability='int'` / `value='+4'`). Static `class` block in
`module/data/actor/player-data.mjs` collapsed to a single
`className` StringField; static `skills` block carries only the
base `detectSecretDoors`. `HTMLField` + `NumberField` imports
dropped from `player-data.mjs`. **All seven DCC classes
(halfling, dwarf, thief, cleric, warrior, wizard, elf) now
mixin-source their fields** — component 1 of the Class Decomposition
(schema mixins) is complete for every built-in. +2 Playwright cases.
966 Vitest unchanged; 116 Playwright passed (was 114, +2 wizard/elf
cases), 1 latent failure (xcc-core-book DCCItemSheet override).

**Phase 4 session 5 (2026-05-18)** extended the vertical to warrior
(class.luckyWeapon + class.luckyWeaponMod). Smallest remaining
block; no skills.

**Phase 4 session 4 (2026-05-18)** extended the vertical to cleric
AND extracted the built-in mixin registrations into a shared module. New `'cleric'` mixin contributes 8 class fields (`spellCheck`
NumberField, `spellCheckAbility` StringField, `spellsLevel1–5`
NumberFields, `deity` nullable StringField, `disapproval` NumberField
min=1 max=20, `disapprovalTable` StringField) + 3 disapproval-range
skills (`divineAid` / `turnUnholy` / `layOnHands`) sharing an inline
`disapprovalSkill(label, extra)` helper — `divineAid` extends with a
`drainDisapproval` NumberField. Mixin extraction surfaced a latent
gap: the integration tests in
`module/__integration__/data-models.test.js` construct `PlayerData`
directly without going through Foundry's `init` hook, so the inline
mixin registrations in `module/dcc.js` weren't running for them.
**All four built-in mixin functions (halfling / dwarf / thief /
cleric) moved into a new `module/built-in-class-mixins.mjs` table +
`registerBuiltInClassMixins(register)` helper consumed by both the
production init hook AND the integration-test setup** — single source
of truth for built-in mixins; future Phase 4 sessions only edit the
table. +1 Playwright case in `extension-api.spec.js` reads from
`player.system._source` (raw, not derived) since `prepareDerivedData`
overwrites `class.spellCheck` and the cleric skills' `.value` slots
with computed strings. 966 Vitest green (unchanged from session 1);
113 Playwright passed (was 112, +1 cleric case), 1 latent failure
(documented xcc-core-book DCCItemSheet override).

Phase 4 session 1 (2026-05-18) shipped the
`game.dcc.registerClassMixin(classId, mixinFn)` infrastructure —
new stable extension helper, `CONFIG.DCC.classMixins`
registry, deterministic-sorted application during
`PlayerData.defineSchema()` (before the existing
`dcc.definePlayerSchema` hook). DCC dogfoods its own seed by
registering a built-in `'halfling'` mixin in `module/dcc.js:init` that
contributes `skills.sneakAndHide`; the static halfling block in
`module/data/actor/player-data.mjs` is deleted. First chip away at
§2.1's monolithic Player schema; Foundry-smelling shape
(`system.skills.sneakAndHide`) intact per §2.12. +11 Vitest, +3
Playwright.

**Phase 1 closed. Phase 2
CLOSED 2026-04-18. Phase 3
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
(`1d6+2[Slashing]`, `2d4-1[Piercing]`) via the new
`peelTrailingFlavor` helper. Phase 3 session 18 (D2 damage sub-
slice a, 2026-04-20) **accepted unparseable formulas as a
lossless passthrough** — lance `(1d8)*2+3`, multi-die `1d8+1d4`,
custom `damageOverride` homebrew shapes. Vendor sync to
`@moonloch/dcc-core-lib@0.6.0` landed 2026-04-20 (commit
`b751ae4`) with richer `DamageInput` — explicit negative
`magicBonus` (cursed) + new `extraDamageDice[]` slot for
dice-bearing magic + per-term flavors. Phase 3 session 19
(D2 damage c + d, 2026-04-20) **retired `_rollDamageLegacy`** —
combined slice broadening the gate for multi-type per-term
formulas (`1d6[fire]+1d6[cold]` via `parseMultiTypeFormula`) AND
dice-bearing / cursed `damageWeaponBonus` (via the structured
`parseWeaponMagicBonus` helper + `buildDamageInput`'s extended
`extraDamageDice` / negative-`magicBonus` handling). Gate +
legacy body + via-adapter alias all deleted; `_rollDamage` is now
a single path. `_buildLibDamageResult` uses a sequenced-natural
roller closure so multi-die damage formulas map each lib
`evaluateRoll` call to its corresponding `damageRoll.dice[i]`.
**All three D2 retirements are now complete** — Group D legacy-
branch retirement for attack / crit / fumble / damage landed.
Phase 3 session 20 (C1, 2026-04-20) **retired the `critText` /
`fumbleText` compatibility shims** on `rollWeaponAttack` /
`rollCritical` messageData — 3 lines dropped from
`module/actor.js`; the canonical `critResult` / `fumbleResult`
fields stay emitted. dcc-qol fix (2-line rename, documented as a
migration recipe in `EXTENSION_API.md`) pending dcc-qol release.
Phase 2 close-out pinned `game.dcc.processSpellCheck` as permanent
stable API — no deprecation, no shim, route migration is per-call-
site and incremental. (The original Phase 2 close-out also deferred
patron-taint RAW alignment as "permanent adapter infrastructure";
session 21 / D3a resolved that lib-side on 2026-04-24 and retired
`_runLegacyPatronTaint`; session 22 / D3b-α wired the per-patron
manifestation table loader against the existing compendium
content.) Phase 3 session 26 (Q7-phase1, 2026-05-17) landed the
generalized roll-modifier-dialog adapter scaffold
(`promptRollModifierDialog` + `parseRollIntoDieAndModifier` in
`module/adapter/roll-dialog.mjs`) and folded the
`showModifierDialog` clause into both skill-check adapter routes;
dispatcher dropped its `showModifierDialog → legacy` clause.
**Phase 3 session 27 (Q7-phase2, 2026-05-17) extended that scaffold
to spell-check.** `promptRollModifierDialog` gained an optional
`spellburn` descriptor (callback captures str/agl/sta and the
wrapper subtracts the burn from `modifierTotal` so callers can
forward `input.spellburn` without double-counting); the bespoke
`promptSpellburnCommitment` helper retired. New
`_promptSpellCheckDialog` + `_applySpellCheckDialogToOptions`
helpers on `DCCActor` build the term list and fold the result
back into `options`; `_rollSpellCheckViaAdapter` and
`_castNakedViaAdapter` invoke the unified prompt post-dispatch-
log. `_castViaCalculateSpellCheck` honors the new options
(`actionDieOverride`, `dialogModifierTotal`) by subtracting the
lib's auto-additive `casterLevel + abilityModifier` from the
dialog total and feeding the net as a single `dialog-modifier`
situational. Open question #7 is now fully closed.
Phase 3
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

**Standing infrastructure the next session builds on:**

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
  populated for PC +N magic weapons. Session 22 added
  `loadPatronTaintTable(actor)` to `spell-input.mjs` (mirror of
  `loadDisapprovalTable`) + seeded `CONFIG.DCC.patronTaintPacks`
  in `module/dcc.js` with `dcc-core-book` + `xcc-core-book`
  side-effect packs (default); sibling content modules can push
  `addPack(…)` on init.
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
- **Test suites are green at branch HEAD.** Run `npm test` (Vitest)
  and the full Playwright e2e suite (see "Browser tests" below) to
  confirm before touching anything. Dispatch-spec subset runs in
  ~40 s thanks to the session-reuse fixture; full Playwright suite
  runs in ~8 min.

**This session's goal:** **Session 27 / Q7-phase2 extended the
roll-modifier-dialog scaffold to spell-check (2026-05-17).** The
`promptRollModifierDialog(terms, opts)` wrapper in
`module/adapter/roll-dialog.mjs` gained an optional `spellburn`
descriptor — when set, a Spellburn term is appended to the dialog
and the returned object carries `spellburn: { str, agl, sta }` with
the chosen burn amounts (original - final ability values). The
wrapper subtracts the burn from `modifierTotal` so callers can
forward the commitment through `input.spellburn` without
double-counting (the lib injects its own "spellburn" modifier).
The bespoke `promptSpellburnCommitment` helper retired entirely
(only consumers were wizard / naked spell-check routes).

Adapter changes:
- **`_promptSpellCheckDialog(spellItem, ctx)`** + companion
  **`_applySpellCheckDialogToOptions(prompt, options)`** on
  `DCCActor` build the spell-check term list (Die / Compound /
  CheckPenalty / Other Bonus / Spellburn) and fold the prompt
  result back into `options` (spellburn → `options.spellburn`;
  action die → `options.actionDieOverride`; flat modifier total →
  `options.dialogModifierTotal`). `ctx.castingMode` drives
  CheckPenalty `apply`, `ctx.isIdolMagic` skips CheckPenalty
  entirely, and `ctx.spellburnEligible` adds the Spellburn term.
- **`_rollSpellCheckViaAdapter`** now invokes the unified prompt
  for both `wizard` and `cleric` casting modes (post-dispatch-log
  so cancels stay observable). The cleric branch in the dispatcher
  used to fall through without a dialog; now it gets one (no
  Spellburn, no CheckPenalty for idol-magic). NPCs and pre-
  committed burns still bypass.
- **`_castNakedViaAdapter`** mirrors the same: unified prompt
  replaces the bespoke spellburn pop-up; `suppressLibAuto` zeroes
  `input.casterLevel` + `input.abilityModifier` when the dialog
  drives the modifier list so the lib's auto level + ability don't
  double-count with the user's flat total.
- **`_castViaCalculateSpellCheck`** honors `options.actionDieOverride`
  + `options.dialogModifierTotal` by overriding `input.actionDie`
  and feeding `dialogModifierTotal - (casterLevel + libGetAbilityModifier(score))`
  as a single `dialog-modifier` situational modifier. The
  subtraction is load-bearing: the lib re-derives `casterLevel +
  abilityModifier` from `character` inside `buildSpellCastInput`,
  so unsubtracted dialogTotal would double-count.

Tests: 949 Vitest (+4 new in `adapter-roll-dialog.test.js`
covering the spellburn descriptor + modifierTotal subtraction; 4
spell-check tests flipped to assert against the unified prompt).
Playwright: +3 new cases (wizard / cleric / naked
showModifierDialog → adapter dispatch).

**Open question #7 is now fully closed.** Both Q7-phase1 (skill
check) and Q7-phase2 (spell check) have folded the
`showModifierDialog` clause into the adapter routes.

Session 26 (Q7-phase1) landed the skill-check fold:
- **`_rollSkillCheckViaAdapter`** grew a `showModifierDialog`
  branch using `promptRollModifierDialog`; `_buildSkillCheckLegacyTerms`
  extracted as a shared term-builder; dispatcher dropped its
  `!!options.showModifierDialog → legacy` clause.

Session 27 (Q7-phase2) closed the spell-check side (see the
"This session's goal" block above for the full inventory).

**Phase 3 backlog (all STOP AND ASK)**: Remaining
`processSpellCheck` callers are stable-surface or item-fallback:
- `DCCItem.rollSpellCheck` — `noCasterProfile` + unknown
  castingMode fallbacks. Permanent stable surface per Phase 2
  close-out.
- `_rollSkillCheckLegacy` — strictly the no-die / description-only
  fallback (the showModifierDialog clauses retired at session 26).

Group E vertical slice for XCC/MCC validation is the next
substantive arc (explicit pick required — halfling /
mercurial-magic / homebrew single-class).
`docs/02-slice-backlog.md` has the full inventory.

Sessions 2–14 landed all of Group A (simplest-weapon, backstab,
deed dice, two-weapon, automate-off, modifier dialog, dice-bearing
toHit). Every common-case attack surfaces a lib-native result on
chat flags (`dcc.libResult` / `dcc.libDamageResult` /
`dcc.libCritResult` / `dcc.libFumbleResult`). Sessions 15 (D1) +
16 (D2 crit + fumble) + 19 (D2 damage) retired the attack / crit
/ fumble / damage legacy branches and collapsed their dispatchers
into single paths. `_rollToHit` / `_rollCritical` / `_rollFumble`
/ `_rollDamage` are all single paths now.

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
+ `rollFumble`. All four core lib calls have adapter paths, AND all
four are now **single paths** (legacy retired at sessions 15 / 16 /
19). Session 20 (C1) then dropped the `critText` / `fumbleText`
dcc-qol-compat shims — the messageData shape is now slimmed to its
canonical field set on both `rollWeaponAttack` and `rollCritical`.

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

### Next-session guidance

**Phase 4 session 4 (2026-05-18)** added the cleric mixin (8 class
fields + 3 disapproval-range skills) and consolidated all four
built-in mixin registrations into a shared
`module/built-in-class-mixins.mjs` table — both `module/dcc.js:init`
and `module/__integration__/setup-foundry.js` now call
`registerBuiltInClassMixins(register)`. Closed a latent integration-
test gap where mixin fields weren't reaching tests that construct
`PlayerData` directly. +1 Playwright; 113 Playwright passed.

Phase 4 session 3 (2026-05-18) extended the vertical to thief —
the largest single-class relocation so far. New `'thief'` mixin
contributes the 12-skill block (sneakSilently / hideInShadows /
pickPockets / climbSheerSurfaces / pickLock / findTrap / disableTrap
/ forgeDocument / disguiseSelf / readLanguages / handlePoison /
castSpellFromScroll) **plus** `schema.class.fields.luckDie`
(DiceField '1d3') + `schema.class.fields.backstab` (StringField
'0'). First mixin to touch BOTH `schema.class.fields` and
`schema.skills.fields` on the same registration, and first to use
an inline factory helper (`thiefSkill(label, ability)`) to compact
10 skills sharing the label/ability/value triple. `DiceField`
import dropped from `player-data.mjs`. +1 Playwright; 112 Playwright
passed at session-3 close.

Phase 4 session 2 (2026-05-18) extended the halfling vertical to
dwarf — `skills.shieldBash` relocated off `player-data.mjs`'s
static body onto a built-in `'dwarf'` class mixin in
`module/dcc.js:init`. Exercises mixed field types (StringField
label/ability/value + DiceField die + BooleanField useDeed) through
the registry.

Phase 4 session 1 (2026-05-18) shipped the
`game.dcc.registerClassMixin(classId, mixinFn)` stable extension
helper + `CONFIG.DCC.classMixins` registry. Mixins run in
deterministic-sorted classId order during
`PlayerData.defineSchema()`, **before** the existing
`dcc.definePlayerSchema` hook. `module/dcc.js`'s init registers a
built-in `'halfling'` mixin contributing `skills.sneakAndHide`.
Last-write-wins semantics on duplicate `classId` matches the
mercurial-magic registry's behavior. EXTENSION_API.md grew a new
Stable `game.dcc.registerClassMixin` row + homebrew migration
recipe.

**Remaining Phase 4 (halfling vertical) candidates:**

1. **Phase 4 closer slices** (per-class schema extraction is done):
   - **Class-id dispatch helper** — replace the remaining
     `system.details.sheetClass === 'Halfling'` string checks in
     `module/actor.js:3265-3266` + `module/item.js:70-103` with a
     single `actor.classId` accessor reading the canonical
     lowercase ID. Tied to the eventual `Character.classId`
     projection from the lib. Appendix C tracks the post-Phase-1
     form of the halfling i18n stopgap. Quick win that could land
     as a Phase 4 closer.
2. **Start Phase 5 — sheet composition + class defaults.** Per
   `docs/dev/CLASS_DECOMPOSITION.md` §3.2 / §3.3 / §3.4:
   - **Sheet parts registry** (`game.dcc.registerSheetPart({
     classId, tab, template, condition })`) — collapse the 7
     class sheets in `module/actor-sheets-dcc.js` (+ partials at
     `templates/actor-partial-*.html`) into one `DCCSheet` that
     composes per `character.classId`.
   - **Class defaults registry** (`registerClassDefaults`) —
     extract the `_prepareContext` first-open blocks (lines
     `60 / 128 / 201 / 269 / 346 / 518 / 595` in
     `actor-sheets-dcc.js`) bundling class identity + mechanical
     defaults + skill activation toggles (notably the
     `skills.shieldBash.useDeed` cross-class toggle).
   - **Starting items registry** — extract the dwarf ShieldBash
     auto-create from `module/actor-sheets-dcc.js:434-454`.
2. **Class-id dispatch helper** — replace the remaining
   `system.details.sheetClass === 'Halfling'` string checks in
   `actor.js:3265-3266` + `item.js:70-103` with a single
   `actor.classId` accessor. Appendix C tracks the post-Phase-1
   form of the halfling i18n stopgap.
3. **Phase 5 work (halfling / dwarf sheet-tab composition)** — out
   of scope for Phase 4 sessions; tracked in the backlog for later.

**Other still-viable Group E candidates** (independent of halfling):

4. **Homebrew single-class slice** — with `registerClassMixin` now
   in place, this becomes a thinner exercise. Still validates §2.8
   end-to-end once Phase 5 sheet composition lands.
5. **`game.dcc.processSpellCheck` audit + retirement decision.**
   The function is pinned as permanent stable API but is now only
   reached via `DCCItem.rollSpellCheck` fallbacks. Could be slimmed
   significantly (patron-taint codepath is dead post-D3, the
   `forceCrit` mutation is dead post-D4(remainder), and the
   no-table HTML emit is dead post-Q7-phase1).

**Also pending — dcc-qol sibling-fix coordination.** Session 20's
shim removal on the DCC side leaves dcc-qol's
`scripts/hooks/attackRollHooks.js:283-284` reading fields that no
longer emit. A 2-line rename (`critText`→`critResult`,
`fumbleText`→`fumbleResult`) is documented as a migration recipe in
`EXTENSION_API.md` under "Sibling-module migration recipes →
dcc-qol migration". Tim is landing the dcc-qol PR on his schedule;
do NOT edit that repo from this session. If Tim signals it's landed,
next slice can optionally include a follow-up assertion in
`../../modules/dcc-qol` verifying the rename (observational only —
no DCC-side change needed).

Ask Tim which to pick.

Do NOT: touch data-model slimming (Phase 4) or sheet composition
(Phase 5). Do NOT break `dcc.modifyAttackRollTerms` — it has
external consumers in dcc-qol. Do NOT silently translate lib-vs-
rules divergence — surface it instead.

**Before touching Phase 3 code, confirm the repo is green:**

- `npm test` — Vitest unit + integration suites. Final check
  before any commit.
- `npm run test:unit` — mock-only; runs in every environment.
- `npm run test:integration` — integration project. Skips if Foundry
  isn't detected (via `FOUNDRY_PATH`, `.foundry-dev/`, or
  `~/Applications/foundry-14`).
- **Dice-engine-gated tests** only run if `.foundry-dev/client/dice/`
  exists. `ls .foundry-dev/client/dice` — missing → run
  `npm run setup:foundry` once. Otherwise the dice cases **skip**
  (not fail); the status line shows `N passed | M skipped`.

**Browser tests (required for refactor slices):** see
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
- Attack / crit / fumble / damage gates + legacy bodies are **all
  retired** (sessions 15 + 16 + 19). Every `rollWeaponAttack`
  downstream is single-path. Any new test assertions for damage
  structuring go in `module/__tests__/adapter-weapon-damage.test.js`
  + `browser-tests/e2e/phase1-adapter-dispatch.spec.js`.
- The pre-commit hook runs `npm run format && git add . && npm test`
  — the `git add .` sweeps untracked files; stash or `.gitignore`
  them first.

**Remaining open questions** (tracked in `00-progress.md`):
- ~~#2 package-name discrepancy~~ — closed 2026-05-18. Vendor
  approach made the original "can't `npm install` the unscoped name"
  problem moot; documentation cleanup landed the same day to call
  out the scoped `@moonloch/dcc-core-lib` name in
  `ARCHITECTURE_REIMAGINED.md`, `EXTENSION_API.md`, and
  `CLAUDE.md`.
- ~~#3 dead `dcc.update` hook~~ — closed 2026-05-18. XCC removed
  the speculative listener on `chore/migrate-to-dcc-extension-api`;
  DCC's `EXTENSION_API.md` Dead-hooks table cleared. Decision: don't
  emit; no real consumer existed.
- ~~#4 stabilizing undocumented `game.dcc.*` pieces~~ — closed
  2026-05-18 via `EXTENSION_API.md` re-audit. Every symbol XCC
  touches is in the Stable table; no gaps. Audit also flipped
  `dcc.afterComputeSpellCheck` from "none yet" to a live XCC
  consumer (XCC retired `xcc-actor.js` + `CONFIG.Actor.documentClass`
  same day) and recorded XCC's actor-sheet-helper migration as
  complete (19/19 sites). MCC + dcc-crawl-classes haven't migrated
  the helper yet — opt-in, no deadline.
- ~~#5 patron-taint RAW alignment~~ — closed at session 21 / D3a
  (2026-04-24). `dcc-core-lib@0.7.0` landed the two RAW triggers;
  `_runLegacyPatronTaint` retired. D3 arc (a/b-α/b-β/b-γ/c) fully
  closed at session 23.
- ~~#6 spellburn dialog integration~~ — closed at Phase 3 session 1.
- ~~#7 wizard adapter-path modifier-dialog coverage beyond
  Spellburn~~ — **fully closed across sessions 26 + 27
  (2026-05-17).** Q7-phase1 landed `promptRollModifierDialog` +
  skill-check fold; Q7-phase2 extended the wrapper with a spellburn
  descriptor and folded wizard / cleric / naked spell-check routes,
  retiring the bespoke `promptSpellburnCommitment` helper.

Start by reading the five docs above, then run `npm test` to confirm
the repo is green before touching anything.
