/**
 * Random Source Types
 *
 * Interfaces for random number generation.
 * Allows injection of deterministic sources for testing.
 */
/**
 * Source of randomness for dice rolls and selections.
 *
 * Implementations:
 * - `createDefaultRandomSource()` - Uses Math.random()
 * - `createSeededRandomSource(seed)` - Reproducible results
 * - `createMockRandomSource(values)` - Predetermined values for testing
 */
export interface RandomSource {
    /**
     * Roll a single die, returning a value from 1 to sides (inclusive).
     * @param sides - Number of sides on the die (e.g., 6 for d6)
     * @returns A value from 1 to sides
     */
    roll(sides: number): number;
    /**
     * Roll multiple dice of the same type.
     * @param count - Number of dice to roll
     * @param sides - Number of sides on each die
     * @returns Array of individual die results
     */
    rollMultiple(count: number, sides: number): number[];
    /**
     * Pick a random index from 0 to max-1.
     * Useful for selecting from arrays.
     * @param max - Exclusive upper bound
     * @returns A value from 0 to max-1
     */
    randomIndex(max: number): number;
    /**
     * Pick a random element from an array.
     * @param array - Array to pick from
     * @returns A random element, or undefined if array is empty
     */
    pick<T>(array: readonly T[]): T | undefined;
}
/**
 * Create a random source using Math.random().
 * This is the default for production use.
 */
export declare function createDefaultRandomSource(): RandomSource;
/**
 * Create a seeded random source for reproducible results.
 * Uses a simple LCG (Linear Congruential Generator).
 *
 * @param seed - Initial seed value
 */
export declare function createSeededRandomSource(seed: number): RandomSource;
/**
 * Queue of predetermined values for mock random source.
 */
export interface MockRandomQueue {
    /** Predetermined die roll results (consumed in order) */
    rolls?: number[];
    /** Predetermined index selections (consumed in order) */
    indices?: number[];
}
/**
 * Create a mock random source with predetermined values.
 * Useful for testing specific scenarios.
 *
 * When the queue is exhausted, falls back to returning 1 for rolls
 * and 0 for indices.
 *
 * @param queue - Predetermined values to return
 */
export declare function createMockRandomSource(queue: MockRandomQueue): RandomSource;
/**
 * Default random source instance.
 * Use this when you don't need reproducibility or testing.
 */
export declare const defaultRandomSource: RandomSource;
//# sourceMappingURL=random.d.ts.map