/**
 * Foundry-flavored implementation of the lib's `SpellEvents` callback
 * interface (see `@moonloch/dcc-core-lib/spells/*` exports).
 *
 * dcc-core-lib emits spell-casting events via callback injection — on
 * the same principle as `foundry-events.mjs` but with a spell-specific
 * method surface: `onSpellCheckStart`, `onSpellCheckComplete`,
 * `onCritical`, `onFumble`, `onSpellLost`, `onCorruptionTriggered`,
 * `onPatronTaint`, `onDisapprovalIncreased`, `onSpellburnApplied`,
 * `onMercurialEffect`.
 *
 * Phase 2 scope (staged across multiple sessions):
 *   - Session 1 (this session): stub. The generic-castingMode adapter
 *     path dispatches without side effects, so no event handlers are
 *     wired yet.
 *   - Session 2: `onSpellLost` drives wizard spell loss (replaces
 *     `actor.loseSpell(item)` call in `processSpellCheck` in
 *     `module/dcc.js`).
 *   - Session 3: `onDisapprovalIncreased` drives cleric disapproval
 *     (replaces the disapproval-range bump + `rollDisapproval` path).
 *   - Session 4: `onPatronTaint` drives the d100 taint roll + chance
 *     bump currently interleaved in `processSpellCheck`.
 *   - Session 5: `onSpellburnApplied` drives the ability-score update,
 *     `onMercurialEffect` drives the mercurial-magic chat append.
 *
 * Each handler bridges a pure lib event to the equivalent Foundry
 * side effect (`actor.update`, chat-message creation, hook emission)
 * while the lib stays platform-agnostic.
 */

export {}
