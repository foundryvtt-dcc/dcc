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
`rollAbilityCheck` and `rollSavingThrow` are both migrated. Next roll
to migrate: `rollSkillCheck`. `@moonloch/dcc-core-lib@0.4.0` is
vendored at `module/vendor/dcc-core-lib/`. The lib uses a tagged-union
`RollModifier` (add, add-dice, set-die, bump-die, multiply,
threat-shift, display). Wave-1 migration complete in the lib (checks,
skills, dice, cleric); combat/spells/patron/occupation still use
`LegacyRollModifier` pending their own phases.

**This session's goal:** migrate `DCCActor.rollSkillCheck` to the
adapter, following the same two-pass pattern locked in for
`rollAbilityCheck` and `rollSavingThrow`. Land it as its own commit;
the system should stay shippable throughout. This is the most complex
Phase 1 migration — skill checks have more branches than abilities or
saves. Scope ruthlessly: skill items + built-in skills with a die go
through the adapter; the "description-only / no meaningful terms"
path and the `showModifierDialog` path stay on the legacy
implementation for this session.

**The adapter pattern to follow (not the earlier async-roller shape):**

Both ability checks and saves use a **two-pass sync flow**, not the
async-roller variant. Do the same for skills. Reference:
`DCCActor._rollSavingThrowViaAdapter` in `module/actor.js` — it's the
freshest copy of the pattern.

```js
async _rollSkillCheckViaAdapter (skillId, options) {
  logDispatch('rollSkillCheck', 'adapter', { skillId })

  const { definition, skillLabel, abilityId } = this._resolveSkill(skillId) // see below
  const character = actorToCharacter(this)

  // Pass 1: ask the lib for the formula (no evaluation).
  const plan = libRollCheck(definition, character, { mode: 'formula' })

  const foundryRoll = new Roll(plan.formula)
  await foundryRoll.evaluate()

  const natural = foundryRoll.dice?.[0]?.total ?? foundryRoll.total

  // Pass 2: lib classifies (crit/fumble/resources) against the same natural.
  const result = libRollCheck(definition, character, {
    mode: 'evaluate',
    roller: () => natural
  })

  return renderSkillCheck({
    actor: this,
    skillId,
    skillLabel,
    abilityId,
    result,
    foundryRoll
  })
}
```

**Do NOT use `rollCheckAsync` with `createFoundryRoller`.** That path
looks cleaner but Foundry's Roll only sees the bare dice expression
(e.g. "1d20"), not the full formula — the chat card ends up showing
the wrong total (missing modifiers). This was a bug we hit and fixed
in commit `5a9bae6`; re-read that commit if you need the full
rationale.

**Skill resolution is the tricky part.** The existing
`DCCActor.rollSkillCheck` dispatcher at roughly `actor.js:1280` is
one big function — split the "figure out what SkillDefinition /
ability / die this is" logic into its own helper so the adapter and
the legacy path can share it. Two kinds of input:

- **Built-in skill** — `this.system.skills[skillId]` exists. Carries
  `label`, optional `ability`, optional `die` (e.g. `'d14'`, `'d24'`),
  optional `value` (numeric modifier), `config.useLevel`,
  `config.applyCheckPenalty`, `useDeed`, `useDisapprovalRange`.
- **Skill item** — found via `this.itemTypes.skill.find(i => i.name
  === skillId)`. Populates similar fields from `skillItem.system.*`
  based on `skillItem.system.config.use{Ability,Die,Value,Level}`.

Either case collapses to a lib `SkillDefinition` with an `id` of
`skill:<skillId>`, a `roll.die` (e.g. `'d14'` if non-default —
propagate through the lib's `set-die` modifier if you want action-die
as the base with an override), and a `roll.ability` for the ability
mod. The skill `value` comes through as a situational `add` modifier;
`skill.level` is another `add`; `useDeed` is another `add`.

**Carve-outs that stay on the legacy path for this session:**

1. The **description-only** branch (skill item with no meaningful
   terms — currently `if (terms.length === 0 || !hasMeaningfulTerms)`
   posts a description ChatMessage and returns early). Don't try to
   model this in the lib. Route to legacy.
2. **`options.showModifierDialog`** → legacy. Same dispatcher
   structure as saves: `!!options.showModifierDialog` plus any other
   bail-outs you discover. Use the `needsLegacyPath` const pattern.
3. **`useDisapprovalRange`** with `spellCheckOverrideDie` — this is a
   cleric mechanic; the lib's cleric module handles disapproval
   differently. If exercising the adapter for this would force a lib
   change, route to legacy and leave a TODO. Do not land a lib change
   in the same commit as the adapter migration.

**Custom dice (`d14`, `d24`)** are fine through the lib. The lib's
`set-die` modifier on a `SkillDefinition` with a `d20` base swaps the
die, and the check pipeline classifies crit/fumble on the actual die
faces. Integration tests must cover a `d14` and a `d24` skill.

**Chat-renderer:** add a `renderSkillCheck` export to
`module/adapter/chat-renderer.mjs`. Preserve the flag contract the
legacy path sets — the existing message at `actor.js:1398` (the
description-only early return) and the main `toMessage` further down
both set: `flags['dcc.RollType'] = 'SkillCheck'`,
`flags['dcc.SkillId'] = skillId`, `flags['dcc.isSkillCheck'] = true`,
and (for skill items) `flags['dcc.ItemId'] = skillId`. Flavor is
`${localized(skill.label)}${abilityLabel}` where `abilityLabel` is
`" (Strength)"` etc. Keep all of that verbatim.

**Dispatch debug logging is still on.** `module/adapter/debug.mjs`
exports `logDispatch(rollType, 'adapter'|'legacy', details)`. Call
it as the first line of both `_rollSkillCheckViaAdapter` and
`_rollSkillCheckLegacy`. Do **not** strip the existing log calls on
ability-check / save — all four stay until Phase 1 fully lands, then
one cleanup commit removes `debug.mjs` + every call site. See the
"Debug logging (temporary — Phase 1 only)" section of
`docs/00-progress.md`.

**Tests required before committing** — all three kinds, matching the
save pattern:

1. **Unit test (mock-based):** new
   `module/__tests__/adapter-skill-check.test.js` modeled on
   `adapter-saving-throw.test.js`. Exercises actor →
   `actorToCharacter` → skill-resolution helper → two-pass →
   chat-renderer against the Foundry mocks in `module/__mocks__/`.
   Runs in every environment. Cover: a built-in skill with a die, a
   built-in skill that routes to legacy (description-only), a skill
   item with custom die, the `dcc.SkillId` / `dcc.ItemId` flag shape.
2. **Integration test (real Foundry dice):** new
   `module/__integration__/adapter-skill-check.test.js` modeled on
   `adapter-saving-throw.test.js`. Gate dice-requiring cases with
   `const describeIfDice = hasDiceEngine ? describe : describe.skip`.
   Dice cases should verify: Foundry Roll total matches
   `natural + ability-mod + skill-value (+ level if applicable)`,
   `result.total` == `foundryRoll.total`, crit / fumble classification
   on the correct die faces (natural max on `d14` = crit, not just on
   `d20`), and that custom dice propagate through the formula.
3. **Existing-test update:** `module/__tests__/actor.test.js` has
   `roll skill check` tests that currently assert
   `dccRollCreateRollMock` was called with specific terms. After the
   migration the adapter-path tests need `objectContaining` the same
   way the ability-check and save tests were relaxed. Legacy-path
   tests (description-only, dialog) should still assert the exact
   legacy call.

**Running tests:**

- `npm test` — runs unit + integration projects. Always the final
  check before committing.
- `npm run test:unit` — unit project only (mock-based). Runs in
  every environment; use this during iteration.
- `npm run test:integration` — integration project only. Skips
  everything if Foundry isn't detected (env var `FOUNDRY_PATH`,
  `.foundry-dev/` in project root, or `~/Applications/foundry-14`
  etc.).
- The **9 dice-engine-gated** tests in `adapter-saving-throw.test.js`
  (and the equivalent ones you add for skills) only execute if
  `.foundry-dev/client/dice/` exists. Check with
  `ls .foundry-dev/client/dice` — if missing, run
  `npm run setup:foundry` once to populate it. Without that, the
  dice cases **skip** (not fail); the status line will show
  `N passed | M skipped` rather than a clean pass. Before claiming
  the integration suite is green, confirm the skip count dropped by
  the number of new dice cases you added.

**Verification after landing:**
- `npm test` — all unit + gated integration tests pass. If dice cases
  skipped, run `npm run setup:foundry` first and re-run
  `npm run test:integration` to confirm the new dice-gated cases
  actually exercise.
- In Foundry: click each of the built-in skills + at least one skill
  item on a Player sheet. Watch the console for
  `[DCC adapter] rollSkillCheck → via adapter skillId=...` vs
  `→ LEGACY path`. Confirm chat totals and flavors match the
  pre-migration output.

**Constraints:**
- Small commits; each leaves the system in a working state.
- Four sibling modules must keep working:
  `../../modules/{dcc-qol,xcc,mcc-classes,dcc-crawl-classes}`. The
  stable surface in `EXTENSION_API.md` is load-bearing — in particular
  `DCCActor.rollSkillCheck` must keep its signature and its emitted
  flags (including `dcc.ItemId` when the caller passed a skill item
  name).
- The pre-commit hook runs `npm run format && git add . && npm test`
  — that `git add .` sweeps untracked files, so stash or `.gitignore`
  them first (or use `git stash push -- <paths>` to park untracked
  test files during any vendor-sync commit, then restore).

**Remaining open questions** (tracked in `00-progress.md`; none block
Phase 1's skill migration):
- #2 package-name discrepancy — resolved in spirit by vendoring, can
  be closed out.
- #3 dead `dcc.update` hook — coordinate with XCC maintainer.
- #4 stabilizing undocumented `game.dcc.*` pieces — Phase 3 concern.

Start by reading the four docs above, then diff `module/actor.js` at
the current HEAD to see the full shape of the ability-check + save
adapters (and the centralized `logDispatch` pattern) before copying
it for skills.
