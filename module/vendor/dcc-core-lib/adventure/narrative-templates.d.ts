/**
 * Narrative Encounter Templates
 *
 * Pre-built templates for non-combat encounters:
 * exploration, traps, puzzles, social, and environmental.
 */
import type { NarrativeTemplate, NarrativeCategory } from "./types.js";
/**
 * All available narrative templates, keyed by ID.
 */
export declare const NARRATIVE_TEMPLATES: Record<string, NarrativeTemplate>;
/**
 * Get a random template from a specific category.
 */
export declare function getRandomTemplate(category: NarrativeCategory): NarrativeTemplate | undefined;
/**
 * Get a template by ID.
 */
export declare function getTemplateById(id: string): NarrativeTemplate | undefined;
/**
 * Get all templates in a category.
 */
export declare function getTemplatesByCategory(category: NarrativeCategory): NarrativeTemplate[];
/**
 * Get all available categories.
 */
export declare function getAvailableCategories(): NarrativeCategory[];
//# sourceMappingURL=narrative-templates.d.ts.map