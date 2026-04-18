/**
 * Phase 1 dispatch logging.
 *
 * Emits a single-line console log at every adapter / legacy dispatch
 * so we can verify in the Foundry console which code path fired when
 * testing end-to-end. Centralized here so the tag stays consistent and
 * so there's exactly one place to rip it out when Phase 1 lands.
 *
 * Remove this module and its call sites at the close of Phase 1 (after
 * skill + init migrations have been verified in Foundry).
 */

/**
 * @param {string} rollType - e.g. 'rollSavingThrow', 'rollAbilityCheck'
 * @param {'adapter'|'legacy'} path - which branch the dispatcher chose
 * @param {Object} [details] - small extra context (serialized inline)
 */
export function logDispatch (rollType, path, details = {}) {
  const tag = path === 'adapter' ? 'via adapter' : 'LEGACY path'
  const extras = Object.entries(details)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ')
  console.log(
    `[DCC adapter] ${rollType} \u2192 ${tag}${extras ? ' ' + extras : ''}`
  )
}
