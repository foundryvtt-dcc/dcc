/**
 * Tests for spellburn validation and application.
 *
 * Regression focus: a physical ability may be burned all the way to 0.
 * Per DCC RAW spellburn has no floor of 1 — burning Stamina to 0 is
 * lethal, and that lethality is an intentional rules feature. These
 * tests pin the floor-0 contract so it cannot silently regress to the
 * old "can't go below 1" behavior.
 */
export {};
//# sourceMappingURL=spellburn.test.d.ts.map