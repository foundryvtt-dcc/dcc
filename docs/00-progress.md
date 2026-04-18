# Refactor Progress — `refactor/dcc-core-lib-adapter`

> **Handoff artifact.** Update at the end of every work session and after any
> significant decision. Future Claude sessions rely on this — without it,
> context is lost each time.

## Current phase

**Phase 2 — Spell checks — session 3 complete.** Cleric disapproval
now flows through the adapter. Cleric-castingMode spell items on
non-patron-bound Cleric actors route through `calculateSpellCheck`
with a real `getCasterProfile('cleric')` profile,
`character.state.classState.cleric.disapprovalRange` seeded from
`actor.system.class.disapproval`, and a Foundry-loaded disapproval
table adapted to the lib's `SimpleTable` shape. When the natural
roll triggers disapproval, the lib's `handleClericDisapproval`
rolls 1d4 × range via the adapter's formula-dispatching roller
(pre-rolled in Foundry), looks up the table entry, and fires
`onDisapprovalIncreased`; the event bridge in `spell-events.mjs`
updates `actor.system.class.disapproval` to the new range and posts
the "DCC.DisapprovalGained" EMOTE chat (replaces
`actor.applyDisapproval()`). The adapter then posts the disapproval
roll chat from `result.disapprovalResult` (replaces
`actor.rollDisapproval(natural)` + `RollTable.draw`).

Wizard spell loss (session 2) + generic side-effect-free path
(session 1) continue to work unchanged. Dispatcher gate:
`castingMode === 'generic' && !isCleric && !hasPatron` OR
`castingMode === 'wizard' && !isCleric && !hasPatron` OR
`castingMode === 'cleric' && isCleric && !hasPatron`.

Patron taint (session 4) and spellburn + mercurial magic (session
5) still route to the legacy path. `game.dcc.processSpellCheck` is
exported verbatim — XCC's wizard/cleric sheets depend on it until
Phase 2 closes.

**Phase 1 — Adopt the lib for simple rolls — COMPLETE.** All four
rolls are migrated through the adapter: `rollAbilityCheck`,
`rollSavingThrow`, `rollSkillCheck`, and initiative (via
`getInitiativeRoll`). A Playwright adapter-dispatch spec
(`browser-tests/e2e/phase1-adapter-dispatch.spec.js`, 18 tests
after the Phase 2 session 1 extension) validates every dispatcher
branch end-to-end by asserting on the `[DCC adapter]` console logs
from `module/adapter/debug.mjs`.

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

Phase 2 — spell checks. Sessions 1 (generic scaffold), 2 (wizard
spell loss), and 3 (cleric disapproval) complete. Remaining: patron
taint (session 4), spellburn + mercurial magic (session 5).
`spell-events.mjs` has `onSpellLost` + `onDisapprovalIncreased`
wired; sessions 4–5 add `onPatronTaint`, `onSpellburnApplied`, and
`onMercurialEffect`.

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

Phase 2 session 4 — migrate patron taint. Wire `onPatronTaint` in
`spell-events.mjs` to replace the patron taint d100 roll + "patron
taint chance" bump in `processSpellCheck` (dcc.js — search for
`patronTaint` / `applyPatronTaint`). Extend `buildSpellCheckArgs`
to populate `character.state.classState.wizard.patron` (and maybe
`.elf.patron`) from `actor.system.class.patron` so
`calculateSpellCheck`'s patron-path sets `castInput.patron` and
triggers `handleWizardFumble` → `rollPatronTaint`. Load the patron
taint table via the same `toLibSimpleTable` adapter session 3
introduced (extract a shared table loader if the shape matches —
likely yes). Broaden the adapter gate to include patron-bound
wizard / elf actors: remove `!hasPatron` from the wizard branch
once the migration is complete. Tests: wizard-castingMode item on
a patron-bound wizard → adapter; patron taint triggers on
appropriate fumbles; legacy path still works for non-patron-bound
wizards (now covered by session 2 path) and XCC variants that keep
`className === 'Wizard'` with novel patrons.

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
