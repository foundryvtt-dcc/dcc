/**
 * Bridge between dcc-core-lib event callbacks and Foundry's Hooks API.
 *
 * The library uses callback injection for events (see
 * `@moonloch/dcc-core-lib` `docs/EVENTS.md`): each lib function accepts an
 * optional events object (`SkillEvents`, `CombatEvents`, `SpellEvents`, …)
 * whose methods fire at well-defined points. It does not depend on any
 * global pub/sub — each integration provides its own bridge.
 *
 * Responsibilities (to be implemented during Phase 1+):
 *   - `createSkillEvents()` — translate `SkillEvents` callbacks to
 *     `Hooks.callAll('dcc.*')` calls consistent with existing DCC hooks
 *   - `createCombatEvents()` — same for combat (attack/damage/crit/fumble/init)
 *   - `createSpellEvents()` — same for spells, including the disapproval /
 *     spellburn / patron-taint / mercurial effects currently wired in
 *     `processSpellCheck` in `dcc.js`
 *
 * Stable hooks that must keep firing during migration (see docs/dev/
 * EXTENSION_API.md): `dcc.rollWeaponAttack`, `dcc.modifyAttackRollTerms`,
 * `dcc.postActorImport`, etc.
 *
 * Phase 0: stub. No implementation yet.
 */

export {}
