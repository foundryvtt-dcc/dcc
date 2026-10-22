/* global game, Actor, ChatMessage, CONFIG, ui, foundry, window */
/**
 * Named world setups for storyboards. Each runs in the page and records what
 * it creates in `window.videoCreated` as it goes, so teardown can undo a setup
 * that failed partway (camera-named documents escape the specs' `E2E `
 * cleanup).
 */
export const setups = {
  'mighty-deeds': async (page) => page.evaluate(async () => {
    const created = window.videoCreated
    const actor = await Actor.create({
      name: 'Brannoc the Bold',
      type: 'Player',
      img: 'icons/svg/sword.svg',
      flags: { dcc: { videoFixture: true }, core: { sheetClass: 'dcc.DCCActorSheetWarrior' } },
      system: {
        details: { sheetClass: 'Warrior', attackBonus: '+d3', level: { value: 1 } },
        class: { className: 'Warrior' },
        config: { attackBonusMode: 'autoPerAttack' },
        abilities: { str: { value: 16 } }
      }
    })
    created.actorIds.push(actor.id)
    await actor.createEmbeddedDocuments('Item', [{
      name: 'Longsword',
      type: 'weapon',
      system: { actionDie: '1d20', toHit: '@ab', damage: '1d8+@ab', melee: true, equipped: true }
    }])
    const swapSetting = async (ns, key, value) => {
      created.settings[`${ns}.${key}`] ??= game.settings.get(ns, key)
      await game.settings.set(ns, key, value)
    }
    await swapSetting('dcc', 'enhancedAttackCards', true)
    // Offer the core book's deed tables on the card (the card captures the list
    // at roll time), and drop any table a spec run left behind.
    for (const table of game.tables.filter(t => t.name.startsWith('E2E '))) await table.delete()
    await swapSetting('dcc', 'mightyDeedsCompendium', 'dcc-core-book.dcc-core-deed-tables')
    await waitFor(() => Object.keys(CONFIG.DCC.mightyDeedsTables).length, 5000, 'core book deed tables (is dcc-core-book active?)')
    // A targeted foe, so the card reports a hit instead of "only if it hits".
    const goblin = await Actor.create({
      name: 'Goblin',
      type: 'NPC',
      img: 'icons/svg/skull.svg',
      flags: { dcc: { videoFixture: true } },
      system: { attributes: { hp: { value: 5, max: 5 }, ac: { value: 10 } } },
      prototypeToken: { actorLink: true }
    })
    created.actorIds.push(goblin.id)
    const scene = game.canvas.scene
    if (!scene) throw new Error('no scene is being viewed to place the target token on')
    created.sceneId = scene.id
    const [tokenDoc] = await scene.createEmbeddedDocuments('Token', [{ name: 'Goblin', actorId: goblin.id, actorLink: true, x: 800, y: 300, width: 1, height: 1, disposition: -1 }])
    created.tokenIds.push(tokenDoc.id)
    await waitFor(() => game.canvas.tokens.get(tokenDoc.id), 3000, 'the Goblin token on the canvas')
    game.canvas.tokens.get(tokenDoc.id).setTarget(true, { releaseOthers: true })

    async function waitFor (test, ms, what) {
      const deadline = Date.now() + ms
      while (!test()) {
        if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`)
        await new Promise(resolve => setTimeout(resolve, 50))
      }
    }
  })
}

/**
 * Undo what prepareStage and the setup recorded. Every step runs even if an
 * earlier one fails; the failures are thrown together afterwards.
 */
export async function teardown (page) {
  const failures = await page.evaluate(async () => {
    const { actorIds = [], tokenIds = [], sceneId, settings = {}, paused } = window.videoCreated ?? {}
    const scene = game.scenes.get(sceneId)
    const steps = [
      () => game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: false })),
      () => scene?.deleteEmbeddedDocuments('Token', tokenIds.filter(id => scene.tokens.has(id))),
      ...Object.entries(settings).map(([key, value]) => () => game.settings.set(...key.split(/\.(.*)/s, 2), value)),
      ...actorIds.map(id => () => game.actors.get(id)?.delete()),
      () => Promise.all(game.actors.filter(a => a.getFlag('dcc', 'videoFixture')).map(a => a.delete())),
      () => paused && !game.paused && game.togglePause(true, { broadcast: true })
    ]
    const failures = []
    for (const step of steps) {
      try { await step() } catch (e) { failures.push(e.message) }
    }
    return failures
  })
  if (failures.length) throw new Error(`teardown left the world dirty: ${failures.join('; ')}`)
}

/**
 * Put the client in a camera-ready state: chat open and empty, nothing stray
 * on screen, unpaused. Deletes every chat message in the world, which is why
 * capture refuses to run against the live world.
 */
export async function prepareStage (page) {
  await page.evaluate(async () => {
    window.videoCreated = { actorIds: [], tokenIds: [], settings: {}, paused: game.paused }
    // Clear fixtures a failed run left behind, so getName finds this run's.
    await Promise.all(game.actors.filter(a => a.getFlag('dcc', 'videoFixture')).map(a => a.delete()))
    for (const app of foundry.applications.instances.values()) {
      if (app.id !== 'sidebar' && app.hasFrame) await app.close()
    }
    await ChatMessage.deleteDocuments(game.messages.map(m => m.id))
    ui.sidebar.expand()
    ui.sidebar.changeTab('chat', 'primary')
    if (game.paused) game.togglePause(false, { broadcast: true })
  })
}
