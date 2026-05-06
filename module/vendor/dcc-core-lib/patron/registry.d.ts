/**
 * Patron Registry
 *
 * Registry for patron definitions loaded from external JSON.
 * Patrons are registered at application startup and looked up during play.
 */
import type { PatronDefinition, PatronLookupOptions } from "../types/patron.js";
/**
 * Register a patron definition.
 *
 * @param patron - The patron definition to register
 * @throws Error if patron with same ID already exists
 */
export declare function registerPatron(patron: PatronDefinition): void;
/**
 * Register multiple patron definitions.
 *
 * @param patrons - Array of patron definitions to register
 */
export declare function registerPatrons(patrons: readonly PatronDefinition[]): void;
/**
 * Clear all registered patrons.
 * Primarily for testing purposes.
 */
export declare function clearPatronRegistry(): void;
/**
 * Get a patron by ID.
 *
 * @param patronId - The patron's unique identifier
 * @returns The patron definition, or undefined if not found
 */
export declare function getPatron(patronId: string): PatronDefinition | undefined;
/**
 * Get a patron by ID, throwing if not found.
 *
 * @param patronId - The patron's unique identifier
 * @returns The patron definition
 * @throws Error if patron is not registered
 */
export declare function requirePatron(patronId: string): PatronDefinition;
/**
 * Check if a patron is registered.
 *
 * @param patronId - The patron's unique identifier
 * @returns True if patron is registered
 */
export declare function hasPatron(patronId: string): boolean;
/**
 * Get all registered patron IDs.
 *
 * @returns Array of registered patron IDs
 */
export declare function getRegisteredPatronIds(): string[];
/**
 * Get all registered patrons.
 *
 * @returns Array of all patron definitions
 */
export declare function getAllPatrons(): PatronDefinition[];
/**
 * Find patrons matching the given criteria.
 *
 * @param options - Lookup/filter options
 * @returns Array of matching patron definitions
 */
export declare function findPatrons(options: PatronLookupOptions): PatronDefinition[];
/**
 * Get the invoke table ID for a patron.
 *
 * @param patronId - The patron's unique identifier
 * @returns The invoke table ID, or undefined if patron not found
 */
export declare function getPatronInvokeTableId(patronId: string): string | undefined;
/**
 * Get the taint table ID for a patron.
 *
 * @param patronId - The patron's unique identifier
 * @returns The taint table ID, or undefined if patron not found
 */
export declare function getPatronTaintTableId(patronId: string): string | undefined;
/**
 * Get spells granted by a patron.
 *
 * @param patronId - The patron's unique identifier
 * @param casterLevel - Optional level filter (only return spells available at this level)
 * @returns Array of spell grant info
 */
export declare function getPatronSpells(patronId: string, casterLevel?: number): PatronDefinition["grantedSpells"];
/**
 * Get the number of registered patrons.
 *
 * @returns Number of registered patrons
 */
export declare function getPatronCount(): number;
//# sourceMappingURL=registry.d.ts.map