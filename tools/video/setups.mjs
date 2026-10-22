/* global game, Actor, ChatMessage, CONFIG, ui, foundry */
/**
 * Named world setups for storyboards. Each runs in the page and returns the
 * ids of everything it created, so the runner can delete them after the take
 * (camera-named documents escape the specs' `E2E ` cleanup).
 */
export const setups = {
  'mighty-deeds': async (page) => page.evaluate(async () => {
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
    await actor.createEmbeddedDocuments('Item', [{
      name: 'Longsword',
      type: 'weapon',
      system: { actionDie: '1d20', toHit: '@ab', damage: '1d8+@ab', melee: true, equipped: true }
    }])
    const swapSetting = async (ns, key, value) => {
      const previous = game.settings.get(ns, key)
      await game.settings.set(ns, key, value)
      return previous
    }
    // Offer the core book's deed tables on the card (the card captures the list
    // at roll time), and drop any table a spec run left behind.
    for (const table of game.tables.filter(t => t.name.startsWith('E2E '))) await table.delete()
    const deedCompendium = await swapSetting('dcc', 'mightyDeedsCompendium', 'dcc-core-book.dcc-core-deed-tables')
    const deadlineTables = Date.now() + 5000
    while (Date.now() < deadlineTables && !Object.keys(CONFIG.DCC.mightyDeedsTables).length) await new Promise(resolve => setTimeout(resolve, 50))
    // A targeted foe, so the card reports a hit instead of "only if it hits".
    const goblin = await Actor.create({
      name: 'Goblin',
      type: 'NPC',
      img: 'icons/svg/skull.svg',
      flags: { dcc: { videoFixture: true } },
      system: { attributes: { hp: { value: 5, max: 5 }, ac: { value: 10 } } },
      prototypeToken: { actorLink: true }
    })
    const scene = game.canvas.scene
    const [tokenDoc] = await scene.createEmbeddedDocuments('Token', [{ name: 'Goblin', actorId: goblin.id, actorLink: true, x: 800, y: 300, width: 1, height: 1, disposition: -1 }])
    const deadline = Date.now() + 3000
    while (Date.now() < deadline && !game.canvas.tokens.get(tokenDoc.id)) await new Promise(resolve => setTimeout(resolve, 50))
    game.canvas.tokens.get(tokenDoc.id).setTarget(true, { releaseOthers: true })
    return { actorIds: [actor.id, goblin.id], tokenIds: [tokenDoc.id], settings: { 'dcc.enhancedAttackCards': await swapSetting('dcc', 'enhancedAttackCards', true), 'dcc.mightyDeedsCompendium': deedCompendium } }
  })
}

/** Delete what a setup created, plus chat from the take. */
export async function teardown (page, created) {
  await page.evaluate(async ({ actorIds, tokenIds, settings }) => {
    game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: false }))
    if (tokenIds?.length) await game.canvas.scene.deleteEmbeddedDocuments('Token', tokenIds.filter(id => game.canvas.scene.tokens.has(id)))
    for (const [key, value] of Object.entries(settings ?? {})) await game.settings.set(...key.split(/\.(.*)/s, 2), value)
    for (const id of actorIds ?? []) await game.actors.get(id)?.delete()
    for (const actor of game.actors.filter(a => a.getFlag('dcc', 'videoFixture'))) await actor.delete()
  }, created)
}

/** Put the client in a camera-ready state: chat open, nothing stray on screen. */
export async function prepareStage (page) {
  await page.evaluate(async () => {
    for (const app of foundry.applications.instances.values()) {
      if (app.id !== 'sidebar' && app.hasFrame) await app.close()
    }
    await ChatMessage.deleteDocuments(game.messages.map(m => m.id))
    ui.sidebar.expand()
    ui.sidebar.changeTab('chat', 'primary')
    if (game.paused) game.togglePause(false, { broadcast: true })
  })
}
