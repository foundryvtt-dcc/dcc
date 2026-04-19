/**
 * Attack-events adapter (Phase 3 session 2 — stub).
 *
 * Mirrors `spell-events.mjs`. Future sessions will wire Foundry-side
 * side effects to the lib's `CombatEvents`:
 *   - `onAttackRoll` — no-op for now (attack chat is produced by
 *     `rollWeaponAttack` tail post-adapter).
 *   - `onCriticalThreat` — eventually drives crit-table lookup when
 *     crit rolls migrate off of `getCritTableResult`.
 *   - `onFumbleRoll` — fumble-table lookup analog of the above.
 *   - `onDamageRoll` — when damage migrates to `rollDamage`.
 *   - `onDeedAttempt` — deed-die migration.
 *
 * Session 2 exports nothing — the simplest-weapon happy-path doesn't
 * need side effects.
 */

export {}
