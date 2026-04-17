/**
 * Renders dcc-core-lib result objects into Foundry ChatMessages.
 *
 * Library functions return structured result types (`SkillCheckResult`,
 * `AttackResult`, `SpellCastResult`, etc.) with no presentation. This
 * module is where those turn into chat cards that match the DCC system's
 * existing visual design and flags contract — so downstream integrations
 * (`dcc-qol`, `token-action-hud-dcc`) that parse chat messages keep working.
 *
 * Responsibilities (to be implemented during Phase 1+):
 *   - Render skill / ability / save / init results from
 *     `SkillCheckResult`
 *   - Render attack / damage / crit / fumble from `CombatResult` and
 *     friends, preserving the chat-card flags and data-attributes that
 *     `dcc-qol` depends on (see its `chatCardActions/handle*Click.js`)
 *   - Render spell check results including disapproval / spellburn /
 *     patron-taint / mercurial magic outcomes
 *
 * Phase 0: stub. No implementation yet.
 */

export {}