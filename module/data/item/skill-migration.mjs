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

  const migrated = die.replace(/\s*[+-]\s*@CL\s*/gi, '')
  if (migrated === die) return null

  return { die: migrated || '1d20', useLevel: true }
}
