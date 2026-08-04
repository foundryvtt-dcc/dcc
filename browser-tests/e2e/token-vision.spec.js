/* eslint-disable no-undef -- Browser globals used in page.evaluate */
const { expect, createSessionTest } = require('./fixtures')

/**
 * Owned-token vision (issue #872): while the `dcc.ownedTokenVision` world
 * setting is on (the default), a non-GM player's owned sighted tokens keep
 * providing vision even while another token is controlled — the case core
 * suppresses (an uncontrolled token is only a vision source when no sighted
 * token is controlled), which made a funnel character that walked out of
 * the controlled token's sight invisible and unclickable.
 *
 * The suite runs as Gamemaster and the rule is non-GM only, so the
 * behavioral tests spoof `game.user.isGM` to false as an instance property
 * for the duration of a single evaluate (restored in a finally), with an
 * explicit OWNER ownership entry so permission checks don't depend on GM
 * status.
 */

const test = createSessionTest()

/** Create a probe scene with token vision plus two owned, sighted tokens. */
async function setupTokens (page) {
  return page.evaluate(async () => {
    const prevSceneId = game.canvas.scene?.id ?? null
    const scene = await Scene.create({ name: 'DCC TokenVision Probe', width: 4000, height: 3000, tokenVision: true, grid: { type: 1, size: 100, distance: 5, units: 'ft' } })
    // view() is refused while a previous scene switch is still loading, and
    // control() no-ops while the canvas is loading — retry until the probe
    // scene is actually viewed and ready
    const viewDeadline = Date.now() + 15000
    while (Date.now() < viewDeadline && !(game.canvas.ready && game.canvas.scene?.id === scene.id)) {
      if (game.canvas.scene?.id !== scene.id) {
        try { await scene.view() } catch { /* still loading — retry */ }
      }
      await new Promise(resolve => setTimeout(resolve, 200))
    }

    const makeActor = name => Actor.create({
      name,
      type: 'Player',
      ownership: { [game.user.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER },
      prototypeToken: { actorLink: true, sight: { enabled: true } }
    })
    const controller = await makeActor('DCC TokenVision Controller')
    const companion = await makeActor('DCC TokenVision Companion')

    const [controllerToken, companionToken] = await scene.createEmbeddedDocuments('Token', [
      { name: 'Controller', actorId: controller.id, actorLink: true, x: 500, y: 500, sight: { enabled: true } },
      { name: 'Companion', actorId: companion.id, actorLink: true, x: 2500, y: 2500, sight: { enabled: true } }
    ])
    const deadline = Date.now() + 3000
    while (Date.now() < deadline && !(game.canvas.tokens.get(controllerToken.id) && game.canvas.tokens.get(companionToken.id))) {
      await new Promise(resolve => setTimeout(resolve, 50))
    }

    return {
      prevSceneId,
      sceneId: scene.id,
      actorIds: [controller.id, companion.id],
      controllerTokenId: controllerToken.id,
      companionTokenId: companionToken.id
    }
  })
}

/** Restore the setting, view the previous scene, and delete the probe docs. */
async function cleanupTokens (page, setup) {
  await page.evaluate(async ({ prevSceneId, sceneId, actorIds }) => {
    await game.settings.set('dcc', 'ownedTokenVision', true)
    game.canvas.tokens.releaseAll()
    // Scene switches are refused while the canvas is still loading
    const deadline = Date.now() + 10000
    while (Date.now() < deadline && !game.canvas.ready) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    if (prevSceneId) await game.scenes.get(prevSceneId)?.view()
    await game.scenes.get(sceneId)?.delete()
    for (const id of actorIds) await game.actors.get(id)?.delete()
  }, setup)
}

/**
 * Control the controller token, then evaluate the companion's vision-source
 * status as a spoofed non-GM under both the DCC override and core's rule.
 */
async function probeVisionSources (page, setup) {
  return page.evaluate(async ({ controllerTokenId, companionTokenId }) => {
    const controller = game.canvas.tokens.get(controllerTokenId)
    const companion = game.canvas.tokens.get(companionTokenId)
    // control() can silently no-op right after a scene switch — retry until it takes
    const deadline = Date.now() + 5000
    while (Date.now() < deadline && !controller.controlled) {
      controller.control({ releaseOthers: true })
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    Object.defineProperty(game.user, 'isGM', { value: false, configurable: true })
    try {
      return {
        controllerControlled: controller.controlled,
        companionControlled: companion.controlled,
        dccVisionSource: companion._isVisionSource(),
        coreVisionSource: foundry.canvas.placeables.Token.prototype._isVisionSource.call(companion)
      }
    } finally {
      delete game.user.isGM
    }
  }, setup)
}

test.describe('Owned-token vision (issue #872)', () => {
  test('registers the world setting (default on) and the DCCToken placeable class', async ({ page }) => {
    const info = await page.evaluate(() => {
      const config = game.settings.settings.get('dcc.ownedTokenVision')
      return {
        scope: config?.scope,
        default: config?.default,
        tokenClassName: CONFIG.Token.objectClass.name,
        extendsCoreToken: CONFIG.Token.objectClass.prototype instanceof foundry.canvas.placeables.Token
      }
    })
    expect(info.scope).toBe('world')
    expect(info.default).toBe(true)
    expect(info.tokenClassName).toBe('DCCToken')
    expect(info.extendsCoreToken).toBe(true)
  })

  test('an owned token keeps providing vision while another token is controlled', async ({ page }) => {
    const setup = await setupTokens(page)
    try {
      const result = await probeVisionSources(page, setup)
      expect(result.controllerControlled).toBe(true)
      expect(result.companionControlled).toBe(false)
      // Core's rule suppresses the uncontrolled token — the #872 failure mode
      expect(result.coreVisionSource).toBe(false)
      // The DCC override keeps it a vision source, so it stays rendered and clickable
      expect(result.dccVisionSource).toBe(true)
    } finally {
      await cleanupTokens(page, setup)
    }
  })

  test('standard Foundry vision applies while the setting is off', async ({ page }) => {
    const setup = await setupTokens(page)
    try {
      await page.evaluate(() => game.settings.set('dcc', 'ownedTokenVision', false))
      const result = await probeVisionSources(page, setup)
      expect(result.dccVisionSource).toBe(false)
    } finally {
      await cleanupTokens(page, setup)
    }
  })
})
