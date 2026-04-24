/**
 * Random Source Types
 *
 * Interfaces for random number generation.
 * Allows injection of deterministic sources for testing.
 */
/**
 * Create a random source using Math.random().
 * This is the default for production use.
 */
export function createDefaultRandomSource() {
    return {
        roll(sides) {
            return Math.floor(Math.random() * sides) + 1;
        },
        rollMultiple(count, sides) {
            const results = [];
            for (let i = 0; i < count; i++) {
                results.push(this.roll(sides));
            }
            return results;
        },
        randomIndex(max) {
            return Math.floor(Math.random() * max);
        },
        pick(array) {
            if (array.length === 0)
                return undefined;
            return array[this.randomIndex(array.length)];
        },
    };
}
/**
 * Create a seeded random source for reproducible results.
 * Uses a simple LCG (Linear Congruential Generator).
 *
 * @param seed - Initial seed value
 */
export function createSeededRandomSource(seed) {
    // LCG parameters (same as glibc)
    const a = 1103515245;
    const c = 12345;
    const m = 2 ** 31;
    let state = seed;
    function next() {
        state = (a * state + c) % m;
        return state / m; // Returns 0 to <1
    }
    return {
        roll(sides) {
            return Math.floor(next() * sides) + 1;
        },
        rollMultiple(count, sides) {
            const results = [];
            for (let i = 0; i < count; i++) {
                results.push(this.roll(sides));
            }
            return results;
        },
        randomIndex(max) {
            return Math.floor(next() * max);
        },
        pick(array) {
            if (array.length === 0)
                return undefined;
            return array[this.randomIndex(array.length)];
        },
    };
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
export function createMockRandomSource(queue) {
    const rolls = [...(queue.rolls ?? [])];
    const indices = [...(queue.indices ?? [])];
    return {
        roll(_sides) {
            return rolls.shift() ?? 1;
        },
        rollMultiple(count, sides) {
            const results = [];
            for (let i = 0; i < count; i++) {
                results.push(this.roll(sides));
            }
            return results;
        },
        randomIndex(_max) {
            return indices.shift() ?? 0;
        },
        pick(array) {
            if (array.length === 0)
                return undefined;
            return array[this.randomIndex(array.length)];
        },
    };
}
/**
 * Default random source instance.
 * Use this when you don't need reproducibility or testing.
 */
export const defaultRandomSource = createDefaultRandomSource();
//# sourceMappingURL=random.js.map