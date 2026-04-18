/**
 * Adapter dispatch logging.
 *
 * Emits a single-line console log at every adapter / legacy dispatch
 * so each code path is identifiable in the Foundry console. Centralized
 * here so the tag stays consistent across every dispatcher branch.
 *
 * Permanent infrastructure: `browser-tests/e2e/phase1-adapter-dispatch.spec.js`
 * captures these lines via Playwright and asserts every dispatcher
 * branch end-to-end. Every new `_xxxViaAdapter` / `_xxxLegacy` method
 * in later phases must call `logDispatch` as its first line.
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
