/**
 * Pure migration functions for skill data
 * No Foundry dependencies - can be imported anywhere
 */

/**
 * Migrate legacy @CL expressions in skill die fields
 * Users previously added +@CL or -@CL to die expressions to add character level.
 * This is now handled by the useLevel config option.
 *
 * @param {string} die - The die expression to migrate
 * @returns {{ die: string, useLevel: boolean } | null} - Migrated values, or null if no migration needed
 */
export function migrateSkillDie (die) {
  if (!die || typeof die !== 'string') return null

  const clPattern = /\s*[+-]\s*@CL\s*/gi
  if (!clPattern.test(die)) return null

  // Reset lastIndex after test() call since we use the global flag
  clPattern.lastIndex = 0
  let migrated = die.replace(clPattern, '')

  // If removing @CL left the die empty, default to 1d20
  if (!migrated) {
    migrated = '1d20'
  }

  return { die: migrated, useLevel: true }
}
