/**
 * Attack-events adapter — reserved for lib `CombatEvents` bridges.
 *
 * Phase 3 sessions 5-6 migrated damage / crit / fumble without wiring
 * combat events: those paths use the two-pass observational pattern
 * (see `_rollDamageViaAdapter` for damage, and `_rollCritical` /
 * `_rollFumble` in `actor.js` post-D2 single-path retirement) where
 * Foundry's `DCCRoll.createRoll` remains the source of truth for chat +
 * anchor totals, and the lib is called purely to populate
 * `dcc.libDamageResult` / `dcc.libCritResult` / `dcc.libFumbleResult`
 * flags. Events (`onCriticalThreat`, `onFumbleRoll`, `onDamageRoll`,
 * `onAttackRoll`, `onDeedAttempt`) will be wired here only when a
 * later slice needs lib-driven side effects — e.g. lib-native
 * crit-table lookup replacing `getCritTableResult`.
 */

export {}
