# Refactor Progress — `refactor/dcc-core-lib-adapter`

> **Handoff artifact.** Update at the end of every work session and after any
> significant decision. Future Claude sessions rely on this — without it,
> context is lost each time.

## Current phase

**Extension API (2026-04-19) — `dcc.registerItemSheet(types,
SheetClass, options?)` shipped** (Group B1 from
`02-slice-backlog.md`). Folds the
`Items.unregisterSheet('core', ItemSheetV2) +
Items.registerSheet('dcc', SheetClass, {…})` two-call dance into a
single declarative call. Closes the §2.5 / §2.11 pain point about
modules having to know Foundry's exact incantation and ordering for
"replace the default sheet". Helper lives in
`module/extension-api.mjs`; `game.dcc.registerItemSheet` exposed at
init time alongside the other stable exports. DCC's own
`DCCItemSheet` registration in `module/dcc.js` was migrated to
dogfood the helper — proves the API works for the existing
high-traffic call site, not just future module callers. 847 Vitest
tests pass (was 838, +9 in `extension-api.test.js`: type
normalization (string / array / undefined), `makeDefault: false`
preserves existing default, `makeDefault: true` triggers
unregister-first with correct call order, custom scope honored,
defensive missing-`SheetClass` + missing-`Items` errors,
defensive missing-`ItemSheetV2` skip-unregister) + 66 Playwright
e2e tests pass against live v14 (was 63, +3 in new
`extension-api.spec.js`: helper exposed on `game.dcc`,
register-without-default keeps the existing default sheet,
register-with-default unseats the prior default). Documented in
`EXTENSION_API.md` as **stable** with §2.5 / §2.11 pain-point
references.

**Docs (2026-04-19) — `EXTENSION_API.md` cross-referenced against
`ARCHITECTURE_REIMAGINED.md §2.8–§2.12` pain points** (Group B2 from
`02-slice-backlog.md`). New "Stated contract: Foundry-smelling
surface (§2.12)" section codifies the schema-shape constraint that
bounds Phase 4. Both surface tables (hooks emitted by the system,
`game.dcc.*` exports) gained a "Pain points it addresses" column so
each stable item is traceable to the §2 motivation it serves.
Recommendations section grew two entries: (6) honor the §2.12
contract during schema slimming, (7) plan future extension-hook
additions (`dcc.registerItemSheet`, `registerClassMixin`,
`registerSheetPart`, `registerVariant`) as stable-from-day-one to
relieve §2.11 module-extension pressure. Pure-docs slice; no test
changes.

**Phase 3 — ACTIVE. Session 7 (2026-04-19) routed the NPC
damage-bonus adjustment through the adapter with correct
attribution.** The dispatcher previously folded the appended
`±N` adjustment into `strengthModifier` (silently misattributed
to Strength in the lib breakdown). Session 7 keeps
`rollWeaponAttack` baking the adjustment into the formula (so
`_rollDamageLegacy` keeps working unchanged) but threads the raw
`npcDamageAdjustment` as an option into `_rollDamage`. The adapter
path's `buildDamageInput(parsed, { npcDamageAdjustment })` now
peels the adjustment off `strengthModifier` and surfaces it as a
`RollBonus` (`source: { type: 'other', id: 'npc-attack-damage-bonus' }`)
on `bonuses[]`. The lib's `rollDamage` aggregates that into a
`{ source: 'bonuses', amount: N }` breakdown entry on
`flags['dcc.libDamageResult']` instead of crediting Strength. PCs
unaffected (their damage formula already bakes Strength via
`computeMeleeAndMissileAttackAndDamage`; `npcDamageAdjustment` is
0 for non-NPCs). 838 Vitest tests pass (up from 834 — 4 new in
`adapter-weapon-damage.test.js` covering `buildDamageInput` with
positive / negative / zero NPC adjustments, plus the
`_rollDamage` dispatch with the breakdown attribution check) + 34
Playwright dispatch tests pass against live v14 Foundry (33
prior + 1 new — `NPC with attackDamageBonus.melee.adjustment`
asserts both dispatch lines are `adapter` and reads the chat
flag's breakdown to confirm the `bonuses` entry exists with
`amount === 2` while no `Strength` entry appears).

**Phase 3 — session 6 (2026-04-19) completed the first
crit + fumble migration slice.** `DCCActor.rollWeaponAttack`'s inline
crit and fumble blocks are now dispatchers: `_rollCritical` /
`_rollFumble` gates route through the adapter when the attack itself
went via the adapter AND `automateDamageFumblesCrits` is on.
Everything else (legacy-routed attacks, automate-off) stays on
`_rollCriticalLegacy` / `_rollFumbleLegacy` (the pre-split bodies
verbatim). Both adapter paths use the same two-pass pattern session
5 locked in for damage: Foundry's `DCCRoll.createRoll` still
evaluates and remains the source of truth for chat rendering + the
anchor total; the lib's `rollCritical` / `rollFumble` are then
called with deterministic sync rollers returning the natural die
values, populating `flags['dcc.libCritResult']` /
`flags['dcc.libFumbleResult']` on the chat message. No divergence
with the displayed total this session — observational only.
Dispatch: `logDispatch('rollCritical', 'adapter'|'legacy', …)` and
`logDispatch('rollFumble', 'adapter'|'legacy', …)` fire first line
in each branch. 834 Vitest tests pass (up from 821 — 13 new in
`adapter-weapon-crit-fumble.test.js`: `buildCriticalInput` +
`buildFumbleInput` unit coverage, gate truth-tables for both
dispatchers, adapter + legacy dispatch branches, libCritResult
contents, libFumbleResult contents, NPC-fumble die swap) + 33
Playwright dispatch tests pass against live v14 Foundry (28
prior + 5 new crit/fumble cases: adapter-path crit when attack was
adapter, legacy crit for backstab, adapter-path libCritResult flag
shape, adapter-path fumble on forced natural 1, libFumbleResult
flag shape). Full 62-test e2e suite runs in ~7 min (down from
~10 min) after a session-reuse fixture landed in the dispatch
spec — dispatch-spec tests now ~0.5-1 s each instead of 7-13 s.

**Phase 3 — session 5 (2026-04-19) started the damage
migration.** `DCCActor.rollWeaponAttack`'s inline damage block is now
a dispatcher: `_rollDamage` gate routes the simplest-damage happy-path
through `_rollDamageViaAdapter` (attack already went through the
adapter + single-die `NdM[+K]` formula + no backstab + no per-term
flavors); everything else through `_rollDamageLegacy` (the pre-split
body verbatim). The adapter path uses the same two-pass pattern
session 2 used for attacks: Foundry's `DCCRoll.createRoll` still
evaluates and remains the source of truth for chat rendering + the
damage-applyable anchor; the lib's `rollDamage` is then called with a
deterministic sync roller returning the natural die value, populating
`flags['dcc.libDamageResult']` on the chat message. No divergence
with the displayed total this session — observational only.
Dispatch: `logDispatch('rollDamage', 'adapter'|'legacy', …)` fires
first line in each branch. 821 Vitest tests pass (up from 811 — 10
new in `adapter-weapon-damage.test.js`: `parseDamageFormula` +
`buildDamageInput` unit coverage, gate truth-table, both dispatch
branches, minimum-1-damage clamp, per-term-flavor legacy routing) +
27 Playwright dispatch tests pass against live v14 Foundry (26 prior
+ 1 new — multi-damage-type `1d6[fire]+1d6[cold]` routes attack via
adapter + damage via legacy, validating the per-term-flavor gate
end-to-end; the happy-path + backstab weapon-attack cases now
additionally assert the `rollDamage` log line).

**Phase 3 — session 4 (2026-04-18) added the long-range
dice-chain translation.** `_rollToHitViaAdapter` now re-reads
`terms[0].formula` after `dcc.modifyAttackRollTerms` fires and, when
a listener mutated the action die in place (dcc-qol's long-range
`DiceChain.bumpDie('1d20') === '1d16'`), normalizes it via
`normalizeLibDie` and assigns to `attackInput.actionDie` before
calling `makeAttackRoll`. Result: `libResult.die` now agrees with the
die the Foundry Roll actually evaluated on, closing the divergence
session 3 noted but didn't fix. 811 Vitest tests pass (up from 808 —
3 new: `normalizeLibDie` unit, post-hook bump round-trip, no-op when
the hook leaves `terms[0]` alone); Playwright dispatch suite unchanged
(observational change to a flag field, no new dispatch branches).

**Phase 3 — session 3 (2026-04-18) added the hook-translation
bridge.** `_rollToHitViaAdapter` captures terms pushed by
`dcc.modifyAttackRollTerms` listeners (snapshotting `terms.length`
before the hook and slicing after), translates pure signed-integer
`Modifier` terms into lib `RollBonus[]` via `hookTermsToBonuses`, and
assigns them to `attackInput.bonuses`. The lib's `makeAttackRoll`
aggregates them into `totalBonus` + emits a `{source: 'bonuses',
…}` entry in `appliedModifiers`; the per-bonus breakdown is
preserved as `libResult.bonuses` on the chat flag. dcc-qol's
firing-into-melee / medium-range penalties surface in the lib result
alongside the base attack bonus.

**Phase 3 — session 2 (2026-04-18) landed the first attack-migration
slice.** `DCCActor.rollToHit` is a dispatcher: simplest-weapon
happy-path (no deed, no backstab, no two-weapon, no
`showModifierDialog`, `automateDamageFumblesCrits` on, simple numeric
`weapon.system.toHit`) routes through `_rollToHitViaAdapter`;
everything else through `_rollToHitLegacy` (pre-dispatcher body
verbatim). The adapter path preserves the legacy terms /
`dcc.modifyAttackRollTerms` / `DCCRoll.createRoll` pipeline for chat
rendering and hook compatibility, but after evaluation feeds the
natural d20 into the lib's `makeAttackRoll` so the lib owns classification
+ the `appliedModifiers` list that surfaces as `dcc.libResult` on the
chat flags. dcc-qol's `applyFiringIntoMeleePenalty` and
`applyRangeChecksAndPenalties` keep working unchanged (same hook, same
`terms` shape). 26 Playwright dispatch tests passed against live v14
Foundry (verified 2026-04-18, 3.0 min run).

**Phase 3 — session 1 (2026-04-18) shipped the Spellburn
dialog-adapter scaffold.** Open question #6 resolved: the adapter path
for wizard / elf casts with `options.showModifierDialog` now prompts a
DialogV2-based Spellburn input adapter-side (`module/adapter/roll-dialog.mjs`),
forwards the resulting `SpellburnCommitment` as `options.spellburn`, and
delegates to `_rollSpellCheckViaAdapter` — which already knew how to
apply the burn via `onSpellburnApplied`. The prior latent regression
(wizard adapter casts silently skipping the Spellburn UI) is fixed.

**Phase 2 — CLOSED 2026-04-18.** Both gates resolved. See the Phase 2
close-out section below for decisions + hand-off.

**Phase 2 — Spell checks — session 5 complete.** Spellburn + mercurial
magic now flow through the adapter for wizard / elf casts.
`buildSpellCheckArgs` forwards `options.spellburn` (a lib
`SpellburnCommitment`) into `input.spellburn`; the lib's `castSpell`
adds a spellburn modifier to the roll formula and returns
`result.spellburnApplied`. The new `onSpellburnApplied` bridge in
`spell-events.mjs` subtracts the burn from `system.abilities.<str|agl|sta>
.value` (clamped at 1, NPC-aware). Mercurial magic: the pre-cast
`_rollMercurialIfNeeded(spellItem, spellbookEntry)` walks the
configured `CONFIG.DCC.mercurialMagicTable` via the new
`loadMercurialMagicTable()` helper (compendium → world fallback,
same shape as session-3's `loadDisapprovalTable`), pre-rolls the
d100 + luckMod × 10 via `libRollMercurialMagic`, persists the
rolled effect to `spellItem.system.mercurialEffect.{value,summary,
description,displayInChat}`, and attaches it to the in-flight
spellbook entry. `_castViaCalculateSpellCheck` then renders a
mercurial display chat via the new `renderMercurialEffect` (mirrors
the session-3 `renderDisapprovalRoll` pattern) directly from
`result.mercurialEffect` — NOT through the lib's `onMercurialEffect`
event, because that fires unconditionally on both formula + evaluate
passes and its Promise return isn't awaitable through the lib.
Pass-1 events were tightened to `{}` for the same reason (otherwise
spellburn would double-apply).

**Phase 2 — Spell checks — session 4 complete.** Patron-bound
wizard / elf actors now route wizard-castingMode spell checks
through the adapter. `buildSpellCheckArgs` populates
`character.state.classState.wizard.patron` (and `elf.patron` for
elves) so `getPatronId(character)` resolves and the lib records
`castInput.patron`. The lib's RAW patron-taint pipeline (`spells/
spell-check.js:241` `handleWizardFumble`) stays dormant — gated on
`input.fumbleTable`, which the adapter never plumbs in — and the
adapter calls a new `_runLegacyPatronTaint(spellItem)` after
`_castViaCalculateSpellCheck` to preserve the legacy
`processSpellCheck:623-660` d100-vs-chance creeping mechanic
verbatim. Dispatcher gate: `castingMode === 'wizard' && !isCleric`
(patron OK now); generic + cleric branches still require `!hasPatron`.

**Cleric disapproval (session 3)** continues to work: cleric-castingMode
spell items on non-patron-bound Cleric actors route through
`calculateSpellCheck` with a real `getCasterProfile('cleric')` profile,
`character.state.classState.cleric.disapprovalRange` seeded from
`actor.system.class.disapproval`, and a Foundry-loaded disapproval
table adapted to the lib's `SimpleTable` shape. When the natural roll
triggers disapproval, the lib's `handleClericDisapproval` rolls 1d4 ×
range via the adapter's formula-dispatching roller (pre-rolled in
Foundry), looks up the table entry, and fires `onDisapprovalIncreased`;
the event bridge in `spell-events.mjs` updates
`actor.system.class.disapproval` to the new range and posts the
"DCC.DisapprovalGained" EMOTE chat (replaces `actor.applyDisapproval()`).
The adapter then posts the disapproval roll chat from
`result.disapprovalResult` (replaces `actor.rollDisapproval(natural)` +
`RollTable.draw`).

Wizard spell loss (session 2) + generic side-effect-free path
(session 1) continue to work unchanged.

`game.dcc.processSpellCheck` is exported verbatim — XCC's
wizard/cleric sheets depend on it until Phase 2 closes. Phase 2
close needs: (a) XCC migration plan for `processSpellCheck`
consumers, (b) resolution of open question #5 (patron-taint RAW
alignment).

**Phase 1 — Adopt the lib for simple rolls — COMPLETE.** All four
rolls are migrated through the adapter: `rollAbilityCheck`,
`rollSavingThrow`, `rollSkillCheck`, and initiative (via
`getInitiativeRoll`). A Playwright adapter-dispatch spec
(`browser-tests/e2e/phase1-adapter-dispatch.spec.js`, 20 tests
after the Phase 2 session 1–3 extensions) validates every
dispatcher branch end-to-end by asserting on the `[DCC adapter]`
console logs from `module/adapter/debug.mjs`. All 20 passing
against live v14 Foundry as of 2026-04-18.

**Dispatch-logging decision (2026-04-18):** `debug.mjs` +
`logDispatch` are now PERMANENT infrastructure, not a Phase 1
scaffold. The earlier plan to strip them at phase close is
cancelled — the Playwright spec depends on them for automated
validation, and `getInitiativeRoll` emits no chat message that
could substitute as an assertion target. Later phases add their
own `logDispatch` calls and extend the browser-test spec.

Per the 7-phase plan in `docs/dev/ARCHITECTURE_REIMAGINED.md §7`:
> Phase 1: ability check · save · skill · init through the adapter.

## Done

### Session 2026-04-17 (first session)

- Created worktree on branch `refactor/dcc-core-lib-adapter` off `main`
  (`2337ec0`). Worktree now lives at
  `/Users/timwhite/FoundryVTT-Next/Data/systems/dcc` (moved 2026-04-17 —
  see Decisions §1 for the updated location rationale).
- Committed architecture doc at `docs/dev/ARCHITECTURE_REIMAGINED.md`
  (**32a5f79**).
- Phase 0 scaffolding + audit committed as **6b433a3**.
- Wired `@moonloch/dcc-core-lib` via `npm link` (see §Decisions about the
  scoped name). Verified runtime resolution — library imports succeed.
  Re-linked from the new worktree location on 2026-04-17 after the move
  (the original link didn't travel with the worktree because
  `node_modules/` isn't tracked). Current symlink:
  `node_modules/@moonloch/dcc-core-lib` →
  `/Users/timwhite/WebstormProjects/dcc-core-lib`.
- Created Phase 0 adapter stubs under `module/adapter/`:
  - `character-accessors.mjs` — Foundry actor shape → lib `Character` via
    `CharacterAccessors`
  - `foundry-roller.mjs` — wraps `DCCRoll.createRoll` as the lib's custom
    roller
  - `foundry-events.mjs` — bridges lib event callbacks to Foundry `Hooks`
  - `foundry-data-loader.mjs` — Foundry compendia → lib's table /
    progression registries
  - `chat-renderer.mjs` — library result objects → Foundry `ChatMessage`
  - Each contains only a header JSDoc explaining its role. No behavior.
- Audited every emitted hook in `module/` and every `game.dcc.*` export
  against the four sibling modules (dcc-qol, xcc, mcc-classes,
  dcc-crawl-classes) plus content packs. Published as
  `docs/dev/EXTENSION_API.md` with each item tagged **stable**,
  **internal**, or **dead**.
- Halfling i18n fix carried in via `main` — merged as commit `2337ec0`
  before the branch was created, so no extra work needed this session.

### Session 2026-04-18 (second session)

- **Runtime loading resolved** (open question #1). Chose option (b):
  vendor the lib's built `dist/` under `module/vendor/dcc-core-lib/`.
  Added `scripts/sync-core-lib.mjs` + `npm run sync-core-lib`. Initial
  vendor commit **fddcf04** (0.2.1, ~4.3 MB).
- **Wave 1 modifier redesign landed in `@moonloch/dcc-core-lib@0.3.0`**
  (commit `93033cb` in the lib repo, follow-up `f78cbdf` for async
  exports). Replaces the flat `RollModifier` with a tagged union of
  seven transformations paired with a structured `ModifierOrigin`.
  Design doc at `dcc-core-lib/docs/MODIFIERS.md`. Staged migration:
  wave 1 (checks, skills, dice, cleric) adopts the new type; combat,
  spells, patron, occupation keep `LegacyRollModifier` until later
  waves.
- **Async siblings added** through the check pipeline:
  `resolveSkillCheckAsync`, `rollCheckAsync`, `rollAbilityCheckAsync`,
  `rollSavingThrowAsync`, `evaluateRollAsync`. Lets the Foundry
  adapter use Foundry's Promise-based Roll.evaluate idiomatically.
- **Vendor re-sync** to 0.3.0 + `f78cbdf`, committed as **c200938**.
- **Phase 1 adapter wired** for `DCCActor.rollAbilityCheck`:
  - `module/adapter/character-accessors.mjs` — `actorToCharacter`
    builds a lib `Character` from DCCActor; handles save-id remap
    (frt/ref/wil ↔ fortitude/reflex/will) and parses signed save
    strings to numbers.
  - `module/adapter/foundry-roller.mjs` — `createFoundryRoller`
    returns an async roller that wraps `new Roll()`, awaits
    `.evaluate()`, stashes the Foundry Roll on a context object.
  - `module/adapter/chat-renderer.mjs` — `renderAbilityCheck` builds
    a ChatMessage with the same flags + speaker the legacy path
    emitted, plus a structured `system.libResult` payload for
    downstream consumers.
  - `DCCActor.rollAbilityCheck` is now a thin dispatcher: the legacy
    path handles `rollUnder`, `showModifierDialog`, and str/agl with
    CheckPenalty display (preserved verbatim as
    `_rollAbilityCheckLegacy`); everything else flows through
    `_rollAbilityCheckViaAdapter`. Public signature unchanged.
- **Tests**: new `module/__tests__/adapter-ability-check.test.js`
  (3 tests) locks the adapter round-trip. Existing `actor.test.js`
  updated to reflect the new dispatch (legacy path for str+penalty
  and lck+rollUnder; adapter for lck default). 683 unit tests pass
  across 19 test files.

### Session 2026-04-18 (third session)

- **Phase 1 adapter wired** for `DCCActor.rollSavingThrow`:
  - `module/actor.js` — `rollSavingThrow` is now a dispatcher. The
    legacy path (preserved verbatim as `_rollSavingThrowLegacy`) only
    handles `showModifierDialog` / `rollUnder`; everything else flows
    through `_rollSavingThrowViaAdapter` using the two-pass
    formula/evaluate pattern locked in for ability checks.
  - `module/adapter/chat-renderer.mjs` — new `renderSavingThrow`
    export. Preserves legacy flags (`dcc.RollType: 'SavingThrow'`,
    `dcc.Save: <frt|ref|wil>`, `dcc.isSave: true`) plus a structured
    `dcc.libResult` payload. Renders the DC success/failure suffix
    (with / without showDc) from the original call options.
  - `foundrySaveIdToLib` already in `character-accessors.mjs` handles
    the frt/ref/wil ↔ fortitude/reflex/will remap at the adapter
    boundary.
  - Adapter path returns the `foundryRoll` so the public return shape
    matches the legacy `rollSavingThrow` contract (used by one test
    and potentially downstream macro code).
- **Tests**: new `module/__tests__/adapter-saving-throw.test.js`
  (5 tests) plus `module/__integration__/adapter-saving-throw.test.js`
  (10 tests, 9 dice-gated). `module/__tests__/actor.test.js` updated
  to reflect the new dispatch for the three save tests (adapter path
  no longer invokes `DCCRoll.createRoll`; flavor/flags still locked).
  733 unit + integration tests pass (up from 683).
- **Dispatch debug logging** — added `module/adapter/debug.mjs` with a
  single `logDispatch(rollType, path, details)` helper. Called from
  all four dispatch branches (`_rollAbilityCheckViaAdapter`,
  `_rollAbilityCheckLegacy`, `_rollSavingThrowViaAdapter`,
  `_rollSavingThrowLegacy`) so the Foundry console shows, e.g.,
  `[DCC adapter] rollSavingThrow → via adapter saveId=ref` on every
  click. Intentionally kept in place through the rest of Phase 1
  (skill + init) and ripped out in one commit at Phase 1 close. See
  the "Debug logging" note below.

### Session 2026-04-18 (fourth session)

- **Phase 1 adapter wired** for `DCCActor.rollSkillCheck`:
  - `module/actor.js` — `rollSkillCheck` is now a dispatcher. A new
    `_resolveSkill(skillId)` helper normalizes the built-in-slot vs.
    skill-item dichotomy into a single bundle shared by both paths.
    The adapter path (`_rollSkillCheckViaAdapter`) builds a lib
    `SkillDefinition` from that bundle and emits the Foundry-side
    numerics (skill value, useLevel, useDeed, armor check penalty)
    as situational `add` modifiers. Two helpers —
    `_buildSkillDefinition` and `_buildSkillCheckModifiers` — keep
    the adapter focused on the two-pass pattern. `_stripDieCount`
    turns Foundry's `'1d14'` into the lib's `DieType` `'d14'`.
    Carve-outs routed to `_rollSkillCheckLegacy`:
    `options.showModifierDialog`, `skill.useDisapprovalRange` (cleric
    spellchecks / spell-table routing), any `CONFIG.DCC.skillTables`
    entry, and the no-die / description-only skill-item path.
  - `module/adapter/chat-renderer.mjs` — new `renderSkillCheck`
    export. Preserves the legacy flag contract
    (`dcc.RollType: 'SkillCheck'`, `dcc.ItemId` + `dcc.SkillId` set
    to the skill id, `dcc.isSkillCheck: true`) plus the structured
    `dcc.libResult` payload. For skill items carrying a description,
    the rendered content appends the `skill-description` div the
    legacy path emitted.
  - Adapter path returns the `foundryRoll`; legacy path preserves
    the existing (implicit undefined) return. Public signature of
    `rollSkillCheck` unchanged.
- **Tests**: new `module/__tests__/adapter-skill-check.test.js`
  (5 tests) plus `module/__integration__/adapter-skill-check.test.js`
  (8 dice-gated tests) exercising built-in + skill-item dispatch,
  custom dice (d14 / d24), crit / fumble classification, skill-value
  modifier origins, and the description-only legacy routing.
  `module/__tests__/actor.test.js` updated: the six built-in skill
  tests and the two skill-item tests now assert on adapter-path
  flags/flavor via `objectContaining` (no `DCCRoll.createRoll`
  invocation). All cleric / disapproval / table-routed tests stay on
  their exact-legacy assertions. 746 tests pass (up from 733).

### Session 2026-04-18 (fifth session)

- **Phase 1 adapter wired** for initiative (Path A — formula-only):
  - `module/actor.js` — `getInitiativeRoll` is now a dispatcher. A
    pre-built `Roll` still short-circuits (Foundry's combat tracker
    reuses one Roll across combatants). `options.showModifierDialog`
    routes to `_getInitiativeRollLegacy`, which keeps the structured
    `DCCRoll.createRoll` terms the modifier dialog's preset-die UI
    needs. Everything else flows through `_getInitiativeRollViaAdapter`,
    which asks the lib for a formula via `rollCheck(mode: 'formula')`
    and returns `new Roll(formula)`. `rollInit` itself is unchanged —
    Foundry's `Combat#rollInitiative` calls back through
    `DCCCombatant.getInitiativeRoll` → `actor.getInitiativeRoll` as
    today, so the core `initiativeRoll` flag (that
    `emoteInitiativeRoll` in `module/chat.js:492` gates on) is still
    set by Foundry, and the init chat message + combatant update
    continue to go through Foundry's core orchestration.
  - **Single-pass, not two-pass.** Init has no gameplay
    crit/fumble in vanilla DCC; pass-2 classification would be
    cosmetic only. Formula-mode is sufficient and preserves the
    `Roll` contract Foundry's combat flow relies on. Save /
    ability / skill migrations remain two-pass where classification
    drives gameplay.
  - **SkillDefinition shape:** `{ id: 'initiative', type: 'check',
    roll: { die, levelModifier: 'none' } }` with NO `roll.ability`
    — `system.attributes.init.value` already bakes in agl mod +
    otherMod + class level (from `computeInitiative`). The aggregate
    init value is emitted as a single `add` modifier with origin
    category `'other'` / id `'initiative-total'`. A future refactor
    could decompose this into per-source modifiers (ability / level
    / AE) once the init-preparation step is aware of its components.
  - **Weapon-die overrides** (two-handed weapon, custom
    `initiativeDieOverride` item) stay Foundry-side. The
    `[Two-Handed]` / `[Weapon]` die label is a Foundry display
    idiom; the adapter re-injects it into the lib's formula string
    with a targeted regex replace after the lib call returns.
- **No chat renderer needed.** Foundry's `Combat#rollInitiative`
  posts the init chat message with `flags.core.initiativeRoll: true`
  — the flag `emoteInitiativeRoll` gates on. Bypassing Foundry's
  rollInitiative (Path B) would have silently broken that emote
  integration; Path A preserves it.
- **Tests**: new `module/__tests__/adapter-initiative.test.js`
  (6 tests: adapter default, zero modifier, custom d24, two-handed
  weapon label, legacy dialog path, pre-built Roll short-circuit)
  plus `module/__integration__/adapter-initiative.test.js` (7
  dice-gated tests: default d20 formula, +N / -N modifier arithmetic,
  custom d14 / d24 die propagation, 30-iteration range check, and
  the aggregate initiative-total modifier origin). Existing
  `actor.test.js` tests for `roll initiative` and `rollInit creates
  initiative roll` relaxed from `expect(dccRollCreateRollMock)
  .toHaveBeenCalled()` to `.not.toHaveBeenCalled()` — the adapter
  path uses `new Roll(formula)`, not `DCCRoll.createRoll`. 759 tests
  pass (up from 746). `logDispatch('rollInit', …)` wired in both
  branches.

## In progress

Phase 3 — attack / damage / crit / fumble migration. Session 6
(2026-04-19) picked options (a) + (b) from the session 5 close-out —
crit + fumble migration off the now-stable attack-roll bridge. Both
finishers route through the adapter when the attack itself was
adapter-routed AND `automateDamageFumblesCrits` is on; the lib's
`rollCritical` / `rollFumble` additively surface breakdowns as
`flags['dcc.libCritResult']` / `flags['dcc.libFumbleResult']` chat
flags. Every chained call in a simplest-weapon attack now has a
lib-native result surfaced on chat. Session 7 options: broaden the
damage gate (magic bonus, NPC damage adjustment), backstab damage
via `getBackstabMultiplier`, deed-die adapter (warriors / dwarves),
or attack-modifier dialog (open question #7 tie-in). See the
seventeenth-session entry below and `§Next steps` for the full
option set.

### Session 2026-04-19 (seventeenth session — Phase 3, session 6)

Phase 3 session 6 — crit + fumble migration landed.

- **Dispatchers in `DCCActor.rollWeaponAttack`.** The inline crit and
  fumble blocks are now one-liners — `const critDispatch = await
  this._rollCritical(...)` / `const fumbleDispatch = await
  this._rollFumble(...)` — that destructure `critRollFormula` /
  `critInlineRoll` / `critPrompt` / `critRoll` / `critResult` /
  `critRollTotal` / `libCritResult` (and analogous fumble fields)
  back into the caller. `_rollCritical` / `_rollFumble` are the
  dispatchers; `_canRouteCritViaAdapter` / `_canRouteFumbleViaAdapter`
  are the gates.
- **Gates (`_canRouteCritViaAdapter`, `_canRouteFumbleViaAdapter`).**
  Both route through the adapter when ALL of:
  - `attackRollResult.libResult` is present (attack itself went
    through `_rollToHitViaAdapter`)
  - `ctx.automate` is true (caller passes `automateDamageFumblesCrits`)

  Any failure → legacy. Both paths call `logDispatch(...)` as first
  line (permanent-infrastructure contract).
- **`_rollCriticalViaAdapter`.** Structurally mirrors the legacy
  crit block for Foundry compatibility: builds a `Compound` DCC
  term, evaluates via `game.dcc.DCCRoll.createRoll`, looks up the
  crit-table entry via `getCritTableResult`, builds the anchor.
  After evaluation, extracts the natural die from
  `critRoll.dice[0].total`, wraps it in a sync roller
  (`() => naturalCrit`), and calls the lib's `rollCritical` with a
  `CriticalInput` built from `buildCriticalInput({ critDie, luckModifier,
  critTableName })`. The lib owns the classification + total; the
  adapter exposes the result as `libCritResult` on the return
  shape, which `rollWeaponAttack` surfaces as
  `flags['dcc.libCritResult']`.
- **`_rollFumbleViaAdapter`.** Same pattern as the crit adapter.
  Builds the Foundry fumble roll (PC fumble die +/- luck, or fixed
  `1d10` for NPCs with `useNPCFumbles`), evaluates, then replays
  the natural die through the lib's `rollFumble` with
  `fumbleDieOverride` set so the lib rolls the exact die Foundry
  used. Result surfaces as `flags['dcc.libFumbleResult']`.
- **`module/adapter/crit-fumble-input.mjs`** — new file.
  - `buildCriticalInput({ critDie, luckModifier, critTableName })`
    normalizes the Foundry-style die (`'1d10'` → `'d10'` via
    `normalizeLibDie`) and defaults missing `critTableName` to
    `'I'` (matches the lib's fallback).
  - `buildFumbleInput({ fumbleDie, luckModifier })` passes
    `fumbleDieOverride` so the lib rolls the exact die; includes
    `armorType: 'unarmored'` as a stable placeholder that the lib
    ignores when an override is set.
- **Legacy paths.** `_rollCriticalLegacy` / `_rollFumbleLegacy`
  preserve the pre-split inline bodies verbatim: legacy paths
  execute for (a) legacy-routed attacks, (b) `automate=false`
  (build the inline-roll HTML without actually rolling), and (c)
  future cases where a broader gate doesn't accept.
- **Chat-flag shape.**
  - `flags['dcc.libCritResult'] = { critDie, natural, total,
    critTable, modifiers }` — `critDie` is the lib's normalized
    formula (`'1d10'`), `natural` is the die result, `total` folds
    luck + bonuses, `critTable` is echoed from input, `modifiers`
    is the lib's breakdown array (`[{source: 'Luck', value: N}, …]`).
  - `flags['dcc.libFumbleResult'] = { fumbleDie, natural, total,
    modifiers }` — `fumbleDie` is the lib-normalized die (`'d10'`
    or `'d8'` etc), `total` is natural − luck (positive luck →
    lower total → better result).
- **Test-mock hurdle reused from session 5.** Same sync stubs on
  `game.dcc.DCCRoll.createRoll` as `adapter-weapon-damage.test.js`.
  The shared `__mocks__/dcc-roll.js` declares `createRoll` as
  `static async`, but production is sync — crits + fumbles both
  rely on production sync behavior through `await`.
- **Tests** (`module/__tests__/adapter-weapon-crit-fumble.test.js`
  — 13 cases):
  - `buildCriticalInput` / `buildFumbleInput` unit: die normalization,
    critTableName fallback, fumbleDieOverride wiring.
  - `_canRouteCritViaAdapter` / `_canRouteFumbleViaAdapter` gate
    truth-tables: reject when attack was legacy; reject when
    automate off; accept when both conditions hold.
  - Crit dispatch: adapter path for happy-path emits
    `logDispatch('rollCritical', 'adapter', …)`, returns populated
    `libCritResult` with `natural=7 / total=9` (luck +2) + crit
    table echoed.
  - Crit dispatch: legacy path when attack was legacy; legacy path
    when automate is off — no `libCritResult`.
  - Fumble dispatch: adapter path for PC fumble (1d8-1 with luck
    +1) emits `logDispatch('rollFumble', 'adapter', …)`, returns
    populated `libFumbleResult` with `natural=3 / total=2` (luck
    subtracted).
  - Fumble dispatch: legacy path when automate is off.
  - Fumble dispatch: adapter path swaps to `1d10` NPC fumble die
    when `isNPC && useNPCFumbles`; `isNPCFumble=true` reflected on
    return.
  - 834 Vitest tests pass (up from 821). `npm run format` +
    `npm run compare-lang` clean.
- **Browser test status.** Playwright
  `phase1-adapter-dispatch.spec.js` extended with `rollCritical` +
  `rollFumble` describe blocks (5 new tests): adapter-path crit on
  forced natural 20 (via `CONFIG.Dice.randomUniform` override — note
  Foundry v14's `mapRandomFace = Math.ceil((1 - rand) * faces)` so
  `randomUniform = 0.0001` forces max face, `0.9999` forces min
  face), legacy crit on backstab, `libCritResult` chat-flag shape,
  adapter-path fumble on forced natural 1, `libFumbleResult`
  chat-flag shape. All 62 e2e tests (33 dispatch + 29 other) pass
  against live v14 Foundry (verified 2026-04-19).

- **Session-reuse fixture added to dispatch spec** (bonus
  infrastructure). Previously every test in
  `phase1-adapter-dispatch.spec.js` re-navigated to `/join` + logged
  in as GM + booted the DCC system (~7-13 s per test). The new
  worker-scoped `sessionPage` fixture logs in ONCE per worker; the
  test-scoped `page` fixture forwards it so existing test bodies
  stay source-compatible. `beforeEach` is now just log-clearing +
  actor cleanup — no navigation. Measured impact: dispatch-spec
  tests drop from ~7-13 s to **~0.5-1 s each** (10-15× speedup);
  full dispatch spec runs in ~30 s instead of ~4 min. Data-models
  + v14-features specs keep default per-test contexts (would need
  the fixture factored out into a shared helper to opt in).



### Session 2026-04-19 (sixteenth session — Phase 3, session 5)

Phase 3 session 5 — first damage-migration slice landed.

- **Dispatcher in `DCCActor.rollWeaponAttack`.** The inline damage
  block is now a one-liner `const damageDispatch = await this._rollDamage(...)` that destructures `damageRoll` / `damageInlineRoll` / `damagePrompt` / `libDamageResult` back into the caller. `_rollDamage` is the dispatcher; `_canRouteDamageViaAdapter` is the gate.
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
  line (same permanent-infrastructure contract as earlier phases).
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
  `rollWeaponAttack` surfaces as `flags['dcc.libDamageResult']` on
  the chat flags.
- **`module/adapter/damage-input.mjs`** — new file.
  - `parseDamageFormula(formula)` extracts `{diceCount, die, modifier}`
    from simple `NdM[+K]` strings; returns `null` for multi-die,
    per-term flavors, `@ab` substitutions, or empty input. Regex:
    `/^\s*(\d*)d(\d+)\s*([+-]\s*\d+)?\s*$/i`.
  - `buildDamageInput(parsed)` folds the flat modifier into
    `strengthModifier` — for the simplest-damage slice, the damage
    formula already bakes in the strength modifier (via
    `computeMeleeAndMissileAttackAndDamage`), so we pass the single
    combined value as `strengthModifier` and leave
    `deedDieResult` / `magicBonus` / `backstabMultiplier` unset. A
    later slice that splits str/class contributions apart can
    broaden this.
- **`_rollDamageLegacy`.** Preserved verbatim from the pre-split
  inline body: handles the two legacy sub-cases (per-term flavors
  via Foundry native `Roll`; simple formulas via
  `DCCRoll.createRoll`), clamps minimum 1, builds the same anchor
  and breakdown.
- **Pre-existing test-mock quirk (discovered).** The shared
  `__mocks__/dcc-roll.js` declares `createRoll` as `static async`,
  but production `module/dcc-roll.js:17` is sync (returns the Roll
  directly). The `rollWeaponAttack` damage block uses
  `damageRoll = DCCRoll.createRoll(...)` without awaiting, relying
  on production's sync behavior. No existing test hits this because
  `automateDamageFumblesCrits` defaults to `undefined` in the mock.
  Session 5 tests install sync stubs on
  `game.dcc.DCCRoll.createRoll` rather than touch the shared mock;
  see the test-file docstring for the rationale.
- **Tests** (`module/__tests__/adapter-weapon-damage.test.js` — 10
  cases):
  - `parseDamageFormula` unit: accepts `1d8`, `d8`, `1d6+2`,
    `2d4-1`, `1d6 + 3`; rejects per-term flavors, multi-die,
    `@ab`, empty, null.
  - `buildDamageInput` unit: folds modifier into `strengthModifier`.
  - `_canRouteDamageViaAdapter` gate truth-table: rejects when
    attack was legacy; rejects on backstab, per-term flavors,
    multi-die; accepts on simple formulas.
  - Dispatch: adapter path for `1d8+2` + libResult attack emits
    `logDispatch('rollDamage', 'adapter', …)`, returns populated
    `libDamageResult` with `baseDamage:3 / modifierDamage:2 /
    total:5` + non-empty `breakdown[]`.
  - Dispatch: legacy path when attack went through legacy.
  - Dispatch: legacy path for per-term-flavor formula
    `1d6[fire]+1d6[cold]` even when attack went through adapter.
  - Clamp: adapter path forces `damageRoll._total = 1` when
    `damageRoll.total < 1` (e.g. `1d4-5` rolling 1).
  - 821 Vitest tests pass (up from 811). `npm run format` +
    `npm run compare-lang` clean.
- **Browser test status.** Playwright
  `phase1-adapter-dispatch.spec.js` extended with `rollDamage`
  assertions: the happy-path + backstab weapon-attack tests now
  additionally `waitForAdapterLog('rollDamage')` and assert path
  (adapter / legacy respectively); a new `rollDamage › multi-damage-
  type formula → legacy (even when attack via adapter)` test drives
  a `1d6[fire]+1d6[cold]` weapon to validate the per-term-flavor
  gate end-to-end. All 27 tests pass against live v14 Foundry
  (verified 2026-04-19, 3.2 min run).



### Session 2026-04-18 (fifteenth session — Phase 3, session 4)

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
- **Tests** (`module/__tests__/adapter-weapon-attack.test.js` —
  3 new cases, 17 total):
  - `normalizeLibDie` unit coverage for `'1d20'`, `'1d16'`, `'d24'`,
    `''`, `null`.
  - Adapter path with a hook that mutates `terms[0].formula = '1d16'`:
    `libResult.die === 'd16'` (was `'d20'` pre-fix).
  - Adapter path with a hook that only pushes a flat penalty: action
    die untouched, `libResult.die === 'd20'`.
  - 811 Vitest tests pass (up from 808). `npm run format` +
    `npm run compare-lang` clean.
- **Browser test status.** Session 3's 4 weapon-attack Playwright
  cases stay green — the post-hook re-read is observational on the
  adapter-result `libResult.die` flag only; no new dispatch branches,
  no new log lines. Not re-run this session.

### Session 2026-04-18 (fourteenth session — Phase 3, session 3)

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
  the per-term breakdown preserved with labels. When wave-3
  modifier migration lands and the lib emits tagged-union
  modifiers natively, consumers can move from the aggregate to the
  per-bonus shape without an adapter change.
- **Scope decisions:**
  - **In-place mutations of `terms[0].formula`** (dcc-qol long-range
    `DiceChain.bumpDie`) are NOT translated. The Foundry `Roll`
    still uses the bumped die — only the lib-side `actionDie`
    + threat math stay on the pre-hook value. Observable
    divergence: `libResult.die` may report `d20` when the Foundry
    roll actually evaluated on `d16`. The Foundry total remains
    the source of truth for chat; addressing this cleanly requires
    post-hook re-reading of `terms[0].formula` + a dice-chain
    bonus (`BonusDiceChain`), which is a separate slice.
  - **Module attribution.** Hook-added terms carry no `moduleId`,
    so all translated bonuses are emitted with `source: { type:
    'other', name: <label> }`. When the wave-3 modifier redesign
    ships, session-N can upgrade this to `category: 'module'` /
    `moduleId` on the tagged union — the current flat-bonus shape
    has no field for it.
  - **Non-happy-path routing unchanged.** `_rollToHitLegacy` still
    handles backstab / two-weapon / deed / automate-off cases
    verbatim; session 3 only expands what the adapter path
    captures, not the gate.
- **Tests** (`module/__tests__/adapter-weapon-attack.test.js` — 5
  new cases, 14 total):
  - `hookTermsToBonuses` unit coverage: translates Modifier-kind
    terms with signed-int formulas; skips Die / Compound / dice-
    bearing formulas / empty strings; handles null / undefined /
    empty input safely.
  - Adapter path surfaces a pushed `{type: 'Modifier', formula:
    '-1'}` term as `libResult.bonuses[0]` with matching label +
    `effect.value`, and as a `{source: 'bonuses', value: -1}`
    entry in `libResult.modifiers` (the lib's aggregate).
  - Adapter path with no hook push emits `libResult.bonuses:
    []`.
  - 808 Vitest tests pass (up from 803). `npm run format` +
    `npm run compare-lang` clean.
- **Browser test status.** Session 2's 4 weapon-attack Playwright
  cases stay green — the hook-translation change is observational
  on the adapter-result flag only; no new dispatch branches, no
  new log lines. Not re-run this session (no change to dispatch
  behavior).

### Session 2026-04-18 (thirteenth session — Phase 3, session 2)

Phase 3 session 2 — first attack migration slice landed.

- **Dispatcher in `DCCActor.rollToHit`.** New `_canRouteAttackViaAdapter`
  gate routes through the adapter when ALL of:
  - `options.showModifierDialog` falsy
  - `options.backstab` falsy
  - `weapon.system.twoWeaponPrimary` / `twoWeaponSecondary` both falsy
  - `actor.system.details.attackBonus` has no `d` (no actor-side deed
    die)
  - `weapon.system.toHit` has no `d` (weapon-side to-hit is simple
    numeric)
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
    and `abilityModifier` stays at 0 to avoid double-counting. Later
    slices with deed die / backstab will need the split apart.
  - `normalizeLibDie` converts Foundry-style `'1d20'` to the lib's
    `'d20'` shape (same helper pattern as `spell-input.mjs`).
  - `parseToHitBonus` parses signed-integer toHit strings; the gate
    rejects dice toHits before `buildAttackInput` runs so the parser
    can assume numeric input.
- **`module/adapter/attack-events.mjs`** — stub. Header JSDoc lists the
  callback surface sessions 3+ will wire (`onAttackRoll`,
  `onCriticalThreat`, `onFumbleRoll`, `onDamageRoll`, `onDeedAttempt`)
  once damage / crit / fumble rolls migrate off their current Foundry
  `getCritTableResult` / `getFumbleTableResult` paths. Empty
  `export {}` body — the simplest-weapon happy-path has no side
  effects.
- **`dcc.modifyAttackRollTerms` preservation.** The adapter path still
  fires the hook with the legacy-shape `terms` array before the Roll
  evaluates. dcc-qol's `applyFiringIntoMeleePenalty` and
  `applyRangeChecksAndPenalties` mutate the array in place; those
  modifications flow into `DCCRoll.createRoll` unchanged. A future
  slice will need to also reflect any injected `Modifier` terms into
  the lib's `bonuses` so `libResult.total` agrees with the Foundry
  `Roll.total` — session 2 keeps the Foundry Roll as the source of
  truth for the display / chat total, so the divergence is
  observational only.
- **Tests**:
  - `module/__tests__/adapter-weapon-attack.test.js` — new file
    (9 tests). `vi.mock('../adapter/debug.mjs')` replaces
    `logDispatch` with a spy (vitest's reporter captures
    `console.log` before spies see it; mocking the helper is the
    reliable signal). Cases: adapter fires for the simplest weapon
    with automate on; adapter result carries `libResult` with
    `die='d20'` + `modifiers[]`; legacy fires when automate is off,
    backstab set, `showModifierDialog` set, `twoWeaponPrimary` set,
    or actor has a deed-die attackBonus; `buildAttackInput` unit
    coverage for melee + missile weapons with different toHit signs.
  - `browser-tests/e2e/phase1-adapter-dispatch.spec.js` — four new
    cases in a `rollWeaponAttack` describe block: simplest happy
    path → adapter with `weapon=<name>`; `options.backstab` →
    legacy; `options.showModifierDialog` → legacy (fire-and-forget
    past the modal); automate off → legacy. **All 26 tests pass
    against live v14 Foundry** (verified 2026-04-18, 3.0 min run).
  - `module/__tests__/actor.test.js` tests for `rollWeaponAttack`
    (`roll weapon attack dagger` at line 260, `rollWeaponAttack
    creates attack roll` at line 1515, `rollToHit with basic weapon`
    at line 1554) keep passing unchanged: the mock's
    `automateDamageFumblesCrits` default is `undefined` → gate fails
    → legacy path → same `DCCRoll.createRoll` assertions hold.
  - 803 Vitest tests pass (up from 794). `npm run format` + `npm run
    compare-lang` clean.

**Scope decisions (Phase 3 session 2):**

- **Dispatcher at `rollToHit`, not `rollWeaponAttack`.** `rollWeaponAttack`
  is 300+ lines of damage / crit / fumble / chat orchestration that
  session 2 doesn't migrate. Duplicating it into `_rollWeaponAttackLegacy`
  + `_rollWeaponAttackViaAdapter` would double the tail for no
  behavioral gain. Splitting at `rollToHit` keeps the migration
  focused on the attack roll itself and lets `rollWeaponAttack`
  propagate `libResult` as a single new field on the return object.
  Future sessions that migrate the damage / crit / fumble chain can
  revisit — but the natural split is per-roll, not per-method.
- **Adapter path still goes through `DCCRoll.createRoll`, not the
  lib's own roller.** The lib's `makeAttackRoll` rolls `1${actionDie}`
  only — it deliberately doesn't construct a full attack formula or
  render chat. The Foundry `Roll` object is still the source of truth
  for display (chat card per-die breakdown, DSN animation,
  FleetingLuck tagging, crit/fumble highlighting). Feeding the natural
  d20 into the lib after evaluation validates the bridge
  end-to-end — lib's `isCriticalThreat` / `isFumble` can be
  cross-checked against the Foundry-derived `fumble === (d20 === 1)`
  / `naturalCrit === (d20 >= critRange)` — without losing any of the
  Foundry presentation layer.
- **`dcc.libResult` on flags, not a new chat renderer.** Phase 1/2
  renderers (`renderAbilityCheck`, `renderSavingThrow`,
  `renderSkillCheck`, `renderSpellCheck`) emit their own `ChatMessage`
  shape because those rolls have simple, uniform chat cards.
  `rollWeaponAttack`'s chat card is a complex Handlebars template with
  per-roll breakdowns for attack / damage / crit / fumble — renaming
  that would regress every attack presentation. Instead the adapter
  attaches `libResult` to `messageData.flags['dcc.libResult']` so the
  existing chat template is untouched. When the lib grows a structured
  combat chat renderer (wave 3), the renderer can read from the same
  flag without a breaking change.
- **`abilityModifier: 0` with `attackBonus: parsed toHit`.**
  `weapon.system.toHit` at roll time has already absorbed the ability
  modifier via `DCCItem.prepareBaseData` → reads
  `actor.system.details.attackHitBonus.melee.value` which
  `computeMeleeAndMissileAttackAndDamage` sums str/agl into. Passing
  both would double-count. The lib is content with either split —
  `totalBonus` is just `attackBonus + abilityModifier + bonuses`. When
  the hook-translator slice lands and `dcc.modifyAttackRollTerms`
  injected terms need to appear in the lib's `bonuses`, the clean
  split is: base `attackBonus` from `actor.system.details.attackBonus`,
  `abilityModifier` split out separately, and any hook-added terms
  mapped to `bonuses[]`. Session 2 deferred that.
- **Wave-3 lib modifier migration still not required.** `makeAttackRoll`
  emits `appliedModifiers` as `LegacyRollModifier[]` — same flat
  `{ source, value }` shape spells / combat use until wave 3 ships in
  the lib. The `dcc.libResult.modifiers` flag inherits that shape. No
  consumer reads it today; when the lib migrates combat to the
  tagged-union `RollModifier`, renderers can adapt in one place
  without the adapter changing.
- **Logs vs. spies.** The Phase 1/2 unit tests assert on
  `logDispatch` console.log output via `vi.spyOn(console, 'log')`.
  Session 2 discovered that vitest's reporter intercepts
  `console.log` before spies can see it — the output prints to the
  test runner but doesn't land in `spy.mock.calls`. Switched to
  `vi.mock('../adapter/debug.mjs', () => ({ logDispatch: vi.fn() }))`
  so the dispatch-path assertions are deterministic. Earlier adapter
  tests work because they use downstream observable assertions
  (`rollToMessage` call-count, flag structure) rather than spying on
  the log itself. If a later session migrates those tests, use the
  same `vi.mock` pattern.

### Session 2026-04-18 (sixth session — Phase 2, session 1)

- **Adapter scaffolded** for spell checks:
  - `module/adapter/spell-input.mjs` — new. Exports
    `buildSpellCastInput(actor, spellItem, options)` which returns a
    lib-shaped `SpellCastInput`. Session 1 uses a synthesized
    generic `casterProfile` (`type: 'generic'`, all side-effect
    flags off) so `castSpell` accepts it directly — no spellbook
    or real caster-profile lookup yet. `DEFAULT_SPELL_CASTER_TYPES`
    and `normalizeLibDie` are local helpers (inlined to avoid a
    third scaffold file for one constant + one function).
  - `module/adapter/spell-events.mjs` — stub. Header JSDoc lists
    the callback surface (`onSpellCheckStart`, `onSpellLost`,
    `onCorruptionTriggered`, `onPatronTaint`,
    `onDisapprovalIncreased`, `onSpellburnApplied`,
    `onMercurialEffect`) and the migration order sessions 2–5
    will fill in. Empty `export {}` body.
  - `module/adapter/chat-renderer.mjs` — extended with
    `renderSpellCheck({ actor, spellItem, flavor, result,
    foundryRoll })`. Preserves legacy flag contract
    (`dcc.RollType: 'SpellCheck'`, `dcc.isSpellCheck`,
    `dcc.isSkillCheck`, `dcc.ItemId`) plus a structured
    `dcc.libResult` payload with spell-check fields
    (`spellId`/`die`/`natural`/`total`/`formula`/`critical`/
    `fumble`/`tier`/`spellLost`/`corruptionTriggered`/`modifiers`).
    No side effects — wizard spell loss, cleric disapproval,
    patron taint, spellburn, mercurial magic all stay on the
    legacy path this session.
- **Dispatcher wired** for `DCCActor.rollSpellCheck`:
  - `module/actor.js` — `rollSpellCheck` hoists the single item
    lookup (so `collectionFindMock` call-count assertions in
    `actor.test.js` still match) then routes on
    `castingMode === 'generic' && !hasPatron && !isCleric` →
    `_rollSpellCheckViaAdapter`; everything else →
    `_rollSpellCheckLegacy`. Legacy keeps the pre-dispatcher body
    verbatim (fire-and-forget item delegation + naked-path term
    construction + `game.dcc.processSpellCheck` handoff).
    `game.dcc.processSpellCheck` export is untouched, so XCC's
    wizard/cleric sheets keep working.
  - `_rollSpellCheckViaAdapter` uses the two-pass
    formula/evaluate pattern (formula mode → `new Roll(formula)`
    → Foundry evaluate → evaluate mode with `roller: () => natural`).
    Uses `castSpell` directly, bypassing `calculateSpellCheck`'s
    spellbook + profile lookups (wizard/cleric spellbook bridge
    is session 2+ work). `logDispatch('rollSpellCheck', 'adapter',
    { spell })` as first line; legacy branch emits the matching
    LEGACY line.
- **Tests**:
  - `module/__tests__/adapter-spell-check.test.js` — new. 4
    tests: generic item on non-cleric non-patron actor routes
    adapter (+ flag assertions); wizard-castingMode item routes
    legacy (+ delegates to `DCCItem.rollSpellCheck`); generic
    item on a Cleric actor routes legacy; generic item on a
    patron-bound actor routes legacy.
  - `browser-tests/e2e/phase1-adapter-dispatch.spec.js` — three
    new test cases in a `rollSpellCheck` describe block:
    generic-castingMode item → adapter, wizard-castingMode item
    → legacy, naked `rollSpellCheck()` → legacy.
    `npx playwright test --list` reports 18 tests in the file
    (up from 15). Not run against live Foundry this session —
    needs manual verification next time v14 is launched.
  - Existing `actor.test.js` "roll spell check" / "roll spell
    check int" / "roll spell check personality" / "roll spell
    check stamina" / "roll spell check item" / "roll spell check
    wrong item type" / "roll spell check missing spell" all
    still pass unchanged (the legacy branch preserves the old
    body + call-sequence).
  - 763 tests pass (up from 759). `npm run format` clean.

### Session 2026-04-18 (tenth session — Phase 2, session 5)

- **Spellburn migration (wizard / elf).** `DCCActor.rollSpellCheck` for
  wizard-castingMode items now forwards `options.spellburn` (a lib
  `SpellburnCommitment`) through `buildSpellCheckArgs` →
  `input.spellburn` → lib `castSpell`. The lib adds a Spellburn modifier
  to the roll formula (`cast.js:50-58`) and fires `onSpellburnApplied`
  with the burn commitment. The new `spell-events.mjs` bridge subtracts
  each ability's burn from `system.abilities.<id>.value`, clamped at
  1 and NPC-gated (mirrors `onDisapprovalIncreased`). Today no code
  path supplies `options.spellburn` — the roll-modifier dialog's
  Spellburn term (`roll-modifier.js:115-126`) still sits on the legacy
  `DCCRoll.createRoll` path, which the adapter bypasses. Plumbing is
  in place for a future dialog-adapter session.
- **Mercurial magic migration (wizard / elf).** `_castViaCalculateSpellCheck`
  now calls `_rollMercurialIfNeeded(spellItem, spellbookEntry)` before
  pass 1 when `profile.usesMercurial === true` and the Foundry spell
  item has no stored effect. The helper walks the configured
  `CONFIG.DCC.mercurialMagicTable` via the new
  `loadMercurialMagicTable()` exporter (pack-then-world resolution,
  mirrors the legacy `DCCItem.rollMercurialMagic:531-558` walk),
  pre-rolls a Foundry `1d100`, passes the total into the lib's
  `rollMercurialMagic(luckMod, table, {roller})`, and persists the
  rolled effect to `spellItem.system.mercurialEffect.{value,summary,
  description,displayInChat}` + attaches it to the in-flight
  spellbook entry. After the main spell-check chat, the adapter
  renders a dedicated mercurial display chat via the new
  `renderMercurialEffect` (mirrors session-3's `renderDisapprovalRoll`
  pattern) directly from `result.mercurialEffect` — see "Scope
  decisions" below for why the lib's `onMercurialEffect` callback is
  intentionally NOT wired.
- **Pass-1 events tightened.** `libCalculateSpellCheck` is now called
  in formula mode with an empty events object `{}` instead of the
  full bridge. Rationale in `cast.js:339-343`: `onSpellburnApplied`
  and `onMercurialEffect` fire unconditionally whenever their input
  fields are populated, so passing events to both passes would
  double-apply the burn and double-post the mercurial chat. Pass 2
  remains the authoritative side-effect pass. `onSpellLost` and
  `onDisapprovalIncreased` were already pass-2-gated via natural-roll
  / spellLost conditions, so earlier sessions didn't hit this.
- **`module/adapter/spell-input.mjs`** extended:
  - `readMercurialEffect(spellItem)` (module-local) converts the
    Foundry item's `system.mercurialEffect.{value,summary,description,
    displayInChat}` to the lib's `MercurialEffect` shape, returning
    `null` when `value` is missing / zero. Called from
    `buildSpellbookEntry` so the lib sees an already-rolled mercurial
    on subsequent casts.
  - `foundryTableEntries(foundryTable, project)` (module-local)
    factors out the Foundry-RollTable → lib-entries walk shared by
    `toLibSimpleTable` (disapproval) and the new `toLibMercurialTable`
    (mercurial). Per-entry projection differs — mercurial carries
    `summary` + `description` + `displayOnCast` — but the row-range
    extraction is identical.
  - `loadMercurialMagicTable()` — async. Walks
    `CONFIG.DCC.mercurialMagicTable` compendium → world-name fallback
    and converts via `toLibMercurialTable`. Returns `null` when no
    table is resolvable.
  - `buildSpellCheckArgs` now forwards `options.spellburn` when the
    commitment is a valid `{str, agl, sta}` object with at least one
    positive value. All-zero commitments are dropped to avoid a no-op
    Spellburn modifier surfacing in the lib's result.
- **`module/adapter/spell-events.mjs`** extended:
  - `createSpellEvents` returns `onSpellburnApplied` when an `actor`
    is provided. The handler bails for NPC actors, then builds
    `actor.update({ 'system.abilities.<id>.value': max(1, current -
    burn) })` for each of str/agl/sta with a positive burn. Skips the
    update entirely if all three are zero.
  - No `onMercurialEffect` bridge — mercurial rendering happens
    adapter-side in `_castViaCalculateSpellCheck` instead (see "Scope
    decisions" below).
- **`module/adapter/chat-renderer.mjs`** extended:
  - `renderMercurialEffect({actor, spellItem, effect})` — posts a
    single chat with the `${rollValue}d1` deterministic Roll, the
    localized "Mercurial Magic Roll" flavor + summary, and a
    `dcc.libMercurial` structured flag (`rollValue`, `summary`,
    `description`, `displayOnCast`). Replaces the chat-card mercurial
    block that `DCCItem.rollSpellCheck:382` threaded through
    `game.dcc.processSpellCheck` on the legacy path.
- **`module/actor.js`** extended:
  - New `_rollMercurialIfNeeded(spellItem, spellbookEntry)` — private.
    Skips when `loadMercurialMagicTable()` returns null (matches the
    legacy `DCCItem.rollMercurialMagic:564` no-table fall-back). Rolls
    via the lib's `rollMercurialMagic(luckMod, table, {roller})`,
    persists the effect to the Foundry item, and mutates the in-flight
    spellbook entry.
  - `_castViaCalculateSpellCheck` now calls `_rollMercurialIfNeeded`
    before pass 1 for wizard / elf profiles, and renders
    `renderMercurialEffect(result.mercurialEffect)` after
    `renderSpellCheck` when the effect's `displayOnCast !== false`.
  - Pass-1 `libCalculateSpellCheck` call now passes `{}` as events
    instead of the full `events` bridge.
- **Tests**:
  - `module/__tests__/adapter-spell-check.test.js` — now 31 tests
    (up from 18 at session 4 close). New:
    `createSpellEvents onSpellburnApplied subtracts burn amounts` (PC
    with str=14/agl=12/sta=13, burn {str:2,sta:3} → str→12/sta→10);
    `onSpellburnApplied clamps at 1` (str=3, burn=5 → str=1);
    `onSpellburnApplied bails early for NPC actors`;
    `onSpellburnApplied with zero commitment does not update`;
    `without actor does not wire onSpellburnApplied`;
    `renderMercurialEffect posts chat with the mercurial flag payload`;
    `buildSpellCheckArgs threads options.spellburn into input.spellburn`;
    `buildSpellCheckArgs drops all-zero spellburn commitment`;
    `buildSpellCheckArgs populates spellbookEntry.mercurialEffect from
    existing Foundry item`;
    `buildSpellCheckArgs omits mercurialEffect when item has no rolled
    value`;
    `adapter wizard first-cast pre-rolls mercurial magic when the item
    has none` (CONFIG.DCC.mercurialMagicTable + game.tables.getName
    mocked);
    `adapter wizard cast on a spell item that already has mercurial does
    not re-roll` (display chat still fires via result path);
    `adapter wizard cast with options.spellburn reduces ability scores
    adapter-side` (integration of the above — str=14, agl=12, sta=13,
    burn {str:2,sta:1} → actor.update str=12, sta=12).
  - `browser-tests/e2e/phase1-adapter-dispatch.spec.js` — 22 tests (up
    from 20). Two new session-5 cases:
    `wizard cast with options.spellburn reduces physical ability scores`
    (asserts str=12/agl=12/sta=12 after a 14/12/13 cast with burn
    {str:2,agl:0,sta:1});
    `wizard first-cast pre-rolls mercurial magic` (asserts
    `item.system.mercurialEffect.value > 0` after first cast, with
    `test.skip` when no `mercurialMagicTable` is configured). **All 22
    tests pass against live v14 Foundry** (verified 2026-04-18 against
    the running `v14` world; 2.3 min run).
  - 790 Vitest tests pass (up from 777).

**Scope decisions (Phase 2 session 5):**

- **Direct render over `onMercurialEffect` bridge.** The initial
  design wired `onMercurialEffect` to call `renderMercurialEffect`.
  That failed in tests because: (1) the lib fires the event on BOTH
  formula-mode and evaluate-mode passes (cast.js:342-344, unconditional
  when `input.spellbookEntry.mercurialEffect` is set), which would
  double-post; (2) the bridge's returned Promise isn't propagated
  through the lib, so the adapter couldn't await the chat before
  returning — causing race-conditions with `rollToMessageMock` in the
  unit tests. Refactored to: (a) pass `{}` events to pass 1 to prevent
  the pass-1 fire; (b) remove the `onMercurialEffect` bridge entirely;
  (c) render directly from `result.mercurialEffect` in
  `_castViaCalculateSpellCheck` post-renderSpellCheck. Same for
  spellburn — pass 1 no longer fires `onSpellburnApplied`; pass 2 is
  the authoritative side-effect pass.
- **`_rollMercurialIfNeeded` is adapter-side, not lib-extension.** The
  lib's `calculateSpellCheck` doesn't accept a mercurial-magic table —
  mercurial effects are expected to be pre-attached to the spellbook
  entry (rolled at spell-learn time per RAW). The legacy Foundry flow
  rolls mercurial via a user-triggered button
  (`DCCItem.rollMercurialMagic`) rather than auto-rolling at first
  cast. Session 5 added adapter-side first-cast auto-roll as an
  improvement: any wizard / elf casting a spell without a stored
  mercurial effect gets one rolled and persisted. This is slightly
  more RAW-aligned than legacy (which left mercurial rolling fully
  manual). Could revisit if users want explicit opt-in.
- **No spellburn dialog integration.** The spellburn UI ships as a
  `Spellburn` term in the legacy roll-modifier dialog
  (`roll-modifier.js:115` `DCCSpellburnTerm`) — the user clicks +/- to
  allocate burn, the dialog calls the term's callback with post-burn
  ability values, which calls `actor.update` directly. The adapter
  path bypasses `DCCRoll.createRoll` entirely, so the dialog never
  appears. Today this means wizard adapter casts silently don't offer
  spellburn UI — a regression introduced in session 2 that's been
  latent until now. Session 5 wires the `options.spellburn` plumbing
  but does NOT integrate the dialog; a future session needs to either:
  (a) detect `options.showModifierDialog` on the dispatcher and fall
  back to legacy for wizard casts (loses the adapter migration for the
  dialog case), or (b) build a dialog-adapter that collects the
  commitment as `options.spellburn` before the adapter runs. Track as
  open question #6 (added below).
- **Factored table conversion via `foundryTableEntries` helper.**
  `toLibSimpleTable` (disapproval) and the new `toLibMercurialTable`
  (mercurial) differ only in per-entry projection. Extracted the
  row-walk into a shared module-local `foundryTableEntries(table,
  project)` helper. If a third consumer lands (corruption, fumble,
  patron-taint) the helper is ready. Still not promoted to a top-level
  `table-adapter.mjs` — three consumers would tip the balance.

### Session 2026-04-18 (ninth session — Phase 2, session 4)

- **Patron route lands on the adapter; legacy taint mechanic preserved
  verbatim adapter-side.** `DCCActor.rollSpellCheck`'s gate broadens
  for the wizard branch from `castingMode === 'wizard' && !isCleric &&
  !hasPatron` to `castingMode === 'wizard' && !isCleric` — patron-bound
  wizards / elves with wizard-castingMode items now flow through
  `_castViaCalculateSpellCheck`. Generic + cleric branches keep
  `!hasPatron` (rare cross-class cases — defer until session 5 close).
- **`buildSpellCheckArgs` extended** to populate
  `character.state.classState.<wizard|elf>.patron` from
  `actor.system.class.patron` so `getPatronId(character)`
  (`spells/spell-check.js:72`) resolves and the lib records
  `castInput.patron`. The lib's RAW patron-taint pipeline
  (`handleWizardFumble` → `rollPatronTaint`) stays dormant because
  the adapter never plumbs in `input.fumbleTable` — populating the
  patron field is harmless but future-proofs for when the RAW
  alignment lands.
- **`_runLegacyPatronTaint(spellItem)`** — new private DCCActor method.
  Ports `module/dcc.js:623-660` verbatim: rolls 1d100 for the d100-vs-
  chance check, parses `system.class.patronTaintChance` ("3%" → 3),
  bumps to `${chance + 1}%`, calls `actor.update`. Same trigger
  conditions as legacy: `actor.system.class?.patron` set AND
  (`spell name includes 'Patron'` OR `item.system.associatedPatron`
  truthy). Called from `_castViaCalculateSpellCheck` after
  `renderSpellCheck` for `profile.type === 'wizard' || 'elf'` casts on
  patron-bound actors. **Silent chance bump** — no chat message — which
  matches the legacy no-table fallback in `processSpellCheck` (the
  patron-taint chat only renders inside `chat-card-spell-result.html`
  when a spell result table is present, and the adapter doesn't
  produce result-table chats this phase).
- **Tests**:
  - `module/__tests__/adapter-spell-check.test.js` — now 18 tests
    (up from 14). Removed the rescoped "wizard + patron → legacy"
    case. Added: `wizard-castingMode item on a patron-bound wizard
    routes to adapter (session 4)` (no chance bump for non-patron-
    related spell name); `patron-related spell (name contains
    Patron) bumps patronTaintChance adapter-side` (3% → 4%); `spell
    with system.associatedPatron set bumps patronTaintChance
    adapter-side` (1% → 2%); `non-patron-related spell on patron-
    bound wizard does not bump patronTaintChance`; `wizard-castingMode
    item on a patron-bound elf routes to adapter (session 4)` (2% → 3%).
  - `browser-tests/e2e/phase1-adapter-dispatch.spec.js` — still 20
    tests. Rescoped the existing "wizard + patron → legacy" case to
    "wizard + patron → adapter (session 4)" with a chance-bump
    assertion (reads `system.class.patronTaintChance` before + after,
    expects +1). **All 20 tests pass against live v14 Foundry**
    (verified 2026-04-18 against the running `v14` world; 2.2 min run).
  - 777 Vitest tests pass (up from 773).

**Scope decisions (Phase 2 session 4):**

- **Option 1: adapter-side legacy preservation, not RAW migration.**
  The session-start prompt step 5 implied wiring the lib's
  `onPatronTaint` callback to bump `patronTaintChance`. On reading
  the legacy code (`dcc.js:623-660`), the Foundry-system patron-taint
  mechanic is fundamentally different from the lib's RAW model:
  - **Legacy**: per-cast 1d100 vs creeping chance, +1% each cast
    (regardless of outcome). No table lookup. Triggered for any
    patron-related spell on a patron-bound actor.
  - **Lib RAW** (`spells/spell-check.js:241` + `spells/fumble.js:46`):
    only fires on a fumble (natural 1) AND only when the fumble-
    table entry is tagged with `effect.type === 'patron-taint'`.
    Foundry-side fumble tables don't carry these tags, so naively
    switching to the lib's pipeline would have made patron taint
    effectively never trigger AND lost the creeping-chance display.
  Discussed the tradeoff with the user mid-session; chose to keep the
  legacy mechanic verbatim adapter-side and defer the RAW alignment.
  See open question below.
- **No fumble / corruption / patron-taint tables loaded.** With the
  lib's RAW pipeline dormant, plumbing in tables would have been dead
  code. Sessions 5+ revisit when figuring out the RAW alignment.
- **Generic + cleric branches keep `!hasPatron`.** Generic items on
  patron-bound actors: still legacy (rare; preserves XCC compatibility
  for patron-related generic-mode side spells). Cleric + patron is a
  rare XCC variant; defer until the last session decides whether to
  include.
- **Patron field populated even though the lib's pipeline is dormant.**
  Harmless (no fumbleTable means no taint trigger) and forward-looking:
  when RAW alignment lands, the character state is already correct.

### Session 2026-04-18 (eighth session — Phase 2, session 3)

- **Cleric disapproval migration.** `DCCActor.rollSpellCheck` now
  routes cleric-castingMode items on non-patron-bound Cleric actors
  through the adapter. The dispatcher gate broadens from the
  session-2 set to also accept `castingMode === 'cleric' && isCleric
  && !hasPatron`. Wizard-on-cleric and cleric-on-non-cleric stay on
  legacy (class-vs-castingMode mismatch would silently switch the
  side-effect set between `handleClericDisapproval` and wizard spell
  loss — safer to keep the mismatch on the old path).
- **`_castViaCalculateSpellCheck` extended** to the cleric path.
  When `profile.type === 'cleric'`, the adapter loads the actor's
  configured disapproval table via `loadDisapprovalTable(actor)` and
  attaches it to `input.disapprovalTable`; when the pass-1 natural
  roll lands within the disapproval range, a 1d4 is pre-rolled in
  Foundry so the pass-2 roller can hand it back when the lib calls
  `options.roller('1d4')` inside `rollDisapproval`. The pass-2 roller
  is now formula-dispatching (`'1d4'` → pre-rolled d4, else spell-check
  natural) instead of the session-2 `() => natural`. After the lib
  returns, `result.disapprovalResult` drives a dedicated chat message
  via `renderDisapprovalRoll` (replaces `_onRollDisapproval` +
  `RollTable.draw`).
- **`module/adapter/spell-input.mjs`** extended:
  - `buildSpellCheckArgs` now populates
    `character.state.classState.cleric.disapprovalRange` from
    `actor.system.class.disapproval` when `profile.type === 'cleric'`;
    defaults to 1 when the actor has no value yet (matches the lib's
    `DEFAULT_DISAPPROVAL_RANGE`).
  - New `loadDisapprovalTable(actor)` — async. Walks the same
    resolution path as the legacy `_onRollDisapproval`
    (`actor.js:2858-2886`): `CONFIG.DCC.disapprovalPacks.packs` first,
    then world tables. Converts the Foundry `RollTable` to the lib's
    `SimpleTable` via `toLibSimpleTable` (module-local helper). Returns
    `null` when no table resolves (unit-test env, misconfigured
    compendium) — the lib then skips the table draw and still triggers
    the range bump via `handleClericDisapproval`, matching legacy
    "no table configured" behavior. **Sessions 4–5 reuse
    `toLibSimpleTable`** for corruption / patron taint / mercurial
    tables if the lookup shape stays the same; extract a shared loader
    when the third consumer lands.
- **`module/adapter/spell-events.mjs`** extended:
  - `createSpellEvents` now returns `onDisapprovalIncreased` when an
    `actor` is provided (previously only `onSpellLost` when a
    `spellItem` was). The handler mirrors the legacy `applyDisapproval`
    (`actor.js:2789`): bails early on `actor.isNPC`, otherwise updates
    `system.class.disapproval` and posts the "DCC.DisapprovalGained"
    EMOTE chat message. Chat rendering is additionally gated on
    `ChatMessage` + `CONFIG.ChatMessage.documentClass` being defined so
    unit tests can assert on `actor.update` without setting up the
    full chat mock.
- **`module/adapter/chat-renderer.mjs`** extended:
  - New `renderDisapprovalRoll({ actor, disapprovalResult })` export.
    Posts a single chat message with the lib's rolled disapproval total
    and the drawn table entry's description (mirrors the
    `RollTable.draw` chat the legacy `_onRollDisapproval` emits). Uses
    a deterministic `${total}d1` Roll so the value renders through
    Foundry's normal chat pipeline (DSN, highlighting, etc.).
- **Tests**:
  - `module/__tests__/adapter-spell-check.test.js` — now 14 tests (up
    from 8). New: `adapter path fires for a cleric-castingMode item on
    a Cleric actor`; `cleric-castingMode item on a patron-bound actor
    routes to legacy`; `cleric-castingMode item on a non-Cleric actor
    routes to legacy`; `createSpellEvents onDisapprovalIncreased
    updates system.class.disapproval`; `createSpellEvents
    onDisapprovalIncreased bails early for NPC actors`;
    `createSpellEvents without actor does not wire
    onDisapprovalIncreased`. Existing "generic item on Cleric →
    legacy" test kept (generic castingMode doesn't gate on isCleric in
    the old dispatcher logic; the new gate `!isCleric` keeps it legacy).
  - `browser-tests/e2e/phase1-adapter-dispatch.spec.js` — 20 tests
    (up from 19). New: "cleric-castingMode spell item on a Cleric
    actor → adapter (cleric)" asserts `mode=cleric`. **All 20 tests
    pass against live v14 Foundry** (verified 2026-04-18 against the
    running `v14` world; 2.1 min run).
  - Existing `actor.test.js` cleric spell-check tests all still
    pass: the dispatcher routes them to legacy when castingMode is
    generic/wizard or when the actor has no className set.
  - 773 Vitest tests pass (up from 767).

**Scope decisions (Phase 2 session 3):**

- **Gate tightened from `(castingMode === 'cleric' || isCleric)` to
  `castingMode === 'cleric' && isCleric`.** The session-start slice
  was permissive (any cleric-mode item OR any cleric actor). Routing
  wizard-castingMode items on a cleric actor through the adapter
  would pick up the cleric profile (since `getCasterProfile` reads
  `actor.system.class.className`) and trigger `handleClericDisapproval`
  — swapping the legacy wizard-spell-loss side effect for disapproval.
  The narrower gate preserves the legacy behavior for mismatched
  cases. Re-open if a future session surfaces a real cross-class need.
- **`toLibSimpleTable` conversion is local to `spell-input.mjs`.**
  Sessions 4–5 (corruption / taint / mercurial) will likely reuse the
  same Foundry-RollTable → lib-SimpleTable shape; extracting a shared
  helper now would be premature. When the third consumer lands, fold
  into a `table-adapter.mjs` or similar.
- **Pre-roll the 1d4 only when natural ≤ disapprovalRange.** The lib
  calls `options.roller('1d4')` inside `rollDisapproval` only when
  `rollTriggersDisapproval` is true. Pre-rolling unconditionally would
  waste a roll (and pollute DSN); pre-rolling conditionally is the
  same branch the lib uses.
- **`renderDisapprovalRoll` uses a `${total}d1` Roll.** The lib's
  rolled value is already computed; Foundry just needs *some* Roll
  object to post the chat message. `NdN1d1` evaluates deterministically
  to `N`, preserving the DSN/chat highlighting pipeline without
  re-rolling the d4.
- **Wave-2 lib modifier migration still not required.** The
  disapproval pipeline reads from `castInput.disapprovalRange` (a
  plain number) and writes to `result.disapprovalResult` /
  `result.newDisapprovalRange`. No tagged-union modifiers touched.

### Session 2026-04-18 (seventh session — Phase 2, session 2)

- **Wizard spell loss migration.** `DCCActor.rollSpellCheck` now
  routes wizard-castingMode items (on non-cleric, non-patron-bound
  actors) through the adapter. The dispatcher's gate broadened from
  `castingMode === 'generic' && !hasPatron && !isCleric` to also
  accept `castingMode === 'wizard' && !hasPatron && !isCleric`.
  Adapter-side pre-check: `spellItem.system.lost &&
  settings.get('dcc', 'automateWizardSpellLoss')` → warn + early
  return, mirroring `DCCItem.rollSpellCheck:260`.
- **Adapter branch structure:**
  `_rollSpellCheckViaAdapter` (single logDispatch call, now logs
  `mode=generic|wizard`) internally dispatches to
  `_castViaCastSpell` (generic path) or
  `_castViaCalculateSpellCheck` (wizard path). Both use the
  two-pass formula/evaluate pattern established by Phase 1.
  `_buildSpellCheckFlavor` factors out the shared chat-flavor
  construction.
- **`module/adapter/spell-input.mjs`** extended:
  - Exported `syntheticGenericProfile(abilityId)` — named factory
    for the generic profile.
  - Exported `buildSpellbookEntry(spellItem, spellId)` — builds a
    lib-shaped entry from the item's `system.lost` /
    `system.lastResult`.
  - New `buildSpellCheckArgs(actor, spellItem, options)` —
    returns `{ character, input, profile, abilityId }` for
    `calculateSpellCheck`. Looks up the real caster profile via
    `getCasterProfile(classId)` (from `actor.system.class.className
    .toLowerCase()`), extends `actorToCharacter` with the
    `identity.birthAugur.multiplier` + `identity.startingLuck` that
    the lib's luck-modifier helpers read, and populates
    `character.state.classState.<profile.type>.spellbook` with the
    single entry so `findSpellEntry` succeeds. Returns `null` for
    classes with no lib-side profile — the adapter then falls back
    to the legacy path.
- **`module/adapter/spell-events.mjs`** filled in:
  - `createSpellEvents({ actor, spellItem })` — session-2 returns
    `{ onSpellLost }`; `onSpellLost(result)` calls
    `spellItem.update({ 'system.lost': true })` fire-and-forget.
    Actor kept in the closure for sessions 3–5.
- **Tests**:
  - `module/__tests__/adapter-spell-check.test.js` — now 8 tests
    (up from 4). New: wizard-on-wizard → adapter (asserts flags +
    no legacy delegation); already-lost wizard + automation on →
    warn + early return; wizard on patron-bound → legacy;
    `createSpellEvents.onSpellLost` bridge unit test; naked-path
    `createSpellEvents` has no `onSpellLost`.
  - `browser-tests/e2e/phase1-adapter-dispatch.spec.js` — 19 tests
    (up from 18). New: "wizard-castingMode spell item on a Wizard
    actor → adapter (wizard)" asserts `mode=wizard`. The previous
    "wizard → legacy" test was rescoped to "wizard on patron-bound
    → legacy" since plain wizard now goes through the adapter.
    Not yet run against live Foundry — pending next v14 launch.
  - Existing `actor.test.js` wizard spell-check tests all still
    pass: the dispatcher routes them to legacy (default mock actor
    has no `className`, so `getCasterProfile` returns undefined
    and the wizard-adapter path falls back — see the "no lib-side
    profile" branch in `_rollSpellCheckViaAdapter`).
  - 767 Vitest tests pass (up from 763).

**Scope decisions (Phase 2 session 2):**

- **`calculateSpellCheck` for the wizard path, `castSpell` for
  generic.** The session doc left both paths open
  ("`castSpell` stays as a fallback for the synthetic generic
  path (or we drop the generic branch in favor of routing all
  casts through `calculateSpellCheck`)"). We kept them split: the
  generic path already had a working single-call `castSpell`
  pipeline; migrating it to `calculateSpellCheck` would force a
  synthetic `Character.state.classState` for no behavioral gain.
  The wizard path genuinely needs `calculateSpellCheck` because
  its lib-side spellbook + `updatedSpellbookEntry` bookkeeping is
  what session 2 is migrating toward — and because later sessions
  layer fumble / corruption / patron / disapproval on top of
  `calculateSpellCheck`'s orchestrator.
- **Class fallback to legacy.** When the actor's
  `system.class.className` doesn't resolve to a lib-side caster
  profile (homebrew class, spinoff module, or a non-caster class
  with a wizard-castingMode item), `buildSpellCheckArgs` returns
  `null` and the adapter drops back to the legacy
  `DCCItem.rollSpellCheck` delegation. This keeps XCC / spinoff
  content working while the migration proceeds.
- **Lost-spell pre-check in the dispatcher, not the adapter.**
  Placing the check in `rollSpellCheck` before dispatch means
  `_rollSpellCheckViaAdapter` / `_castViaCalculateSpellCheck` can
  assume the cast is going ahead. The adapter-side `logDispatch`
  call does not fire when the cast is pre-empted — the observable
  signal is the `ui.notifications.warn`, matching the legacy
  `DCCItem.rollSpellCheck:260` path.
- **Wave-2 lib modifier migration not required.**
  `calculateSpellCheck` / `castSpell` still emit
  `LegacyRollModifier[]` (per the staged migration in
  `dcc-core-lib/docs/MODIFIERS.md §9`, spells are wave 2 and not
  yet landed). The renderer passes the list through unchanged in
  `dcc.libResult.modifiers`; downstream consumers already know
  about the legacy shape.

**Scope decisions (Phase 2 session 1):**

- **`castSpell` instead of `calculateSpellCheck` this session.**
  The session-start doc pointed at `calculateSpellCheck`, but it
  performs a spellbook entry + caster profile lookup that
  requires `actorToCharacter` to populate `state.classState.*`
  (not wired yet). `castSpell` accepts a fully-built
  `SpellCastInput` and runs the lib's buildFormula / evaluateRoll
  / determineTier pipeline without the gatekeeping. Session 2
  extends `actorToCharacter` (or `buildSpellCastInput`) to fetch
  a real wizard caster profile + spellbook entry, at which point
  the adapter can switch to `calculateSpellCheck`.
- **Legacy path delegates to `DCCItem.rollSpellCheck`
  fire-and-forget.** Preserves the pre-dispatcher contract —
  awaiting the delegated promise would surface errors the
  original code swallowed (e.g. `actor.system.abilities[...]`
  on a dummy item without a real actor in `actor.test.js:805`).
  Not ideal long-term, but matches today's behavior; a later
  session can audit whether the swallow is safe.

### Session 2026-04-18 (twelfth session — Phase 3, session 1)

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
    forwards the commitment` (mocked return `{str:1,agl:0,sta:2}` →
    asserts actor.update gets `str: 13 / sta: 11` with str=14/sta=13
    baseline); `wizard cast with showModifierDialog aborts when the
    dialog is canceled` (null return → no rollToMessage, no legacy
    item delegation, no actor.update); `wizard cast with preset
    options.spellburn bypasses the dialog` (preset commitment reaches
    the adapter without the prompt firing); `wizard cast on an NPC
    actor bypasses the spellburn dialog` (NPC short-circuit — the
    legacy dialog never offered spellburn to NPCs either).
  - 794 Vitest tests pass (up from 790). `npm run format` clean,
    `npm run compare-lang` clean.
  - Playwright spec NOT extended this session — the adapter-dispatch
    spec asserts on `logDispatch` console output, which the
    Spellburn dialog bridge doesn't directly emit (the bridge sits
    in the dispatcher BEFORE the adapter path's logDispatch line).
    Future session can add a Playwright case that drives the
    DialogV2 UI if that coverage is worth the complexity; today the
    34-test unit coverage is the integration signal.

**Scope decisions (Phase 3 session 1):**

- **Slice (a) — dialog-adapter — picked over (b) attack-formula and
  (c) hook translation.** The session-start prompt's guidance:
  "Lean (a) if lib wave-3 isn't ready." `module/vendor/dcc-core-lib/`
  is pinned at 0.4.0 where all `src/combat/*.ts` still import
  `LegacyRollModifier`; wave-3 has not shipped. Attack migration
  could still proceed on the legacy shape (Phase 2 precedent), but
  landing the dialog first unblocks BOTH spellburn (immediate
  regression fix) AND the attack / damage dialog (future session)
  and builds reusable scaffolding before the larger attack work
  commits to a shape.
- **OQ6 resolved via (b) dialog-adapter, NOT (a) dispatcher
  carve-out.** Carve-out would have routed `showModifierDialog` back
  to `_rollSpellCheckLegacy` — shipping quickly but undoing the
  session-2 wizard migration for every right-click cast. Dialog-
  adapter preserves the full adapter pipeline and gives a template
  for the attack dialog. The tradeoff: this session's dialog is
  narrow (only Spellburn). Other legacy-dialog capabilities (die
  tweak, custom modifier rows, CheckPenalty toggle, FleetingLuck)
  remain absent on the wizard adapter path — but they have been
  since session 2, and landing those back is a session-5+ project
  once the attack dialog has revealed the general pattern.
- **DialogV2 over Handlebars+custom-UI.** The legacy Spellburn term
  uses a Handlebars partial with +/- buttons that update a display
  showing the post-burn stat in real time. DialogV2 with simple
  number inputs is a UX regression vs that (no live readout;
  keyboard-only +/- via input), but it's dramatically simpler to
  build and test, and matches how the rest of the system's modal
  prompts already work (`spell-duel.js:538`, `parser.js:126`,
  `item-sheet.js:397/429`). If user feedback surfaces the missing
  +/- UX, a later session can port the Handlebars partial onto an
  ApplicationV2 subclass behind the same `promptSpellburnCommitment`
  export.
- **NPC short-circuit.** The legacy `DCCSpellburnTerm` was only
  built on PC-path casts (the dialog only opens for PC casts).
  Mirroring that: NPCs never see the prompt. The condition is
  `!this.isNPC` (not `this.isPC`) to match how other `rollSpellCheck`
  branches gate. A hypothetical NPC with `options.spellburn` pre-set
  still gets the burn applied — the bridge in `spell-events.mjs`
  already bails on NPCs anyway, so the effective behavior is still
  "no NPC spellburn".

### Session 2026-04-18 (eleventh session — Phase 2 CLOSE)

Doc-only session. No code changed. Closes both Phase 2 gate items.

**Gate 1 — `game.dcc.processSpellCheck` consumer audit.**

Inventoried all 5 call sites across DCC + XCC:

| # | Caller | File:line | Options passed | Adapter covers today? |
|---|---|---|---|---|
| 1 | DCC `rollSkillCheck` cleric/skill-table route (Turn Unholy, Lay on Hands, Divine Aid) | `module/actor.js:1757` | `{ rollTable, roll, item, flavor }` | **No** — needs RollTable lookup + level-added crit totals |
| 2 | DCC `_rollSpellCheckLegacy` naked path | `module/actor.js:2371` | `{ rollTable: null, roll, item: null, flavor, forceCrit }` | **Partial** — naked case (no item) needs pre-built-Roll handoff path the adapter doesn't expose |
| 3 | DCC `DCCItem.rollSpellCheck` | `module/item.js:376` | `{ rollTable, roll, item, flavor, manifestation, mercurial, forceCrit }` | **No** — RollTable + manifestation + forceCrit all absent from adapter |
| 4 | XCC naked path (copy of #2) | `xcc/module/xcc-actor-sheet.js:471` | `{ rollTable: null, roll, item: null, flavor }` | Partial (same as #2) |
| 5 | XCC item path (copy of #3 + elf-trickster no-spellburn + blaster die label) | `xcc/module/xcc-actor-sheet.js:597` | `{ rollTable, roll, item, flavor, manifestation, mercurial }` | No (same as #3) |

**Key finding:** XCC's two call sites are structurally identical peers
of DCC's own internal callers, not public-API consumers. They do the
same thing DCC does (construct pre-built Foundry Roll → hand off to
orchestrator) with XCC-specific term tweaks. A deprecation would force
XCC to reinvent the orchestrator; a shim-to-adapter rewrite would break
DCC's own still-legacy paths (`actor.js:1757`, `actor.js:2371`,
`item.js:376`).

**Decision — Option (d): `processSpellCheck` is permanent stable API.**
Don't deprecate. Don't shim. Don't publish a new parallel entry. The
adapter dispatcher (`DCCActor.rollSpellCheck`, sessions 1–5) routes
narrow happy-paths through `_castViaCastSpell` /
`_castViaCalculateSpellCheck`; everything else stays on
`processSpellCheck`. Future adapter capability growth (result-table
rendering, manifestation display, forceCrit, mercurial-chat-without-
race) migrates routes one at a time.

Options (a)–(c) from the session prompt considered and rejected:
- **(a) Shim-to-adapter**: the five call sites all pass a pre-built
  Foundry `Roll` that the adapter's two-pass pipeline doesn't consume.
  Rewriting the shim to construct a `SpellCastInput` from a pre-built
  Roll would require inventing new adapter machinery just to satisfy
  the shim. High blast radius, zero user benefit.
- **(b) Deprecate with 1-version warning**: XCC maintainer would have
  to refactor sheets to stop pre-building terms. No user benefit;
  adversarial to a sibling module.
- **(c) New public `game.dcc.adapter.castSpell` entry**: if it accepts
  a `SpellCastInput`, it's `actor.rollSpellCheck(...)` renamed; if it
  accepts a pre-built Roll, it's `processSpellCheck` renamed. Nothing
  gained.

Actions taken:
- Updated `docs/dev/EXTENSION_API.md` `processSpellCheck` row to
  reflect permanent-stable designation + orchestrator semantics.
- Updated `EXTENSION_API.md` recommendation #5 from "begin deprecating"
  to "permanent stable API".
- Updated `docs/dev/ARCHITECTURE_REIMAGINED.md §7 Phase 2` to remove
  the "Delete `processSpellCheck` from dcc.js" goal and document the
  incremental-route-migration approach.

**Gate 2 — Open question #5 (patron-taint RAW alignment).**

Re-read legacy `module/dcc.js:623-660` (creeping d100-vs-chance
mechanic) and lib RAW (`spells/spell-check.js:241` `handleWizardFumble`
+ `spells/fumble.js:46` `fumbleRequiresPatronTaint`).

**Decision — Option (a): keep `_runLegacyPatronTaint` as permanent
adapter infrastructure.** Document the RAW divergence. RAW alignment
becomes a backlog project (not a Phase 2 gate).

Rationale:
- Legacy creeping-chance is user-facing established behavior across
  every DCC Foundry world since the system was written. Changing to
  RAW would be a silent behavioral regression for every actor with a
  non-1% `patronTaintChance`.
- RAW alignment would touch sibling content modules
  (`dcc-core-book`, `xcc-core-book`) by demanding fumble-table
  effect-tag migration, plus per-patron taint-table resolution
  (Foundry has `spellSideEffectsCompendium` but no taint-table
  setting; likely name-convention lookup). Multi-session, multi-repo
  project.
- `_runLegacyPatronTaint` is already minimal (15 lines), tested (5
  Vitest cases + 1 Playwright case), and works against live v14
  Foundry. Zero incremental cost.

Actions taken:
- Clarified `_runLegacyPatronTaint` JSDoc to explicitly mark it as
  permanent (not a phase scaffold) with the Phase 2 close decision
  date. (Existing JSDoc already captured the divergence; the update
  removes the "defer to a future session" hedge and pins the decision.)
- Moved open question #5 from "Blockers / open questions" to "Closed
  questions" below.

**Phase 2 close-out summary:**
- All 5 spell-check sessions landed (dispatcher + generic + wizard +
  cleric + patron + spellburn + mercurial).
- 790 Vitest tests pass + 22 Playwright dispatch tests pass against
  live v14 Foundry (verified 2026-04-18).
- `processSpellCheck` stays exported; dispatcher fall-through preserves
  all non-covered routes verbatim. No behavioral regressions.
- Sibling modules untouched. XCC works as-is.
- Phase 3 (attack / damage / crit / fumble) is the next active phase;
  open question #6 (spellburn dialog) is the early Phase 3 pick-up.

## Closed questions

5. ~~**Patron-taint mechanic alignment.**~~ **Resolved 2026-04-18 at
   Phase 2 close: keep `_runLegacyPatronTaint` as permanent adapter
   infrastructure, defer RAW alignment indefinitely.** See Phase 2
   close session above. RAW alignment remains possible as a future
   backlog project but is not gated on Phase 3 or later.

6. ~~**Spellburn dialog integration.**~~ **Resolved 2026-04-18 at
   Phase 3 session 1: adapter-side `promptSpellburnCommitment` dialog
   via DialogV2, wired into `rollSpellCheck` dispatcher for the
   wizard / elf + `showModifierDialog` branch.** The latent regression
   from Phase 2 session 2 (wizard adapter casts silently lost the
   Spellburn UI) is fixed. Other legacy-dialog capabilities (die
   tweak, custom modifier rows, CheckPenalty toggle, FleetingLuck)
   remain absent on the adapter path and will be revisited once the
   attack / damage dialog work generalizes the roll-dialog scaffold.

## Blockers / open questions

1. ~~**Runtime loading strategy.**~~ **Resolved 2026-04-17: vendor
   approach (option b).** `scripts/sync-core-lib.mjs` builds the linked
   lib and copies its `dist/` into `module/vendor/dcc-core-lib/`, which
   is committed. Adapter code imports via relative path
   (`../vendor/dcc-core-lib/index.js`). No bundler added. One sync
   command (`npm run sync-core-lib`) + one commit per lib-version bump.
   Rationale: keeps the "Foundry loads `module/dcc.js` directly"
   invariant; CI needs no `npm link` or unpublished-package handling;
   unit tests and Foundry runtime resolve identically; each
   vendor-update commit is a reviewable pin. Initial sync (0.2.1,
   `fa908c2`) is ~4.3 MB across 577 files (1.3 MB JS, 1.1 MB source
   maps, 0.5 MB `.d.ts`/maps for IDE support). If repo bloat becomes a
   concern later, source maps can be excluded from the sync — costs
   some legibility in Foundry console stack traces.

2. **Package name discrepancy.** The architecture doc and setup instructions
   refer to `dcc-core-lib`, but the actual npm package name is
   `@moonloch/dcc-core-lib` (scoped). Imports use the scoped name. The
   unscoped name is not currently published, so CI currently *cannot*
   `npm install` the lib — only `npm link` works. This is entangled with
   the runtime-loading question.

3. **Dead hook `dcc.update`.** XCC listens for this hook
   (`modules/xcc/module/xcc.js:525`), but nothing in the DCC system
   emits it. Either it was removed at some point, or XCC added it
   speculatively. Decide: add the emission back, or coordinate with
   XCC maintainers to remove the listener. Documented in
   `EXTENSION_API.md §Dead`.

4. **Undocumented `game.dcc.*` pieces with heavy XCC usage.** XCC reaches
   into `game.dcc.DCCRoll.cleanFormula`, `game.dcc.DiceChain.bumpDie`,
   `calculateCritAdjustment`, `calculateProportionalCritRange`, and the
   full `FleetingLuck` class (`init`, `updateFlags`, `give`, `enabled`,
   `automationEnabled`). These are now tagged **stable** — removing or
   renaming them breaks XCC. Formal stabilization before Phase 3
   (attack/crit migration) is required because that's where those
   utilities are implicated.

5. ~~**Patron-taint mechanic alignment.**~~ **Resolved at Phase 2
   close, 2026-04-18.** See "Closed questions" section above. RAW
   alignment is backlog, not a phase gate.

6. ~~**Spellburn dialog integration.**~~ **Resolved 2026-04-18 at
   Phase 3 session 1 via option (b) dialog-adapter.** See "Closed
   questions" above for rationale.

7. **Wizard / elf adapter-path modifier-dialog coverage beyond
   Spellburn.** Session 7 (Phase 3 session 1) added back the
   Spellburn prompt but the other legacy `RollModifierDialog`
   capabilities (die tweak, custom modifier rows, CheckPenalty
   toggle, FleetingLuck) remain absent for wizard adapter casts.
   These have been absent since Phase 2 session 2 and are low-volume
   (most users take default rolls), but a fully UI-equivalent
   adapter-side dialog is eventually needed. Most likely path:
   generalize `module/adapter/roll-dialog.mjs` after the attack /
   damage dialog lands, once the two dialogs share a common scaffold.

## PR #720 review backlog (2026-04-19)

PR #720 (the merge of Phases 0-3 into `main`) triggered a full
8-agent review. Safe auto-fixes landed in the PR as follow-up
commits; the items below are the deferred findings — real issues or
design calls — that are out of scope for a "review cleanup" commit
and should be scheduled into Phase 4+ work.

**Blocking for Phase 4 start (pick up before broadening the adapter):**

- **Silent adapter→legacy fallbacks missing a logged reason.** When
  `buildSpellCheckArgs` returns `null` (custom-class caster with no
  lib profile), or when `loadDisapprovalTable` /
  `loadMercurialMagicTable` silently return `null` (unconfigured
  setting, missing pack), the dispatcher falls through to the legacy
  body with no indication *why*. Fix requires a coordinated
  Playwright-spec + adapter-code change — the spec currently asserts
  on a specific log shape per dispatch, so inserting a new
  `logDispatch(rollType, 'legacy', { reason })` line at the fallback
  site needs the spec updated in the same commit.
  Locations: `module/actor.js:1980-1982` (spell-check), `module/
  adapter/spell-input.mjs:386, 440`, `module/actor.js:2067-2069,
  2048-2051`.
- **Partial-failure state when `_castViaCalculateSpellCheck`'s pass-2
  returns `result.error`** (`module/actor.js:2122-2126`). Events
  already fired during pass 2 (`onSpellLost`, `onDisapprovalIncreased`,
  `onSpellburnApplied` have mutated actor/item state), but the chat
  message never posts. Review cleanup added a `console.error` for
  diagnostics; full rollback needs a design decision — probably
  run pass-2 once WITHOUT events to detect the error, then replay
  WITH events only when the result is clean.
- **Spellburn dialog prompts before the adapter knows it can handle
  the cast.** `rollSpellCheck` (`module/actor.js:1914-1940`) calls
  `promptSpellburnCommitment` before `_rollSpellCheckViaAdapter` tries
  `buildSpellCheckArgs` — when the actor's class has no lib caster
  profile the adapter falls back to `_rollSpellCheckLegacy`, which
  ignores `options.spellburn`, silently dropping the user's
  commitment. Scope is narrow (custom-class wizards / elves with
  spellburn) but user-visible. Fix: a cheap `resolveCasterProfile`
  pre-check before the dialog, or have legacy honor `options.spellburn`.

**Design calls (need a deliberate decision, not a silent fix):**

- **Spellburn clamp: `1` vs `0`.** `onSpellburnApplied`
  (`module/adapter/spell-events.mjs:124`) clamps ability scores at
  1; legacy `DCCSpellburnTerm` allowed 0 (RAW permits a wizard dying
  from Stamina burn). The docstring acknowledges the adapter's
  choice. Decide: preserve legacy (allow 0) or keep the safer
  adapter floor (1) and document it as a house-rules change.
- **Damage `_total` clamp divergence** (`module/actor.js:3096`).
  Foundry clamps `damageRoll._total = 1` when below; the lib
  doesn't. Review cleanup added `warnIfDivergent` with post-clamp
  normalization, so no more false-positive warns — but the
  `dcc.libDamageResult.total` flag can still carry `0` or a negative
  while chat shows `1`. Decide: mirror the clamp on the flag
  (`libDamageResult.total = Math.max(1, libResult.total)`) or
  document that the flag is "lib-native, pre-clamp" and let
  consumers clamp.
- **Error boundaries around `_xxxViaAdapter`.** A lib throw currently
  becomes an unhandled rejection → the cast silently fails, broken UX.
  Wrapping every adapter path in `try/catch` with legacy fallback
  would make the system more forgiving, but risks masking the very
  lib bugs the observational refactor is designed to surface. Right
  answer is probably: add the fallback *after* Phase 4-5 prove the
  adapter paths stable.
- **`createFoundryRoller` — delete or wire.** Review cleanup updated
  the docstring to reflect that no dispatcher path currently consumes
  it. Phase 4 should either adopt it (replacing the inline `new Roll`
  + `evaluate()` scattered across dispatchers) or delete the file.

**Resilience (low-risk, nice-to-have):**

- **Dispatcher gate style inconsistency.** Attack / damage / crit /
  fumble use named `_canRouteXxxViaAdapter` predicates; ability /
  save / skill / spell / init inline their gates as
  `const needsLegacyPath = …`. Pick one convention and retrofit —
  the named predicate form scales better as gates grow.
- **Unused `weapon` / `attackRollResult` parameters** on
  `_canRouteCritViaAdapter` / `_canRouteFumbleViaAdapter`
  (`weapon` unused) and `_rollCriticalLegacy` / `_rollFumbleLegacy`
  (`attackRollResult` unused). Dropping them touches test call
  sites that pass positional args (`__tests__/adapter-weapon-crit-fumble.test.js`
  uses `actor._canRouteCritViaAdapter({}, attackRollResult, ctx)`);
  clean as a pair of coordinated edits but out of scope for the
  review cleanup. Tracker: do this with the gate-style unification
  above.
- **Three copies of "strip die count" normalization:**
  `module/adapter/attack-input.mjs:normalizeLibDie`,
  `module/adapter/spell-input.mjs:normalizeLibDie` (private), and
  `module/actor.js:_stripDieCount`. Pick one canonical
  `normalizeLibDie` (probably `attack-input.mjs`'s, it's already
  exported) and consolidate.
- **Four near-identical `dcc.libResult` flag payloads** in
  `module/adapter/chat-renderer.mjs` — every renderer hand-rolls
  the same projection plus the `FleetingLuck.updateFlags` guard.
  Extract a `buildLibResultFlag(result, extras)` + `applyFleetingLuck(flags, roll)`
  helper; renderers keep per-type extras only.
- **Uncached compendium walks.**
  `loadDisapprovalTable` + `loadMercurialMagicTable`
  (`module/adapter/spell-input.mjs`) walk packs on every cleric
  disapproval / wizard first-cast. `getCritTableLink` +
  `getCritTableResult` (`module/utilities.js`, reached from
  `_rollCriticalViaAdapter`) do two independent pack walks per
  crit. Module-level `Map` cache keyed on `tableName`, cleared on
  world reload, is plenty. The caching opportunity was already
  flagged in `spell-input.mjs:399`.

**Test coverage gaps (pr-test-analyzer severity ≥ 6):**

- `renderDisapprovalRoll` has no unit/integration test — only covered
  transitively via the cleric disapproval browser-test case.
- `promptSpellburnCommitment` + `clampBurn` are entirely mocked
  across every caller; `roll-dialog.mjs` has no direct coverage.
- `onSpellLost` is tested as a direct callback but never verified to
  *actually fire* during a real adapter cast — regression surface if
  `createSpellEvents` wiring drifts.
- Two-pass divergence (hook mutates terms *after* pass 1) only has
  coverage for the `terms[0]` die-bump case; `terms[N]` Compound /
  Modifier in-place mutations are uncovered.
- `_canRouteAttackViaAdapter` untested branches: dice-bearing
  `weapon.toHit` (e.g. `+1d4` magic), `twoWeaponSecondary: true`,
  and the `game.settings.get` try/catch fallback.
- `_rollToHitViaAdapter` NPC `attackHitBonus.melee.adjustment`
  Modifier injection block is uncovered (PC-only tests).
- `_rollToHitViaAdapter` `Roll.validate(toHit) === false` early
  return path is untested.
- `loadDisapprovalTable` / `loadMercurialMagicTable` isolated
  fallback-order tests (compendium hit / world fallback / both miss)
  are missing.
- `createFoundryRoller` has no direct unit test (ties to the
  delete-or-wire decision above).
- `__mocks__/dcc-roll.js` declares `createRoll` as `static async`
  while production is sync; tests install local sync stubs to
  paper over the mismatch — fix the shared mock, delete the stubs.

**Documentation / comment hygiene:**

- `docs/dev/ARCHITECTURE_REIMAGINED.md` §7 Phase-1 bullets reference
  lib APIs `rollCheck('ability:str', …)` / `resolveSkillCheck(…)` /
  `rollInitiative(…)` but the adapter landed `rollAbilityCheck` /
  `rollSavingThrow` / `rollCheck` (subsumed skill + init). Annotate
  the bullets with landed names.
- ARCHITECTURE_REIMAGINED.md §2.7 file-size snapshot is pinned to
  branch start; prefix with a `(Snapshot at main @ 2337ec0)` note
  so readers don't mistake it for current state.
- `module/actor.js:2136-2138` ("post the disapproval roll chat
  after the main spell-check chat, mirroring the legacy two-message
  ordering") overstates ordering guarantees — `onDisapprovalIncreased`
  fires fire-and-forget inside pass 2, actual interleaving is at
  the mercy of Foundry's chat-message pipeline. Soften the claim or
  `await` the chat-message creation inside the event.
- `_getInitiativeRollViaAdapter` accepts an `options = {}` parameter
  it never reads — drop, or document "reserved for future
  modifier-dialog bridge."

**Performance (below measurement threshold; document only):**

- `getActionDice` called 3× per `_rollToHitViaAdapter`
  (`module/actor.js:2735-2752`). Hoist to a single `const dice = ...`.
- `items.find` called 2× per `_getInitiativeRollViaAdapter`
  (`module/actor.js:1065, 1070, 1129, 1133`). Fold into one iteration.
- `renderDisapprovalRoll` / `renderMercurialEffect` use
  `new Roll('${N}d1')` for deterministic chat. Use
  `Roll.fromTerms([new NumericTerm({ number: total })])` — no
  measurable win, but reads cleaner.

## Decisions made

0. **Runtime loading: vendor the lib's built `dist/`.** See open
   question #1 above for the full rationale. Committed the initial
   sync + `scripts/sync-core-lib.mjs` in a standalone prep commit so
   Phase 1 imports have somewhere to import *from*. The sync script
   reads from `$DCC_CORE_LIB_SRC` (default
   `/Users/timwhite/WebstormProjects/dcc-core-lib`), runs `npm run
   build` inside the lib, wipes and copies `dist/`, and writes a
   `VERSION.json` with `{ name, version, commit, dirty, syncedAt }`.
   `module/vendor/**` added to `standard.ignore` so the linter skips
   vendored output.

1. **Worktree location.** Now at
   `/Users/timwhite/FoundryVTT-Next/Data/systems/dcc`. Main repo remains
   at `/Users/timwhite/FoundryVTT/Data/systems/dcc`.
   *Why:* `FoundryVTT-Next` is a separate Foundry user-data install, so
   the worktree can live under its `systems/` directory without clashing
   with the main repo on `system.json` id (each Foundry install sees
   only its own `systems/` tree). This lets Tim actually run the
   refactored system in Foundry for testing during Phase 1+.
   *History:* originally parked at
   `/Users/timwhite/WebstormProjects/dcc-refactor` on 2026-04-17 to
   avoid `systems/` collisions; moved same day once the separate
   `FoundryVTT-Next` install was set up.

2. **No `package.json` dependency entry this phase.** Adding
   `"@moonloch/dcc-core-lib": "file:../../../WebstormProjects/dcc-core-lib"`
   would break CI (absolute path, ubuntu runner), and `"*"` or any
   registry version fails because the package is unpublished. Chose to
   leave `package.json` alone and document `npm link` in this log.
   Revisit when open question #1 is resolved.

3. **Adapter stubs are empty by design.** The goal of Phase 0 is to lock
   in the *shape* of the adapter layer (which concerns live where) and
   catch any architectural objections before implementation starts in
   Phase 1. Empty stubs give reviewers a file-tree to react to; filled
   stubs would invite relitigation on boilerplate.

4. **Hook categorization method.** "Stable" = emitted *and* actively
   consumed by a sibling module. "Internal" = emitted but no external
   consumer found in the audited modules. "Dead" = listened to
   externally but never emitted (or vice versa). Tagged per-item in
   `docs/dev/EXTENSION_API.md`.

## Next steps

**Phase 3 — session 6 (crit + fumble migration) complete.** Both
finishers now surface lib-native results on chat flags when the
attack went through the adapter + automate is on. Every chained
call in a simplest-weapon attack now has a lib-native result
(`dcc.libResult` / `dcc.libDamageResult` / `dcc.libCritResult` /
`dcc.libFumbleResult`). Session 7 picks up the next slice.

**Phase 3 scope** (per `ARCHITECTURE_REIMAGINED.md §7`):
- Port `rollWeaponAttack` → `makeAttackRoll(attackInput)` + `rollDamage`
  + `rollCritical` + `rollFumble` from the lib. **All four core calls
  now have adapter paths for the simplest-weapon happy-path** —
  remaining slices broaden the gate (backstab, deed die, two-weapon,
  modifier dialog, magic bonus).
- Preserve `dcc.modifyAttackRollTerms` (dcc-qol's main hook integration
  point). Sessions 3–4 fully bridged it for the simplest-weapon
  happy-path: pushed `Modifier` terms → `libResult.bonuses` +
  `{source:'bonuses',…}` aggregate; in-place `terms[0].formula`
  mutations → `libResult.die`. Action-die threat-range math already
  lives in the existing `strictCriticalHits` / `calculateCritAdjustment`
  branches (re-read from `attackRoll.formula` post-evaluate).
- Wave 3 modifier migration on the lib side (combat subsystems) lands
  alongside Phase 3 sessions. Session 2's attack bridge emits
  `LegacyRollModifier[]` (Phase 2 precedent); session 5's damage
  bridge uses `DamageResult.breakdown[]` (the lib's native shape);
  session 6's crit/fumble bridges use `CriticalResult.roll.modifiers`
  / `FumbleResult.roll.modifiers` (lib-native `RollModifier[]`).
  Flag lib-side gaps early; sync via `npm run sync-core-lib` when
  the lib ships a wave-3 release.

**Session 7 pick-up** — Options:
(a) **Broaden the damage gate.** Pick one excluded damage case:
   magic weapon bonus (lib's `DamageInput.magicBonus`) or NPC
   damage adjustment (currently inlined as `damageRollFormula +=
   ±N`). Low-risk, high-coverage — extends session 5's adapter.
(b) **Backstab attack + damage.** Broaden the attack gate to accept
   `options.backstab`, plumb `isBackstab` into `AttackInput`, and
   use `getBackstabMultiplier` on the damage side. Design call: the
   legacy code treats backstab as auto-crit
   (`_rollToHitLegacy`), which diverges from the lib's RAW
   behavior — may want a decision doc before implementing.
(c) **Deed-die adapter path** (warriors / dwarves). Plumbs `deedDie`
   into `AttackInput` and extracts the rolled deed from Foundry's
   attack roll's `dice[1]`. Exercises the lib's `onDeedAttempt`.
(d) **Attack-modifier dialog** (open question #7 tie-in): extend
   `module/adapter/roll-dialog.mjs` with an attack-modifier prompt
   before driving a broader adapter path.
(e) **Two-weapon fighting.** Broaden the attack gate to accept
   `twoWeaponPrimary` / `twoWeaponSecondary`; lib has
   `getTwoWeaponPenalty` + `getTwoWeaponInitiativeBonus`.
(f) **Crit-result lookup in the lib.** The adapter currently
   delegates crit-table lookups to Foundry's `getCritTableResult`;
   lib's `parseCritExtraDamage` could classify the table result
   into extra damage, letting `libCritResult` carry a fully
   structured breakdown instead of just natural/total.

Lean (a) as the natural session 7 slice: the cleanest extension of
session 5's damage-adapter gate, no RAW-divergence decisions, and
immediately useful for NPC attacks which rarely crit but frequently
have damage-bonus adjustments.

**Cross-repo coordination:** if any migration uncovers a missing
feature in the lib's tagged-union modifier (e.g. skill items with
`allowLuck` needing dice-chain bumps), land the lib change first in
its own PR in `dcc-core-lib`, then sync via `npm run sync-core-lib`.

## Notes for future sessions

- The pre-commit hook runs `npm run format` → `git add .` → `npm test`.
  That `git add .` **will sweep untracked files into the commit**. Before
  committing, either stash or add to `.gitignore`.
- **Lib updates require `npm run sync-core-lib`** to re-vendor
  `module/vendor/dcc-core-lib/`. Commit the vendor delta separately
  from any adapter change that depends on it — two commits: `vendor:
  sync dcc-core-lib to <version> (<sha>)` then the adapter change.
  `VERSION.json` records the lib's git SHA and flags `dirty: true` if
  the lib tree had uncommitted changes at sync time (do not release
  from a dirty sync).
- `npm link @moonloch/dcc-core-lib` is no longer required for runtime
  loading (the vendored copy is used instead). It *is* still useful if
  you want TypeScript-aware IDE support against the linked source, but
  nothing in the system imports from `@moonloch/dcc-core-lib` at
  runtime anymore — all imports are relative paths into
  `module/vendor/dcc-core-lib/`.
- Sibling modules that must keep working:
  - `../../modules/dcc-qol` — attack hook consumer, reaches into
    `DiceChain.bumpDie` + `DCCRoll.createRoll`
  - `../../modules/xcc` — heaviest consumer; variant game fighting the
    system (replaces `CONFIG.Actor.documentClass` globally)
  - `../../modules/mcc-classes` — clean schema-hook consumer
  - `../../modules/dcc-crawl-classes` — clean schema-hook consumer

### Dispatch logging (permanent)

- Centralized at `module/adapter/debug.mjs`. Every dispatch path calls
  `logDispatch(rollType, 'adapter'|'legacy', details)` to print one
  line to the Foundry console, e.g.
  `[DCC adapter] rollSavingThrow → via adapter saveId=ref`.
- **The logs are permanent, not a Phase-1 scaffold** (decision
  2026-04-18). `browser-tests/e2e/phase1-adapter-dispatch.spec.js`
  captures them via Playwright and asserts every dispatcher branch
  end-to-end; stripping the logs would delete that signal.
- Every `_xxxViaAdapter` / `_xxxLegacy` added in later phases (spell,
  attack, damage, crit, fumble) must call `logDispatch(...)` as its
  first line. Mirror the pattern at `_rollSavingThrowViaAdapter` in
  `module/actor.js`.
- The helper's header JSDoc describes the role. This bullet is the
  process-level reminder; `debug.mjs` itself should be treated as
  core adapter infrastructure on a par with `chat-renderer.mjs` and
  `character-accessors.mjs`.
