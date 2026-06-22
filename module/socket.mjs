/* global game, ui */

/**
 * Native system socket (channel `system.dcc`) for privileged, GM-side
 * operations a player client cannot perform itself — applying damage or status
 * effects to tokens the player doesn't own, and similar. Foundry gives every
 * system its own socket channel, so this needs no `socketlib` dependency.
 *
 * Exactly one client executes any given action: the **active GM**
 * (`game.users.activeGM`), the deterministic GM Foundry designates for
 * GM-side work. With several GMs connected an action still runs once.
 *
 * Consumers register a handler with {@link registerSocketHandler} and request
 * it with {@link executeAsGM}; when the caller is the active GM the handler
 * runs locally (no round-trip), otherwise it is emitted for the GM to run.
 */

export const DCC_SOCKET = 'system.dcc'

const handlers = new Map()

/**
 * Register a GM-side handler for a socket action. The handler only ever runs
 * on the active GM's client.
 *
 * @param {string} action - unique action name
 * @param {(payload: any) => any | Promise<any>} handler
 */
export function registerSocketHandler (action, handler) {
  handlers.set(action, handler)
}

/**
 * Whether this client is the GM responsible for handling GM-side work — the
 * single active GM Foundry designates. Used to ensure GM-side reactions run
 * exactly once even with several GMs connected.
 */
export function isActiveGM () {
  return !!game.user?.isGM && game.user === game.users?.activeGM
}

async function runHandler (action, payload) {
  const handler = handlers.get(action)
  if (!handler) {
    console.warn(`DCC | No socket handler registered for action '${action}'`)
    return undefined
  }
  return handler(payload)
}

/**
 * Socket message dispatcher. Only the active GM acts on an incoming message;
 * every other client ignores it.
 */
export async function onSocketMessage (message) {
  if (!message || !isActiveGM()) return
  await runHandler(message.action, message.payload)
}

/**
 * Request that the active GM perform a registered action. If this client is the
 * active GM the handler runs locally; otherwise the request is emitted for the
 * GM to handle. No-op (with a warning) when no GM is connected.
 *
 * @param {string} action - a registered action name
 * @param {any} payload - serializable data for the handler
 * @returns {Promise<any>} the handler's result when run locally, else undefined
 */
export async function executeAsGM (action, payload) {
  if (isActiveGM()) return runHandler(action, payload)
  if (!game.users?.activeGM) {
    ui.notifications?.warn(game.i18n.localize('DCC.SocketNoGMWarning'))
    return undefined
  }
  game.socket.emit(DCC_SOCKET, { action, payload })
  return undefined
}

/**
 * Wire the socket listener and expose the request API on `game.dcc.socket` for
 * modules and macros. Call once after `game.socket` is available (the `ready`
 * hook).
 */
export function registerSocket () {
  game.socket.on(DCC_SOCKET, onSocketMessage)
  if (game.dcc) game.dcc.socket = { registerSocketHandler, executeAsGM }
}
