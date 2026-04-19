/**
 * Reserved — Foundry-side bridge from lib event callbacks to
 * `Hooks.callAll('dcc.*')` emissions.
 *
 * The original Phase 0 design centralized all event bridges here.
 * The code diverged: Phase 2 put spell events in `spell-events.mjs`
 * (`createSpellEvents`), Phase 3 deliberately skipped wiring combat
 * events in favor of the two-pass observational pattern (see
 * `attack-events.mjs`). This module stays as a placeholder for
 * any future cross-domain event plumbing that doesn't fit the
 * per-domain files.
 */

export {}
