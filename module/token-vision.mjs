/* global CONFIG, canvas, foundry, game */

/**
 * Vision from all owned tokens (issue #872).
 *
 * Core's `Token#_isVisionSource` only lets an uncontrolled token provide
 * vision while the player controls no other sighted token, so a player
 * running several characters (a funnel) loses the rest of the party's
 * vision the moment they select one token — and a character outside the
 * controlled token's line of sight stops rendering entirely and cannot be
 * clicked or drag-selected to recover. That suppression is deliberate core
 * design (foundryvtt#11016) with no core setting to relax it.
 *
 * While the `ownedTokenVision` world setting is on (the default), the
 * DCCToken placeable registered here also treats every owned/observed,
 * sighted, non-hidden token as a vision source for non-GM players. A token
 * that is a vision source is always rendered (`Token#isVisible`
 * short-circuits on `this.vision?.active`), so the separated character
 * stays visible and selectable with no extra visibility handling. GM
 * vision is unchanged.
 */

/**
 * Would this token provide vision under the owned-token-vision rule?
 *
 * Mirrors core `_isVisionSource`'s own requirements — scene token vision
 * on, sight enabled, viewed level, not hidden, OBSERVER-or-better on the
 * actor (core's fallback rule uses OBSERVER, not OWNER) — minus the
 * "player controls another sighted token" suppression.
 *
 * @param {foundry.canvas.placeables.Token} token
 * @returns {boolean}
 */
export function isOwnedTokenVisionSource (token) {
  if (game.user.isGM) return false
  if (!game.settings.get('dcc', 'ownedTokenVision')) return false
  if (!canvas.visibility.tokenVision || !token.hasSight) return false
  if (token.document.level !== canvas.level.id) return false
  if (token.document.hidden) return false
  return token.actor?.testUserPermission(game.user, 'OBSERVER') ?? false
}

/**
 * Register the DCCToken placeable class onto `CONFIG.Token.objectClass`.
 * Runs at `init` (module/init-hook.mjs). Core re-runs `_isVisionSource`
 * for every token on control/release/update, so the override needs no
 * hook plumbing of its own; toggling the setting mid-session is handled
 * by its `onChange` perception refresh (module/settings.js).
 */
export function registerTokenVision () {
  class DCCToken extends foundry.canvas.placeables.Token {
    /** @override */
    _isVisionSource () {
      return super._isVisionSource() || isOwnedTokenVisionSource(this)
    }
  }
  CONFIG.Token.objectClass = DCCToken
}
