/**
 * Class Progression Utilities
 *
 * This module provides utilities for working with class progression data.
 *
 * IMPORTANT: This library does NOT include official class data.
 * Official class progressions must be loaded from your own data source
 * and registered using registerClassProgression() or registerClassProgressions().
 *
 * @example
 * ```typescript
 * import { registerClassProgressions, getSavingThrows } from "@moonloch/dcc-core-lib";
 * import { ALL_CLASS_PROGRESSIONS } from "./my-class-data.js"; // your own data
 *
 * // Register at app startup
 * registerClassProgressions(ALL_CLASS_PROGRESSIONS);
 *
 * // Use utilities
 * const saves = getSavingThrows("warrior", 5);
 * ```
 */
export * from "./progression-utils.js";
