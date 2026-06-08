# Refactor Progress — `refactor/dcc-core-lib-adapter`

> **Handoff artifact.** Update at the end of every work session and
> after any significant decision. Future Claude sessions rely on this.
>
> **Detailed session-by-session history lives in phase archives:**
> - [Phase 0 + 1 — scaffolding + simple rolls](dev/progress/phase-0-1.md)
> - [Phase 2 — spell check migration](dev/progress/phase-2.md)
> - [Phase 3 — attacks, damage, crit, fumble + cruft](dev/progress/phase-3.md)
> - [Phase 4 — data-model slimming + class-mixin extension surface](dev/progress/phase-4.md)
> - [Phase 5 — sheet composition + class defaults + starting items](dev/progress/phase-5.md)
> - [Phase 6 — lib-side class progression + variant registration](dev/progress/phase-6.md)
> - [Phase 7 — cleanup](dev/progress/phase-7.md)

## Archive discipline

**This file is the index, not the log.** Keep it scannable — session
narratives belong in the phase archives above. Rules for maintaining
the split:

- **End-of-session updates go here first**, in *Recent slices*
  (newest at top). Write the slice narrative at whatever detail level
  feels right to the author; don't pre-abbreviate.
- **When *Recent slices* passes 5 entries, push the oldest down to
  the relevant phase archive.** The archives are chronological
  within each phase — append the demoted entry at the end of its
  section. Don't delete anything. If the entry belongs to a phase
  that isn't yet archived (e.g., first Phase 4 slice), start
  `dev/progress/phase-N.md` with the existing archive header style
  and link it from the index above.
- **New phase boundaries** (a slice starts Phase 4 / 5 / 6 / 7) get
  a new archive file from day one. The first slice of a new phase
  lands in *Recent slices* like any other; the archive file exists
  ready to receive it when it rotates out.
- **What stays here indefinitely:** *Current phase* (≤2 paragraphs,
  rewritten each session if the situation moved), *Closed questions*
  (short ticks), *Blockers / open questions* (active only — move
  resolved ones to *Closed* with a one-line date stamp),
  *PR #N review backlog* (these are actionable and short-lived —
  prune fixed items with strikethrough + date, delete fully when
  a section is empty), *Decisions made* (durable — never archived),
  *Next steps*, *Notes for future sessions*.
- **What never goes here:** session-by-session narrative beyond the
  5 most recent, historical decision rationale that's already
  captured in a completed slice, test-count deltas from older
  sessions. If you catch yourself summarizing a session that's
  already in an archive, delete the summary and let the archive
  speak.
- **Cross-linking rule.** Every entry in *Recent slices* should fit
  in 3–6 lines. If the slice has architecturally interesting detail,
  put that detail in the archive and link from the *Recent slices*
  bullet, don't inline it here.
- **No dedup pass required between this file and `01-session-start.md`.**
  The session-start prompt is a self-contained handoff; it will
  drift from this file's *Current phase* summary by a sentence or
  two and that's fine. They're read in different contexts (fresh
  session vs. in-progress update). If they diverge meaningfully,
  treat *this file* as authoritative and refresh the session-start
  prompt when the next slice lands.

**Length check.** If `00-progress.md` creeps past ~600 lines, one of
the rules above is being ignored. The *PR #720 review backlog* is
the most likely offender — prune fixed items with strikethrough +
date, then delete them entirely once a whole sub-section is cleared.

## Current phase

**Phase 7 cleanup — latest 2026-06-08 (sessions 48–50).** Every PR #720 arc is
closed: legacy-decommission (sessions 21–25 — no `_xxxLegacy` roll body
survives; every public dispatcher is single-path through the adapter),
test-coverage backfill (26–31 — every PR #720 severity-≥6 gap closed or
found-stale, incl. the session-29 forceCrit dice-flake fix), doc/comment
hygiene (32), the programmatic-PC-creation doc (33), and the two
below-threshold perf items (34). **Sessions 35–39 ran the Appendix-A
`config.js` file-shrinkage arc** with five slices (monster tables →
`module/config/monster-data.mjs`; default-image tables →
`module/config/images.mjs`; dice config → `module/config/dice.mjs`;
`activeEffectKeys` → `module/config/active-effect-keys.mjs`; actor-importer
block → `module/config/actor-importer.mjs`), shrinking `config.js` 845 → 451.
**Sessions 40–42 opened + advanced the Appendix-A `item.js` arc** —
container-support → `module/item/container-mixin.mjs` (40), treasure-value/currency
→ `module/item/currency-mixin.mjs` (41), spell-roll (spell check + manifestation +
mercurial magic) → `module/item/spell-mixin.mjs` (42), composed as
`DCCItem extends SpellItemMixin(CurrencyItemMixin(ContainerItemMixin(Item)))`;
`item.js` 975 → 339 (−636). **Session 43 opened the `actor-sheet.js` arc** by
extracting the four AE summary builders into `module/actor-sheet/effects.mjs` as
pure free functions (sheets can't use mixins for `#private` methods), `actor-sheet.js`
1890 → 1613. **Session 44 extracted `#prepareItems`** (the ~248-line inventory
categorizer) into `module/actor-sheet/items.mjs` as an "actor-logic → free
function" (it mutates the actor: zero-qty deletion, coin-treasure merge, icon
repair), Foundry globals injected via a `deps` param; `actor-sheet.js` 1613 →
1366. **Session 45 extracted the four small context-field helpers** (`#prepareNotes`
/ `#prepareCorruption` / `#prepareImage` / `#prepareCompendiumLinks`) into
`module/actor-sheet/presentation.mjs` as pure free functions (Foundry globals via
`deps`), `actor-sheet.js` 1366 → 1324. **Session 46 extracted `_onDragStart`**
(the ~210-line drag-payload switch — the biggest cohesive chunk left, and a plain
overridable method rather than `#private`) into `module/actor-sheet/drag-drop.mjs`
as the pure free function `buildDragStartData(actor, event)`, leaving the sole
side effect (`event.dataTransfer.setData`) in the thin sheet wrapper; `findDataset`
moved alongside it with `DCCActorSheet.findDataset` kept as a delegating static
(it's consumed cross-module by `party-sheet.js` + documented), `actor-sheet.js`
1324 → 1121. **Session 47 extracted the two drop-side handlers**
(`_handleContainerDrop` / `_onDropActiveEffect`) into `module/actor-sheet/drop.mjs`
as the free functions `handleContainerDrop(actor, event, data, deps)` /
`dropActiveEffect(actor, data, deps)` (Foundry globals via `deps`); `_onDrop`
stays on the sheet (calls `super._onDrop`); `actor-sheet.js` 1121 → 1040. The
cohesive `actor-sheet.js` extractions are now done — what remains there is the
static `#` action handlers (low value, must stay in the `actions` map). **Sessions
48–49 opened the `actor.js` arc** — being a document class it CAN use the `item.js`
mixin pattern: session 48 lifted the AE-application engine (`applyActiveEffects` +
`_resolveEffectValue` + the 7 `_applyXxxEffect` handlers) into
`module/actor/active-effects-mixin.mjs`; session 49 lifted the four derived-stat
helpers (`computeMeleeAndMissileAttackAndDamage` / `computeSavingThrows` /
`computeSpellCheck` / `computeInitiative`) into `module/actor/derived-stats-mixin.mjs`;
`DCCActor extends DerivedStatsMixin(ActiveEffectsMixin(Actor))`, `actor.js` 4574 →
4145 (−429). **Session 50 shipped the low-value `actor.js` mop-up** — the roll-input
accessors (`getRollData` / `getAttackBonusMode` / `getActionDice`) into
`module/actor/roll-data-mixin.mjs` and the pure `_buildDamageBreakdown` into the
free function `module/actor/damage-breakdown.mjs`;
`DCCActor extends RollDataMixin(DerivedStatsMixin(ActiveEffectsMixin(Actor)))`,
`actor.js` 4145 → 3999 (−146). **With session 50 the Appendix-A file-shrinkage arc
is complete** — every cohesive *non-dispatch* group is extracted; what remains in
`actor.js` is the adapter dispatch layer that per §8.6 stays co-located with the
public `rollXxx` wrappers. The `dcc.afterComputeSpellCheck` stable hook is
preserved. All behavior-neutral with no lib change. Repo green:
**1589 Vitest passed** (sessions 48–49 closed at 1574); full E2E run for the
48–49 batch was **195 passed + 1 documented flake**
(`extension-api.spec.js:315`, the session-40 container-mixin probe — the
`createEmbeddedDocuments`-under-load family; reconfirmed clean in isolation).
**Session 47 adopted the push-per-batch E2E cadence** (Vitest per slice, full
E2E once per batch — see `CLAUDE.md`); sessions 48–49 and session 50 each ran as
one such batch.
Per-session detail lives in *Recent slices* +
the [phase-7 archive](dev/progress/phase-7.md); the itemized close-outs are in
the *PR #720 review backlog* below.

**Appendix-A `config.js` data-table extraction is effectively complete (arc ran
sessions 35–39).** The pattern mirrored the Phase-7 `dcc.js` split: break the
big self-contained data tables in `config.js` into focused
`module/config/*.mjs` modules and let `config.js` import + re-compose them onto
the `DCC` object, keeping the public `CONFIG.DCC` shape byte-identical. Done:
`monster-data.mjs` (35) + `images.mjs` (36) + `dice.mjs` (37) +
`active-effect-keys.mjs` (38) + `actor-importer.mjs` (39) — `config.js` 845 →
451 lines (−394). What remains in `config.js` is small scalar enums + the
Phase 4–6 registry seeds (`classMixins` / `classDefaults` / `sheetParts` /
`variants` / …); those stay — they're tiny and are the file's reason to exist.

**Appendix-A `item.js` arc opened (session 40).** The behavior-class targets
(`actor.js` / `actor-sheet.js` / `item.js`) use a different shape than the
`config.js` data-table arc: **method-group → Foundry mixin**
(`(Base) => class extends Base`, the codebase's `HandlebarsApplicationMixin(...)`
idiom), keeping the public instance surface byte-identical. Session 40 lifted the
container-support block into `module/item/container-mixin.mjs`; session 41 lifted
the treasure-value / currency block into `module/item/currency-mixin.mjs`; session
42 lifted the spell-roll block (spell check + manifestation + mercurial magic)
into `module/item/spell-mixin.mjs`
(`DCCItem extends SpellItemMixin(CurrencyItemMixin(ContainerItemMixin(Item)))`),
`item.js` 975 → 339 (−636 across the three slices). What remains in `item.js` is
`prepareBaseData` (weapon attack/damage prep) + the lifecycle hooks
(`_onCreate` / `_preDelete` / `deleteDialog`) — the class's core identity, which
stays. The `item.js` arc is effectively done.

**Appendix-A `actor-sheet.js` arc opened (session 43).** A sheet is an
`ApplicationV2` class whose big methods are mostly `#private` (the action
handlers, `#prepareItems`, the AE builders) — and **private names are lexically
class-scoped, so they can't move to a mixin** the way `item.js`'s public methods
did. The shrinkage shape for the sheet is therefore **pure-logic → free function
in `module/actor-sheet/*.mjs`**, with the sheet calling them. Session 43 lifted
the four AE summary builders (`#prepareAbilityEffects` /
`#prepareAttackBonusEffects` / `#prepareSaveEffects` / `#prepareAttributeEffects`,
all `#private`, all with zero prior coverage) into `module/actor-sheet/effects.mjs`
as pure free functions, deduping the identical effect-collection block they each
repeated into one shared `collectTransferredActiveEffects`. Session 44 lifted
`#prepareItems` (the inventory categorizer) into `module/actor-sheet/items.mjs`
as an "actor-logic → free function" (it mutates the actor; Foundry globals
injected via `deps`). Session 45 lifted the four small context-field helpers
(`#prepareNotes` / `#prepareCorruption` / `#prepareImage` /
`#prepareCompendiumLinks`) into `module/actor-sheet/presentation.mjs` as pure
free functions (Foundry globals via `deps`). Session 46 lifted `_onDragStart`
(the ~210-line drag-payload switch — a plain overridable method, not `#private`,
so it extracts more cleanly than the action handlers will) into
`module/actor-sheet/drag-drop.mjs` as the pure `buildDragStartData(actor, event)`,
with `findDataset` relocated beside it and `DCCActorSheet.findDataset` kept as a
delegating static (cross-module + documented). `actor-sheet.js` 1890 → 1613 →
1366 → 1324 → 1121. The cohesive small-helper extractions + the drag-start
builder are now done; what remains are the static `#` action handlers + the
drop-side handlers (`_onDrop` calls `super._onDrop` so it can't fully move;
`_handleContainerDrop` / `_onDropActiveEffect` are more self-contained and could
follow) — trickier, lower priority. `actor.js` remains an unstarted multi-session
project.
Group E / §2.8 homebrew
extensibility was validated 2026-05-29 by migrating two real sibling content
modules (`dcc-crawl-classes` PR #40, `mcc-classes` PR #38) onto the Phase 4–6
class-registration API; no further DCC-side Group E work is needed (see
*Sibling-module status*). **Session 51 (2026-06-08) closed the last Group E thread
— the §2.1 schema-slimming question — as architecturally-bounded** (Foundry's
static one-schema-per-subtype model blocks full per-class field removal; the lib is
the class-clean read-side source of truth). Decision record:
[`dev/SCHEMA_SLIMMING.md`](dev/SCHEMA_SLIMMING.md).

## Recent slices

Newest first. Five most recent — everything else is in the phase
archives linked above.

- **2026-06-08 — Phase 7 session 51: resolve §2.1 schema-slimming (Group E
  halfling) as architecturally-bounded.** The last substantive Group E thread.
  Investigation (3 Explore sweeps) established the headline goal — "a halfling
  carries only halfling fields" — is **architecturally blocked**: Foundry's
  `defineSchema()` is static (one schema per document *subtype*), so a halfling and
  a wizard both being `type: 'Player'` share one schema, `applyClassMixins` attaches
  all 7 classes' fields to it, and Foundry bakes every `.initial` into every actor's
  `_source`. There is no per-instance schema mechanism. **Resolution
  (architecturally-bounded):** the `registerClassMixin` relocation closed the
  "spinoffs cannot remove or restructure" half (siblings last-write-wins replace
  built-ins), and the lib is the class-clean read-side source of truth —
  `actorToCharacter` (`character-accessors.mjs`) reads **zero** class-specific schema
  fields, so the schema's class fields are a Foundry-forced compat projection, not a
  source of truth. Rejected (ecosystem-breakage, fail the stop-conditions): runtime
  pruning (~15 unguarded `actor.js` reads + 8+ unguarded XCC sheet reads would throw)
  and per-class Actor subtypes (changes `actor.type` off `'Player'` across the system
  + 4 sibling modules + packs + migration). **No production-code change — fully
  behavior-neutral** (docs + guard tests only). New decision record
  [`dev/SCHEMA_SLIMMING.md`](dev/SCHEMA_SLIMMING.md); §2.1/§7 cross-links in
  `ARCHITECTURE_REIMAGINED.md` + `CLASS_DECOMPOSITION.md`. Tests: +3 Vitest
  (`schema-slimming-guard.test.js` — `actorToCharacter` builds a complete class-clean
  Character from an actor with no class fields, and returns identical output with vs
  without a pile of foreign-class fields, locking in "the roll path needs zero schema
  class fields"); +1 Playwright (`data-models.spec.js` — a live halfling that DOES
  carry `shieldBash`/`knownSpells` projects to a class-clean Character with
  `classId==='halfling'` and only `identity`/`state`/`classInfo`). **1592 Vitest**
  (was 1589, +3). **The §2.1 / Group E halfling question is now closed.**

- **2026-06-08 — Phase 7 session 50: Appendix-A `actor.js` shrinkage —
  extract the roll-input accessors (`module/actor/roll-data-mixin.mjs`) + the
  pure `_buildDamageBreakdown` helper (`module/actor/damage-breakdown.mjs`).**
  Third `actor.js` slice, the "low-value mop-up" remainder the docs flagged — two
  cohesive extractions shipped as one batch (one E2E run). **(a) RollDataMixin:**
  the three roll-input accessors — `getRollData` (the `@override` that augments
  Foundry's roll data with DCC ability/save/attack shorthands), `getAttackBonusMode`
  (normalizes `system.config.attackBonusMode`, read only by `getRollData`), and
  `getActionDice` (parses `system.config.actionDice` into the sheet/adapter preset
  list + the implicit legacy-actor migration) — lifted into `RollDataMixin`;
  `DCCActor extends RollDataMixin(DerivedStatsMixin(ActiveEffectsMixin(Actor)))`.
  Transparent composition keeps the public surface byte-identical, so the
  consumers (`actor.getRollData()` in `item/spell-mixin.mjs`,
  `actor.getActionDice()` in `actor-sheet/items.mjs` + `adapter/attack-input.mjs`
  + **XCC's sheets**) are untouched; `super.getRollData()` still resolves up the
  chain to `Actor.prototype` (no intervening mixin defines it). **(b)
  buildDamageBreakdown:** `_buildDamageBreakdown` was a *pure* method (no `this`),
  so it extracts as a **free function** (the `actor-sheet/*` pure-logic shape, not
  a mixin) into `module/actor/damage-breakdown.mjs`; `_rollDamage` calls it
  directly. `actor.js` 4145 → 3999 (−146). **No behavior/lib change.** Both groups
  had zero prior *direct* unit coverage (only exercised end-to-end), so a real
  coverage win: +9 Vitest (`actor-roll-data-mixin.test.js` — composition guard +
  getRollData shorthands/flat-vs-rolled-ab/NPC-no-xp, getAttackBonusMode
  normalization, getActionDice parse/untrained/legacy-migration/warn) +6 Vitest
  (`actor-damage-breakdown.test.js` — single-type null, two-type, same-flavor
  accumulation, missing-total, flavored+flavorless mix). +2 Playwright
  (`data-models.spec.js` — a live actor drives the real `getRollData` /
  `getAttackBonusMode` / `getActionDice`; an in-page import of
  `damage-breakdown.mjs` confirms the multi-type/null contract). **1589 Vitest**
  (was 1574, +15). **With session 50 the `actor.js` low-value shrink candidates
  are exhausted** — what remains is the adapter dispatch layer that per §8.6 stays
  co-located with the public `rollXxx` wrappers. The Appendix-A file-shrinkage arc
  is now complete.

- **2026-06-08 — Phase 7 session 49: Appendix-A `actor.js` shrinkage —
  extract derived-stat computation into `module/actor/derived-stats-mixin.mjs`.**
  Second `actor.js` slice (document class → mixin pattern). The four cohesive
  derived-stat helpers — `computeMeleeAndMissileAttackAndDamage`,
  `computeSavingThrows`, `computeSpellCheck`, `computeInitiative` — lifted into
  `DerivedStatsMixin`; `DCCActor extends DerivedStatsMixin(ActiveEffectsMixin(Actor))`.
  Self-contained (only `this.system` + `ensurePlus`); `computeSpellCheck` still
  fires the **stable `dcc.afterComputeSpellCheck` hook** (XCC consumer) verbatim.
  Static `computeSpeedValue` stays in `actor.js`. `actor.js` 4263 → 4145 (−118).
  **No behavior/lib change.** Existing `actor.test.js` exercises these on a live
  actor and passes unchanged (transparent composition); +5 Vitest composition
  guard (`actor-derived-stats-mixin.test.js`), +1 Playwright
  (`data-models.spec.js` — calls each method on a live actor: saves with
  bonuses+override, initiative, spell-check formula + hook fire; passes in
  isolation). Part of the session-48/49 batch (one E2E run, see below).

- **2026-06-08 — Phase 7 session 48: Appendix-A `actor.js` arc opens —
  extract the AE-application engine into `module/actor/active-effects-mixin.mjs`.**
  First `actor.js` slice. `actor.js` is a **document class**, so unlike the sheet
  it CAN use the `item.js` mixin pattern. The self-contained Active-Effects
  application engine — `applyActiveEffects` (the custom replacement for core's,
  handling equipped-item transfers + DCC change types incl. `diceChain`/`subtract`
  + the #736 `token.*` routing) + `_resolveEffectValue` + the seven
  `_applyXxxEffect` handlers (custom/add/subtract/multiply/override/upgrade/
  downgrade) — lifted into `ActiveEffectsMixin`;
  `DCCActor extends ActiveEffectsMixin(Actor)`. `_getConfig` stays (also read by
  `prepareBaseData`/`prepareDerivedData`); now-unused `DCCActiveEffect` + imported
  `DiceChain` (the rest are `game.dcc.DiceChain`) dropped from `actor.js`.
  `actor.js` 4574 → 4263 (−311). **No behavior/lib change.** Existing
  `active-effects.test.js` exercises every handler on a live actor and passes
  unchanged (transparent composition); +8 Vitest composition guard + direct
  stub checks (`actor-active-effects-mixin.test.js`), +1 Playwright
  (`active-effects.spec.js` — add/override/upgrade/downgrade/multiply through the
  live engine + the `overrides` tracking map; passes in isolation).

- **2026-06-08 — Phase 7 session 47: Appendix-A `actor-sheet.js` shrinkage —
  extract the drop-side handlers into `module/actor-sheet/drop.mjs`.** Fifth
  slice of the `actor-sheet.js` arc, same **pure-logic → free function** shape as
  43–46 (drop side this time). The two self-contained drop handlers —
  `_handleContainerDrop` (drop an item onto a container element) and
  `_onDropActiveEffect` (copy a dropped ActiveEffect onto the actor) — read only
  the actor (`this.options.document`) plus the DOM event / drag data, so they
  lifted cleanly into `handleContainerDrop(actor, event, data, deps)` /
  `dropActiveEffect(actor, data, deps)`; the sheet methods collapse to thin
  wrappers. Foundry globals (`fromUuid`, `ui`, `game.i18n`,
  `foundry.utils.deepClone`) injected via `deps` defaulting to
  `globalThis.…?.` (the `items.mjs`/`presentation.mjs` DI idiom — resolves to
  `undefined` in unit tests instead of throwing on a bare global). `_onDrop`
  stays on the sheet (it calls `super._onDrop`, so it can't fully move).
  `fromUuid`/`ui` dropped from the file's `/* global */` directive (now unused
  there). `actor-sheet.js` 1121 → 1040 (−81). **No behavior change, no lib
  change.** Both were non-`#private` but had zero prior unit coverage (drop is
  e2e-hard) — a real coverage win. Tests: +17 Vitest (new
  `actor-sheet-drop.test.js` — container drop: no-container/no-item/fromUuid-throw
  /null-item undefined+false paths, already-on-actor allow/disallow/update-throw,
  external-item create + ContainerFull/ContainerTooHeavy/null-capacity/create-throw;
  ActiveEffect: not-owner, no-data, uuid-miss, inline-create with id-strip +
  origin/transfer/img-default + module-flag preservation, compendium uuid resolve
  keeping existing img); +1 Playwright (`sheet-ui.spec.js` "Drop Handlers" — live
  actor drives the real `sheet._handleContainerDrop` setting an item's container
  ref + the non-container undefined fall-through, and `sheet._onDropActiveEffect`
  copying an inline effect with normalized origin/transfer/img). **1561 Vitest**
  (was 1544, +17). **Full E2E: 195 passed + 1 documented flake**
  (`extension-api.spec.js:315`, the session-40 container-mixin probe — the
  `createEmbeddedDocuments`-under-load family; reconfirmed clean in isolation,
  502ms; untouched by this slice). New Drop Handlers probe passed in the full run.
  **Cadence note:** this batch adopted the new push-per-batch E2E cadence (Vitest
  per slice, full E2E once per batch — see `CLAUDE.md`). The cohesive
  `actor-sheet.js` extractions are now done; next target is `actor.js`.

## Closed questions

All resolved — one-line ticks (full rationale in the linked sessions /
phase archives):

1. ~~Runtime loading strategy~~ — vendor the lib's built `dist/`; adapter imports a relative path into `module/vendor/dcc-core-lib/`, one `npm run sync-core-lib` per lib bump (2026-04-17).
2. ~~Package-name discrepancy~~ — moot under the vendor approach; docs call out the scoped `@moonloch/dcc-core-lib` (the bare token = local paths only) (2026-05-18).
3. ~~Dead hook `dcc.update`~~ — don't emit; XCC's speculative debug-only listener removed; `EXTENSION_API.md` Dead-hook table cleared (2026-05-18).
4. ~~Undocumented `game.dcc.*` with heavy XCC usage~~ — re-audit confirmed every symbol XCC touches is in `EXTENSION_API.md` Stable; caught + fixed two doc-rot items (2026-05-18).
5. ~~Patron-taint mechanic alignment~~ — `dcc-core-lib@0.7.0` models the RAW triggers; `_runLegacyPatronTaint` deleted; entire D3 arc complete (2026-04-24).
6. ~~Spellburn dialog integration~~ — adapter DialogV2 prompt wired into `rollSpellCheck` (2026-04-18); later unified into `promptRollModifierDialog` (Q7).
7. ~~Wizard/elf modifier-dialog coverage beyond Spellburn~~ — unified `promptRollModifierDialog` covers skill + spell checks incl. spellburn (2026-05-17, sessions 26 + 27).
8. ~~§2.1 schema-slimming (Group E halfling vertical)~~ — resolved **architecturally-bounded** (2026-06-08, session 51): Foundry's static one-schema-per-subtype model makes full per-class field removal unreachable; §2.1 closes on the mixin relocation (extensibility) + the lib being the class-clean read-side source of truth (schema class fields = compat projection). Per-class subtypes + runtime pruning rejected (ecosystem breakage). Decision record: [`dev/SCHEMA_SLIMMING.md`](dev/SCHEMA_SLIMMING.md).

## Blockers / open questions

None open. All prior blockers/questions are resolved (see *Closed
questions* above); active design / coverage work is tracked in the
*PR #720 review backlog* below.

## PR #720 review backlog (2026-04-19) — FULLY DRAINED

PR #720 (the merge of Phases 0-3 into `main`) triggered a full 8-agent review.
**Every flagged finding is now closed**; per-session narratives live in the
[phase-7 archive](dev/progress/phase-7.md). One-line close-out per sub-section:

- **Design calls** — 5 review-flagged calls (spellburn dialog-ordering,
  spellburn floor 0-vs-1, damage `_total` clamp divergence, `_xxxViaAdapter`
  error boundaries, `createFoundryRoller` delete-or-wire) resolved in sessions
  16–20.
- **Resilience / cleanup** — the programmatic-PC-creation finding was documented
  in `docs/dev/PROGRAMMATIC_ACTOR_CREATION.md` (session 33); a "quick PC" helper
  stays unbuilt by design.
- **Legacy decommission** — COMPLETE (sessions 16, 21–25): no `_xxxLegacy` roll
  branch survives; every public dispatcher is single-path through the adapter
  (retaining only the `options.rollUnder` / `!hasDie` *adapter* branches).
- **Test-coverage gaps (severity ≥ 6)** — all closed/found-stale (sessions
  26–31), each with Vitest + a live Playwright probe where the gap was real
  behavior.
- **Doc/comment hygiene** — 4 behavior-neutral edits (session 32).
- **Performance** — the two above-threshold items done (session 34); one
  micro-item left (deterministic `new Roll('${N}d1')` → `Roll.fromTerms`, no
  measurable win), not worth a slice.

## Decisions made

0. **Runtime loading: vendor the lib's built `dist/`.** See open
   question #1 above for the full rationale. Committed the initial
   sync + `scripts/sync-core-lib.mjs` in a standalone prep commit so
   Phase 1 imports have somewhere to import *from*. The sync script
   reads from `$DCC_CORE_LIB_SRC` (default
   `/Users/timlwhite/WebstormProjects/dcc-core-lib`), runs `npm run
   build` inside the lib, wipes and copies `dist/`, and writes a
   `VERSION.json` with `{ name, version, commit, dirty, syncedAt }`.
   `module/vendor/**` added to `standard.ignore` so the linter skips
   vendored output.

1. **Worktree location.** Now at
   `/Users/timlwhite/FoundryVTT-Next/Data/systems/dcc`. Main repo remains
   at `/Users/timlwhite/FoundryVTT/Data/systems/dcc`.
   *Why:* `FoundryVTT-Next` is a separate Foundry user-data install, so
   the worktree can live under its `systems/` directory without clashing
   with the main repo on `system.json` id (each Foundry install sees
   only its own `systems/` tree). This lets Tim actually run the
   refactored system in Foundry for testing during Phase 1+.
   *History:* originally parked at
   `/Users/timlwhite/WebstormProjects/dcc-refactor` on 2026-04-17 to
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

5. **Dispatch logs are permanent infrastructure** (2026-04-18).
   Originally planned to strip at Phase 1 close; reversed because
   the Playwright dispatch spec asserts on them. Every
   `_xxxViaAdapter` / single-path-with-branch added in later phases
   must call `logDispatch(...)` as its first line. See
   "Dispatch logging" note below.

6. **`game.dcc.processSpellCheck` is permanent stable API**
   (Phase 2 close, 2026-04-18). Don't deprecate; don't shim; route
   migration is per-call-site and incremental. See phase-2.md
   Phase 2 CLOSE section for full rationale.

7. **Legacy-branch retirement principle** (added post-Phase-2,
   2026-04-19; see `ARCHITECTURE_REIMAGINED.md §8.6`). Foundry-facing
   API (`DCCActor.rollXxx`, `game.dcc.*`, hooks) stays as thin
   wrappers indefinitely. Internal `_xxxLegacy` branches and
   direct-reimpl methods retire once adapter coverage is exhaustive
   for their call site. **Supersedes** earlier "permanent legacy
   branch" close-outs — those blockers are back on the critical
   path. Group D D1 / D2 (attack / crit / fumble / damage) all
   landed under this principle.

## Next steps

**The Appendix-A `config.js` data-table extraction arc is done** (sessions
35–39); **the `item.js` behavior-class arc opened at session 40** with the
container-support mixin. All PR #720 cleanup arcs were closed first — legacy-decom
21–25, test-coverage 26–31, doc-hygiene 32, programmatic-PC doc 33, perf 34.

- **`config.js` (845 → 451 after session 39) — DONE.** `monster-data.mjs` (35),
  `images.mjs` (36), `dice.mjs` (37), `active-effect-keys.mjs` (38),
  `actor-importer.mjs` (39). What's left is small scalar enums
  (`abilities` / `saves` / `items` / `currencies` / `critRanges` / …) + the
  Phase 4–6 registry seeds (`classMixins` / `classDefaults` / `sheetParts` /
  `variants` / …) — **leave those in place**; they're tiny and are the file's
  actual reason to exist. No further `config.js` slice is warranted. Open
  question still deferred: whether the unconsumed `activeEffectKeys` table
  (extracted session 38) should be deprecated/removed — see the session-38
  slice.
- **`item.js` (975 → 339 after session 42) — effectively DONE.** Pattern was
  **method-group → Foundry mixin** in `module/item/*.mjs`
  (`DCCItem extends SpellItemMixin(CurrencyItemMixin(ContainerItemMixin(Item)))`),
  public surface byte-identical. Done: `container-mixin.mjs` (40 — 9
  weight/capacity/depth getters + 2 validation helpers); `currency-mixin.mjs`
  (41 — the 4-method treasure-value / currency block); `spell-mixin.mjs` (42 —
  the 5-method spell-roll block). All cohesive method groups are now extracted;
  what remains in `item.js` is `prepareBaseData` (weapon attack/damage prep) +
  the lifecycle hooks (`_onCreate` / `_preDelete` / `deleteDialog`) — the class's
  core identity, which stays. No further `item.js` slice is warranted.
  **Open item:** the session-41 latent finding — `needsValueRoll`/`rollValue`
  formula path is dead under the integer-`NumberField` `CurrencyField` schema
  (`migrateData` `parseInt()`s strings); decide whether to make the value field
  formula-capable or remove the dead path. Separate from the extraction arc.
- **`actor-sheet.js` (1890 → 1040 after session 47) — cohesive extractions DONE.**
  Sheets can't use the mixin pattern (their big methods are `#private`); shape is
  **pure-logic → free function** in `module/actor-sheet/*.mjs`, sheet calls it.
  Done: `effects.mjs` (43), `items.mjs` (44), `presentation.mjs` (45),
  `drag-drop.mjs` (46 — `_onDragStart` + `findDataset`), `drop.mjs` (47 — the two
  drop handlers `handleContainerDrop` / `dropActiveEffect`; `_onDrop` stays since
  it calls `super._onDrop`). Remaining is just the static `#` action handlers
  (thin `rollXxx` wrappers — low value, the `static #x` entries must stay in the
  `actions` map). No further `actor-sheet.js` slice warranted.
- **`actor.js` (4574 → 4145 after session 49) — IN PROGRESS.** Document class →
  uses the `item.js` mixin pattern (`DCCActor extends DerivedStatsMixin(
  ActiveEffectsMixin(Actor))`). Done: `active-effects-mixin.mjs` (48 — the
  AE-application engine) + `derived-stats-mixin.mjs` (49 — the four `compute*`
  helpers) + `roll-data-mixin.mjs` (50 — `getRollData` / `getAttackBonusMode` /
  `getActionDice`) + `damage-breakdown.mjs` (50 — the pure `_buildDamageBreakdown`
  free function). `actor.js` 4574 → 3999 (−575). **All cohesive *non-dispatch*
  groups + the low-value accessor/pure-logic mop-up are now extracted — the
  Appendix-A shrinkage arc is COMPLETE.** What remains in `actor.js` is the
  **adapter dispatch layer** (`rollXxx` + `_xxxViaAdapter` + the
  spell/attack/damage/crit/fumble dispatch bodies) that per
  `ARCHITECTURE_REIMAGINED.md §8.6` stays co-located with the public wrappers —
  extracting it would split the dispatch path and is NOT a behavior-neutral
  shrinkage. No further `actor.js` shrinkage slice is warranted.

**Group E / §2.8 — validated, no DCC-side work left.** The class-registration
registries shipped in Phases 4–6 and two real sibling content modules now
consume them (`dcc-crawl-classes` PR #40, `mcc-classes` PR #38; Group E
session 1 added the per-class mercurial-magic table registry). **The §2.1
schema-slimming question — the halfling vertical — was closed session 51
(2026-06-08) as architecturally-bounded** (Foundry's static one-schema-per-subtype
model blocks full per-class field removal; the lib is the class-clean read-side
source of truth; per-class subtypes + runtime pruning rejected for ecosystem
breakage — see [`dev/SCHEMA_SLIMMING.md`](dev/SCHEMA_SLIMMING.md)). The one
remaining unbuilt candidate stays viable if more pattern-laying is wanted, but
nothing requires it: **homebrew single-class** — exercises Phase 4+5+6 end-to-end
via `registerClassMixin` + `registerSheetPart` + variant-aware data loading (a
thin exercise now the registries exist; doesn't slim the schema, just validates
the homebrew path with a fresh class).

**Cross-repo coordination:** if any future migration uncovers a missing
feature in the lib's tagged-union modifier (e.g. skill items with `allowLuck`
needing dice-chain bumps), land the lib change first in its own `dcc-core-lib`
PR, then sync via `npm run sync-core-lib`.

**Sibling-module status:**
- **`dcc-crawl-classes`** — migrated to the full class-registration API
  (mixins / defaults / sheet-parts / `registerActorSheet` + 5-line
  `DCCSheet` stubs). Branch `refactor/dcc-extension-api`, PR
  foundryvtt-dcc/dcc-crawl-classes#40 (2026-05-29).
- **`mcc-classes`** — migrated the same way, keeping thin `_prepareContext`
  overrides for its §9.2/§9.3a data migrations; cross-cutting shared MCC
  fields stay on the `dcc.definePlayerSchema` hook. Branch
  `refactor/dcc-extension-api`, PR foundryvtt-dcc/mcc-classes#38
  (2026-05-29). Both verified live in the v14 world; together they are the
  §2.8 homebrew-extensibility validation.
- **XCC** has consumed the `dcc.afterComputeSpellCheck` hook +
  `game.dcc.registerActorSheet` recipes shipped in B1-followup /
  B1-followup-2; PR pending on `foundryvtt-dcc/xcc` branch
  `chore/migrate-to-dcc-extension-api`. Same branch also retires 9
  XCC-side redefinitions of DCC class schema fields (luckDie, backstab,
  knownSpells, maxSpellLevel, disapproval, disapprovalTable, deity,
  corruption, spellCheckAbility) that were silently clobbering DCC
  defaults. Phase 4 schema-mixin design needs to coordinate with the XCC
  field consumption documented in this PR.

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

### Silent adapter→legacy fallback reason codes (2026-04-23)

- Every silent-fallback site emits a `reason=<tag>` field on the
  dispatch log. Pattern: `logDispatch('rollXxx', 'adapter' | 'legacy',
  { reason: 'camelCaseTag', ...extras })` so the Foundry console is
  self-documenting ("why did this cast fall back?") without opening
  source. Tags in use: `noCasterProfile`, `noDisapprovalTable`,
  `noMercurialTable`. New fallback sites added in future sessions
  must pick a short tag and document it here.
