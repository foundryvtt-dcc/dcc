/* eslint-disable no-undef -- Browser globals used in page.evaluate */
const { expect, createSessionTest } = require('./fixtures')

/**
 * Native system socket (module/socket.mjs) end-to-end against live Foundry.
 * The session logs in as Gamemaster — the active GM — so this exercises the
 * local-run branch of executeAsGM through the live API the system wired at
 * ready and exposed on game.dcc.socket. The cross-client emit branch is
 * covered by unit tests.
 */
const test = createSessionTest()

test.describe('System socket', () => {
  test('the active GM runs a registered handler locally via game.dcc.socket', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const ranWith = []
      game.dcc.socket.registerSocketHandler('dcc-e2e-probe', (payload) => {
        ranWith.push(payload)
        return { echoed: payload.n * 2 }
      })
      const returned = await game.dcc.socket.executeAsGM('dcc-e2e-probe', { n: 21 })
      return {
        exposed: typeof game.dcc.socket?.executeAsGM === 'function',
        isActiveGM: game.user === game.users.activeGM,
        hasSocket: !!game.socket,
        ranWith,
        returned
      }
    })

    expect(result.exposed).toBe(true) // registerSocket wired the API at ready
    expect(result.hasSocket).toBe(true)
    expect(result.isActiveGM).toBe(true) // GM session resolves as the active GM
    expect(result.ranWith).toEqual([{ n: 21 }]) // handler ran locally with the payload
    expect(result.returned).toEqual({ echoed: 42 }) // and its result came back
  })
})
