/**
 * Foundry → dcc-core-lib character accessor adapter.
 *
 * dcc-core-lib is pure and agnostic: it does not know about Foundry actors,
 * TypeDataModel, Active Effects, or embedded documents. Instead, every lib
 * function that needs character data accepts a `CharacterAccessors`
 * implementation (see `@moonloch/dcc-core-lib` `checks/accessors.ts`).
 *
 * This module is the single place where Foundry `DCCActor` shapes get
 * translated into the flat, post-Active-Effects data the library expects.
 *
 * Responsibilities (to be implemented during Phase 1+):
 *   - Ability score extraction (with modifiers) from `actor.system.abilities`
 *   - Class id, level, and alignment extraction
 *   - Class-specific state (deed die, luck die, disapproval range, spellbook)
 *   - Equipment / armor / shield extraction for AC and attack resolution
 *   - Feeding *post-Active-Effects* values — AEs are applied by Foundry before
 *     `prepareDerivedData` runs, so by the time we hand data to the lib, AE
 *     modifications are already baked in.
 *
 * Everything the library consumes should flow through here. Do not reach
 * into `actor.system.*` directly from other adapter files.
 *
 * Phase 0: stub. No implementations yet.
 */

export {}
