/**
 * Foundry compendium → dcc-core-lib data loader adapter.
 *
 * dcc-core-lib registers tables and class progressions at runtime via
 * `registerTable`, `registerClassProgression`, and `registerXPThresholds`
 * (see `@moonloch/dcc-core-lib` `data/classes/progression-utils.ts` and
 * `tables/registry.ts`). The library doesn't care where the data comes
 * from — filesystem, HTTP, or Foundry packs.
 *
 * Responsibilities (to be implemented during Phase 1+):
 *   - Load rollable tables from Foundry compendia and register them with
 *     the lib's table registry
 *   - Load class progression data (currently in `dcc-core-book`'s
 *     `dcc-class-level-data` pack, plus extensions in `dcc-crawl-classes`
 *     and `xcc-core-book`) and feed `registerClassProgressions`
 *   - Honor the existing dcc.registerLevelDataPack / setFumbleTable / etc.
 *     hook-based pack registration — content modules keep emitting those;
 *     this loader consumes what the system has accumulated and forwards
 *     it into the lib's registries
 *
 * Phase 0: stub. No implementation yet.
 */

export {}
