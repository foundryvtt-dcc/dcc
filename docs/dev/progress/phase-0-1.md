# Phase 0 + Phase 1 — Scaffolding + Simple Rolls

> Archive of session-by-session detail for Phase 0 (adapter scaffold +
> hook audit) and Phase 1 (ability check, saving throw, skill check,
> initiative through the adapter). See
> [`docs/dev/ARCHITECTURE_REIMAGINED.md §7`](../ARCHITECTURE_REIMAGINED.md)
> for the phase plan and [`00-progress.md`](../../00-progress.md) for
> current state + open questions.

---

## Phase 0 — 2026-04-17 (first session)

- Created worktree on branch `refactor/dcc-core-lib-adapter` off `main`
  (`2337ec0`). Worktree now lives at
  `/Users/timwhite/FoundryVTT-Next/Data/systems/dcc` (moved 2026-04-17 —
  see Decisions §1 in `00-progress.md` for the updated location rationale).
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

---

## Phase 1 — 2026-04-18

### Session 1 (second session overall) — `rollAbilityCheck`

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

### Session 2 (third session overall) — `rollSavingThrow`

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
  click. Initially planned to rip out at Phase 1 close — that plan
  was reversed at Phase 1 close; the logs are now permanent
  infrastructure because the Playwright dispatch spec asserts on
  them.

### Session 3 (fourth session overall) — `rollSkillCheck`

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

### Session 4 (fifth session overall) — initiative

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

---

## Phase 1 close-out

All four rolls migrated through the adapter: `rollAbilityCheck`,
`rollSavingThrow`, `rollSkillCheck`, and initiative (via
`getInitiativeRoll`). A Playwright adapter-dispatch spec
(`browser-tests/e2e/phase1-adapter-dispatch.spec.js`, 20 tests
after the Phase 2 session 1–3 extensions) validates every
dispatcher branch end-to-end by asserting on the `[DCC adapter]`
console logs from `module/adapter/debug.mjs`. All 20 passing
against live v14 Foundry as of 2026-04-18.

**Dispatch-logging decision (2026-04-18):** `debug.mjs` +
`logDispatch` are PERMANENT infrastructure, not a Phase 1 scaffold.
The earlier plan to strip them at phase close is cancelled — the
Playwright spec depends on them for automated validation, and
`getInitiativeRoll` emits no chat message that could substitute as
an assertion target. Later phases add their own `logDispatch` calls
and extend the browser-test spec.
