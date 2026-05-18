# Refactor Progress — `refactor/dcc-core-lib-adapter`

> **Handoff artifact.** Update at the end of every work session and
> after any significant decision. Future Claude sessions rely on this.
>
> **Detailed session-by-session history lives in phase archives:**
> - [Phase 0 + 1 — scaffolding + simple rolls](dev/progress/phase-0-1.md)
> - [Phase 2 — spell check migration](dev/progress/phase-2.md)
> - [Phase 3 — attacks, damage, crit, fumble + cruft](dev/progress/phase-3.md)
> - [Phase 4 — data-model slimming + class-mixin extension surface](dev/progress/phase-4.md)

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

**Phase 4 session 3 (2026-05-18)** extended the vertical to thief —
the largest single-class relocation so far. Built-in `'thief'` mixin
in `module/dcc.js:init` contributes the 12-skill block (sneakSilently
/ hideInShadows / pickPockets / climbSheerSurfaces / pickLock /
findTrap / disableTrap / forgeDocument / disguiseSelf / readLanguages
/ handlePoison / castSpellFromScroll) plus `class.luckDie` (DiceField
'1d3') + `class.backstab` (StringField '0'). First mixin to touch
**both** `schema.class.fields` and `schema.skills.fields` in one
registration — and the first to use an inline factory helper
(`thiefSkill(label, ability)`) to compact the repeated agl/int/per
skill shapes. `castSpellFromScroll.die` (DiceField '1d10') exercises
the DiceField path a second time (dwarf's `shieldBash.die` was the
first). `handlePoison` deliberately omits `ability` to match the
static body's shape. `DiceField` import dropped from `player-data.mjs`
since the only class fields needing it (`luckDie` + `castSpellFromScroll.die`)
now live on the thief mixin. Three of seven DCC classes (halfling,
dwarf, thief) now mixin-source their fields; cleric / warrior /
wizard / elf remain on the static body.

**Phase 4 session 2 (2026-05-18)** extended the halfling vertical to
dwarf — `skills.shieldBash` relocated off `player-data.mjs`'s static
body onto a built-in `'dwarf'` class mixin registered in
`module/dcc.js:init`. Exercises the registry across mixed field types
(StringField for label/ability/value + DiceField for die +
BooleanField for useDeed) — confirms `applyClassMixins` handles
non-trivial field shapes identically to the static definition.
`DiceField` imported into `dcc.js` from `module/data/fields/_module.mjs`
to keep the mixin self-contained.

**Phase 4 session 1 (2026-05-18)** opened the halfling vertical with
the `game.dcc.registerClassMixin(classId, mixinFn)` infrastructure —
new stable-from-day-one extension helper, `CONFIG.DCC.classMixins`
registry, deterministic-sorted application during
`PlayerData.defineSchema()`. The system dogfoods its own seed by
registering a `'halfling'` mixin in `module/dcc.js:init` that
contributes `skills.sneakAndHide`; the static `player-data.mjs` body
loses its hardcoded halfling block. First chip away at §2.1's
monolithic Player schema — every Player document still resolves
`sneakAndHide` identically (preserves §2.12's Foundry-smelling
contract), but the source of truth has moved off the static body and
onto the per-class registry. Subsequent slices relocate additional
class-bound fields (thief skills, cleric disapproval, wizard patron,
dwarf shieldBash, etc.) the same way. Sibling modules registering
their own classes use the same helper (see EXTENSION_API.md
"Homebrew / sibling-module recipe: registerClassMixin").

**Group E session 1 (2026-05-18)** landed the per-class mercurial-
magic table registry — new `dcc.registerMercurialMagicTable(classKey,
tableName)` stable-from-day-one hook, `CONFIG.DCC.mercurialMagicTables`
registry, resolver shared between the adapter cast path and the
legacy `DCCItem.rollMercurialMagic` item-sheet button. Closes the
§2.4 critique that XCC has been fighting since before Phase 0; the
xcc-core-book monkey-patch (mutating `CONFIG.DCC.mercurialMagicTable`
per roll) gets a migration recipe to retire it.

Phase 3 is active but now narrow. `rollWeaponAttack` + all four
chained calls (`rollToHit` / `rollDamage` / `rollCritical` /
`rollFumble`) are single-path via the adapter (sessions 15 / 16 /
19 retired the respective `_xxxLegacy` branches). Groups A
(attack-gate broadening) and C (parallel cruft slices) are closed.
Session 21 / D3a (2026-04-24) retired `_runLegacyPatronTaint`; the
full D3 arc (a / b-α / b-β / b-γ / c) closed 2026-04-24. Session
24 / D4(profile-override) (2026-05-17) landed
`dcc-core-lib@0.9.0`'s `SpellCheckOptions.profileOverride` and
folded the wizard-mode-on-cleric + cleric-mode-on-non-cleric
dispatcher gates through the adapter. Session 25 / D4(remainder)
(2026-05-17) landed `dcc-core-lib@0.10.0`'s optional
`SpellCastInput.spellbookEntry` and folded the three remaining
direct-reimpl branches: naked spell check (no item) →
`_castNakedViaAdapter`, `options.forceCrit` (shift-click GM
testing) → shared `applyForceCritToFoundryRoll` helper threaded
through every adapter spell-check route, and skill-table /
disapproval-range skills (Turn Unholy, divineAid, layOnHands)
→ `_skillTableViaAdapter`. Session 26 / Q7-phase1 (2026-05-17)
landed the generalized roll-modifier-dialog adapter scaffold —
new `promptRollModifierDialog` in `module/adapter/roll-dialog.mjs`
is a thin wrapper over the existing `RollModifierDialog`, and
`_rollSkillCheckViaAdapter` now folds the dialog adapter-side
instead of routing `showModifierDialog` to legacy. The dispatcher
gate dropped its `!!options.showModifierDialog` clause; skill-
table-with-dialog naturally flows through `_skillTableViaAdapter`
(it already forwarded `options` through `DCCRoll.createRoll`).
Session 27 / Q7-phase2 (2026-05-17) extended the same scaffold to
spell-check: the unified prompt now surfaces Die / Compound /
CheckPenalty / Spellburn / Other Bonus for wizard / cleric /
naked routes, and the bespoke `promptSpellburnCommitment` helper
retired. Open question #7 is now fully closed.
The remaining `processSpellCheck` substrate is now only reachable
from `DCCItem.rollSpellCheck` delegations (the `noCasterProfile`
+ unknown-castingMode fallbacks). See
[`docs/02-slice-backlog.md`](02-slice-backlog.md) for the full
inventory. Phase 4 (schema slimming) has not started.

## Recent slices

Newest first. Five most recent — everything else is in the phase
archives linked above.

- **2026-05-18 — Phase 4 session 3: thief class-mixin extraction (12
  skills + `class.luckDie` + `class.backstab`).** Largest single-
  class relocation so far. New `'thief'` entry in `CONFIG.DCC.classMixins`
  registered in `module/dcc.js:init` builds 12 skill SchemaFields via
  a shared inline `thiefSkill(label, ability)` helper plus two class-
  field mutations (`schema.class.fields.luckDie` =
  `DiceField('1d3')`, `schema.class.fields.backstab` =
  `StringField('0')`). First mixin to touch BOTH `schema.class.fields`
  and `schema.skills.fields` on the same registration. `handlePoison`
  deliberately omits `ability` to match the static body's shape;
  `castSpellFromScroll` carries its own DiceField die (`'1d10'`)
  alongside the standard label/ability/value triple. The static
  thief-skills block (~62 lines) + the two thief class-field lines
  in `module/data/actor/player-data.mjs` are deleted; the trailing
  comment near the removed skill block now documents thief alongside
  halfling/dwarf mixins. `DiceField` import dropped from
  `player-data.mjs` (was only used by the two now-relocated thief
  fields). +1 Playwright case in `extension-api.spec.js` asserts (a)
  all 12 skill fields are present, (b) `findTrap`/`disguiseSelf`
  carry their non-`agl` abilities, (c) `handlePoison` lacks the
  `ability` field, (d) `castSpellFromScroll.die`'s field type is
  `DiceField` with initial `'1d10'`, and (e) `class.luckDie` /
  `class.backstab` are present with correct types + initials. No new
  Vitest needed (registry mechanics covered session 1). 966 Vitest
  green (unchanged); 112 Playwright passed (was 110, +1 thief + 1
  dwarf-flake recovered), 1 latent failure (xcc-core-book DCCItemSheet
  override — unchanged).
- **2026-05-18 — Phase 4 session 2: dwarf `shieldBash` class-mixin
  extraction.** Second halfling-vertical slice, same pattern as
  session 1 but with mixed field types. New `'dwarf'` entry in
  `CONFIG.DCC.classMixins` registered in `module/dcc.js:init`
  contributes `skills.shieldBash` (`label` / `ability` / `value`
  StringFields + `die` DiceField + `useDeed` BooleanField). The
  static `shieldBash` block in `player-data.mjs` is deleted; the
  comment near the removed block is updated to document both
  halfling + dwarf mixin-sourced fields together. `DiceField`
  imported into `dcc.js` from `module/data/fields/_module.mjs` so the
  mixin can reference it without further plumbing. +1 Playwright
  case in `extension-api.spec.js` asserts the built-in dwarf mixin
  produces all five fields with the expected defaults AND verifies
  `dieFieldType === 'DiceField'` + `useDeedFieldType === 'BooleanField'`
  on the resolved schema — proves mixed field types survive the
  mixin path identically to a static definition. No new Vitest test
  needed; the registry mechanics tested in session 1
  (`applyClassMixins` sort order, last-write-wins, etc.) cover the
  dwarf mixin's plumbing — only the schema-shape claim is new and
  it's best exercised against live Foundry. 966 Vitest green
  (unchanged from session 1). 110 Playwright passed (was 109, +1
  dwarf case); same single pre-existing environmental flake as
  session 1 (`xcc-core-book` unregistering DCCItemSheet).
- **2026-05-18 — Phase 4 session 1: halfling vertical kickoff —
  `registerClassMixin` infrastructure + sneakAndHide extraction.**
  New stable extension helper `game.dcc.registerClassMixin(classId,
  mixinFn)` in `module/extension-api.mjs` (alongside companion
  `applyClassMixins(schema)` used by `defineSchema`).
  `CONFIG.DCC.classMixins = {}` initialized in `module/config.js`;
  mutators run in sorted-classId order during
  `PlayerData.defineSchema()` **before** the existing
  `dcc.definePlayerSchema` hook fires so external handlers see
  mixin-contributed fields. `module/dcc.js`'s init registers a
  built-in `'halfling'` mixin (right after `CONFIG.DCC = DCC`,
  before `CONFIG.Actor.dataModels`) that contributes
  `skills.sneakAndHide` (`StringField initial '+3'`,
  `label initial 'DCC.SneakAndHide'`) — identical to the static
  definition it replaces. The static `player-data.mjs` halfling
  block is removed; the field is no longer hardcoded in the
  monolithic schema body. Last-write-wins on duplicate `classId`
  registration (matches mercurial-magic registry semantic) — lets a
  sibling module fully replace a DCC built-in mixin instead of
  having to additively patch. EXTENSION_API.md gains the new helper
  in the Stable `game.dcc.*` exports table, refreshes the
  `dcc.definePlayerSchema` row to call out the new sibling registry,
  and adds a "Homebrew / sibling-module recipe: registerClassMixin"
  migration entry. +11 Vitest tests in `extension-api.test.js`
  (registry mechanics: stores under classId, self-heals missing
  registry, last-write-wins, throws on bad inputs;
  `applyClassMixins`: deterministic sort order, no-op on empty /
  missing registry, defensive against malformed entries). +3
  Playwright cases in `extension-api.spec.js` (helper exposed on
  `game.dcc`, built-in halfling mixin produces `sneakAndHide` on a
  live Player document, last-write-wins survives a round-trip
  restore). 966 Vitest green (was 955, +11); 109 Playwright passed.
  **Two pre-existing environmental Playwright failures observed
  (unrelated to slice, pin-pointed):**
  (1) `extension-api.spec.js:78 › registerItemSheet adds a sheet
  option…` asserts `sheetCtorName === 'DCCItemSheet'` but resolves
  to `'XCCItemSheet'` — `xcc-core-book/module/dccModule.js:14-16`
  unregisters DCC's item sheet and registers XCCItemSheet as
  default at init; the assertion has been latent since the test
  landed 2026-04-19 (`907cfaf`) and only fires when xcc-core-book
  is enabled in the test world. Fix is one of: relax to
  `expect(['DCCItemSheet', 'XCCItemSheet']).toContain(…)`, or
  disable xcc-core-book in the v14 world for the test run.
  (2) `v14-features.spec.js:659 › Status Icons › can toggle…`
  hit a "You have lost connection to the server" console error
  mid-suite — environmental Foundry connection flake during the
  long v14-features run, not a test-logic failure. Neither is
  introduced by this slice. First chip away at
  §2.1; Foundry-smelling shape (`system.skills.sneakAndHide`) stays
  intact per §2.12. Subsequent halfling-vertical sessions: extract
  remaining class-bound fields (Phase 4 cont.), halfling sheet-tab
  composition (Phase 5), variant registration (Phase 6).
- **2026-05-18 — Group E session 1: per-class mercurial-magic table
  registry.** New `dcc.registerMercurialMagicTable(classKey,
  tableName)` Stable hook + `CONFIG.DCC.mercurialMagicTables`
  registry. The legacy `setMercurialMagicTable` shim writes through
  `register('default', value)`, so dcc-core-book / system-setting
  callers keep working with no API change. Both the adapter cast
  path (`_rollMercurialIfNeeded`, now taking `profile.type` from
  `_castViaCalculateSpellCheck`) and the legacy
  `DCCItem.rollMercurialMagic` item-sheet button go through the same
  resolver (`spell-input.mjs:resolveMercurialMagicTableName`), which
  walks per-class → `'default'` → legacy single-table mirror →
  null. EXTENSION_API.md picks up the new Stable row + an
  xcc-core-book migration recipe that retires the per-roll
  `CONFIG.DCC.mercurialMagicTable = …` monkey-patch in
  `xcc-core-book/module/xcc-item-sheet.js:49-58`. +5 Vitest tests in
  `adapter-spell-check.test.js` (resolver cascade: per-class wins,
  unregistered falls to default, empty registry falls to legacy
  field then null; loader uses classKey end-to-end; wizard cast skips
  when nothing matches). +2 Playwright cases in the dispatch spec
  exercising the hook end-to-end against live Foundry (wizard-keyed
  registration drives the cast; gnome-only registration with no
  default produces `reason=noMercurialTable` for a wizard).
  Closed `ARCHITECTURE_REIMAGINED.md` §2.4 generalization promise
  ("XCC has 2 Mercurial tables and DCC only supports one" —
  no longer true). 955 Vitest green (was 949, +6).
- **2026-05-17 — Session 27 / Q7-phase2: spell-check modifier-
  dialog generalization.** Extended the session-26
  `promptRollModifierDialog` wrapper with an optional `spellburn`
  descriptor — when set, a Spellburn term is appended internally
  and the term's callback captures final str/agl/sta values; the
  wrapper computes burn amounts (original − final) and subtracts
  the burn total from `modifierTotal` so callers can forward
  `input.spellburn` without double-counting the lib's auto-injected
  spellburn modifier. The bespoke `promptSpellburnCommitment`
  helper retired entirely. New `_promptSpellCheckDialog(spellItem,
  ctx)` + `_applySpellCheckDialogToOptions(prompt, options)`
  helpers on `DCCActor` build the term list (Die / Compound /
  CheckPenalty / Other Bonus / Spellburn) and fold the result back
  into `options` (spellburn → `options.spellburn`; action die →
  `options.actionDieOverride`; flat modifier total →
  `options.dialogModifierTotal`). `_rollSpellCheckViaAdapter` now
  invokes the unified prompt for both wizard and cleric branches
  post-dispatch-log (cleric showModifierDialog previously fell
  through silently — fixed). `_castNakedViaAdapter` mirrors the
  same; `suppressLibAuto` zeroes `input.casterLevel` +
  `input.abilityModifier` when the dialog drives the modifier list
  so the lib's auto level + ability don't double-count.
  `_castViaCalculateSpellCheck` honors the new options by
  overriding `input.actionDie` and feeding
  `dialogModifierTotal - (casterLevel + libGetAbilityModifier(score))`
  as a single `dialog-modifier` situational — the subtraction is
  load-bearing because the lib re-derives `casterLevel +
  abilityModifier` from `character` inside `buildSpellCastInput`.
  +4 Vitest tests in `adapter-roll-dialog.test.js` covering the
  spellburn descriptor (zero commitment, mid burn, no descriptor,
  clamped negative); 4 spell-check tests in
  `adapter-spell-check.test.js` flipped to assert against the
  unified prompt. 949 Vitest green (was 945, +4). +3 new
  Playwright cases (wizard / cleric / naked showModifierDialog →
  adapter dispatch). Open question #7 is now fully closed.
- **2026-05-17 — Session 26 / Q7-phase1: generalized roll-modifier-
  dialog adapter scaffold + skill-check fold.** New
  `promptRollModifierDialog(terms, opts)` in
  `module/adapter/roll-dialog.mjs` — thin wrapper over
  `game.dcc.DCCRoll.createRoll({ showModifierDialog: true })` that
  returns `{ actionDie, modifierTotal, formula, roll } | null`. The
  parser (`parseRollIntoDieAndModifier`, also exported) walks the
  resulting Foundry Roll's `terms[]`, picking the first Die term as
  the action die and summing all signed numerics as a flat modifier
  total. Attribution flattens to match legacy — the dialog reduces
  every non-die term to a single formula, so per-source attribution
  is unrecoverable on submit. `_rollSkillCheckViaAdapter` grew a
  `showModifierDialog` branch: builds the legacy-shaped term
  descriptor via the new shared `_buildSkillCheckLegacyTerms`
  helper (also used by `_skillTableViaAdapter` + the
  description-only legacy path — eliminates the term-builder
  duplication), prompts adapter-side, overrides `definition.roll.die`
  with the user's selection, suppresses `definition.roll.ability`
  (the dialog total already includes ability mod via the legacy
  Compound term), and feeds the user's flat total as a single
  `dialog-modifier` situational modifier. Dispatcher dropped the
  `!!options.showModifierDialog → legacy` clause; `_rollSkillCheckLegacy`
  is now strictly the no-die / description-only fallback path.
  Skill-table-with-dialog routes naturally through
  `_skillTableViaAdapter` (which has always forwarded `options`
  through `DCCRoll.createRoll`). +12 Vitest tests (945 total: 2 new
  in adapter-skill-check.test.js for the dialog round-trip + cancel,
  10 new in adapter-roll-dialog.test.js covering the parser + the
  wrapper). +1 flipped Playwright case (skill `showModifierDialog`
  legacy → adapter) + 1 new Playwright case (skill-table + dialog →
  adapter with `mode=skillTable`). Open question #7 partially
  closed: the scaffold exists. Spell-check generalization
  (combining `promptSpellburnCommitment` with general modifier
  terms in one dialog) deferred to the next slice.
- **2026-05-17 — Session 25 / D4(remainder): naked spell check +
  forceCrit + skill-table folds.** Lib PR (`dcc-core-lib@0.10.0`,
  commit `77c95e2`) made `SpellCastInput.spellbookEntry` optional —
  `castSpell` now runs without a spellbook slot, skipping the
  manifestation override + mercurial attach when absent. +5 lib
  tests (1416 green). Adapter side: shared
  `applyForceCritToFoundryRoll` helper mutates the Foundry Roll's
  natural to 20 (chat-visible) and the lib roller closure feeds
  the same value, threaded through `_castViaCastSpell` /
  `_castViaCalculateSpellCheck` / `_castNakedViaAdapter`. New
  `_castNakedViaAdapter` builds a synthetic SpellDefinition + cleric/
  wizard profile based on actor class, threads spellburn dialog +
  disapproval mechanics, and emits chat via `renderSpellCheck`
  (extended with a `buildNakedSpellResultHtml` helper for the
  pass/fail/crit/fumble HTML indicator). New `_skillTableViaAdapter`
  re-uses the legacy term-builder (DCCRoll.createRoll), Foundry's
  RollTable lookup, and `SpellResult.addChatMessage` for the
  table-driven cases; the no-table disapproval-only path emits its
  own SpellCheck*NoTable indicator. Dispatcher updates: `!spellItem`
  routes to `_castNakedViaAdapter` unconditionally; `rollSkillCheck`
  routes `hasSkillTable || useDisapprovalRange` to
  `_skillTableViaAdapter` (showModifierDialog + description-only
  stay legacy). `_rollSpellCheckLegacy`'s naked branch removed
  (~110 lines deleted). Test changes: 5 actor.test.js naked-spell
  tests flipped, 4 actor.test.js skill-table tests flipped, +3 new
  adapter-spell-check.test.js cases (naked wizard, naked cleric,
  skill-table turnUnholy), +3 new Playwright cases (naked adapter,
  naked cleric adapter, forceCrit + libResult.natural=20), +1
  flipped Playwright case (divineAid legacy → adapter). 933 Vitest
  green (was 930, +3 net). Lib commit local-only on `main` until
  Tim pushes.
- **2026-05-17 — Session 24 / D4(profile-override): cross-class
  castingMode routing via `SpellCheckOptions.profileOverride`.** Two-
  repo slice. Lib PR (`dcc-core-lib@0.9.0`, commit `a453473`) added
  `SpellCheckOptions.profileOverride?: CasterProfile` — when supplied,
  the lib uses the override profile instead of deriving it from
  `character.classInfo.classId`. Override governs `casterTypes`
  validation, spellburn / disapproval / corruption / patron-taint
  triggers, spell-check ability, and spell-loss recovery; class-bound
  state (spellbook / disapprovalRange / patron) is read from
  `character.state.classState[override.type]`, which the caller
  populates. `getSpellbookEntry` + `markSpellLost` writeback both
  re-keyed by the active profile so the override flow looks up against
  the synthetic spellbook the adapter built. +4 lib tests (1411 green).
  Adapter side: `buildSpellCheckArgs` accepts
  `options.castingModeOverride`; `_rollSpellCheckViaAdapter` accepts a
  `dispatch.castingModeOverride` argument; `_castViaCalculateSpellCheck`
  threads `profileOverride: profile` onto every `libCalculateSpellCheck`
  call (no-op when override matches the derived profile, load-bearing
  for cross-class). Dispatcher widens two gates: `wizard` castingMode
  on `isCleric` → adapter with `castingModeOverride: 'wizard'`;
  `cleric` castingMode on `!isCleric || hasPatron` → adapter with
  `castingModeOverride: 'cleric'`. Three vitest tests flipped (cleric-
  on-patron, cleric-on-non-cleric, +1 new wizard-on-cleric case); +2
  Playwright cases covering both cross-class routes. 930 Vitest green
  (+1 net). Remaining D4 sub-branches (naked spell check + skill-table
  Turn Unholy + generic-on-patron-or-cleric staying legacy) tracked
  in `02-slice-backlog.md`.
- **2026-04-24 — Session 22 follow-ons: D3b-γ closed, D3b-β
  authored cross-repo.** Sibling audit: `mcc-classes` ships no
  packs; `dcc-crawl-classes/packs/` has no patron-taint JSONs.
  `CONFIG.DCC.patronTaintPacks` default seed (core + xcc side-
  effect packs) is exhaustive — no adapter change needed (γ).
  D3b-β authored new `src/spells/patron-taints.ts` in
  `dcc-official-data` mirroring the 5 core `dcc-core-book`
  manifestation tables with Foundry `[[/roll XdY]]` markup
  stripped to plain `[XdY]` dice notation; exports
  `PATRON_TAINT_TABLES` + `getPatronTaintTable(patron)` lookup
  helper; `tsc --noEmit` clean. Tim committed + pushed in the
  `dcc-official-data` repo on its own cadence. No runtime DCC
  change — the compendium RollTables remain authoritative.
- **2026-04-24 — Session 22 / D3b-α: patron-taint manifestation
  table loader.** New `loadPatronTaintTable(actor)` in
  `module/adapter/spell-input.mjs` (mirror of `loadDisapprovalTable`):
  walks `CONFIG.DCC.patronTaintPacks` looking for a `RollTable`
  named `Patron Taint: ${actor.system.class.patron}`, case-
  insensitive-fallback on the tail (lets actors storing "The King
  of Elfland" resolve the `dcc-core-book` table named with lowercase
  "the King of Elfland"), falls back to world tables. New `CONFIG.DCC.patronTaintPacks`
  `TablePackManager` seeded in `module/dcc.js:462-472` with the core
  + xcc side-effect packs; sibling modules can push additional packs
  via `addPack`. `_castViaCalculateSpellCheck` threads the resolved
  `SimpleTable` onto `input.patronTaintTable`, pre-rolls the paired
  manifestation 1d6 (only when a table is present, matching the
  existing creeping-chance d100 pattern), and the roller closure now
  returns the pre-rolled d6 for `1d6` formulas. Bobugbubilz / Azi
  Dahaka / Sezrekan / the King of Elfland / Three Fates tables ship
  authored in `dcc-core-book/packs/dcc-core-spell-side-effect-tables`;
  Barzodi / Circe / Medea / Prometheus Firebringer / Amazing Rando
  in the equivalent `xcc-core-book` pack. All 10 light up the
  `onPatronTaint` chat emote automatically. 924 Vitest + 98
  Playwright (+7 new vitest for loader paths + full integration
  acquisition; +1 new Playwright asserting compendium-resolved
  manifestation text reaches chat).
- **2026-04-24 — Session 21 / D3a: patron-taint RAW alignment +
  retire `_runLegacyPatronTaint`.** Lib PR #6 (`dcc-core-lib@0.7.0`,
  commit `e8ecabe`) replaced the fumble-gated taint mechanic with the
  two RAW triggers: per-cast creeping chance (1d100 vs
  `patronTaintChance`, +1% per miss, reset to 1 on acquisition) + per-
  spell result-table entry (`effect.type === 'patron-taint'` or
  `effect.data.patronTaint === true`). Also fixed natural-1 forcing
  result-table lookup to row 1 (discards modifiers per RAW). Adapter
  side: `spell-input.mjs` threads `patronTaintChance` +
  `isPatronSpell` onto `castInput`; `spell-events.mjs` wires
  `onPatronTaint` chat render; `actor.js` pre-rolls the 1d100 via
  Foundry (same two-pass determinism pattern as disapproval d4),
  persists `result.newPatronTaintChance`, and deletes
  `_runLegacyPatronTaint` (36 lines). 917 Vitest + 97 Playwright
  (+2 new: high-chance acquisition reset, non-patron spell no-op).
## Closed questions

5. ~~**Patron-taint mechanic alignment.**~~ **Resolved 2026-04-24 at
   Session 21 / D3a: `dcc-core-lib@0.7.0` models the two RAW triggers
   (creeping chance + patron-spell result-table entries) plus the
   natural-1-forces-row-1 rule; `_runLegacyPatronTaint` deleted.
   D3b (manifestation table loader + cross-repo content mirror) closed
   at session 22; D3b-γ (sibling audit) closed as a no-op; D3c
   (dead-flag cleanup) closed at session 23 via `dcc-core-lib@0.8.0`.
   Entire D3 arc complete.**

6. ~~**Spellburn dialog integration.**~~ **Resolved 2026-04-18 at
   Phase 3 session 1: adapter-side `promptSpellburnCommitment` dialog
   via DialogV2, wired into `rollSpellCheck` dispatcher for the
   wizard / elf + `showModifierDialog` branch.** The latent regression
   from Phase 2 session 2 (wizard adapter casts silently lost the
   Spellburn UI) is fixed. Other legacy-dialog capabilities (die
   tweak, custom modifier rows, CheckPenalty toggle, FleetingLuck)
   remain absent on the adapter path and will be revisited once the
   attack / damage dialog work generalizes the roll-dialog scaffold.

3. ~~**Dead hook `dcc.update`.**~~ **Resolved 2026-05-18: don't emit.**
   Git history showed the DCC system never emitted the hook; XCC's
   listener was speculative from its initial commit (`24b68b1`) and
   its body was a debug-only `console.log` gated on `isDebug` —
   redundant with the adjacent Foundry-native `updateActor` listener
   doing the same thing. Inventing an emission contract from nothing
   would add coupling without a real consumer. XCC removed the
   listener on `chore/drop-dead-dcc-update-hook`; `EXTENSION_API.md`
   Dead-hook table cleared.

## Blockers / open questions

1. ~~**Runtime loading strategy.**~~ **Resolved 2026-04-17: vendor
   approach (option b).** `scripts/sync-core-lib.mjs` builds the linked
   lib and copies its `dist/` into `module/vendor/dcc-core-lib/`, which
   is committed. Adapter code imports via relative path
   (`../vendor/dcc-core-lib/index.js`). No bundler added. One sync
   command (`npm run sync-core-lib`) + one commit per lib-version bump.

2. ~~**Package name discrepancy.**~~ **Closed 2026-05-18.** The
   underlying issue (the unscoped `dcc-core-lib` cannot be `npm
   install`ed because only the scoped `@moonloch/dcc-core-lib` is
   published) was rendered moot by the vendor approach (open question
   #1, resolved 2026-04-17) — the system imports from
   `module/vendor/dcc-core-lib/` and never `npm install`s the lib at
   all. The documentation cleanup (2026-05-18) updated the top of
   `ARCHITECTURE_REIMAGINED.md`, the install step in Phase 0, the
   `EXTENSION_API.md` header, and the "Working with dcc-core-lib"
   section in `CLAUDE.md` to call out the scoped name explicitly and
   note that the bare `dcc-core-lib` token in branch / vendor / repo
   identifiers refers to local-only paths, not the npm package.
   Historical session-handoff prose that says e.g. "synced
   dcc-core-lib@0.7.0" is unchanged — it refers to lib versions, not
   install instructions, and the context is unambiguous.

4. ~~**Undocumented `game.dcc.*` pieces with heavy XCC usage.**~~
   **Closed 2026-05-18.** Re-audit of XCC, MCC, dcc-crawl-classes,
   dcc-qol, and the four content-pack modules against the current
   stable surface confirmed: every `game.dcc.*` symbol XCC actually
   touches (`DCCRoll.createRoll` / `DCCRoll.cleanFormula`,
   `DiceChain.bumpDie` / `calculateCritAdjustment` /
   `calculateProportionalCritRange`, the five-method `FleetingLuck`
   surface — `init`, `updateFlags`, `give`, `enabled`,
   `automationEnabled`, the latter two consumed via
   `Object.defineProperty`, so they must remain configurable —
   `processSpellCheck`, and `registerActorSheet`) appears in
   `EXTENSION_API.md`'s Stable table. No undocumented usage and no
   gaps. The audit also caught two doc-rot items, both fixed in the
   same pass: `dcc.afterComputeSpellCheck` now has a live XCC
   consumer (XCC retired `xcc-actor.js` + `CONFIG.Actor.documentClass`
   override 2026-05-18 in favor of the hook) and XCC migrated all 19
   actor-sheet registrations to `game.dcc.registerActorSheet`. MCC
   (7 sites) and dcc-crawl-classes (9 sites) have not migrated yet;
   that's opt-in with no deadline. See `EXTENSION_API.md` re-audit
   header dated 2026-05-18.

7. **Wizard / elf adapter-path modifier-dialog coverage beyond
   Spellburn.** **Fully resolved 2026-05-17 across sessions 26 +
   27.** Session 26 / Q7-phase1 landed
   `promptRollModifierDialog` + the skill-check fold; session 27 /
   Q7-phase2 extended the wrapper with an optional spellburn
   descriptor and folded wizard / cleric / naked spell-check
   routes onto it (retiring the bespoke
   `promptSpellburnCommitment` helper). The unified prompt now
   surfaces Die / Compound / CheckPenalty / Spellburn / Other
   Bonus in one dialog for both skill checks and spell checks,
   matching the legacy `DCCItem.rollSpellCheck` term layout.
   `_castViaCalculateSpellCheck` subtracts the lib's auto level +
   ability from the dialog total to avoid double-counting when
   feeding the user's flat modifier as a situational. Can be
   closed.

## PR #720 review backlog (2026-04-19)

PR #720 (the merge of Phases 0-3 into `main`) triggered a full
8-agent review. Safe auto-fixes landed in the PR as follow-up
commits; the items below are the deferred findings — real issues or
design calls — that are out of scope for a "review cleanup" commit
and should be scheduled into Phase 4+ work.

**Blocking for Phase 4 start (pick up before broadening the adapter):**

- ~~**Silent adapter→legacy fallbacks missing a logged reason.**~~
  **Fixed 2026-04-23.** Each silent-fallback site now emits a
  `reason=<tag>` field on the dispatch log so the code path is
  readable from the console without opening the source.
    - `buildSpellCheckArgs` returns `null` (custom-class caster with
      no lib profile) → `_rollSpellCheckLegacy` called with
      `reason: 'noCasterProfile'`; the legacy dispatch log carries
      `reason=noCasterProfile` alongside the `spell=…` field.
    - `loadDisapprovalTable` returns `null` (cleric actor without a
      disapproval table configured) → a second
      `logDispatch('rollSpellCheck', 'adapter', { reason: 'noDisapprovalTable' })`
      line fires from `_castViaCalculateSpellCheck`. The adapter path
      continues (degradation, not legacy fall-back) but the silent
      sub-roll skip is now observable.
    - `loadMercurialMagicTable` returns `null` (wizard/elf first-cast
      with no mercurial table) → `_rollMercurialIfNeeded` emits a
      `logDispatch('rollSpellCheck', 'adapter', { reason: 'noMercurialTable' })`
      line and bails; the cast continues without a fresh effect.
  Coverage: three new unit tests in
  `module/__tests__/adapter-spell-check.test.js` (`…reason=noCasterProfile`,
  `…reason=noDisapprovalTable`, `…reason=noMercurialTable`) and three
  matching Playwright cases in
  `browser-tests/e2e/phase1-adapter-dispatch.spec.js`.
- ~~**Partial-failure state when `_castViaCalculateSpellCheck`'s pass-2
  returns `result.error`.**~~ **Fixed 2026-04-23.** Events now run
  with a rollback-capable wrapper; if pass-2 returns `result.error`
  the adapter reverses applied actor / spellItem mutations before
  returning.
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

- ~~**`rollSpellCheck`'s cleric branch silently no-ops without
  `details.sheetClass = 'Cleric'`.**~~ **Fixed 2026-04-23.** The
  dispatcher's `isCleric` gate in `module/actor.js` now accepts
  either `system.details.sheetClass === 'Cleric'` OR
  `system.class.className === 'Cleric'` — programmatic PCs (anything
  not routed through the level-change dialog) route via the cleric
  adapter path instead of silently no-oping on the legacy
  `spellItem.rollSpellCheck` delegate. Matches the class-identity
  key `resolveCasterProfile` (`spell-input.mjs:194`) already uses.
  Symmetric effect: wizard / generic branches on a
  className-only-Cleric actor now correctly route to legacy
  (preserving the "wizard spell on cleric → legacy side-effect set"
  contract). Coverage: unit test
  `adapter path fires for a cleric-castingMode item on a
  className-only Cleric (no sheetClass)` in
  `module/__tests__/adapter-spell-check.test.js`; Playwright case
  `cleric-castingMode spell on className-only Cleric (no sheetClass)
  → adapter + chat` in
  `browser-tests/e2e/phase1-adapter-dispatch.spec.js`.

- **Programmatic PC creation produces inconsistent class config —
  the system relies on the level-change dialog to populate it.**
  `Actor.create({..., system: { class: { className: 'Wizard' } } })`
  does NOT set `class.spellCheckAbility` (defaults to `'per'` for
  every class — Wizards then cast with Personality, formula AND
  flavor), `details.sheetClass` (cleric branch above won't fire),
  `saves.{ref,frt,wil}.classBonus` (saves drop to ability-mod-only),
  or class-appropriate crit die / luck die / etc. Real users get
  these via the level-change dialog (which applies a class-specific
  level item from `CONFIG.DCC.levelDataPacks`), so end-users don't
  hit this — it bites browser-test fixtures, the PC parser when a
  field is missing, and any future "quick PC" tooling. Two paths to
  resolve: (a) document the level-change-dialog dependency
  prominently and have programmatic creators call into the same
  apply-level-data routine, or (b) register the standard DCC class
  progressions with the lib (`registerClassProgression`) and have
  the system auto-derive defaults from `class.className` + level on
  prepare. The lib already has `getSavingThrows("warrior", 3)` etc.
  — currently returns zeros because no class is registered. Option
  (b) is more invasive but eliminates a whole class of "PC silently
  has wrong stats because user skipped the level-up dialog" bugs.
  Surfaced 2026-04-23 during exhaustive manual-testing.

- **Chat doesn't surface the per-modifier breakdown the adapter
  already captures.** The lib emits each contributing modifier with
  rich origin metadata (`{ kind, value, origin: { category, id,
  label }, applied }`) and the adapter persists the array onto the
  ChatMessage as `flags.dcc.libResult.modifiers` (see
  `module/adapter/chat-renderer.mjs` — every renderer projects it).
  Nothing currently renders it: chat templates don't reference
  `libResult.modifiers`, and because the adapter builds the Foundry
  Roll from the lib's flat formula string (`new Roll(plan.formula)`),
  Foundry's native term-tooltip is unlabelled too — a regression vs.
  the legacy `module/roll-modifier.js` path, which set per-term
  `label` (e.g. "Strength", "Stamina") that Foundry's tooltip
  surfaced. Cheapest fix: a small chat-template partial under the
  rolled formula that lists each `applied` modifier as
  `<origin.label> <signed value>` (e.g. "STA modifier +1, Save bonus
  +0"). More invasive alternative: reconstruct the Roll term-by-term
  in the adapter so the native Foundry tooltip works again — keeps
  parity with the legacy path's UX without adding a chat partial,
  but requires every renderer / dispatcher to thread structured
  terms instead of a string formula. Surfaced 2026-04-23 during the
  Cheesemaker save-bonus debugging session — modifier metadata is
  available to downstream modules (`dcc-qol` etc.) and to debugger
  scripts via the flag, but invisible to the player reading chat.

- **Dispatcher gate style inconsistency.** Attack / damage / crit /
  fumble use named `_canRouteXxxViaAdapter` predicates; ability /
  save / skill / spell / init inline their gates as
  `const needsLegacyPath = …`. Pick one convention and retrofit —
  the named predicate form scales better as gates grow.
- **Unused `weapon` / `attackRollResult` parameters** on
  `_canRouteCritViaAdapter` / `_canRouteFumbleViaAdapter`
  (`weapon` unused) and `_rollCriticalLegacy` / `_rollFumbleLegacy`
  (`attackRollResult` unused). Dropping them touches test call
  sites that pass positional args; clean as a pair of coordinated
  edits but out of scope for the review cleanup. Tracker: do this
  with the gate-style unification above. (Note: `_rollCriticalLegacy`
  / `_rollFumbleLegacy` retired at session 16 — revisit the
  remaining predicate params.)
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
- **`migrateWorld` per-doc catches swallow silently** (C2 review,
  2026-04-24). Four `catch (err) { console.error(err) }` sites in
  `module/migrations.js` (`migrateWorld`'s actors/items/scenes loops
  + `migrateCompendium`) log to console and keep going. A
  migration that fails on every document still stamps the world at
  `NEEDS_MIGRATION_VERSION` and shows the green "complete"
  notification, so the GM has no signal. Align with the
  `9e79459 feat(adapter): reason codes for silent adapter→legacy
  fallbacks` pattern: accumulate failures into a `failedMigrations[]`
  array, surface a `ui.notifications.warn` with the count at the
  end, and only stamp the version when the run was clean.
- **`migrateWorld` fire-and-forget from a sync ready hook** (C2
  review, 2026-04-24). `checkMigrations` calls `migrations.migrateWorld()`
  without `await` from a non-async ready callback, so the rest of
  the ready chain (`registerTables`, `FleetingLuck.init`,
  `SpellDuel.init`, `defineStatusIcons`, welcome dialog,
  `Hooks.callAll('dcc.ready')`) runs concurrently with the async
  per-document mutations. Third-party modules listening on
  `dcc.ready` can fire against a half-migrated world. Pre-existing;
  elevated by C2 because the guard-up-front approach now means
  ordering is the only remaining correctness lever. Fix: make
  `checkMigrations` async, `await migrations.migrateWorld()`, and
  thread a `{ migrationComplete: true }` payload on `dcc.ready`.

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
  and the `game.settings.get` try/catch fallback. **(Note: gate
  retired at session 15 — these assertions moved to the single-path
  body.)**
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
- **Surviving data-driven migration branches have no fixture
  tests** (C2 review, 2026-04-24). `migrateActorData` /
  `migrateItemData` retain the V14 ActiveEffect numeric-mode →
  string-type converter, the `sheetClass`-from-localized-`className`
  inverse helper, `critRange` / `disapproval` string→number
  coercion, `luckyRoll` → `birthAugur`, and default alignment.
  None have direct Vitest coverage; they're exercised only
  transitively when Foundry boots a real world. The V14 AE
  converter is particularly V14-critical — if it silently stops
  running, every pre-V14 active effect fails to apply on upgrade.
  Proposed: `migrations-data-driven.test.js` with one fixture per
  branch (numeric-mode effect → string-type, localized
  `className: 'Zwerg'` → `sheetClass: 'Dwarf'`, stringy
  `critRange: '20'` → number, unaligned actor → alignment `'l'`,
  `luckyRoll: '…'` → `birthAugur`). Requires exporting
  `migrateActorData` / `migrateItemData` (currently module-local
  `const`) or a test-only export.

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

**Post-Group-E-session-1 (2026-05-18) — Groups A, C, and D are
fully closed; open questions #2, #3, #4, and #7 all closed
2026-05-18.** `rollWeaponAttack` + all four chained calls are
single-path via the adapter; `module/migrations.js` targets V14-era
(0.66+) worlds only; patron-taint matches DCC RAW end-to-end; the
unified roll-modifier dialog covers wizard / cleric / naked spell
checks + skill checks. Group E session 1 added the per-class
mercurial-magic table registry, closing the long-standing §2.4
generalization promise. Remaining Group E candidates (any are
viable next):

1. **Halfling vertical slice** — most natural Phase 4 starter
   because it concentrates the schema-slimming question on one
   class. Exercises §2.1 (monolithic Player schema) directly.
2. **Homebrew single-class slice** — most ambitious; exercises
   Phase 4 + 5 + 6 end-to-end via `registerClassMixin` +
   `registerSheetPart` + variant-aware data loading. Largest blast
   radius but lays the most pattern down.

(Mercurial-magic, originally listed here as the third candidate,
landed as Group E session 1 — see Recent slices.)

**Cross-repo coordination:** if any migration uncovers a missing
feature in the lib's tagged-union modifier (e.g. skill items with
`allowLuck` needing dice-chain bumps), land the lib change first in
its own PR in `dcc-core-lib`, then sync via `npm run sync-core-lib`.

**Sibling-module status:** XCC has consumed the
`dcc.afterComputeSpellCheck` hook + `game.dcc.registerActorSheet`
recipes shipped in B1-followup / B1-followup-2; PR pending on
`foundryvtt-dcc/xcc` branch `chore/migrate-to-dcc-extension-api`.
Same branch also retires 9 XCC-side redefinitions of DCC class
schema fields (luckDie, backstab, knownSpells, maxSpellLevel,
disapproval, disapprovalTable, deity, corruption,
spellCheckAbility) that were silently clobbering DCC defaults.
Phase 4 schema-mixin design needs to coordinate with the XCC field
consumption documented in this PR.

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
