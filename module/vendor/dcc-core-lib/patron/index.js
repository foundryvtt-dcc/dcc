/**
 * Patron Module
 *
 * Complete patron system for DCC wizards and elves including:
 * - Patron registration and lookup
 * - Invoke Patron spell mechanics
 * - Patron bond formation and management
 * - Patron spell grants
 * - Taint tracking
 */
// Registry
export { registerPatron, registerPatrons, clearPatronRegistry, getPatron, requirePatron, hasPatron, getRegisteredPatronIds, getAllPatrons, findPatrons, getPatronInvokeTableId, getPatronTaintTableId, getPatronSpells, getPatronCount, } from "./registry.js";
// Invoke Patron
export { INVOKE_PATRON_MIN_SUCCESS, INVOKE_PATRON_FUMBLE_TRIGGERS_TAINT, buildInvokeModifiers, sumModifiers, buildInvokeFormula, invokePatron, isInvokeSuccess, isInvokeFumble, getInvokeSummary, getMinimumForInvokeTier, estimateInvokeSuccessChance, } from "./invoke.js";
// Patron Bond
export { createPatronBond, canFormPatronBond, getCharacterPatronId, hasPatronBond, formWizardPatronBond, formElfPatronBond, getAvailablePatronSpells, canLearnPatronSpell, createPatronSpellEntry, incrementTaintCount, addTaintToNotes, getPatronBondBreakConsequences, canBreakPatronBond, } from "./bond.js";
//# sourceMappingURL=index.js.map