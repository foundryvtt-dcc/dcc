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
2. `docs/dev/ARCHITECTURE_REIMAGINED.md §7` — the 7-phase plan.
3. `docs/dev/EXTENSION_API.md` — what sibling modules consume (stable /
   internal / dead).
4. `module/vendor/dcc-core-lib/../../../../WebstormProjects/dcc-core-lib/docs/MODIFIERS.md`
   — lib-side design doc for the tagged-union `RollModifier` type the
   adapter emits and consumes.

**Status:** Phase 0 complete. Phase 1 partially complete —
`rollAbilityCheck` is migrated. Next roll to migrate: `rollSavingThrow`.
`@moonloch/dcc-core-lib@0.4.0` is vendored at
`module/vendor/dcc-core-lib/`. The lib uses a tagged-union
`RollModifier` (add, add-dice, set-die, bump-die, multiply, threat-shift,
display). Wave-1 migration complete in the lib (checks, skills, dice,
cleric); combat/spells/patron/occupation still use `LegacyRollModifier`
pending their own phases.

**This session's goal:** migrate `DCCActor.rollSavingThrow` to the
adapter, following the same pattern already locked in for
`rollAbilityCheck`. Land it as its own commit; the system should stay
shippable throughout.

**The adapter pattern to follow (not the earlier async-roller shape):**

Ability checks use a **two-pass sync flow**, not the async-roller
variant. Do the same for saves. Reference:
`DCCActor._rollAbilityCheckViaAdapter` in `module/actor.js`.

```js
async _rollSavingThrowViaAdapter (saveId, options) {
  const character = actorToCharacter(this)

  // Pass 1: ask the lib for the formula (no evaluation).
  const plan = libRollSavingThrow(saveId, character, { mode: 'formula' })

  // Foundry rolls the FULL formula so its Roll.total includes modifiers.
  const foundryRoll = new Roll(plan.formula)
  await foundryRoll.evaluate()

  const natural = foundryRoll.dice?.[0]?.total ?? foundryRoll.total

  // Pass 2: lib classifies (crit/fumble/resources) against the same natural.
  const result = libRollSavingThrow(saveId, character, {
    mode: 'evaluate',
    roller: () => natural
  })

  return renderSavingThrow({ actor: this, saveId, result, foundryRoll })
}
```

**Do NOT use `rollSavingThrowAsync` with `createFoundryRoller`.** That
path looks cleaner but Foundry's Roll only sees the bare dice expression
("1d20"), not the full formula — the chat card ends up showing the
wrong total (missing modifiers). This was a bug we hit and fixed in
commit `5a9bae6`; re-read that commit if you need the full rationale.

**Save-id remapping is already handled** in
`module/adapter/character-accessors.mjs`:
- Foundry uses `frt` / `ref` / `wil` on `actor.system.saves.*`
- The lib uses `fortitude` / `reflex` / `will`
- `actorToCharacter` translates, and `libSaveIdToFoundry` /
  `foundrySaveIdToLib` are available for two-way mapping.

When calling `libRollSavingThrow`, pass the **lib** save id
(`reflex`/`fortitude`/`will` or namespaced `save:reflex` etc.). The
existing `DCCActor.rollSavingThrow` accepts the Foundry shorthand
(`'frt'`, `'ref'`, `'wil'`). Translate at the adapter boundary using
`foundrySaveIdToLib`.

**Dual-track dispatcher:** mirror the ability-check dispatcher. Route
to legacy when `options.showModifierDialog` or `options.rollUnder` is
truthy (bitwise XOR from `actor-sheet.js:1433` returns 0/1, so use
`!!` not `=== true`).

**Chat-renderer:** add a `renderSavingThrow` export to
`module/adapter/chat-renderer.mjs`. Preserve the flag contract the
legacy path sets — check `_rollSavingThrowLegacy` (once you've
extracted it) for: `flags['dcc.RollType'] = 'SavingThrow'`,
`flags['dcc.Save'] = saveId`, `flags['dcc.isSave'] = true`, and a
`flavor` of `<SaveLabel> Save` (plus DC suffix behavior if applicable).

**Tests required before committing** — all three kinds, matching the
ability-check pattern:

1. **Unit test (mock-based):** new
   `module/__tests__/adapter-saving-throw.test.js` modeled on
   `adapter-ability-check.test.js`. Exercises actor →
   `actorToCharacter` → two-pass → chat-renderer against the Foundry
   mocks in `module/__mocks__/`. Runs in every environment.
2. **Integration test (real Foundry dice):** new
   `module/__integration__/adapter-saving-throw.test.js` modeled on
   the existing `module/__integration__/adapter-ability-check.test.js`.
   Gate dice-requiring cases with
   `const describeIfDice = hasDiceEngine ? describe : describe.skip`.
   The `actorToCharacter` shape checks can run always-on. The dice
   cases should verify: save-id remap round-trip, Foundry Roll total
   matches `natural + ability-mod + save-bonus`, `result.total` ==
   `foundryRoll.total`, crit / fumble classification, and that the
   modifier breakdown contains both the ability (`origin.category ==
   'ability'`) and the save bonus (`origin.id == 'save-bonus'`)
   entries with `applied: true`.
3. **Existing-test update:** `module/__tests__/actor.test.js` has a
   `roll saving throw` test that currently asserts
   `dccRollCreateRollMock` was called with specific terms. After the
   migration it'll hit the adapter path — relax those assertions to
   `expect.objectContaining(...)` the same way the ability-check test
   at lines ~43–80 was relaxed.

**Running tests:**

- `npm test` — runs unit + integration projects, both gated on Foundry
  being available. Always the final check before committing.
- `npm run test:unit` — unit project only (mock-based). Runs in every
  environment; use this during iteration.
- `npm run test:integration` — integration project only. Skips
  everything if Foundry isn't detected (env var `FOUNDRY_PATH`,
  `.foundry-dev/` in project root, or `~/Applications/foundry-14`
  etc.).
- The **8 dice-engine-gated** tests in `adapter-ability-check.test.js`
  (and the equivalent ones you add for saves) only execute if
  `.foundry-dev/client/dice/` exists. Check with
  `ls .foundry-dev/client/dice` — if missing, run
  `npm run setup:foundry` once to populate it. Without that, the dice
  cases **skip** (not fail); the status line will show
  `N passed | M skipped` rather than a clean pass. Before claiming the
  integration suite is green, confirm the skip count dropped by the
  number of new dice cases you added.

**DCC saves-combine-both note:** in DCC the save bonus is `ability mod
+ class save bonus`. The lib handles this via its save-check
`SkillDefinition` (references an ability) + a save-bonus modifier
injected in `rollCheck`. Verify the modifier breakdown shows both:
`origin.category === 'ability'` (e.g. `agl` for reflex) and
`origin.category === 'other'` with `id: 'save-bonus'`. The formula
should be `1d20 + <abilityMod> + <saveBonus>` collapsed to a single
trailing sum.

**Verification after landing:**
- `npm test` — all unit + gated integration tests pass. If the dice
  cases skipped, run `npm run setup:foundry` first and re-run
  `npm run test:integration` to confirm the new dice-gated cases
  actually exercise.
- In Foundry: click each of the three saves on a Player sheet, confirm
  chat total matches `raw d20 + ability mod + save bonus`. Check that
  `game.messages.contents.at(-1).getFlag('dcc', 'libResult')` returns
  the structured result with both ability and save-bonus modifiers.

**Constraints:**
- Small commits; each leaves the system in a working state.
- Four sibling modules must keep working:
  `../../modules/{dcc-qol,xcc,mcc-classes,dcc-crawl-classes}`. The
  stable surface in `EXTENSION_API.md` is load-bearing — in particular
  `DCCActor.rollSavingThrow` must keep its signature and its emitted
  flags.
- The pre-commit hook runs `npm run format && git add . && npm test`
  — that `git add .` sweeps untracked files, so stash or `.gitignore`
  them first (or use `git stash push -- <paths>` to park the untracked
  test file during the vendor-sync commit, then restore).

**Remaining open questions** (tracked in `00-progress.md`; none block
Phase 1's save migration):
- #2 package-name discrepancy — resolved in spirit by vendoring, can be
  closed out.
- #3 dead `dcc.update` hook — coordinate with XCC maintainer.
- #4 stabilizing undocumented `game.dcc.*` pieces — Phase 3 concern.

Start by reading the four docs above, then diff `module/actor.js` in
commit `e992c32` + `5a9bae6` to see the full shape of the
ability-check adapter before copying it for saves.
